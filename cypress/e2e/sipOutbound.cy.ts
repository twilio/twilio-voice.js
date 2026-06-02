import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import * as env from '../../tests/env';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent } from '../../tests/lib/util';

describe('SIP Outbound Call', function() {
  this.timeout(30000);

  let device: Device;
  let identity: string;

  beforeEach(async () => {
    identity = 'sip-id-' + Date.now();
    const token = generateAccessToken(identity);
    device = new Device(token, {
      signalingOptions: {
        useSignalingMethod: 'sip',
        sipServer: (env as any).sipServer,
        sipUri: (env as any).sipUri,
        sipCredentials: { username: (env as any).sipUsername, password: (env as any).sipPassword },
        region: (env as any).sipRegion,
      },
    });
    await device.register();
  });

  afterEach(() => {
    if (device) {
      device.destroy();
    }
  });

  it('should place an outbound call via SIP and connect', async () => {
    const call = await device.connect({ params: { To: 'alice' } });
    await expectEvent('accept', call);
    assert.strictEqual(call.status(), Call.State.Open);
  });

  it('should transition to closed after disconnect', async () => {
    const call = await device.connect({ params: { To: 'alice' } });
    const disconnectPromise = expectEvent('disconnect', call);
    call.disconnect();
    await disconnectPromise;
    assert.strictEqual(call.status(), Call.State.Closed);
  });
});
