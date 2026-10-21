import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent, waitFor } from '../../tests/lib/util';

// A callee getUserMedia request, held until settled: resolved with its stream, or rejected with an error.
interface HeldRequest {
  settle: (error?: Error) => void;
  stream: MediaStream;
}

describe('Incoming call while connecting', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  let callerA: Device;
  let callerB: Device;
  let callee: Device;
  let calleeIdentity: string;
  // Each callee getUserMedia request, in request order.
  let requests: Array<Promise<HeldRequest>>;

  beforeEach(async () => {
    calleeIdentity = 'callee-' + Date.now();
    requests = [];
    callerA = new Device(await generateAccessToken('callerA-' + Date.now()));
    callerB = new Device(await generateAccessToken('callerB-' + Date.now()));
    callee = new Device(await generateAccessToken(calleeIdentity), {
      allowIncomingWhileBusy: true,
      closeProtection: true,
      getUserMedia: (constraints: MediaStreamConstraints) => new Promise<MediaStream>((resolve, reject) => {
        requests.push(navigator.mediaDevices.getUserMedia(constraints).then(stream => ({
          settle: (error?: Error) => {
            if (!error) {
              resolve(stream);
              return;
            }
            stream.getTracks().forEach(track => track.stop());
            reject(error);
          },
          stream,
        })));
      }),
    } as any);
    await callee.register();
  });

  afterEach(() => {
    [callerA, callerB, callee].forEach(device => {
      if (device) {
        device.disconnectAll();
        device.destroy();
      }
    });
    // A test that failed early may leave a request held.
    requests.forEach(request => request.then(({ stream }) => stream.getTracks().forEach(track => track.stop())));
  });

  const incomingFrom = async (caller: Device): Promise<Call> => {
    const incoming: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await caller.connect({ params: { To: calleeIdentity } });
    return waitFor(incoming, 15000).then(() => incoming);
  };

  const heldRequest = (index: number): Promise<HeldRequest> =>
    waitFor(requests[index], 15000).then(() => requests[index]);

  const settle = () => new Promise(resolve => setTimeout(resolve, 0));

  const waitUntilIdle = () => waitFor(new Promise<void>(resolve => {
    const poll = () => callee.isBusy ? setTimeout(poll, 50) : resolve();
    poll();
  }), 15000);

  it('should treat the Device as busy while an accepted incoming call connects', async () => {
    const callA = await incomingFrom(callerA);
    const acceptA = expectEvent('accept', callA);
    callA.accept();
    const requestA = await heldRequest(0);

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

    requestA.settle();
    await waitFor(acceptA, 15000);
    assert.strictEqual(callA.status(), Call.State.Open);
  });

  it('should free the Device when getUserMedia fails while connecting', async () => {
    const callA = await incomingFrom(callerA);
    const errorA = expectEvent('error', callA);
    callA.accept();
    const requestA = await heldRequest(0);
    assert.strictEqual(callee.isBusy, true);

    requestA.settle(new DOMException('forced getUserMedia failure', 'NotReadableError'));
    await waitFor(errorA, 15000);
    await waitUntilIdle();

    assert.strictEqual(callA.status(), Call.State.Closed);
  });

  it('should free the Device when the caller hangs up while connecting', async () => {
    const callA = await incomingFrom(callerA);
    callA.accept();
    const requestA = await heldRequest(0);
    assert.strictEqual(callee.isBusy, true);

    callerA.disconnectAll();
    await waitUntilIdle();
    assert.strictEqual(callA.status(), Call.State.Closed);

    // The late result is released and must not bring the Device back to busy.
    requestA.settle();
    await settle();
    assert.strictEqual(requestA.stream.getAudioTracks()[0].readyState, 'ended');
    assert.strictEqual(callee.isBusy, false);
  });

  it('should not emit an error for a replaced call whose getUserMedia then fails', async () => {
    const callA = await incomingFrom(callerA);
    const callB = await incomingFrom(callerB);
    let errorA: any = null;
    callA.on('error', error => { errorA = error; });
    const disconnectA = expectEvent('disconnect', callA);
    const acceptB = expectEvent('accept', callB);

    callA.accept();
    callB.accept();
    await waitFor(disconnectA, 15000);
    const requestA = await heldRequest(0);
    const requestB = await heldRequest(1);
    requestA.settle(new DOMException('Permission denied', 'NotAllowedError'));
    requestB.settle();
    await waitFor(acceptB, 15000);
    await settle();

    assert.strictEqual(errorA, null);
    assert.strictEqual(callA.status(), Call.State.Closed);
    assert.strictEqual(callB.status(), Call.State.Open);
  });
});
