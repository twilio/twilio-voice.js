import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent, waitFor } from '../../tests/lib/util';

describe('setInputDevice while a call is connecting', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  let caller: Device;
  let callee: Device;
  let calleeIdentity: string;
  // Holds the call's default-device request until released, so setInputDevice() settles first.
  let releaseDefault: () => void;
  let defaultRequest: Promise<MediaStream>;

  beforeEach(async () => {
    calleeIdentity = 'callee-' + Date.now();
    const defaultHold = new Promise<void>(resolve => { releaseDefault = resolve; });
    caller = new Device(await generateAccessToken('caller-' + Date.now()));
    callee = new Device(await generateAccessToken(calleeIdentity), {
      getUserMedia: (constraints: MediaStreamConstraints) => {
        const audio: any = constraints.audio;
        const stream = navigator.mediaDevices.getUserMedia(constraints);
        if (audio && typeof audio === 'object' && audio.deviceId) {
          return stream;
        }
        defaultRequest = stream.then(s => defaultHold.then(() => s));
        return defaultRequest;
      },
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
    releaseDefault();
    await waitFor(accept, 15000);

    const late = await defaultRequest;

    assert.strictEqual(callError, null);
    assert.strictEqual(call.status(), Call.State.Open);
    assert.strictEqual(call.getLocalStream()!.getAudioTracks()[0], callee.audio!.inputStream!.getAudioTracks()[0]);
    assert.strictEqual(late.getAudioTracks()[0].readyState, 'ended');
  });
});
