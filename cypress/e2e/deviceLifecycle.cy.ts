import * as assert from 'assert';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent } from '../../tests/lib/util';

describe('Device Lifecycle', function() {
  this.timeout(30000);
  Cypress.config('defaultCommandTimeout', 30000);

  describe('register and unregister', () => {
    let device: Device;

    afterEach(() => {
      if (device) {
        try { device.destroy(); } catch (_) { /* no-op */ }
      }
    });

    it('should transition through registering to registered state', async () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);
      device = new Device(token);

      assert.strictEqual(device.state, Device.State.Unregistered);

      const registeringPromise = expectEvent(Device.EventName.Registering, device);
      const registeredPromise = expectEvent(Device.EventName.Registered, device);

      device.register();

      await registeringPromise;
      assert.strictEqual(device.state, Device.State.Registering);

      await registeredPromise;
      assert.strictEqual(device.state, Device.State.Registered);
    });

    it('should unregister and emit unregistered event', async () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);
      device = new Device(token);

      await device.register();
      assert.strictEqual(device.state, Device.State.Registered);

      const unregisteredPromise = expectEvent(Device.EventName.Unregistered, device);
      await device.unregister();
      await unregisteredPromise;
      assert.strictEqual(device.state, Device.State.Unregistered);
    });

    it('should throw when unregistering a device that is not registered', async () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);
      device = new Device(token);

      try {
        await device.unregister();
        assert.fail('Expected an error to be thrown');
      } catch (err: any) {
        assert(err.message.includes('Must be "registered"'));
      }
    });

    it('should allow re-registering after unregister', async () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);
      device = new Device(token);

      await device.register();
      await device.unregister();
      assert.strictEqual(device.state, Device.State.Unregistered);

      await device.register();
      assert.strictEqual(device.state, Device.State.Registered);
    });
  });

  describe('destroy', () => {
    it('should emit destroyed event and set state to destroyed', async () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);
      const device = new Device(token);

      await device.register();

      const destroyedPromise = expectEvent(Device.EventName.Destroyed, device);
      device.destroy();
      await destroyedPromise;
      assert.strictEqual(device.state, Device.State.Destroyed);
    });

    it('should throw when calling register on a destroyed device', async () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);
      const device = new Device(token);

      device.destroy();

      try {
        await device.register();
        assert.fail('Expected an error to be thrown');
      } catch (err: any) {
        assert(err.message.includes('destroyed'));
      }
    });

    it('should throw when calling updateOptions on a destroyed device', () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);
      const device = new Device(token);

      device.destroy();

      assert.throws(() => device.updateOptions({ edge: 'ashburn' }), (err: any) => {
        return err.message.includes('destroyed');
      });
    });

    it('should throw when calling updateToken on a destroyed device', () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);
      const device = new Device(token);

      device.destroy();

      const newToken = generateAccessToken(identity);
      assert.throws(() => device.updateToken(newToken), (err: any) => {
        return err.message.includes('destroyed');
      });
    });
  });

  describe('updateToken', () => {
    let device: Device;

    afterEach(() => {
      if (device) {
        try { device.destroy(); } catch (_) { /* no-op */ }
      }
    });

    it('should update the token on the device', () => {
      const identity = 'id-' + Date.now();
      const token1 = generateAccessToken(identity);
      device = new Device(token1);

      const token2 = generateAccessToken(identity);
      device.updateToken(token2);
      assert.strictEqual(device.token, token2);
    });

    it('should update the token while registered', async () => {
      const identity = 'id-' + Date.now();
      const token1 = generateAccessToken(identity);
      device = new Device(token1);

      await device.register();

      const token2 = generateAccessToken(identity);
      device.updateToken(token2);
      assert.strictEqual(device.token, token2);
      assert.strictEqual(device.state, Device.State.Registered);
    });

    it('should throw when passing a non-string token', () => {
      const identity = 'id-' + Date.now();
      const token = generateAccessToken(identity);
      device = new Device(token);

      assert.throws(() => device.updateToken(123 as any), (err: any) => {
        return err.message.includes('must be of type "string"');
      });
    });
  });
});
