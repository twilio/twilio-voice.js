import { Device } from '../../';

const checkAudioHelper = async () => {
  const device: Device = new Device('foo', {});
  const audio = device.audio;

  if (!audio) {
    return;
  }

  const availableInputDevices: Map<string, MediaDeviceInfo> = audio.availableInputDevices;
  const availableOutputDevices: Map<string, MediaDeviceInfo> = audio.availableOutputDevices;
  const isOutputSelectionSupported: boolean = audio.isOutputSelectionSupported;
  const isVolumeSupported: boolean = audio.isVolumeSupported;
  const audioConstraints: MediaTrackConstraints | null = audio.audioConstraints;
  const inputDevice: MediaDeviceInfo | null = audio.inputDevice;
  const inputStream: MediaStream | null = audio.inputStream;

  [audio.ringtoneDevices, audio.speakerDevices].forEach(deviceCollection => {
    let d: Set<MediaDeviceInfo> = deviceCollection.get();
    deviceCollection.delete(d.values()[0]);
    deviceCollection.set('');
    deviceCollection.set(['foo', 'bar']);
    deviceCollection.test('');
    deviceCollection.test();
  });

  [undefined, true, false].forEach((doEnable) => {
    audio.disconnect(doEnable);
    audio.incoming(doEnable);
    audio.outgoing(doEnable);
  });

  await audio.setAudioConstraints({});
  await audio.setInputDevice('foo');
  await audio.unsetAudioConstraints();
  await audio.unsetInputDevice();
};

export default checkAudioHelper;
