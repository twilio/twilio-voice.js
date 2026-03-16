import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent } from '../../tests/lib/util';

describe('Device Properties', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  describe('static properties', () => {
    it('should report isSupported as a boolean', () => {
      assert.strictEqual(typeof Device.isSupported, 'boolean');
      assert.strictEqual(Device.isSupported, true);
    });

    it('should have a version string', () => {
      assert.strictEqual(typeof Device.version, 'string');
      assert(Device.version.length > 0, 'version should not be empty');
    });

    it('should have a packageName string', () => {
      assert.strictEqual(typeof Device.packageName, 'string');
      assert(Device.packageName.length > 0, 'packageName should not be empty');
    });
  });

  describe('instance properties', () => {
    let device: Device;

    afterEach(() => {
      if (device) {
        device.disconnectAll();
        device.destroy();
      }
    });

    it('should have identity set to null before registration', () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);
      device = new Device(token);

      assert.strictEqual(device.identity, null);
    });

    it('should have identity populated after registration', async () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);
      device = new Device(token);

      await device.register();
      assert.strictEqual(device.identity, identity);
    });

    it('should have edge set after registration', async () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);
      device = new Device(token, { edge: 'ashburn' });

      await device.register();
      assert.strictEqual(device.edge, 'ashburn');
    });

    it('should have home set after registration', async () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);
      device = new Device(token);

      await device.register();
      assert(typeof device.home === 'string', 'home should be a string');
      assert(device.home!.length > 0, 'home should not be empty');
    });

    it('should have token set', () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);
      device = new Device(token);

      assert.strictEqual(device.token, token);
    });

    it('should have isBusy as false when not on a call', async () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);
      device = new Device(token);

      await device.register();
      assert.strictEqual(device.isBusy, false);
    });

    it('should have audio (AudioHelper) available after registration', async () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);
      device = new Device(token);

      await device.register();
      assert(device.audio !== null, 'audio should not be null');
    });

    it('should have calls as an empty array by default', async () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);
      device = new Device(token);

      await device.register();
      assert(Array.isArray(device.calls), 'calls should be an array');
      assert.strictEqual(device.calls.length, 0);
    });
  });

  describe('isBusy during a call', () => {
    let device1: Device;
    let device2: Device;

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

    it('should be true when on an active call and false after disconnect', async () => {
      const identity1 = 'id1-' + Date.now();
      const identity2 = 'id2-' + Date.now();
      const token1 = generateAccessToken(identity1);
      const token2 = generateAccessToken(identity2);
      device1 = new Device(token1);
      device2 = new Device(token2);

      await Promise.all([device1.register(), device2.register()]);

      const incomingPromise: Promise<Call> = expectEvent(Device.EventName.Incoming, device2);
      const outgoingCall = await device1.connect({ params: { To: identity2 } });
      const incomingCall = await incomingPromise;

      assert.strictEqual(device1.isBusy, true);

      const acceptPromise = expectEvent('accept', outgoingCall);
      incomingCall.accept();
      await acceptPromise;

      assert.strictEqual(device1.isBusy, true);
      assert.strictEqual(device2.isBusy, true);

      const disconnectPromise = expectEvent('disconnect', outgoingCall);
      incomingCall.disconnect();
      await disconnectPromise;

      assert.strictEqual(device1.isBusy, false);
    });
  });
});
