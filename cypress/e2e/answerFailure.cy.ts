import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent, waitFor } from '../../tests/lib/util';

// The RTCPeerConnection method the callee's peer connection fails, set per test.
let failingMethod: 'setRemoteDescription' | 'setLocalDescription';
// When set, the failure waits until this resolves.
let failureHold: Promise<void> | null;

// Fails the offer (setRemoteDescription) or the answer (setLocalDescription),
// which reaches PeerConnection's onAnswerError either way.
function FailingRTCPeerConnection(configuration?: RTCConfiguration) {
  const pc: any = new RTCPeerConnection(configuration);
  pc[failingMethod] = (_desc: any, _onSuccess?: Function, onError?: Function) => {
    const error = new Error(`forced ${failingMethod} failure`);
    const hold = failureHold || Promise.resolve();
    if (typeof onError === 'function') {
      hold.then(() => onError(error));
      return;
    }
    return hold.then(() => Promise.reject(error));
  };
  return pc;
}

describe('Answer failure', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  let caller: Device;
  let callee: Device;
  let calleeIdentity: string;

  beforeEach(async () => {
    calleeIdentity = 'callee-' + Date.now();
    failureHold = null;
    caller = new Device(await generateAccessToken('caller-' + Date.now()));
    callee = new Device(await generateAccessToken(calleeIdentity), {
      RTCPeerConnection: FailingRTCPeerConnection,
    } as any);
    callee.on('error', () => { /* expected */ });
    await callee.register();
  });

  afterEach(() => {
    [caller, callee].forEach(device => {
      if (device) {
        device.disconnectAll();
        device.destroy();
      }
    });
  });

  ['setRemoteDescription', 'setLocalDescription'].forEach(method => {
    it(`should disconnect the call and leave the Device idle when ${method} fails`, async () => {
      failingMethod = method as typeof failingMethod;
      const incoming: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
      await caller.connect({ params: { To: calleeIdentity } });
      const call = await incoming;

      const error = expectEvent('error', call);
      const disconnect = expectEvent('disconnect', call);
      call.accept();
      assert.strictEqual(callee.isBusy, true);

      await waitFor([error, disconnect], 15000);

      assert.strictEqual(((await error) as any).code, 53402);
      assert.strictEqual(call.status(), Call.State.Closed);
      assert.strictEqual(callee.isBusy, false);
    });
  });

  it('should not emit an error when the answer fails after the call is closed', async () => {
    failingMethod = 'setRemoteDescription';
    let releaseFailure!: () => void;
    failureHold = new Promise<void>(resolve => { releaseFailure = resolve; });
    const incoming: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await caller.connect({ params: { To: calleeIdentity } });
    const call = await incoming;

    let callError: any = null;
    call.on('error', error => { callError = error; });
    call.accept();
    // The answer is in flight once the call has its peer connection.
    await waitFor(new Promise<void>(resolve => {
      const poll = () => (call as any)._mediaHandler.version ? resolve() : setTimeout(poll, 50);
      poll();
    }), 15000);

    const disconnect = expectEvent('disconnect', call);
    call.disconnect();
    await waitFor(disconnect, 15000);
    releaseFailure();
    // The rejection reaches onAnswerError within the same task.
    await new Promise(resolve => setTimeout(resolve, 0));

    assert.strictEqual(call.status(), Call.State.Closed);
    assert.strictEqual(callError, null);
  });
});
