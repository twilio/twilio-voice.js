import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent, waitFor } from '../../tests/lib/util';

// Delays only the call's default-device request, so setInputDevice() settles first.
function delayedDefaultGetUserMedia(constraints: MediaStreamConstraints): Promise<MediaStream> {
  const audio: any = constraints.audio;
  const isDefaultDevice = !(audio && typeof audio === 'object' && audio.deviceId);
  const stream = navigator.mediaDevices.getUserMedia(constraints);
  return isDefaultDevice
    ? stream.then(s => new Promise(resolve => setTimeout(() => resolve(s), 3000)))
    : stream;
}

describe('setInputDevice while a call is connecting', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  let caller: Device;
  let callee: Device;
  let calleeIdentity: string;

  beforeEach(async () => {
    calleeIdentity = 'callee-' + Date.now();
    caller = new Device(await generateAccessToken('caller-' + Date.now()));
    callee = new Device(await generateAccessToken(calleeIdentity), {
      getUserMedia: delayedDefaultGetUserMedia,
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

  it('should connect using the selected input device', async () => {
    const incoming: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await caller.connect({ params: { To: calleeIdentity } });
    const call = await incoming;

    let callError: any = null;
    call.on('error', error => { callError = error; });
    const accept = expectEvent('accept', call);

    const deviceId = Array.from(callee.audio!.availableInputDevices.keys())[0];
    call.accept();
    await callee.audio!.setInputDevice(deviceId);
    await waitFor(accept, 15000);

    assert.strictEqual(callError, null);
    assert.strictEqual(call.status(), Call.State.Open);
    const track = call.getLocalStream()!.getAudioTracks()[0];
    assert.strictEqual(track.getSettings().deviceId, deviceId);
  });
});
