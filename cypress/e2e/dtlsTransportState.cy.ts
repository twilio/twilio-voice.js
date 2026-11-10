import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent, waitFor } from '../../tests/lib/util';

const EVENT_TIMEOUT = 30000;

describe('dtls-transport-state', function() {
  this.timeout(60000);
  Cypress.config('defaultCommandTimeout', 60000);

  let device1: Device;
  let device2: Device;
  let call1: Call;
  let call2: Call;

  beforeEach(async () => {
    const identity1 = 'id1-' + Date.now();
    const identity2 = 'id2-' + Date.now();
    const [token1, token2] = await Promise.all([
      generateAccessToken(identity1),
      generateAccessToken(identity2),
    ]);
    device1 = new Device(token1);
    device2 = new Device(token2);

    await device2.register();

    const incomingPromise: Promise<Call> = expectEvent(Device.EventName.Incoming, device2);
    call1 = await device1.connect({ params: { To: identity2 } });
    call2 = await incomingPromise;

    const acceptPromise = expectEvent('accept', call1);
    call2.accept();
    await acceptPromise;
  });

  afterEach(() => {
    [device1, device2].forEach(device => {
      if (device) {
        device.disconnectAll();
        device.destroy();
      }
    });
  });

  const expectOneDtlsClosedPost = async (call: Call): Promise<void> => {
    const publisher = (call as any)['_publisher'];
    const post = publisher.post;
    let count = 0;
    await waitFor(new Promise<void>(resolve => {
      publisher.post = function(level: string, group: string, name: string, payload: any, source: any) {
        if (group === 'dtls-transport-state' && name === 'closed' && source === call) {
          count++;
          resolve();
        }
        return post.apply(this, arguments);
      };
    }), EVENT_TIMEOUT);
    await new Promise(resolve => setTimeout(resolve, 2000));
    assert.strictEqual(count, 1);
  };

  it('should publish closed once when the call hangs up locally', () => {
    const closedPosted = expectOneDtlsClosedPost(call1);
    call1.disconnect();
    return closedPosted;
  });

  it('should publish closed once when the remote party hangs up', () => {
    const closedPosted = expectOneDtlsClosedPost(call1);
    call2.disconnect();
    return closedPosted;
  });
});
