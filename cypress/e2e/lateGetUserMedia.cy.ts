import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent, waitFor } from '../../tests/lib/util';

describe('Late getUserMedia results', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  let caller: Device;
  let callee: Device;
  let calleeIdentity: string;
  // Each default-device getUserMedia result (no deviceId constraint), in request order.
  let defaultRequests: Array<Promise<MediaStream>>;
  // When set, holds default-device results until it resolves.
  let holdDefault: Promise<void> | null;

  // Lets every pending promise callback chained on a settled request run.
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));

  beforeEach(async () => {
    calleeIdentity = 'callee-' + Date.now();
    defaultRequests = [];
    holdDefault = null;
    caller = new Device(await generateAccessToken('caller-' + Date.now()));
    callee = new Device(await generateAccessToken(calleeIdentity), {
      getUserMedia: (constraints: MediaStreamConstraints) => {
        const audio: any = constraints.audio;
        const stream = navigator.mediaDevices.getUserMedia(constraints);
        if (audio && typeof audio === 'object' && audio.deviceId) {
          return stream;
        }
        const hold = holdDefault;
        const result = hold ? stream.then(s => hold.then(() => s)) : stream;
        defaultRequests.push(result);
        return result;
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

  const incomingCall = async (): Promise<Call> => {
    const incoming: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await caller.connect({ params: { To: calleeIdentity } });
    return incoming;
  };

  it('should release a late default stream when the call ends after setInputDevice', async () => {
    // Firefox hides device IDs until microphone permission is granted.
    const permission = await navigator.mediaDevices.getUserMedia({ audio: true });
    permission.getTracks().forEach(track => track.stop());
    await (callee.audio as any)._updateAvailableDevices();
    const deviceId = Array.from(callee.audio!.availableInputDevices.keys())[0];

    const call = await incomingCall();
    let releaseDefault!: () => void;
    holdDefault = new Promise<void>(resolve => { releaseDefault = resolve; });
    call.accept();
    await callee.audio!.setInputDevice(deviceId);
    call.disconnect();

    releaseDefault();
    const late = await waitFor(defaultRequests[0], 15000).then(() => defaultRequests[0]);
    await settle();

    assert.strictEqual(call.status(), Call.State.Closed);
    assert.strictEqual(late.getAudioTracks()[0].readyState, 'ended');
  });

  it('should keep the new track after the default device is lost', async () => {
    const call = await incomingCall();
    const accept = expectEvent('accept', call);
    call.accept();
    await waitFor(accept, 15000);

    const lostTrack = call.getLocalStream()!.getAudioTracks()[0];
    lostTrack.stop();
    callee.audio!.emit('deviceChange', []);

    assert.strictEqual(defaultRequests.length, 2);
    const reopened = await waitFor(defaultRequests[1], 15000).then(() => defaultRequests[1]);
    await waitFor(new Promise<void>(resolve => {
      const poll = () => call.getLocalStream()!.getAudioTracks()[0] !== lostTrack ? resolve() : setTimeout(poll, 50);
      poll();
    }), 15000);

    assert.strictEqual(reopened.getAudioTracks()[0].readyState, 'live');
    assert.strictEqual(call.getLocalStream()!.getAudioTracks()[0].readyState, 'live');
  });
});
