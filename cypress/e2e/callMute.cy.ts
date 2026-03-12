import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent } from '../../tests/lib/util';

describe('Call Mute', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  let device1: Device;
  let device2: Device;
  let identity1: string;
  let identity2: string;
  let call1: Call;
  let call2: Call;

  before(async () => {
    identity1 = 'id1-' + Date.now();
    identity2 = 'id2-' + Date.now();
    const token1 = generateAccessToken(identity1);
    const token2 = generateAccessToken(identity2);
    device1 = new Device(token1);
    device2 = new Device(token2);

    await Promise.all([device1.register(), device2.register()]);

    const incomingPromise: Promise<Call> = expectEvent(Device.EventName.Incoming, device2);
    call1 = await device1.connect({ params: { To: identity2 } });
    call2 = await incomingPromise;

    const acceptPromise = expectEvent('accept', call1);
    call2.accept();
    await acceptPromise;
  });

  after(() => {
    if (device1) {
      device1.disconnectAll();
      device1.destroy();
    }
    if (device2) {
      device2.disconnectAll();
      device2.destroy();
    }
  });

  it('should not be muted by default', () => {
    assert.strictEqual(call1.isMuted(), false);
    assert.strictEqual(call2.isMuted(), false);
  });

  it('should mute the call and emit a mute event', async () => {
    const mutePromise: Promise<boolean> = new Promise(resolve => {
      call1.once('mute', (isMuted: boolean) => resolve(isMuted));
    });
    call1.mute(true);
    const isMuted = await mutePromise;
    assert.strictEqual(isMuted, true);
    assert.strictEqual(call1.isMuted(), true);
  });

  it('should unmute the call and emit a mute event', async () => {
    const mutePromise: Promise<boolean> = new Promise(resolve => {
      call1.once('mute', (isMuted: boolean) => resolve(isMuted));
    });
    call1.mute(false);
    const isMuted = await mutePromise;
    assert.strictEqual(isMuted, false);
    assert.strictEqual(call1.isMuted(), false);
  });

  it('should not emit mute event when muting an already muted call', () => {
    call1.mute(true);
    let emitted = false;
    call1.once('mute', () => { emitted = true; });
    call1.mute(true);
    assert.strictEqual(emitted, false);
    // Clean up
    call1.mute(false);
  });

  it('should mute the incoming call side', async () => {
    const mutePromise: Promise<boolean> = new Promise(resolve => {
      call2.once('mute', (isMuted: boolean) => resolve(isMuted));
    });
    call2.mute(true);
    const isMuted = await mutePromise;
    assert.strictEqual(isMuted, true);
    assert.strictEqual(call2.isMuted(), true);
    // Clean up
    call2.mute(false);
  });

  it('should hang up', (done) => {
    call1.once('disconnect', () => done());
    call2.disconnect();
  });
});
