import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent, waitFor } from '../../tests/lib/util';

describe('Token update during a call', function() {
  this.timeout(60000);
  Cypress.config('defaultCommandTimeout', 60000);

  let device1: Device;
  let device2: Device;
  let identity1: string;
  let call1: Call;
  let stream: any;
  let reconnectInvites: number;
  let callEvents: string[];
  let orphanSocket: any;

  const generateTokens = () => Promise.all(Array.from({ length: 5 }, () => generateAccessToken(identity1)));
  const settle = () => new Promise(resolve => setTimeout(resolve, 3000));

  beforeEach(async () => {
    identity1 = 'id1-' + Date.now();
    const identity2 = 'id2-' + Date.now();
    const [token1, token2] = await Promise.all([
      generateAccessToken(identity1),
      generateAccessToken(identity2),
    ]);
    device1 = new Device(token1);
    device2 = new Device(token2);
    await Promise.all([device1.register(), device2.register()]);

    const incoming: Promise<Call> = expectEvent(Device.EventName.Incoming, device2);
    call1 = await device1.connect({ params: { To: identity2 } });
    const call2 = await incoming;
    const accept = expectEvent('accept', call1);
    call2.accept();
    await waitFor(accept, 20000);

    callEvents = [];
    ['error', 'disconnect', 'reconnecting', 'reconnected'].forEach(name =>
      call1.on(name, () => callEvents.push(name)));

    stream = (device1 as any)._stream;
    reconnectInvites = 0;
    const reconnect = stream.reconnect;
    stream.reconnect = function(...args: any[]) {
      reconnectInvites++;
      return reconnect.apply(this, args);
    };
  });

  afterEach(() => {
    if (orphanSocket) {
      delete orphanSocket.close;
      orphanSocket.close();
      orphanSocket = undefined;
    }
    [device1, device2].forEach(device => {
      if (device) {
        device.disconnectAll();
        device.destroy();
      }
    });
  });

  it('should not send a reconnect invite when the token is updated on an open socket', async () => {
    // Each update sends `listen`; the gateway does not answer every one with `connected`,
    // and before the fix each `connected` sent a reconnect invite.
    const connected = expectEvent('connected', stream);
    const tokens = await generateTokens();
    tokens.forEach(token => device1.updateToken(token));
    await waitFor(connected, 20000);
    // Let the remaining replies arrive and any duplicate invite fail the call.
    await settle();

    assert.strictEqual(reconnectInvites, 0);
    assert.deepStrictEqual(callEvents, []);
    assert.strictEqual(call1.status(), Call.State.Open);
  });

  it('should send one reconnect invite when the token is updated during a signaling reconnect', async () => {
    const tokens = await generateTokens();
    // Runs after the call's own `connected` handler sends the reconnect invite.
    stream.once('connected', () => tokens.forEach(token => device1.updateToken(token)));
    // Simulate a slow reconnect answer so the updates' `connected` replies arrive first.
    const emit = stream.emit;
    stream.emit = function(name: string, ...args: any[]) {
      if (name === 'answer') {
        setTimeout(() => emit.call(this, name, ...args), 1500);
        return true;
      }
      return emit.call(this, name, ...args);
    };
    const reconnected = expectEvent('reconnected', call1);

    // Take the heartbeat-timeout path without letting the close reach the gateway, as in a
    // network drop. A clean close ends the session, so the gateway rejects the reconnect (31107).
    const transport = stream.transport;
    orphanSocket = transport._socket;
    orphanSocket.close = () => {};
    transport._closeSocket();

    await waitFor(Promise.race([reconnected, expectEvent('disconnect', call1)]), 30000);
    await settle();

    assert.strictEqual(reconnectInvites, 1);
    assert.deepStrictEqual(callEvents, ['reconnecting', 'reconnected']);
    assert.strictEqual(call1.status(), Call.State.Open);
  });
});
