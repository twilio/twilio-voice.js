import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent, waitFor } from '../../tests/lib/util';

// Fails the local answer, which reaches PeerConnection's onAnswerError.
function FailingAnswerRTCPeerConnection(configuration?: RTCConfiguration) {
  const pc: any = new RTCPeerConnection(configuration);
  pc.setLocalDescription = (_desc: any, _onSuccess?: Function, onError?: Function) => {
    const error = new Error('forced answer failure');
    if (typeof onError === 'function') {
      onError(error);
      return;
    }
    return Promise.reject(error);
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
    caller = new Device(await generateAccessToken('caller-' + Date.now()));
    callee = new Device(await generateAccessToken(calleeIdentity), {
      RTCPeerConnection: FailingAnswerRTCPeerConnection,
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

  it('should disconnect the call and leave the Device idle', async () => {
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
