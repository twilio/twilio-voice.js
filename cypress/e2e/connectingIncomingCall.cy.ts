import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent, waitFor } from '../../tests/lib/util';

describe('Incoming call while connecting', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  let callerA: Device;
  let callerB: Device;
  let callee: Device;
  let calleeIdentity: string;
  // Resolves once the callee's getUserMedia is held, to a function that resolves it,
  // or rejects it when passed an error.
  let heldGetUserMedia: Promise<(error?: Error) => void>;

  beforeEach(async () => {
    calleeIdentity = 'callee-' + Date.now();
    callerA = new Device(await generateAccessToken('callerA-' + Date.now()));
    callerB = new Device(await generateAccessToken('callerB-' + Date.now()));
    callee = new Device(await generateAccessToken(calleeIdentity), {
      allowIncomingWhileBusy: true,
      closeProtection: true,
      getUserMedia: (constraints: MediaStreamConstraints) => new Promise<MediaStream>((resolve, reject) => {
        heldGetUserMedia = navigator.mediaDevices.getUserMedia(constraints).then(stream => (error?: Error) => {
          if (!error) {
            resolve(stream);
            return;
          }
          stream.getTracks().forEach(track => track.stop());
          reject(error);
        });
      }),
    } as any);
    callee.on('error', () => { /* expected */ });
    await callee.register();
  });

  afterEach(() => {
    [callerA, callerB, callee].forEach(device => {
      if (device) {
        device.disconnectAll();
        device.destroy();
      }
    });
  });

  const incomingFrom = async (caller: Device): Promise<Call> => {
    const incoming: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await caller.connect({ params: { To: calleeIdentity } });
    return waitFor(incoming, 15000).then(() => incoming);
  };

  const waitUntilIdle = () => waitFor(new Promise<void>(resolve => {
    const poll = () => callee.isBusy ? setTimeout(poll, 50) : resolve();
    poll();
  }), 15000);

  it('should treat the Device as busy while an accepted incoming call connects', async () => {
    const callA = await incomingFrom(callerA);
    const acceptA = expectEvent('accept', callA);
    callA.accept();
    const settleGetUserMedia = await waitFor(heldGetUserMedia, 15000).then(() => heldGetUserMedia);

    assert.strictEqual(callee.isBusy, true);
    const connectError = await callee.connect({ params: { To: calleeIdentity } }).then(() => null, error => error);
    assert.strictEqual(connectError && connectError.name, 'InvalidStateError');
    assert.throws(() => callee.updateOptions({ edge: 'ashburn' }), (error: any) => error.name === 'InvalidStateError');
    const unloadEvent: any = {};
    (callee as any)._confirmClose(unloadEvent);
    assert.ok(unloadEvent.returnValue);

    const ringtone = (callee as any)._soundcache.get(Device.SoundName.Incoming);
    let ringCount = 0;
    const play = ringtone.play.bind(ringtone);
    ringtone.play = () => { ringCount++; return play(); };
    await incomingFrom(callerB);
    assert.strictEqual(ringCount, 0);

    settleGetUserMedia();
    await waitFor(acceptA, 15000);
    assert.strictEqual(callA.status(), Call.State.Open);
  });

  it('should free the Device when getUserMedia fails while connecting', async () => {
    const callA = await incomingFrom(callerA);
    const errorA = expectEvent('error', callA);
    callA.accept();
    const settleGetUserMedia = await waitFor(heldGetUserMedia, 15000).then(() => heldGetUserMedia);
    assert.strictEqual(callee.isBusy, true);

    settleGetUserMedia(new DOMException('forced getUserMedia failure', 'NotReadableError'));
    await waitFor(errorA, 15000);
    await waitUntilIdle();

    assert.strictEqual(callA.status(), Call.State.Closed);
  });

  it('should free the Device when the caller hangs up while connecting', async () => {
    const callA = await incomingFrom(callerA);
    callA.accept();
    const settleGetUserMedia = await waitFor(heldGetUserMedia, 15000).then(() => heldGetUserMedia);
    assert.strictEqual(callee.isBusy, true);

    callerA.disconnectAll();
    await waitUntilIdle();
    assert.strictEqual(callA.status(), Call.State.Closed);

    // The late result must not bring the Device back to busy.
    settleGetUserMedia();
    await waitFor(heldGetUserMedia, 15000);
    await new Promise(resolve => setTimeout(resolve, 0));
    assert.strictEqual(callee.isBusy, false);
  });
});
