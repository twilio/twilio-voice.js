import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent } from '../../tests/lib/util';

describe('Call Status', function() {
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

  it('should have pending status for an incoming call before accepting', async () => {
    const incomingPromise: Promise<Call> = expectEvent(Device.EventName.Incoming, device2);
    await device1.connect({ params: { To: identity2 } });
    const incomingCall = await incomingPromise;

    assert.strictEqual(incomingCall.status(), Call.State.Pending);
  });

  it('should transition from connecting to open for an outgoing call', async () => {
    const incomingPromise: Promise<Call> = expectEvent(Device.EventName.Incoming, device2);
    const outgoingCall = await device1.connect({ params: { To: identity2 } });
    const incomingCall = await incomingPromise;

    // Outgoing call should be in connecting state before being accepted
    const status = outgoingCall.status();
    assert(
      status === Call.State.Connecting || status === Call.State.Ringing || status === Call.State.Open,
      `Expected connecting, ringing, or open but got ${status}`,
    );

    const acceptPromise = expectEvent('accept', outgoingCall);
    incomingCall.accept();
    await acceptPromise;

    assert.strictEqual(outgoingCall.status(), Call.State.Open);
  });

  it('should have open status for both sides after accepting', async () => {
    const incomingPromise: Promise<Call> = expectEvent(Device.EventName.Incoming, device2);
    const outgoingCall = await device1.connect({ params: { To: identity2 } });
    const incomingCall = await incomingPromise;

    const acceptPromise = Promise.all([
      expectEvent('accept', outgoingCall),
      expectEvent('accept', incomingCall),
    ]);
    incomingCall.accept();
    await acceptPromise;

    assert.strictEqual(outgoingCall.status(), Call.State.Open);
    assert.strictEqual(incomingCall.status(), Call.State.Open);
  });

  it('should transition to closed after disconnect', async () => {
    const incomingPromise: Promise<Call> = expectEvent(Device.EventName.Incoming, device2);
    const outgoingCall = await device1.connect({ params: { To: identity2 } });
    const incomingCall = await incomingPromise;

    const acceptPromise = expectEvent('accept', outgoingCall);
    incomingCall.accept();
    await acceptPromise;

    const disconnectPromise = expectEvent('disconnect', outgoingCall);
    incomingCall.disconnect();
    await disconnectPromise;

    assert.strictEqual(outgoingCall.status(), Call.State.Closed);
    assert.strictEqual(incomingCall.status(), Call.State.Closed);
  });

  it('should transition to closed after reject', async () => {
    const incomingPromise: Promise<Call> = expectEvent(Device.EventName.Incoming, device2);
    await device1.connect({ params: { To: identity2 } });
    const incomingCall = await incomingPromise;

    incomingCall.reject();
    assert.strictEqual(incomingCall.status(), Call.State.Closed);
  });

  it('should transition to closed after ignore', async () => {
    const incomingPromise: Promise<Call> = expectEvent(Device.EventName.Incoming, device2);
    await device1.connect({ params: { To: identity2 } });
    const incomingCall = await incomingPromise;

    incomingCall.ignore();
    assert.strictEqual(incomingCall.status(), Call.State.Closed);
  });
});
