import { Device } from '../../';

(async () => {
  const device: Device = new Device('foo', {});

  await device.register();

  const call = await device.connect({
    params: { To: 'foo' },
  });

  device.audio?.disconnect(false);
  device.audio?.incoming(false);
  device.audio?.outgoing(false);
})();
