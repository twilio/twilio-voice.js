import { AudioHelper, AudioProcessor, Device } from '../../lib/twilio';

class MyCustomAudioProcessor implements AudioProcessor {
  createProcessedStream(stream: MediaStream): Promise<MediaStream> {
    return Promise.resolve(new MediaStream());
  }
  destroyProcessedStream(stream: MediaStream): Promise<void> {
    return Promise.resolve();
  }
}

const checkAudioHelper = async () => {
  const device: Device = new Device('foo', {});
  const audio: AudioHelper | null = device.audio;

  if (!audio) {
    return;
  }

  // --- Properties ---

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

  // --- OutputDeviceCollection (ringtoneDevices / speakerDevices) ---

  [audio.ringtoneDevices, audio.speakerDevices].forEach(deviceCollection => {
    let d: Set<MediaDeviceInfo> = deviceCollection.get();
    deviceCollection.delete((d.values() as any)[0]);
    deviceCollection.set('');
    deviceCollection.set(['foo', 'bar']);
    deviceCollection.test('');
    deviceCollection.test();
  });

  // --- Sound toggle methods ---

  [undefined, true, false].forEach((doEnable) => {
    audio.disconnect(doEnable);
    audio.incoming(doEnable);
    audio.outgoing(doEnable);
  });

  // --- Input device / constraints methods ---

  await audio.setAudioConstraints({});
  await audio.setInputDevice('foo');
  await audio.unsetAudioConstraints();
  await audio.unsetInputDevice();

  // --- AudioProcessor (implements keyword verifies interface conformance) ---

  const processor: AudioProcessor = new MyCustomAudioProcessor();
  audio.addProcessor(processor);
  audio.removeProcessor(processor);
  const localProcessor: AudioProcessor = new MyCustomAudioProcessor();
  audio.addProcessor(localProcessor, false);
  audio.removeProcessor(localProcessor, false);
  const remoteProcessor: AudioProcessor = new MyCustomAudioProcessor();
  audio.addProcessor(remoteProcessor, true);
  audio.removeProcessor(remoteProcessor, true);

  // --- Events ---

  audio.on('deviceChange', (lostActiveDevices: MediaDeviceInfo[]) => {
    const devices: MediaDeviceInfo[] = lostActiveDevices;
  });

  audio.on('inputVolume', (inputVolume: number) => {
    const vol: number = inputVolume;
  });
};

export default checkAudioHelper;
