import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent, grantMicPermission, waitFor } from '../../tests/lib/util';

describe('setInputDevice while a call is disconnecting', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  const replaceTrack = RTCRtpSender.prototype.replaceTrack;

  let caller: Device;
  let callee: Device;
  let calleeIdentity: string;

  beforeEach(async () => {
    calleeIdentity = 'callee-' + Date.now();
    caller = new Device(await generateAccessToken('caller-' + Date.now()));
    callee = new Device(await generateAccessToken(calleeIdentity));
    await callee.register();
    await grantMicPermission(callee);
  });

  afterEach(() => {
    RTCRtpSender.prototype.replaceTrack = replaceTrack;
    [caller, callee].forEach(device => {
      if (device) {
        device.disconnectAll();
        device.destroy();
      }
    });
  });

  let outgoing: Call;

  const acceptedCall = async (): Promise<Call> => {
    const incoming: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    outgoing = await caller.connect({ params: { To: calleeIdentity } });
    const call = await incoming;
    const accept = expectEvent('accept', call);
    call.accept();
    await waitFor(accept, 15000);
    return call;
  };

  const assertSwitched = async (call: Call, deviceId: string) => {
    assert.strictEqual(call.status(), Call.State.Closed);
    assert.strictEqual(call.getLocalStream(), null);
    assert.strictEqual(callee.audio!.inputDevice!.deviceId, deviceId);
    const track = callee.audio!.inputStream!.getAudioTracks()[0];
    assert.strictEqual(track.readyState, 'live');

    // The caller's call ends once the hangup reaches it, which frees its Device for the next call.
    if (outgoing.status() !== Call.State.Closed) {
      await waitFor(expectEvent('disconnect', outgoing), 10000);
    }
    const next = await acceptedCall();
    assert.strictEqual(next.getLocalStream()!.getAudioTracks()[0].id, track.id);
  };

  [true, false].forEach(closeFirst => {
    const when = closeFirst ? 'before replaceTrack runs' : 'while replaceTrack is in flight';

    it(`should keep the selected input device when the call closes ${when}`, async () => {
      const call = await acceptedCall();

      let swapStarted = false;
      RTCRtpSender.prototype.replaceTrack = function(track) {
        swapStarted = true;
        RTCRtpSender.prototype.replaceTrack = replaceTrack;
        if (closeFirst) {
          call.disconnect();
          return replaceTrack.call(this, track);
        }
        const result = replaceTrack.call(this, track);
        call.disconnect();
        return result;
      };

      const deviceId = Array.from(callee.audio!.availableInputDevices.keys())[0];
      await waitFor(callee.audio!.setInputDevice(deviceId), 10000);

      assert(swapStarted);
      await assertSwitched(call, deviceId);
    });
  });
});
