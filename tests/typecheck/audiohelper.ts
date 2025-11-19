import { AudioProcessor, Device } from '../../lib/twilio';

class MyCustomAudioProcessor {
  createProcessedStream(stream: MediaStream): Promise<MediaStream> {
    return Promise.resolve(new MediaStream());
  }
  destroyProcessedStream(stream: MediaStream): Promise<void> {
    return Promise.resolve();
  }
}

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
  const processedStream: MediaStream | null = audio.processedStream;
  const localProcessedStream: MediaStream | null = audio.localProcessedStream;
  const remoteProcessedStream: MediaStream | null = audio.remoteProcessedStream;

  [audio.ringtoneDevices, audio.speakerDevices].forEach(deviceCollection => {
    let d: Set<MediaDeviceInfo> = deviceCollection.get();
    deviceCollection.delete((d.values() as any)[0]);
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

  const processor = new MyCustomAudioProcessor();
  audio.addProcessor(processor);
  audio.removeProcessor(processor);
  const localProcessor = new MyCustomAudioProcessor();
  audio.addProcessor(localProcessor, false);
  audio.removeProcessor(localProcessor, false);
  const remoteProcessor = new MyCustomAudioProcessor();
  audio.addProcessor(remoteProcessor, true);
  audio.removeProcessor(remoteProcessor, true);
};

export default checkAudioHelper;
