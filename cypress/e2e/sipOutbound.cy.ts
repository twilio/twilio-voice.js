import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { expectEvent } from '../../tests/lib/util';

// SIP credentials are only available locally today, so this spec skips itself
// in CI rather than failing the run. Remove the guard once CI can vend them.
const hasSipEnv = Boolean(Cypress.env('SIP_SERVER') && Cypress.env('SIP_URI'));

(hasSipEnv ? describe : describe.skip)('SIP Outbound Call', function() {
  this.timeout(30000);

  let device: Device;

  beforeEach(async () => {
    const token = Cypress.env('LOCAL_ACCESS_TOKEN');
    if (!token) {
      throw new Error(
        'LOCAL_ACCESS_TOKEN is not set. Run `source .env` so ACCOUNT_SID, ' +
        'API_KEY_SID and API_KEY_SECRET are exported before this spec.',
      );
    }
    device = new Device(token, {
      signalingOptions: {
        useSignalingMethod: 'sip',
        sipServer: Cypress.env('SIP_SERVER'),
        sipUri: Cypress.env('SIP_URI'),
        sipCredentials: {
          username: Cypress.env('SIP_USERNAME'),
          password: Cypress.env('SIP_PASSWORD'),
        },
        region: Cypress.env('SIP_REGION'),
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
