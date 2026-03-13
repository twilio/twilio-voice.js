import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent } from '../../tests/lib/util';

describe('Call ignore', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  let device1: Device;
  let device2: Device;
  let identity1: string;
  let identity2: string;

  beforeEach(async () => {
    identity1 = 'id1-' + Date.now();
    identity2 = 'id2-' + Date.now();
    const token1 = generateAccessToken(identity1);
    const token2 = generateAccessToken(identity2);
    device1 = new Device(token1);
    device2 = new Device(token2);

    await Promise.all([device1.register(), device2.register()]);
  });

  afterEach(() => {
    if (device1) {
      device1.disconnectAll();
      device1.destroy();
    }
    if (device2) {
      device2.disconnectAll();
      device2.destroy();
    }
  });

  it('should ignore an incoming call and set status to closed', async () => {
    const incomingPromise: Promise<Call> = expectEvent(Device.EventName.Incoming, device2);
    await device1.connect({ params: { To: identity2 } });
    const incomingCall = await incomingPromise;

    assert.strictEqual(incomingCall.status(), Call.State.Pending);
    incomingCall.ignore();
    assert.strictEqual(incomingCall.status(), Call.State.Closed);
  });

  it('should not emit a disconnect event when ignoring', async () => {
    const incomingPromise: Promise<Call> = expectEvent(Device.EventName.Incoming, device2);
    await device1.connect({ params: { To: identity2 } });
    const incomingCall = await incomingPromise;

    let disconnectEmitted = false;
    incomingCall.on('disconnect', () => { disconnectEmitted = true; });
    incomingCall.ignore();

    await new Promise(resolve => setTimeout(resolve, 1000));
    assert.strictEqual(disconnectEmitted, false);
  });

  it('should be a no-op if the call is not in pending state', async () => {
    const incomingPromise: Promise<Call> = expectEvent(Device.EventName.Incoming, device2);
    const outgoingCall = await device1.connect({ params: { To: identity2 } });
    const incomingCall = await incomingPromise;

    const acceptPromise = expectEvent('accept', outgoingCall);
    incomingCall.accept();
    await acceptPromise;

    // Should not throw or change state when calling ignore on an accepted call
    assert.doesNotThrow(() => incomingCall.ignore());
  });
});
