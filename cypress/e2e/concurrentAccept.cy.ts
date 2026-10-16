import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent, waitFor } from '../../tests/lib/util';

describe('Concurrent accept', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  let callerA: Device;
  let callerB: Device;
  let callerC: Device;
  let callee: Device;
  let calleeIdentity: string;
  // Each wrapped getUserMedia result, in request order.
  let requests: Array<Promise<MediaStream>>;
  // When set, holds getUserMedia results until two are ready, then releases them in request order.
  let pairGate: Array<() => void> | null;
  // When set, holds every getUserMedia result until it resolves.
  let holdGate: Promise<void> | null;

  beforeEach(async () => {
    calleeIdentity = 'callee-' + Date.now();
    callerA = new Device(await generateAccessToken('callerA-' + Date.now()));
    callerB = new Device(await generateAccessToken('callerB-' + Date.now()));
    callerC = new Device(await generateAccessToken('callerC-' + Date.now()));
    requests = [];
    pairGate = null;
    holdGate = null;
    callee = new Device(await generateAccessToken(calleeIdentity), {
      getUserMedia: (constraints: MediaStreamConstraints) => {
        const index = requests.length;
        const stream = navigator.mediaDevices.getUserMedia(constraints);
        const hold = holdGate;
        const gate = pairGate;
        let result = stream;
        if (hold) {
          result = stream.then(s => hold.then(() => s));
        } else if (gate) {
          result = stream.then(s => new Promise<MediaStream>(resolve => {
            gate[index] = () => resolve(s);
            if (gate[0] && gate[1]) {
              gate[0]();
              gate[1]();
            }
          }));
        }
        requests.push(result);
        return result;
      },
    } as any);
    await callee.register();
  });

  // Waits for every getUserMedia result, then lets the callbacks chained on them run.
  const settleRequests = () => waitFor(requests, 15000).then(() => new Promise(resolve => setTimeout(resolve, 0)));

  afterEach(() => {
    [callerA, callerB, callerC, callee].forEach(device => {
      if (device) {
        device.disconnectAll();
        device.destroy();
      }
    });
  });

  it('should disconnect the first call when a second is accepted before media opens', async () => {
    const incomingA: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await callerA.connect({ params: { To: calleeIdentity } });
    const callA = await incomingA;

    const incomingB: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await callerB.connect({ params: { To: calleeIdentity } });
    const callB = await incomingB;

    let disconnectCountA = 0;
    callA.on('disconnect', () => disconnectCountA++);
    const disconnectA = expectEvent('disconnect', callA);
    const acceptB = expectEvent('accept', callB);

    // getUserMedia is async, so callB.accept() lands before callA's media opens.
    callA.accept();
    assert.strictEqual(callee.isBusy, true);
    callB.accept();

    await waitFor([disconnectA, acceptB], 15000);
    // callA's getUserMedia settles after it was disconnected; that must not emit again.
    await settleRequests();

    assert.strictEqual(disconnectCountA, 1);
    assert.strictEqual(callA.status(), Call.State.Closed);
    assert.strictEqual(callB.status(), Call.State.Open);
    assert.strictEqual(callee.isBusy, true);
    assert.strictEqual(callee.calls.length, 0);
  });

  it('should keep only the last call when a disconnect handler accepts another', async () => {
    const calls: Call[] = [];
    for (const caller of [callerA, callerB, callerC]) {
      const incoming: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
      await caller.connect({ params: { To: calleeIdentity } });
      calls.push(await incoming);
    }
    const [callA, callB, callC] = calls;

    let errorB: any = null;
    callB.on('error', error => { errorB = error; });
    callA.once('disconnect', () => callC.accept());
    const disconnectB = expectEvent('disconnect', callB);
    const acceptC = expectEvent('accept', callC);

    callA.accept();
    callB.accept();

    await waitFor([disconnectB, acceptC], 15000);
    // Let callA's late getUserMedia settle.
    await settleRequests();

    // callB was disconnected inside its own accept(), so it never requests the mic.
    assert.strictEqual(requests.length, 2);
    assert.strictEqual(errorB, null);
    assert.strictEqual(callB.status(), Call.State.Closed);
    assert.strictEqual(callC.status(), Call.State.Open);
    assert.strictEqual(callC.getLocalStream()!.getAudioTracks()[0].readyState, 'live');
    assert.strictEqual(callee.calls.length, 0);
  });

  it('should keep the second call mic live when both getUserMedia requests settle together', async () => {
    const incomingA: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await callerA.connect({ params: { To: calleeIdentity } });
    const callA = await incomingA;

    const incomingB: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await callerB.connect({ params: { To: calleeIdentity } });
    const callB = await incomingB;

    const acceptB = expectEvent('accept', callB);
    pairGate = [];
    callA.accept();
    callB.accept();

    await waitFor(acceptB, 15000);
    // Let callA's late close run.
    await settleRequests();

    assert.strictEqual(callA.status(), Call.State.Closed);
    assert.strictEqual(callB.status(), Call.State.Open);
    assert.strictEqual(callB.getLocalStream()!.getAudioTracks()[0].readyState, 'live');
  });

  it('should ignore an invite that arrives while an accepted call is connecting', async () => {
    const incomingA: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await callerA.connect({ params: { To: calleeIdentity } });
    const callA = await incomingA;

    let releaseGetUserMedia!: () => void;
    holdGate = new Promise<void>(resolve => { releaseGetUserMedia = resolve; });
    callA.accept();
    assert.strictEqual(callee.isBusy, true);

    let incomingCount = 0;
    callee.on(Device.EventName.Incoming, () => incomingCount++);
    const inviteB = new Promise<void>(resolve => (callee as any)._stream.once('invite', () => resolve()));
    await callerB.connect({ params: { To: calleeIdentity } });
    await waitFor(inviteB, 15000);
    await new Promise(resolve => setTimeout(resolve, 500));

    assert.strictEqual(incomingCount, 0);
    // callA stays in device.calls until its media opens; no call for callerB was added.
    assert.deepStrictEqual(callee.calls, [callA]);

    const acceptA = expectEvent('accept', callA);
    releaseGetUserMedia();
    await waitFor(acceptA, 15000);
    assert.strictEqual(callA.status(), Call.State.Open);
  });
});
