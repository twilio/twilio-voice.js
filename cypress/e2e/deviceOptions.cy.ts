import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent } from '../../tests/lib/util';

describe('DeviceOptions', function() {
  this.timeout(10000);

  let device1: Device;
  let device2: Device;
  let identity1: string;
  let identity2: string;

  const setupDevices = (device1Options = {}, device2Options = {}) => {
    identity1 = 'id1-' + Date.now();
    identity2 = 'id2-' + Date.now();
    const token1 = generateAccessToken(identity1);
    const token2 = generateAccessToken(identity2);

    device1 = new Device(token1, device1Options);
    device2 = new Device(token2, device2Options);

    const devicePromises = Promise.all([
      expectEvent(Device.EventName.Registered, device1),
      expectEvent(Device.EventName.Registered, device2),
    ]);

    device1.register();
    device2.register();

    return devicePromises;
  };

  const destroyDevices = () => {
    if (device1) {
      device1.disconnectAll();
      device1.destroy();
    }

    if (device2) {
      device2.disconnectAll();
      device2.destroy();
    }
  };

  const makeCall = async (connectOptions = {}) => {
    await setupDevices();
    await device1.connect({ params: { To: identity2 }, ...connectOptions });
  };

  afterEach(() => {
    destroyDevices();
  });

  describe('rtcConstraints', () => {
    it('should connect if audio constraints is provided', async () => {
      await makeCall({ rtcConstraints: { audio: true } });
      await expectEvent('incoming', device2);
    });

    it('should connect if audio constraints is not provided', async () => {
      await makeCall();
      await expectEvent('incoming', device2);
    });

    it('should accept if audio constraints is provided', async () => {
      await makeCall();
      const call2 = await expectEvent('incoming', device2);
      setTimeout(() => call2.accept({ rtcConstraints: { audio: true } }));
      await expectEvent('accept', call2);
    });

    it('should accept if audio constraints is not provided', async () => {
      await makeCall();
      const call2 = await expectEvent('incoming', device2);
      setTimeout(() => call2.accept());
      await expectEvent('accept', call2);
    });
  });
});
