import { Device, OutputDeviceCollection } from '../../lib/twilio';

const checkOutputDeviceCollection = async () => {
  const device: Device = new Device('foo', {});
  const audio = device.audio;

  if (!audio) {
    return;
  }

  const ringtoneDevices: OutputDeviceCollection = audio.ringtoneDevices;
  const speakerDevices: OutputDeviceCollection = audio.speakerDevices;

  // get() returns a Set of MediaDeviceInfo
  const activeRingtoneDevices: Set<MediaDeviceInfo> = ringtoneDevices.get();
  const activeSpeakerDevices: Set<MediaDeviceInfo> = speakerDevices.get();

  // set() accepts a string or string array
  await ringtoneDevices.set('default');
  await ringtoneDevices.set(['default', 'other']);
  await speakerDevices.set('default');
  await speakerDevices.set(['default', 'other']);

  // delete() accepts a MediaDeviceInfo and returns a boolean
  const devices: Set<MediaDeviceInfo> = ringtoneDevices.get();
  const firstDevice: MediaDeviceInfo | undefined = devices.values().next().value;
  if (firstDevice) {
    const wasDeleted: boolean = ringtoneDevices.delete(firstDevice);
  }

  // test() accepts an optional sound URL and returns a Promise
  await ringtoneDevices.test();
  await ringtoneDevices.test('https://example.com/sound.mp3');
  await speakerDevices.test();
};

export default checkOutputDeviceCollection;
