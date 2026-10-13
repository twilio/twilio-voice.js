import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent } from '../../tests/lib/util';

describe('Transport close before answer', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  let device1: Device;
  let device2: Device;
  let identity2: string;

  beforeEach(async () => {
    identity2 = 'id2-' + Date.now();
    const [token1, token2] = await Promise.all([
      generateAccessToken('id1-' + Date.now()),
      generateAccessToken(identity2),
    ]);
    device1 = new Device(token1);
    device2 = new Device(token2);
    await device2.register();
  });

  afterEach(() => {
    [device1, device2].forEach(device => {
      if (device) {
        device.disconnectAll();
        device.destroy();
      }
    });
  });

  // A clean close takes the same transportClose path as a network drop.
  const closeSignaling = () => (device1 as any)._stream.transport._socket.close();

  const assertCallReleased = async (call: Call) => {
    const disconnect = expectEvent('disconnect', call);
    closeSignaling();
    await Promise.race([disconnect, new Promise((_, reject) => setTimeout(() =>
      reject(new Error(`No disconnect after transport close, status ${call.status()}`)), 5000))]);

    assert.strictEqual(call.status(), Call.State.Closed);
    const nextCall = await device1.connect({ params: { To: identity2 } });
    assert.notStrictEqual(nextCall, call);
    nextCall.disconnect();
  };

  it('should disconnect a connecting call and allow another connect', async () => {
    const call = await device1.connect({ params: { To: identity2 } });
    // Closing before the invite is sent also emits Device error 31009.
    while (!(call as any)._mediaHandler.version?.pc?.localDescription) {
      await new Promise(resolve => setTimeout(resolve, 5));
    }
    assert.strictEqual(call.status(), Call.State.Connecting);

    await assertCallReleased(call);
  });

  it('should disconnect a ringing call and allow another connect', async () => {
    const incoming = expectEvent(Device.EventName.Incoming, device2);
    const call = await device1.connect({ params: { To: identity2 } });
    const ringing = expectEvent('ringing', call);
    await Promise.all([incoming, ringing]);
    assert.strictEqual(call.status(), Call.State.Ringing);

    await assertCallReleased(call);
  });
});
