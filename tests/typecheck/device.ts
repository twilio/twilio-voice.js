import { AudioHelper, Call, Device, PreflightTest, TwilioError } from '../../lib/twilio';

const checkDevice = async () => {
  // --- Device.Options (all fields) ---

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
    enableImprovedSignalingErrorPrecision: true,
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

  // closeProtection also accepts a string
  const optionsWithStringProtection: Device.Options = {
    closeProtection: 'Are you sure?',
  };

  // edge also accepts an array
  const optionsWithEdgeArray: Device.Options = {
    edge: ['ashburn', 'dublin'],
  };

  const device: Device = new Device('foo', options);

  // --- Static properties ---

  const isSupported: boolean = Device.isSupported;
  const packageName: string = Device.packageName;
  const version: string = Device.version;

  // --- Instance properties ---

  const audio: AudioHelper | null = device.audio;
  const calls: Call[] = device.calls;
  const isBusy: boolean = device.isBusy;
  const state: Device.State = device.state;

  const edge: string | null = device.edge;
  const home: string | null = device.home;
  const identity: string | null = device.identity;
  const token: string | null = device.token;

  // --- Events ---

  device.on(Device.EventName.Destroyed, () => {});

  device.on(Device.EventName.Error, (error: TwilioError.TwilioError) => {
    const code: number = error.code;
    const message: string = error.message;
  });

  device.on(Device.EventName.Incoming, (call: Call) => {
    const c: Call = call;
  });

  device.on(Device.EventName.Registered, () => {});

  device.on(Device.EventName.Registering, () => {});

  device.on(Device.EventName.TokenWillExpire, (device: Device) => {
    const d: Device = device;
  });

  device.on(Device.EventName.Unregistered, () => {});

  // --- Device.EventName enum ---

  const destroyed: Device.EventName = Device.EventName.Destroyed;
  const error: Device.EventName = Device.EventName.Error;
  const incoming: Device.EventName = Device.EventName.Incoming;
  const registered: Device.EventName = Device.EventName.Registered;
  const registering: Device.EventName = Device.EventName.Registering;
  const tokenWillExpire: Device.EventName = Device.EventName.TokenWillExpire;
  const unregistered: Device.EventName = Device.EventName.Unregistered;

  // --- Device.State enum ---

  const stateDestroyed: Device.State = Device.State.Destroyed;
  const stateRegistered: Device.State = Device.State.Registered;
  const stateRegistering: Device.State = Device.State.Registering;
  const stateUnregistered: Device.State = Device.State.Unregistered;

  // --- Methods ---

  await device.connect();
  await device.connect({
    params: { To: 'foo' },
  });
  await device.connect({
    connectToken: 'foo',
  });
  await device.connect({
    rtcConfiguration: {},
    rtcConstraints: {},
  });

  // ConnectOptions typed explicitly
  const connectOptions: Device.ConnectOptions = {
    params: { To: 'foo' },
    connectToken: 'foo',
    rtcConfiguration: {},
    rtcConstraints: {},
  };
  await device.connect(connectOptions);

  device.destroy();
  device.disconnectAll();
  await device.register();
  await device.unregister();
  device.updateOptions(options);
  device.updateToken('foo');

  // --- runPreflight ---

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
