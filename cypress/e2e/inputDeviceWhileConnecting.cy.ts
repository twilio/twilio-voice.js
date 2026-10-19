import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent, grantMicPermission, waitFor } from '../../tests/lib/util';

describe('setInputDevice while a call is connecting', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  let caller: Device;
  let callee: Device;
  let calleeIdentity: string;
  // Holds the call's default-device request until released, so setInputDevice() settles first.
  let releaseDefault: () => void;
  let defaultRequest: Promise<MediaStream>;
  // When set, the held default-device request fails with this error once released.
  let defaultFailure: Error | null;

  beforeEach(async () => {
    calleeIdentity = 'callee-' + Date.now();
    const defaultHold = new Promise<void>(resolve => { releaseDefault = resolve; });
    defaultFailure = null;
    caller = new Device(await generateAccessToken('caller-' + Date.now()));
    callee = new Device(await generateAccessToken(calleeIdentity), {
      getUserMedia: (constraints: MediaStreamConstraints) => {
        const audio: any = constraints.audio;
        const stream = navigator.mediaDevices.getUserMedia(constraints);
        if (audio && typeof audio === 'object' && audio.deviceId) {
          return stream;
        }
        defaultRequest = stream.then(s => defaultHold.then(() => {
          if (defaultFailure) {
            s.getTracks().forEach(track => track.stop());
            throw defaultFailure;
          }
          return s;
        }));
        return defaultRequest;
      },
    } as any);
    await callee.register();
    await grantMicPermission(callee);
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

  it('should keep the selected input device when the default request then fails', async () => {
    const incoming: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await caller.connect({ params: { To: calleeIdentity } });
    const call = await incoming;

    let callError: any = null;
    call.on('error', error => { callError = error; });
    const accept = expectEvent('accept', call);

    const deviceId = Array.from(callee.audio!.availableInputDevices.keys())[0];
    call.accept();
    await callee.audio!.setInputDevice(deviceId);
    defaultFailure = new DOMException('forced getUserMedia failure', 'NotReadableError');
    releaseDefault();
    await waitFor(accept, 15000);

    assert.strictEqual(callError, null);
    assert.strictEqual(call.status(), Call.State.Open);
    assert.strictEqual(call.getLocalStream()!.getAudioTracks()[0], callee.audio!.inputStream!.getAudioTracks()[0]);
  });

  it('should switch the selected device again before the call has a peer connection', async () => {
    const incoming: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await caller.connect({ params: { To: calleeIdentity } });
    const call = await incoming;
    const accept = expectEvent('accept', call);

    const deviceId = Array.from(callee.audio!.availableInputDevices.keys())[0];
    call.accept();
    await callee.audio!.setInputDevice(deviceId);
    // The call now has a stream but no peer connection, so this swap has no track to replace.
    // A forced restart, as a device change does, since Firefox fakes only one input device.
    await (callee.audio as any)._setInputDevice(deviceId, true);
    releaseDefault();
    await waitFor(accept, 15000);
    const late = await defaultRequest;

    assert.strictEqual(call.status(), Call.State.Open);
    assert.strictEqual(call.getLocalStream()!.getAudioTracks()[0], callee.audio!.inputStream!.getAudioTracks()[0]);
    assert.strictEqual(late.getAudioTracks()[0].readyState, 'ended');
  });

  it('should reject unsetInputDevice while the call is connecting', async () => {
    const incoming: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await caller.connect({ params: { To: calleeIdentity } });
    const call = await incoming;
    const accept = expectEvent('accept', call);

    const deviceId = Array.from(callee.audio!.availableInputDevices.keys())[0];
    call.accept();
    await callee.audio!.setInputDevice(deviceId);
    const unsetError = await callee.audio!.unsetInputDevice().then(() => null, error => error);
    releaseDefault();
    await waitFor(accept, 15000);

    assert.strictEqual(unsetError && unsetError.name, 'InvalidStateError');
    assert.strictEqual(call.status(), Call.State.Open);
  });
});
