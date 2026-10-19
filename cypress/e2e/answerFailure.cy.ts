import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent, waitFor } from '../../tests/lib/util';

// The RTCPeerConnection method the callee's peer connection fails, set per test.
let failingMethod: 'setRemoteDescription' | 'setLocalDescription';
// When set, the failure waits until this resolves.
let failureHold: Promise<void> | null;
// When set, called each time the failing method is reached.
let onFailingCall: (() => void) | null;
// When set, addTrack throws while the peer connection is being set up.
let failAddTrack: boolean;
// Each peer connection the callee created, in order.
let peerConnections: RTCPeerConnection[];

// Fails the offer (setRemoteDescription) or the answer (setLocalDescription),
// which reaches PeerConnection's onAnswerError either way.
function FailingRTCPeerConnection(configuration?: RTCConfiguration) {
  const pc: any = new RTCPeerConnection(configuration);
  peerConnections.push(pc);
  if (failAddTrack) {
    pc.addTrack = () => {
      throw new Error('forced addTrack failure');
    };
  }
  pc[failingMethod] = (_desc: any, _onSuccess?: Function, onError?: Function) => {
    const error = new Error(`forced ${failingMethod} failure`);
    if (onFailingCall) {
      onFailingCall();
    }
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
    onFailingCall = null;
    failAddTrack = false;
    peerConnections = [];
    caller = new Device(await generateAccessToken('caller-' + Date.now()));
    callee = new Device(await generateAccessToken(calleeIdentity), {
      RTCPeerConnection: FailingRTCPeerConnection,
    } as any);
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

  ['setRemoteDescription', 'setLocalDescription'].forEach(method => {
    it(`should not emit an error when ${method} fails after the call is closed`, async () => {
      failingMethod = method as typeof failingMethod;
      let releaseFailure!: () => void;
      failureHold = new Promise<void>(resolve => { releaseFailure = resolve; });
      const reached = new Promise<void>(resolve => { onFailingCall = resolve; });
      const incoming: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
      await caller.connect({ params: { To: calleeIdentity } });
      const call = await incoming;

      let callError: any = null;
      call.on('error', error => { callError = error; });
      call.accept();
      await waitFor(reached, 15000);

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

  it('should disconnect the call and leave the Device idle when its peer connection cannot be created', async () => {
    const incoming: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await caller.connect({ params: { To: calleeIdentity } });
    const call = await incoming;

    const error = expectEvent('error', call);
    const disconnect = expectEvent('disconnect', call);
    // A TURN server without credentials makes the RTCPeerConnection constructor throw.
    call.accept({ rtcConfiguration: { iceServers: [{ urls: 'turn:turn.example.com' }] } });
    await waitFor([error, disconnect], 15000);

    assert.strictEqual(((await error) as any).code, 31000);
    assert.strictEqual(call.status(), Call.State.Closed);
    assert.strictEqual(callee.isBusy, false);
  });

  it('should close the peer connection and disconnect the call when setting it up fails', async () => {
    failAddTrack = true;
    const incoming: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await caller.connect({ params: { To: calleeIdentity } });
    const call = await incoming;

    const error = expectEvent('error', call);
    const disconnect = expectEvent('disconnect', call);
    call.accept();
    await waitFor([error, disconnect], 15000);

    assert.strictEqual(((await error) as any).code, 31000);
    assert.strictEqual(call.status(), Call.State.Closed);
    assert.strictEqual(callee.isBusy, false);
    assert.strictEqual(peerConnections.length, 1);
    assert.strictEqual(peerConnections[0].signalingState, 'closed');
  });

  it('should disconnect an outgoing call whose peer connection cannot be created', async () => {
    const call = await callee.connect({
      params: { To: calleeIdentity },
      rtcConfiguration: { iceServers: [{ urls: 'turn:turn.example.com' }] },
    });

    const error = expectEvent('error', call);
    const disconnect = expectEvent('disconnect', call);
    await waitFor([error, disconnect], 15000);

    assert.strictEqual(((await error) as any).code, 31000);
    assert.strictEqual(call.status(), Call.State.Closed);
    assert.strictEqual(callee.isBusy, false);
  });
});
