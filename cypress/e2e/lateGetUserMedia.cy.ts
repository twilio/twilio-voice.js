import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent, waitFor } from '../../tests/lib/util';

describe('Late getUserMedia results', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  let caller: Device;
  let callerB: Device | null;
  let callee: Device;
  let calleeIdentity: string;
  // Each default-device getUserMedia result (no deviceId constraint), in request order.
  let defaultRequests: Array<Promise<MediaStream>>;
  // Holds the default-device result with this request index until the promise resolves.
  let holds: Map<number, Promise<void>>;

  // Lets every pending promise callback chained on a settled request run.
  const settle = () => new Promise(resolve => setTimeout(resolve, 0));

  beforeEach(async () => {
    calleeIdentity = 'callee-' + Date.now();
    defaultRequests = [];
    holds = new Map();
    callerB = null;
    caller = new Device(await generateAccessToken('caller-' + Date.now()));
    callee = new Device(await generateAccessToken(calleeIdentity), {
      getUserMedia: (constraints: MediaStreamConstraints) => {
        const audio: any = constraints.audio;
        const stream = navigator.mediaDevices.getUserMedia(constraints);
        if (audio && typeof audio === 'object' && audio.deviceId) {
          return stream;
        }
        const hold = holds.get(defaultRequests.length);
        const result = hold ? stream.then(s => hold.then(() => s)) : stream;
        defaultRequests.push(result);
        return result;
      },
    } as any);
    await callee.register();
  });

  afterEach(() => {
    [caller, callerB, callee].forEach(device => {
      if (device) {
        device.disconnectAll();
        device.destroy();
      }
    });
  });

  const incomingCall = async (from: Device = caller): Promise<Call> => {
    const incoming: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await from.connect({ params: { To: calleeIdentity } });
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
    holds.set(0, new Promise<void>(resolve => { releaseDefault = resolve; }));
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

  it('should not destroy the next call remote processed stream on a repeat close', async () => {
    let destroyCount = 0;
    await callee.audio!.addProcessor({
      createProcessedStream: (stream: MediaStream) => Promise.resolve(new MediaStream(stream.getAudioTracks())),
      destroyProcessedStream: () => { destroyCount++; return Promise.resolve(); },
    }, true);

    callerB = new Device(await generateAccessToken('callerB-' + Date.now()));
    const callA = await incomingCall();
    const callB = await incomingCall(callerB);
    let releaseA!: () => void;
    holds.set(0, new Promise<void>(resolve => { releaseA = resolve; }));

    const acceptB = expectEvent('accept', callB);
    callA.accept();
    callB.accept();
    await waitFor(acceptB, 15000);
    await waitFor(new Promise<void>(resolve => {
      const poll = () => callee.audio!.remoteProcessedStream ? resolve() : setTimeout(poll, 50);
      poll();
    }), 15000);
    const processedB = callee.audio!.remoteProcessedStream;

    // callA was superseded while its getUserMedia was held; releasing it runs callA's late close.
    releaseA();
    await waitFor(defaultRequests[0], 15000);
    await settle();

    assert.strictEqual(callA.status(), Call.State.Closed);
    assert.strictEqual(callB.status(), Call.State.Open);
    assert.strictEqual(destroyCount, 0);
    assert.strictEqual(callee.audio!.remoteProcessedStream, processedB);
  });
});
