import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent } from '../../tests/lib/util';

describe('Concurrent accept', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  let callerA: Device;
  let callerB: Device;
  let callee: Device;
  let calleeIdentity: string;

  beforeEach(async () => {
    calleeIdentity = 'callee-' + Date.now();
    callerA = new Device(await generateAccessToken('callerA-' + Date.now()));
    callerB = new Device(await generateAccessToken('callerB-' + Date.now()));
    callee = new Device(await generateAccessToken(calleeIdentity));
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

  it('should disconnect the first call when a second is accepted before media opens', async () => {
    const incomingA: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await callerA.connect({ params: { To: calleeIdentity } });
    const callA = await incomingA;

    const incomingB: Promise<Call> = expectEvent(Device.EventName.Incoming, callee);
    await callerB.connect({ params: { To: calleeIdentity } });
    const callB = await incomingB;

    const disconnectA = expectEvent('disconnect', callA);
    const acceptB = expectEvent('accept', callB);

    // getUserMedia is async, so callB.accept() lands before callA's media opens.
    callA.accept();
    callB.accept();

    await Promise.all([disconnectA, acceptB]);

    assert.strictEqual(callA.status(), Call.State.Closed);
    assert.strictEqual(callB.status(), Call.State.Open);
    assert.strictEqual(callee.isBusy, true);
    assert.strictEqual(callee.calls.length, 0);
  });
});
