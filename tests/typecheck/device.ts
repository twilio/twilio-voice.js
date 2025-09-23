import { Call, Device, PreflightTest } from '../../lib/twilio';

const checkDevice = async () => {
  const options: Device.Options = {
    RTCPeerConnection: 'foo',
    allowIncomingWhileBusy: true,
    appName: 'foo',
    appVersion: 'foo',
    closeProtection: true,
    codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
    disableAudioContextSounds: true,
    dscp: true,
    edge: 'foo',
    enumerateDevices: 'foo',
    forceAggressiveIceNomination: true,
    getUserMedia: 'foo',
    logLevel: 'debug',
    maxAverageBitrate: 1,
    maxCallSignalingTimeoutMs: 1,
    sounds: {
      [Device.SoundName.Disconnect]: 'foo',
      [Device.SoundName.Dtmf0]: 'foo',
      [Device.SoundName.Dtmf1]: 'foo',
      [Device.SoundName.Dtmf2]: 'foo',
      [Device.SoundName.Dtmf3]: 'foo',
      [Device.SoundName.Dtmf4]: 'foo',
      [Device.SoundName.Dtmf5]: 'foo',
      [Device.SoundName.Dtmf6]: 'foo',
      [Device.SoundName.Dtmf7]: 'foo',
      [Device.SoundName.Dtmf8]: 'foo',
      [Device.SoundName.Dtmf9]: 'foo',
      [Device.SoundName.DtmfH]: 'foo',
      [Device.SoundName.DtmfS]: 'foo',
      [Device.SoundName.Incoming]: 'foo',
      [Device.SoundName.Outgoing]: 'foo',
    },
    tokenRefreshMs: 1,
  };
  const device: Device = new Device('foo', options);

  const isSupported: boolean = Device.isSupported;
  const packageName: string = Device.packageName;
  const version: string = Device.version;

  const calls: Call[] = device.calls;
  const isBusy: boolean = device.isBusy;
  const state: Device.State = device.state;

  const edge: string | null = device.edge;
  const home: string | null = device.home;
  const identity: string | null = device.identity;
  const token: string | null = device.token;

  await device.connect();
  await device.connect({
    params: { To: 'foo' }
  });
  await device.connect({
    connectToken: 'foo',
  });
  await device.connect({
    rtcConfiguration: {},
    rtcConstraints: {},
  });
  await device.connect({
    params: { To: 'foo' },
    rtcConfiguration: {},
    rtcConstraints: {},
  });

  device.destroy();
  device.disconnectAll();
  await device.register();
  await device.unregister();
  device.updateOptions(options);
  device.updateToken('foo');

  const preflight: PreflightTest = Device.runPreflight('foo', {
    codecPreferences: [Call.Codec.Opus, Call.Codec.PCMU],
    edge: 'foo',
    fakeMicInput: true,
    iceServers: [],
    logLevel: 'debug',
    signalingTimeoutMs: 1,
  });
};

export default checkDevice;
