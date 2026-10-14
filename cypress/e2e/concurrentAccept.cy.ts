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
  let getUserMediaCount: number;
  // When set, holds getUserMedia results until two are ready, then releases them in request order.
  let pairGate: Array<() => void> | null;

  beforeEach(async () => {
    calleeIdentity = 'callee-' + Date.now();
    callerA = new Device(await generateAccessToken('callerA-' + Date.now()));
    callerB = new Device(await generateAccessToken('callerB-' + Date.now()));
    callerC = new Device(await generateAccessToken('callerC-' + Date.now()));
    getUserMediaCount = 0;
    pairGate = null;
    callee = new Device(await generateAccessToken(calleeIdentity), {
      getUserMedia: (constraints: MediaStreamConstraints) => {
        const index = getUserMediaCount++;
        const stream = navigator.mediaDevices.getUserMedia(constraints);
        const gate = pairGate;
        if (!gate) {
          return stream;
        }
        return stream.then(s => new Promise<MediaStream>(resolve => {
          gate[index] = () => resolve(s);
          if (gate[0] && gate[1]) {
            gate[0]();
            gate[1]();
          }
        }));
      },
    } as any);
    await callee.register();
  });

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
    callB.accept();

    await Promise.all([disconnectA, acceptB]);
    // callA's getUserMedia settles after it was disconnected; that must not emit again.
    await new Promise(resolve => setTimeout(resolve, 1000));

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
    // Let any late getUserMedia from callA or callB settle.
    await new Promise(resolve => setTimeout(resolve, 1000));

    // callB was disconnected inside its own accept(), so it never requests the mic.
    assert.strictEqual(getUserMediaCount, 2);
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
    await new Promise(resolve => setTimeout(resolve, 1000));

    assert.strictEqual(callA.status(), Call.State.Closed);
    assert.strictEqual(callB.status(), Call.State.Open);
    assert.strictEqual(callB.getLocalStream()!.getAudioTracks()[0].readyState, 'live');
  });
});
