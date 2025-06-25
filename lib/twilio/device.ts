import { EventEmitter } from 'events';
import { levels as LogLevels, LogLevelDesc } from 'loglevel';
import AudioHelper from './audiohelper';
import { AudioProcessorEventObserver } from './audioprocessoreventobserver';
import Call from './call';
import * as C from './constants';
import DialtonePlayer from './dialtonePlayer';
import {
  AuthorizationErrors,
  ClientErrors,
  GeneralErrors,
  getPreciseSignalingErrorByCode,
  InvalidArgumentError,
  InvalidStateError,
  NotSupportedError,
  TwilioError,
} from './errors';
import Publisher from './eventpublisher';
import Log from './log';
import { PreflightTest } from './preflight/preflight';
import PStream from './pstream';
import {
  createEventGatewayURI,
  createSignalingEndpointURL,
  Edge,
  getChunderURIs,
  getRegionShortcode,
  Region,
  regionToEdge,
} from './regions';
import * as rtc from './rtc';
import getUserMedia from './rtc/getusermedia';
import { generateVoiceEventSid } from './sid';
import Sound from './sound';
import {
  isLegacyEdge,
  isUnifiedPlanDefault,
  promisifyEvents,
  queryToJson,
} from './util';

// Placeholders until we convert the respective files to TypeScript.
/**
 * @private
 */
export type IPStream = any;
/**
 * @private
 */
export type IPublisher = any;
/**
 * @private
 */
export type ISound = any;

const REGISTRATION_INTERVAL = 30000;
const RINGTONE_PLAY_TIMEOUT = 2000;
const PUBLISHER_PRODUCT_NAME = 'twilio-js-sdk';
const INVALID_TOKEN_MESSAGE = 'Parameter "token" must be of type "string".';

declare const RTCRtpTransceiver: any;
declare const webkitAudioContext: typeof AudioContext;

/**
 * Options that may be passed to the {@link Device} constructor for internal testing.
 * @private
 */
export interface IExtendedDeviceOptions extends Device.Options {
  /**
   * Custom {@link AudioHelper} constructor
   */
  AudioHelper?: typeof AudioHelper;

  /**
   * The max amount of time in milliseconds to allow stream (re)-connect
   * backoffs.
   */
  backoffMaxMs?: number;

  /**
   * Custom {@link Call} constructor
   */
  Call?: typeof Call;

  /**
   * Hostname of the signaling gateway to connect to.
   */
  chunderw?: string | string[];

  /**
   * Hostname of the event gateway to connect to.
   */
  eventgw?: string;

  /**
   * File input stream to use instead of reading from mic
   */
  fileInputStream?: MediaStream;

  /**
   * Ignore browser support, disabling the exception that is thrown when neither WebRTC nor
   * ORTC are supported.
   */
  ignoreBrowserSupport?: boolean;

  /**
   * Whether this is a preflight call or not
   */
  preflight?: boolean;

  /**
   * Custom PStream constructor
   */
  PStream?: IPStream;

  /**
   * Custom Publisher constructor
   */
  Publisher?: IPublisher;

  /**
   * Whether or not to publish events to insights using {@link Device._publisher}.
   */
  publishEvents?: boolean;

  /**
   * MediaStreamConstraints to pass to getUserMedia when making or accepting a Call.
   */
  rtcConstraints?: Call.AcceptOptions['rtcConstraints'];

  /**
   * Custom Sound constructor
   */
  Sound?: ISound;

  /**
   * Voice event SID generator.
   */
  voiceEventSidGenerator?: () => string;
}

/**
 * A sound definition used to initialize a Sound file.
 * @private
 */
export interface ISoundDefinition {
  /**
   * Name of the sound file.
   */
  filename: string;

  /**
   * The amount of time this sound file should play before being stopped automatically.
   */
  maxDuration?: number;

  /**
   * Whether or not this sound should loop after playthrough finishes.
   */
  shouldLoop?: boolean;
}

/**
 * Twilio Device. Allows registration for incoming calls, and placing outgoing calls.
 */
class Device extends EventEmitter {
  /**
   * The AudioContext to be used by {@link Device} instances.
   * @private
   */
  static get audioContext(): AudioContext | undefined {
    return Device._audioContext;
  }

  /**
   * Which sound file extension is supported.
   * @private
   */
  static get extension(): 'mp3' | 'ogg' {
    // NOTE(mroberts): Node workaround.
    const a: any = typeof document !== 'undefined'
      ? document.createElement('audio') : { canPlayType: false };

    let canPlayMp3;
    try {
      canPlayMp3 = a.canPlayType && !!a.canPlayType('audio/mpeg').replace(/no/, '');
    } catch (e) {
      canPlayMp3 = false;
    }

    let canPlayVorbis;
    try {
      canPlayVorbis = a.canPlayType && !!a.canPlayType('audio/ogg;codecs=\'vorbis\'').replace(/no/, '');
    } catch (e) {
      canPlayVorbis = false;
    }

    return (canPlayVorbis && !canPlayMp3) ? 'ogg' : 'mp3';
  }

  /**
   * Whether or not this SDK is supported by the current browser.
   */
  static get isSupported(): boolean { return rtc.enabled(); }

  /**
   * Package name of the SDK.
   */
  static get packageName(): string { return C.PACKAGE_NAME; }

  /**
   * Run some tests to identify issues, if any, prohibiting successful calling.
   * @param token - A Twilio JWT token string
   * @param options
   */
  static runPreflight(token: string, options?: PreflightTest.Options): PreflightTest {
    return new PreflightTest(token, { audioContext: Device._getOrCreateAudioContext(), ...options });
  }

  /**
   * String representation of {@link Device} class.
   * @private
   */
  static toString(): string {
    return '[Twilio.Device class]';
  }

  /**
   * Current SDK version.
   */
  static get version(): string { return C.RELEASE_VERSION; }

  /**
   * An AudioContext to share between {@link Device}s.
   */
  private static _audioContext?: AudioContext;

  private static _defaultSounds: Record<string, ISoundDefinition> = {
    disconnect: { filename: 'disconnect', maxDuration: 3000 },
    dtmf0: { filename: 'dtmf-0', maxDuration: 1000 },
    dtmf1: { filename: 'dtmf-1', maxDuration: 1000 },
    dtmf2: { filename: 'dtmf-2', maxDuration: 1000 },
    dtmf3: { filename: 'dtmf-3', maxDuration: 1000 },
    dtmf4: { filename: 'dtmf-4', maxDuration: 1000 },
    dtmf5: { filename: 'dtmf-5', maxDuration: 1000 },
    dtmf6: { filename: 'dtmf-6', maxDuration: 1000 },
    dtmf7: { filename: 'dtmf-7', maxDuration: 1000 },
    dtmf8: { filename: 'dtmf-8', maxDuration: 1000 },
    dtmf9: { filename: 'dtmf-9', maxDuration: 1000 },
    dtmfh: { filename: 'dtmf-hash', maxDuration: 1000 },
    dtmfs: { filename: 'dtmf-star', maxDuration: 1000 },
    incoming: { filename: 'incoming', shouldLoop: true },
    outgoing: { filename: 'outgoing', maxDuration: 3000 },
  };

  /**
   * A DialtonePlayer to play mock DTMF sounds through.
   */
  private static _dialtonePlayer?: DialtonePlayer;

  /**
   * Whether or not the browser uses unified-plan SDP by default.
   */
  private static _isUnifiedPlanDefault: boolean | undefined;

  /**
   * Initializes the AudioContext instance shared across the Voice SDK,
   * or returns the existing instance if one has already been initialized.
   */
  private static _getOrCreateAudioContext(): AudioContext | undefined {
    if (!Device._audioContext) {
      if (typeof AudioContext !== 'undefined') {
        Device._audioContext = new AudioContext();
      } else if (typeof webkitAudioContext !== 'undefined') {
        Device._audioContext = new webkitAudioContext();
      }
    }
    return Device._audioContext;
  }

  /**
   * The currently active {@link Call}, if there is one.
   */
  private _activeCall: Call | null = null;

  /**
   * The AudioHelper instance associated with this {@link Device}.
   */
  private _audio: AudioHelper | null = null;

  /**
   * The AudioProcessorEventObserver instance to use
   */
  private _audioProcessorEventObserver: AudioProcessorEventObserver | null = null;

  /**
   * {@link Device._confirmClose} bound to the specific {@link Device} instance.
   */
  private _boundConfirmClose: typeof Device.prototype._confirmClose;

  /**
   * {@link Device.destroy} bound to the specific {@link Device} instance.
   */
  private _boundDestroy: typeof Device.prototype.destroy;

  /**
   * An audio input MediaStream to pass to new {@link Call} instances.
   */
  private _callInputStream: MediaStream | null = null;

  /**
   * An array of {@link Call}s. Though only one can be active, multiple may exist when there
   * are multiple incoming, unanswered {@link Call}s.
   */
  private _calls: Call[] = [];

  /**
   * An array of {@link Device} IDs to be used to play sounds through, to be passed to
   * new {@link Call} instances.
   */
  private _callSinkIds: string[] = ['default'];

  /**
   * The list of chunder URIs that will be passed to PStream
   */
  private _chunderURIs: string[] = [];

  /**
   * Default options used by {@link Device}.
   */
  private readonly _defaultOptions: IExtendedDeviceOptions = {
    allowIncomingWhileBusy: false,
    closeProtection: false,
    codecPreferences: [Call.Codec.PCMU, Call.Codec.Opus],
    dscp: true,
    enableImprovedSignalingErrorPrecision: false,
    forceAggressiveIceNomination: false,
    logLevel: LogLevels.ERROR,
    maxCallSignalingTimeoutMs: 0,
    preflight: false,
    sounds: { },
    tokenRefreshMs: 10000,
    voiceEventSidGenerator: generateVoiceEventSid,
  };

  /**
   * The name of the edge the {@link Device} is connected to.
   */
  private _edge: string | null = null;

  /**
   * The name of the home region the {@link Device} is connected to.
   */
  private _home: string | null = null;

  /**
   * The identity associated with this Device.
   */
  private _identity: string | null = null;

  /**
   * Whether SDK is run as a browser extension
   */
  private _isBrowserExtension: boolean;

  /**
   * An instance of Logger to use.
   */
  private _log: Log = new Log('Device');

  /**
   * The internal promise created when calling {@link Device.makeCall}.
   */
  private _makeCallPromise: Promise<any> | null = null;

  /**
   * Network related information
   * See https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API
   */
  private _networkInformation: any;

  /**
   * The options passed to {@link Device} constructor or {@link Device.updateOptions}.
   */
  private _options: IExtendedDeviceOptions = { };

  /**
   * The preferred URI to (re)-connect signaling to.
   */
  private _preferredURI: string | null = null;

  /**
   * An Insights Event Publisher.
   */
  private _publisher: IPublisher | null = null;

  /**
   * The region the {@link Device} is connected to.
   */
  private _region: string | null = null;

  /**
   * A timeout ID for a setTimeout schedule to re-register the {@link Device}.
   */
  private _regTimer: NodeJS.Timeout | null = null;

  /**
   * Boolean representing whether or not the {@link Device} was registered when
   * receiving a signaling `offline`. Determines if the {@link Device} attempts
   * a `re-register` once signaling is re-established when receiving a
   * `connected` event from the stream.
   */
  private _shouldReRegister: boolean = false;

  /**
   * A Map of Sounds to play.
   */
  private _soundcache: Map<Device.SoundName, ISound> = new Map();

  /**
   * The current status of the {@link Device}.
   */
  private _state: Device.State = Device.State.Unregistered;

  /**
   * A map from {@link Device.State} to {@link Device.EventName}.
   */
  private readonly _stateEventMapping: Record<Device.State, Device.EventName> = {
    [Device.State.Destroyed]: Device.EventName.Destroyed,
    [Device.State.Unregistered]: Device.EventName.Unregistered,
    [Device.State.Registering]: Device.EventName.Registering,
    [Device.State.Registered]: Device.EventName.Registered,
  };

  /**
   * The Signaling stream.
   */
  private _stream: IPStream | null = null;

  /**
   * A promise that will resolve when the Signaling stream is ready.
   */
  private _streamConnectedPromise: Promise<IPStream> | null = null;

  /**
   * The JWT string currently being used to authenticate this {@link Device}.
   */
  private _token: string;

  /**
   * A timeout to track when the current AccessToken will expire.
   */
  private _tokenWillExpireTimeout: NodeJS.Timeout | null = null;

  /**
   * Construct a {@link Device} instance. The {@link Device} can be registered
   * to make and listen for calls using {@link Device.register}.
   * @param options
   */
  constructor(token: string, options: Device.Options = { }) {
    super();

    // Setup loglevel asap to avoid missed logs
    this._setupLoglevel(options.logLevel);
    this._logOptions('constructor', options);

    this.updateToken(token);

    if (isLegacyEdge()) {
      throw new NotSupportedError(
        'Microsoft Edge Legacy (https://support.microsoft.com/en-us/help/4533505/what-is-microsoft-edge-legacy) ' +
        'is deprecated and will not be able to connect to Twilio to make or receive calls after September 1st, 2020. ' +
        'Please see this documentation for a list of supported browsers ' +
        'https://www.twilio.com/docs/voice/client/javascript#supported-browsers',
      );
    }

    if (!Device.isSupported && (options as IExtendedDeviceOptions).ignoreBrowserSupport) {
      if (window && window.location && window.location.protocol === 'http:') {
        throw new NotSupportedError(`twilio.js wasn't able to find WebRTC browser support. \
          This is most likely because this page is served over http rather than https, \
          which does not support WebRTC in many browsers. Please load this page over https and \
          try again.`);
      }

      throw new NotSupportedError(`twilio.js 1.3+ SDKs require WebRTC browser support. \
        For more information, see <https://www.twilio.com/docs/api/client/twilio-js>. \
        If you have any questions about this announcement, please contact \
        Twilio Support at <help@twilio.com>.`);
    }

    const root: any = globalThis as any;
    const browser: any = root.msBrowser || root.browser || root.chrome;

    this._isBrowserExtension = (!!browser && !!browser.runtime && !!browser.runtime.id)
      || (!!root.safari && !!root.safari.extension);

    if (this._isBrowserExtension) {
      this._log.info('Running as browser extension.');
    }

    if (navigator) {
      const n = navigator as any;
      this._networkInformation = n.connection
        || n.mozConnection
        || n.webkitConnection;
    }

    if (this._networkInformation && typeof this._networkInformation.addEventListener === 'function') {
      this._networkInformation.addEventListener('change', this._publishNetworkChange);
    }

    Device._getOrCreateAudioContext();

    if (Device._audioContext) {
      if (!Device._dialtonePlayer) {
        Device._dialtonePlayer = new DialtonePlayer(Device._audioContext);
      }
    }

    if (typeof Device._isUnifiedPlanDefault === 'undefined') {
      Device._isUnifiedPlanDefault = typeof window !== 'undefined'
        && typeof RTCPeerConnection !== 'undefined'
        && typeof RTCRtpTransceiver !== 'undefined'
      ? isUnifiedPlanDefault(window, window.navigator, RTCPeerConnection, RTCRtpTransceiver)
      : false;
    }

    this._boundDestroy = this.destroy.bind(this);
    this._boundConfirmClose = this._confirmClose.bind(this);

    if (typeof window !== 'undefined' && window.addEventListener) {
      window.addEventListener('unload', this._boundDestroy);
      window.addEventListener('pagehide', this._boundDestroy);
    }

    this.updateOptions(options);
  }

  /**
   * Return the {@link AudioHelper} used by this {@link Device}.
   */
  get audio(): AudioHelper | null {
    return this._audio;
  }

  /**
   * Make an outgoing Call.
   * @param options
   */
  async connect(options: Device.ConnectOptions = { }): Promise<Call> {
    this._log.debug('.connect', JSON.stringify(options));
    this._throwIfDestroyed();
    if (this._activeCall) {
      throw new InvalidStateError('A Call is already active');
    }

    let customParameters;
    let parameters;
    let signalingReconnectToken;

    if (options.connectToken) {
      try {
        const connectTokenParts = JSON.parse(decodeURIComponent(atob(options.connectToken)));
        customParameters = connectTokenParts.customParameters;
        parameters = connectTokenParts.parameters;
        signalingReconnectToken = connectTokenParts.signalingReconnectToken;
      } catch {
        throw new InvalidArgumentError('Cannot parse connectToken');
      }

      if (!parameters || !parameters.CallSid || !signalingReconnectToken) {
        throw new InvalidArgumentError('Invalid connectToken');
      }
    }

    let isReconnect = false;
    let twimlParams: Record<string, string> = {};
    const callOptions: Call.Options = {
      enableImprovedSignalingErrorPrecision:
      !!this._options.enableImprovedSignalingErrorPrecision,
      rtcConfiguration: options.rtcConfiguration,
      voiceEventSidGenerator: this._options.voiceEventSidGenerator,
    };

    if (signalingReconnectToken && parameters) {
      isReconnect = true;
      callOptions.callParameters = parameters;
      callOptions.reconnectCallSid = parameters.CallSid;
      callOptions.reconnectToken = signalingReconnectToken;
      twimlParams = customParameters || twimlParams;
    } else {
      twimlParams = options.params || twimlParams;
    }

    let activeCall;
    this._makeCallPromise = this._makeCall(twimlParams, callOptions, isReconnect);
    try {
      activeCall = this._activeCall = await this._makeCallPromise;
    } finally {
      this._makeCallPromise = null;
    }

    // Make sure any incoming calls are ignored
    this._calls.splice(0).forEach(call => call.ignore());

    // Stop the incoming sound if it's playing
    this._soundcache.get(Device.SoundName.Incoming).stop();

    activeCall.accept({ rtcConstraints: options.rtcConstraints });
    this._publishNetworkChange();
    return activeCall;
  }

  /**
   * Return the calls that this {@link Device} is maintaining.
   */
  get calls(): Call[] {
    return this._calls;
  }

  /**
   * Destroy the {@link Device}, freeing references to be garbage collected.
   */
  destroy(): void {
    this._log.debug('.destroy');

    this._log.debug('Rejecting any incoming calls');
    const calls = this._calls.slice(0);
    calls.forEach((call: Call) => call.reject());

    this.disconnectAll();
    this._stopRegistrationTimer();

    this._destroyStream();
    this._destroyAudioHelper();
    this._audioProcessorEventObserver?.destroy();
    this._destroyPublisher();

    if (this._networkInformation && typeof this._networkInformation.removeEventListener === 'function') {
      this._networkInformation.removeEventListener('change', this._publishNetworkChange);
    }

    if (typeof window !== 'undefined' && window.removeEventListener) {
      window.removeEventListener('beforeunload', this._boundConfirmClose);
      window.removeEventListener('unload', this._boundDestroy);
      window.removeEventListener('pagehide', this._boundDestroy);
    }

    this._setState(Device.State.Destroyed);
    EventEmitter.prototype.removeAllListeners.call(this);
  }

  /**
   * Disconnect all {@link Call}s.
   */
  disconnectAll(): void {
    this._log.debug('.disconnectAll');
    const calls = this._calls.splice(0);
    calls.forEach((call: Call) => call.disconnect());

    if (this._activeCall) {
      this._activeCall.disconnect();
    }
  }

  /**
   * Returns the {@link Edge} value the {@link Device} is currently connected
   * to. The value will be `null` when the {@link Device} is offline.
   */
  get edge(): string | null {
    return this._edge;
  }

  /**
   * Returns the home value the {@link Device} is currently connected
   * to. The value will be `null` when the {@link Device} is offline.
   */
  get home(): string | null {
    return this._home;
  }

  /**
   * Returns the identity associated with the {@link Device} for incoming calls. Only
   * populated when registered.
   */
  get identity(): string | null {
    return this._identity;
  }

  /**
   * Whether the Device is currently on an active Call.
   */
  get isBusy(): boolean {
    return !!this._activeCall;
  }

  /**
   * Register the `Device` to the Twilio backend, allowing it to receive calls.
   */
  async register(): Promise<void> {
    this._log.debug('.register');
    if (this.state !== Device.State.Unregistered) {
      throw new InvalidStateError(
        `Attempt to register when device is in state "${this.state}". ` +
        `Must be "${Device.State.Unregistered}".`,
      );
    }

    this._shouldReRegister = false;
    this._setState(Device.State.Registering);

    await (this._streamConnectedPromise || this._setupStream());
    await this._sendPresence(true);
    await promisifyEvents(this, Device.State.Registered, Device.State.Unregistered);
  }

  /**
   * Get the state of this {@link Device} instance
   */
  get state(): Device.State {
    return this._state;
  }

  /**
   * Get the token used by this {@link Device}.
   */
  get token(): string | null {
    return this._token;
  }

  /**
   * String representation of {@link Device} instance.
   * @private
   */
  toString() {
    return '[Twilio.Device instance]';
  }

  /**
   * Unregister the `Device` to the Twilio backend, disallowing it to receive
   * calls.
   */
  async unregister(): Promise<void> {
    this._log.debug('.unregister');
    if (this.state !== Device.State.Registered) {
      throw new InvalidStateError(
        `Attempt to unregister when device is in state "${this.state}". ` +
        `Must be "${Device.State.Registered}".`,
      );
    }

    this._shouldReRegister = false;

    const stream = await this._streamConnectedPromise;
    const streamOfflinePromise = new Promise(resolve => {
      stream.on('offline', resolve);
    });
    await this._sendPresence(false);
    await streamOfflinePromise;
  }

  /**
   * Set the options used within the {@link Device}.
   * @param options
   */
  updateOptions(options: Device.Options = { }): void {
    this._logOptions('updateOptions', options);
    if (this.state === Device.State.Destroyed) {
      throw new InvalidStateError(
        `Attempt to "updateOptions" when device is in state "${this.state}".`,
      );
    }

    this._options = { ...this._defaultOptions, ...this._options, ...options };

    const originalChunderURIs: Set<string> = new Set(this._chunderURIs);

    const newChunderURIs = this._chunderURIs = (
      this._getChunderws() || getChunderURIs(this._options.edge)
    ).map(createSignalingEndpointURL);

    let hasChunderURIsChanged = originalChunderURIs.size !== newChunderURIs.length;

    if (!hasChunderURIsChanged) {
      for (const uri of newChunderURIs) {
        if (!originalChunderURIs.has(uri)) {
          hasChunderURIsChanged = true;
          break;
        }
      }
    }

    if (this.isBusy && hasChunderURIsChanged) {
      throw new InvalidStateError('Cannot change Edge while on an active Call');
    }

    this._setupLoglevel(this._options.logLevel);

    for (const name of Object.keys(Device._defaultSounds)) {
      const soundDef: ISoundDefinition = Device._defaultSounds[name];

      const defaultUrl: string = `${C.SOUNDS_BASE_URL}/${soundDef.filename}.${Device.extension}`
        + `?cache=${C.RELEASE_VERSION}`;

      const soundUrl: string = this._options.sounds && this._options.sounds[name as Device.SoundName] || defaultUrl;
      const sound: any = new (this._options.Sound || Sound)(name, soundUrl, {
        audioContext: this._options.disableAudioContextSounds ? null : Device.audioContext,
        maxDuration: soundDef.maxDuration,
        shouldLoop: soundDef.shouldLoop,
      });

      this._soundcache.set(name as Device.SoundName, sound);
    }

    this._setupAudioHelper();
    this._setupPublisher();

    if (hasChunderURIsChanged && this._streamConnectedPromise) {
      this._setupStream();
    }

    // Setup close protection and make sure we clean up ongoing calls on unload.
    if (
      typeof window !== 'undefined' &&
      typeof window.addEventListener === 'function' &&
      this._options.closeProtection
    ) {
      window.removeEventListener('beforeunload', this._boundConfirmClose);
      window.addEventListener('beforeunload', this._boundConfirmClose);
    }
  }

  /**
   * Update the token used by this {@link Device} to connect to Twilio.
   * It is recommended to call this API after [[Device.tokenWillExpireEvent]] is emitted,
   * and before or after a call to prevent a potential ~1s audio loss during the update process.
   * @param token
   */
  updateToken(token: string) {
    this._log.debug('.updateToken');
    if (this.state === Device.State.Destroyed) {
      throw new InvalidStateError(
        `Attempt to "updateToken" when device is in state "${this.state}".`,
      );
    }

    if (typeof token !== 'string') {
      throw new InvalidArgumentError(INVALID_TOKEN_MESSAGE);
    }

    this._token = token;

    if (this._stream) {
      this._stream.setToken(this._token);
    }

    if (this._publisher) {
      this._publisher.setToken(this._token);
    }
  }

  /**
   * Called on window's beforeunload event if closeProtection is enabled,
   * preventing users from accidentally navigating away from an active call.
   * @param event
   */
  private _confirmClose(event: any): string {
    if (!this._activeCall) { return ''; }

    const closeProtection: boolean | string = this._options.closeProtection || false;
    const confirmationMsg: string = typeof closeProtection !== 'string'
      ? 'A call is currently in-progress. Leaving or reloading this page will end the call.'
      : closeProtection;

    (event || window.event).returnValue = confirmationMsg;
    return confirmationMsg;
  }

  /**
   * Create the default Insights payload
   * @param call
   */
  private _createDefaultPayload = (call?: Call): Record<string, any> => {
    const payload: Record<string, any> = {
      aggressive_nomination: this._options.forceAggressiveIceNomination,
      browser_extension: this._isBrowserExtension,
      dscp: !!this._options.dscp,
      ice_restart_enabled: true,
      platform: rtc.getMediaEngine(),
      sdk_version: C.RELEASE_VERSION,
    };

    function setIfDefined(propertyName: string, value: string | undefined | null) {
      if (value) { payload[propertyName] = value; }
    }

    if (call) {
      const callSid = call.parameters.CallSid;
      setIfDefined('call_sid', /^TJ/.test(callSid) ? undefined : callSid);
      setIfDefined('temp_call_sid', call.outboundConnectionId);
      setIfDefined('audio_codec', call.codec);
      payload.direction = call.direction;
    }

    setIfDefined('gateway', this._stream && this._stream.gateway);
    setIfDefined('region', this._stream && this._stream.region);

    return payload;
  }

  /**
   * Destroy the AudioHelper.
   */
  private _destroyAudioHelper() {
    if (!this._audio) { return; }
    this._audio._destroy();
    this._audio = null;
  }

  /**
   * Destroy the publisher.
   */
  private _destroyPublisher() {
    // Attempt to destroy non-existent publisher.
    if (!this._publisher) { return; }

    this._publisher = null;
  }

  /**
   * Destroy the connection to the signaling server.
   */
  private _destroyStream() {
    if (this._stream) {
      this._stream.removeListener('close', this._onSignalingClose);
      this._stream.removeListener('connected', this._onSignalingConnected);
      this._stream.removeListener('error', this._onSignalingError);
      this._stream.removeListener('invite', this._onSignalingInvite);
      this._stream.removeListener('offline', this._onSignalingOffline);
      this._stream.removeListener('ready', this._onSignalingReady);

      this._stream.destroy();
      this._stream = null;
    }

    this._onSignalingOffline();

    this._streamConnectedPromise = null;
  }

  /**
   * Find a {@link Call} by its CallSid.
   * @param callSid
   */
  private _findCall(callSid: string): Call | null {
    return this._calls.find(call => call.parameters.CallSid === callSid
      || call.outboundConnectionId === callSid) || null;
  }

  /**
   * Get chunderws array from the chunderw param
   */
  private _getChunderws(): string[] | null {
    return typeof this._options.chunderw === 'string' ? [this._options.chunderw]
      : Array.isArray(this._options.chunderw) ? this._options.chunderw : null;
  }

  /**
   * Utility function to log device options
   */
  private _logOptions(caller: string, options: Device.Options = { }): void {
    // Selectively log options that users can modify.
    // Also, convert user overrides.
    // This prevents potential app crash when calling JSON.stringify
    // and when sending log strings remotely
    const userOptions = [
      'allowIncomingWhileBusy',
      'appName',
      'appVersion',
      'closeProtection',
      'codecPreferences',
      'disableAudioContextSounds',
      'dscp',
      'edge',
      'enableImprovedSignalingErrorPrecision',
      'forceAggressiveIceNomination',
      'logLevel',
      'maxAverageBitrate',
      'maxCallSignalingTimeoutMs',
      'sounds',
      'tokenRefreshMs',
    ];
    const userOptionOverrides = [
      'RTCPeerConnection',
      'enumerateDevices',
      'getUserMedia',
      'MediaStream',
    ];
    if (typeof options === 'object') {
      const toLog: any = { ...options };
      Object.keys(toLog).forEach((key: string) => {
        if (!userOptions.includes(key) && !userOptionOverrides.includes(key)) {
          delete toLog[key];
        }
        if (userOptionOverrides.includes(key)) {
          toLog[key] = true;
        }
      });
      this._log.debug(`.${caller}`, JSON.stringify(toLog));
    }
  }

  /**
   * Create a new {@link Call}.
   * @param twimlParams - A flat object containing key:value pairs to be sent to the TwiML app.
   * @param options - Options to be used to instantiate the {@link Call}.
   */
  private async _makeCall(twimlParams: Record<string, string>, options?: Call.Options, isReconnect: boolean = false): Promise<Call> {
    if (typeof Device._isUnifiedPlanDefault === 'undefined') {
      throw new InvalidStateError('Device has not been initialized.');
    }

    // Wait for the input device if it's set by the user
    const inputDevicePromise = this._audio?._getInputDevicePromise();
    if (inputDevicePromise) {
      this._log.debug('inputDevicePromise detected, waiting...');
      await inputDevicePromise;
      this._log.debug('inputDevicePromise resolved');
    }

    const config: Call.Config = {
      audioHelper: this._audio,
      isUnifiedPlanDefault: Device._isUnifiedPlanDefault,
      onIgnore: (): void => {
        this._soundcache.get(Device.SoundName.Incoming).stop();
      },
      pstream: await (this._streamConnectedPromise || this._setupStream()),
      publisher: this._publisher,
      soundcache: this._soundcache,
    };

    options = Object.assign({
      MediaStream: this._options.MediaStream,
      RTCPeerConnection: this._options.RTCPeerConnection,
      beforeAccept: (currentCall: Call) => {
        if (!this._activeCall || this._activeCall === currentCall) {
          return;
        }

        this._activeCall.disconnect();
        this._removeCall(this._activeCall);
      },
      codecPreferences: this._options.codecPreferences,
      customSounds: this._options.sounds,
      dialtonePlayer: Device._dialtonePlayer,
      dscp: this._options.dscp,
      // TODO(csantos): Remove forceAggressiveIceNomination option in 3.x
      forceAggressiveIceNomination: this._options.forceAggressiveIceNomination,
      getInputStream: (): MediaStream | null => this._options.fileInputStream || this._callInputStream,
      getSinkIds: (): string[] => this._callSinkIds,
      maxAverageBitrate: this._options.maxAverageBitrate,
      preflight: this._options.preflight,
      rtcConstraints: this._options.rtcConstraints,
      shouldPlayDisconnect: () => this._audio?.disconnect(),
      twimlParams,
      voiceEventSidGenerator: this._options.voiceEventSidGenerator,
    }, options);

    const maybeUnsetPreferredUri = () => {
      if (!this._stream) {
        this._log.warn('UnsetPreferredUri called without a stream');
        return;
      }
      if (this._activeCall === null && this._calls.length === 0) {
        this._stream.updatePreferredURI(null);
      }
    };

    const call = new (this._options.Call || Call)(config, options);

    this._publisher.info('settings', 'init', {
      MediaStream: !!this._options.MediaStream,
      RTCPeerConnection: !!this._options.RTCPeerConnection,
      enumerateDevices: !!this._options.enumerateDevices,
      getUserMedia: !!this._options.getUserMedia,
    }, call);

    call.once('accept', () => {
      this._stream.updatePreferredURI(this._preferredURI);
      this._removeCall(call);
      this._activeCall = call;
      if (this._audio) {
        this._audio._maybeStartPollingVolume();
      }

      if (call.direction === Call.CallDirection.Outgoing && this._audio?.outgoing() && !isReconnect) {
        this._soundcache.get(Device.SoundName.Outgoing).play();
      }

      const data: any = { edge: this._edge || this._region };
      if (this._options.edge) {
        data['selected_edge'] = Array.isArray(this._options.edge)
          ? this._options.edge
          : [this._options.edge];
      }

      this._publisher.info('settings', 'edge', data, call);

      if (this._audio?.processedStream) {
        this._audioProcessorEventObserver?.emit('enabled');
      }
    });

    call.addListener('error', (error: TwilioError) => {
      if (call.status() === 'closed') {
        this._removeCall(call);
        maybeUnsetPreferredUri();
      }
      if (this._audio) {
        this._audio._maybeStopPollingVolume();
      }
      this._maybeStopIncomingSound();
    });

    call.once('cancel', () => {
      this._log.info(`Canceled: ${call.parameters.CallSid}`);
      this._removeCall(call);
      maybeUnsetPreferredUri();
      if (this._audio) {
        this._audio._maybeStopPollingVolume();
      }
      this._maybeStopIncomingSound();
    });

    call.once('disconnect', () => {
      if (this._audio) {
        this._audio._maybeStopPollingVolume();
      }
      this._removeCall(call);
      maybeUnsetPreferredUri();
      /**
       * NOTE(kamalbennani): We need to stop the incoming sound when the call is
       * disconnected right after the user has accepted the call (activeCall.accept()), and before
       * the call has been fully connected (i.e. before the `pstream.answer` event)
       */
      this._maybeStopIncomingSound();
    });

    call.once('reject', () => {
      this._log.info(`Rejected: ${call.parameters.CallSid}`);
      if (this._audio) {
        this._audio._maybeStopPollingVolume();
      }
      this._removeCall(call);
      maybeUnsetPreferredUri();
      this._maybeStopIncomingSound();
    });

    call.on('transportClose', () => {
      if (call.status() !== Call.State.Pending) {
        return;
      }
      if (this._audio) {
        this._audio._maybeStopPollingVolume();
      }
      this._removeCall(call);
      /**
       * NOTE(mhuynh): We don't want to call `maybeUnsetPreferredUri` because
       * a `transportClose` will happen during signaling reconnection.
       */
      this._maybeStopIncomingSound();
    });

    return call;
  }

  /**
   * Stop the incoming sound if no {@link Call}s remain.
   */
  private _maybeStopIncomingSound(): void {
    if (!this._calls.length) {
      this._soundcache.get(Device.SoundName.Incoming).stop();
    }
  }

  /**
   * Called when a 'close' event is received from the signaling stream.
   */
  private _onSignalingClose = () => {
    this._stream = null;
    this._streamConnectedPromise = null;
  }

  /**
   * Called when a 'connected' event is received from the signaling stream.
   */
  private _onSignalingConnected = (payload: Record<string, any>) => {
    const region = getRegionShortcode(payload.region);
    this._edge = payload.edge || regionToEdge[region as Region] || payload.region;
    this._region = region || payload.region;
    this._home = payload.home;
    this._publisher?.setHost(createEventGatewayURI(payload.home));

    if (payload.token) {
      this._identity = payload.token.identity;
      if (
        typeof payload.token.ttl === 'number' &&
        typeof this._options.tokenRefreshMs === 'number'
      ) {
        const ttlMs: number = payload.token.ttl * 1000;
        const timeoutMs: number = Math.max(0, ttlMs - this._options.tokenRefreshMs);
        this._tokenWillExpireTimeout = setTimeout(() => {
          this._log.debug('#tokenWillExpire');
          this.emit('tokenWillExpire', this);
          if (this._tokenWillExpireTimeout) {
            clearTimeout(this._tokenWillExpireTimeout);
            this._tokenWillExpireTimeout = null;
          }
        }, timeoutMs);
      }
    }

    const preferredURIs = this._getChunderws() || getChunderURIs(this._edge as Edge);
    if (preferredURIs.length > 0) {
      const [preferredURI] = preferredURIs;
      this._preferredURI = createSignalingEndpointURL(preferredURI);
    } else {
      this._log.warn('Could not parse a preferred URI from the stream#connected event.');
    }

    // The signaling stream emits a `connected` event after reconnection, if the
    // device was registered before this, then register again.
    if (this._shouldReRegister) {
      this.register();
    }
  }

  /**
   * Called when an 'error' event is received from the signaling stream.
   */
  private _onSignalingError = (payload: Record<string, any>) => {
    if (typeof payload !== 'object') {
      this._log.warn('Invalid signaling error payload', payload);
      return;
    }

    const { error: originalError, callsid, voiceeventsid } = payload;

    // voiceeventsid is for call message events which are handled in the call object
    // missing originalError shouldn't be possible but check here to fail properly
    if (typeof originalError !== 'object' || !!voiceeventsid) {
      this._log.warn('Ignoring signaling error payload', { originalError, voiceeventsid });
      return;
    }

    const call: Call | undefined =
      (typeof callsid === 'string' && this._findCall(callsid)) || undefined;

    const { code, message: customMessage } = originalError;
    let { twilioError } = originalError;

    if (typeof code === 'number') {
      if (code === 31201) {
        twilioError = new AuthorizationErrors.AuthenticationFailed(originalError);
      } else if (code === 31204) {
        twilioError = new AuthorizationErrors.AccessTokenInvalid(originalError);
      } else if (code === 31205) {
        // Stop trying to register presence after token expires
        this._stopRegistrationTimer();
        twilioError = new AuthorizationErrors.AccessTokenExpired(originalError);
      } else {
        const errorConstructor = getPreciseSignalingErrorByCode(
          !!this._options.enableImprovedSignalingErrorPrecision,
          code,
        );
        if (typeof errorConstructor !== 'undefined') {
          twilioError = new errorConstructor(originalError);
        }
      }
    }

    if (!twilioError) {
      this._log.error('Unknown signaling error: ', originalError);
      twilioError = new GeneralErrors.UnknownError(customMessage, originalError);
    }

    this._log.error('Received error: ', twilioError);
    this._log.debug('#error', originalError);
    this.emit(Device.EventName.Error, twilioError, call);
  }

  /**
   * Called when an 'invite' event is received from the signaling stream.
   */
  private _onSignalingInvite = async (payload: Record<string, any>) => {
    const wasBusy = !!this._activeCall;
    if (wasBusy && !this._options.allowIncomingWhileBusy) {
      this._log.info('Device busy; ignoring incoming invite');
      return;
    }

    if (!payload.callsid || !payload.sdp) {
      this._log.debug('#error', payload);
      this.emit(Device.EventName.Error, new ClientErrors.BadRequest('Malformed invite from gateway'));
      return;
    }

    const callParameters = payload.parameters || { };
    callParameters.CallSid = callParameters.CallSid || payload.callsid;

    const customParameters = Object.assign({ }, queryToJson(callParameters.Params));

    this._makeCallPromise = this._makeCall(
      customParameters,
      {
        callParameters,
        enableImprovedSignalingErrorPrecision:
          !!this._options.enableImprovedSignalingErrorPrecision,
        offerSdp: payload.sdp,
        reconnectToken: payload.reconnect,
        voiceEventSidGenerator: this._options.voiceEventSidGenerator,
      },
    );

    let call;
    try {
      call = await this._makeCallPromise;
    } finally {
      this._makeCallPromise = null;
    }

    this._calls.push(call);

    call.once('accept', () => {
      this._soundcache.get(Device.SoundName.Incoming).stop();
      this._publishNetworkChange();
    });

    const play = (this._audio?.incoming() && !wasBusy)
      ? () => this._soundcache.get(Device.SoundName.Incoming).play()
      : () => Promise.resolve();

    this._showIncomingCall(call, play);
  }

  /**
   * Called when an 'offline' event is received from the signaling stream.
   */
  private _onSignalingOffline = () => {
    this._log.info('Stream is offline');

    this._edge = null;
    this._region = null;

    this._shouldReRegister = this.state !== Device.State.Unregistered;

    this._setState(Device.State.Unregistered);
  }

  /**
   * Called when a 'ready' event is received from the signaling stream.
   */
  private _onSignalingReady = () => {
    this._log.info('Stream is ready');

    this._setState(Device.State.Registered);
  }

  /**
   * Publish a NetworkInformation#change event to Insights if there's an active {@link Call}.
   */
  private _publishNetworkChange = () => {
    if (!this._activeCall) {
      return;
    }

    if (this._networkInformation) {
      this._publisher.info('network-information', 'network-change', {
        connection_type: this._networkInformation.type,
        downlink: this._networkInformation.downlink,
        downlinkMax: this._networkInformation.downlinkMax,
        effective_type: this._networkInformation.effectiveType,
        rtt: this._networkInformation.rtt,
      }, this._activeCall);
    }
  }

  /**
   * Remove a {@link Call} from device.calls by reference
   * @param call
   */
  private _removeCall(call: Call): void {
    if (this._activeCall === call) {
      this._activeCall = null;
      this._makeCallPromise = null;
    }

    for (let i = this._calls.length - 1; i >= 0; i--) {
      if (call === this._calls[i]) {
        this._calls.splice(i, 1);
      }
    }
  }

  /**
   * Register with the signaling server.
   */
  private async _sendPresence(presence: boolean): Promise<void> {
    const stream = await this._streamConnectedPromise;

    if (!stream) { return; }

    stream.register({ audio: presence });
    if (presence) {
      this._startRegistrationTimer();
    } else {
      this._stopRegistrationTimer();
    }
  }

  /**
   * Helper function that sets and emits the state of the device.
   * @param state The new state of the device.
   */
   private _setState(state: Device.State): void {
    if (state === this.state) {
      return;
    }

    this._state = state;
    const name = this._stateEventMapping[state];
    this._log.debug(`#${name}`);
    this.emit(name);
  }

  /**
   * Set up an audio helper for usage by this {@link Device}.
   */
  private _setupAudioHelper(): void {
    if (!this._audioProcessorEventObserver) {
      this._audioProcessorEventObserver = new AudioProcessorEventObserver();
      this._audioProcessorEventObserver.on('event', ({ name, group }) => {
        this._publisher.info(group, name, {}, this._activeCall);
      });
    }

    const audioOptions: AudioHelper.Options = {
      audioContext: Device.audioContext,
      audioProcessorEventObserver: this._audioProcessorEventObserver,
      beforeSetInputDevice: () => {
        if (this._makeCallPromise) {
          this._log.debug('beforeSetInputDevice pause detected');
          return this._makeCallPromise;
        } else {
          this._log.debug('beforeSetInputDevice pause not detected, setting default');
          return Promise.resolve();
        }
      },
      enumerateDevices: this._options.enumerateDevices,
      getUserMedia: this._options.getUserMedia || getUserMedia,
    };

    if (this._audio) {
      this._log.info('Found existing audio helper; updating options...');
      this._audio._updateUserOptions(audioOptions);
      return;
    }

    this._audio = new (this._options.AudioHelper || AudioHelper)(
      this._updateSinkIds,
      this._updateInputStream,
      audioOptions,
    );

    this._audio.on('deviceChange', (lostActiveDevices: MediaDeviceInfo[]) => {
      const activeCall: Call | null = this._activeCall;
      const deviceIds: string[] = lostActiveDevices.map((device: MediaDeviceInfo) => device.deviceId);

      this._publisher.info('audio', 'device-change', {
        lost_active_device_ids: deviceIds,
      }, activeCall);

      if (activeCall) {
        activeCall['_mediaHandler']._onInputDevicesChanged();
      }
    });
  }

  /**
   * Setup logger's loglevel
   */
  private _setupLoglevel(logLevel?: LogLevelDesc): void {
    const level = typeof logLevel === 'number' ||
      typeof logLevel === 'string' ?
      logLevel : LogLevels.ERROR;

    this._log.setDefaultLevel(level);
    this._log.info('Set logger default level to', level);
  }

  /**
   * Create and set a publisher for the {@link Device} to use.
   */
  private _setupPublisher(): IPublisher {
    if (this._publisher) {
      this._log.info('Found existing publisher; destroying...');
      this._destroyPublisher();
    }

    const publisherOptions = {
      defaultPayload: this._createDefaultPayload,
      metadata: {
        app_name: this._options.appName,
        app_version: this._options.appVersion,
      },
    } as any;

    if (this._options.eventgw) {
      publisherOptions.host = this._options.eventgw;
    }

    if (this._home) {
      publisherOptions.host = createEventGatewayURI(this._home);
    }

    this._publisher = new (this._options.Publisher || Publisher)(PUBLISHER_PRODUCT_NAME, this.token, publisherOptions);

    if (this._options.publishEvents === false) {
      this._publisher.disable();
    } else {
      this._publisher.on('error', (error: Error) => {
        this._log.warn('Cannot connect to insights.', error);
      });
    }

    return this._publisher;
  }

  /**
   * Set up the connection to the signaling server. Tears down an existing
   * stream if called while a stream exists.
   */
  private _setupStream(): Promise<IPStream> {
    if (this._stream) {
      this._log.info('Found existing stream; destroying...');
      this._destroyStream();
    }

    this._log.info('Setting up VSP');
    this._stream = new (this._options.PStream || PStream)(
      this.token,
      this._chunderURIs,
      {
        backoffMaxMs: this._options.backoffMaxMs,
        maxPreferredDurationMs: this._options.maxCallSignalingTimeoutMs,
      },
    );

    this._stream.addListener('close', this._onSignalingClose);
    this._stream.addListener('connected', this._onSignalingConnected);
    this._stream.addListener('error', this._onSignalingError);
    this._stream.addListener('invite', this._onSignalingInvite);
    this._stream.addListener('offline', this._onSignalingOffline);
    this._stream.addListener('ready', this._onSignalingReady);

    return this._streamConnectedPromise =
      promisifyEvents(this._stream, 'connected', 'close').then(() => this._stream);
  }

  /**
   * Start playing the incoming ringtone, and subsequently emit the incoming event.
   * @param call
   * @param play - The function to be used to play the sound. Must return a Promise.
   */
  private _showIncomingCall(call: Call, play: Function): Promise<void> {
    let timeout: NodeJS.Timeout;
    return Promise.race([
      play(),
      new Promise((resolve, reject) => {
        timeout = setTimeout(() => {
          const msg = 'Playing incoming ringtone took too long; it might not play. Continuing execution...';
          reject(new Error(msg));
        }, RINGTONE_PLAY_TIMEOUT);
      }),
    ]).catch(reason => {
      this._log.warn(reason.message);
    }).then(() => {
      clearTimeout(timeout);
      this._log.debug('#incoming', JSON.stringify({
        customParameters: call.customParameters,
        parameters: call.parameters,
      }));
      this.emit(Device.EventName.Incoming, call);
    });
  }

  /**
   * Set a timeout to send another register message to the signaling server.
   */
  private _startRegistrationTimer(): void {
    this._stopRegistrationTimer();
    this._regTimer = setTimeout(() => {
      this._sendPresence(true);
    }, REGISTRATION_INTERVAL);
  }

  /**
   * Stop sending registration messages to the signaling server.
   */
  private _stopRegistrationTimer(): void {
    if (this._regTimer) {
      clearTimeout(this._regTimer);
    }
  }

  /**
   * Throw an error if the {@link Device} is destroyed.
   */
  private _throwIfDestroyed(): void {
    if (this.state === Device.State.Destroyed) {
      throw new InvalidStateError('Device has been destroyed.');
    }
  }

  /**
   * Update the input stream being used for calls so that any current call and all future calls
   * will use the new input stream.
   * @param inputStream
   */
  private _updateInputStream = (inputStream: MediaStream | null): Promise<void> => {
    const call: Call | null = this._activeCall;

    if (call && !inputStream) {
      return Promise.reject(new InvalidStateError('Cannot unset input device while a call is in progress.'));
    }

    this._callInputStream = inputStream;
    return call
      ? call._setInputTracksFromStream(inputStream)
      : Promise.resolve();
  }

  /**
   * Update the device IDs of output devices being used to play the incoming ringtone through.
   * @param sinkIds - An array of device IDs
   */
  private _updateRingtoneSinkIds(sinkIds: string[]): Promise<void> {
    return Promise.resolve(this._soundcache.get(Device.SoundName.Incoming).setSinkIds(sinkIds));
  }

  /**
   * Update the device IDs of output devices being used to play sounds through.
   * @param type - Whether to update ringtone or speaker sounds
   * @param sinkIds - An array of device IDs
   */
  private _updateSinkIds = (type: 'ringtone' | 'speaker', sinkIds: string[]): Promise<void> => {
    const promise: Promise<void> = type === 'ringtone'
      ? this._updateRingtoneSinkIds(sinkIds)
      : this._updateSpeakerSinkIds(sinkIds);

    return promise.then(() => {
      this._publisher.info('audio', `${type}-devices-set`, {
        audio_device_ids: sinkIds,
      }, this._activeCall);
    }, error => {
      this._publisher.error('audio', `${type}-devices-set-failed`, {
        audio_device_ids: sinkIds,
        message: error.message,
      }, this._activeCall);

      throw error;
    });
  }

  /**
   * Update the device IDs of output devices being used to play the non-ringtone sounds
   * and Call audio through.
   * @param sinkIds - An array of device IDs
   */
  private _updateSpeakerSinkIds(sinkIds: string[]): Promise<void> {
    Array.from(this._soundcache.entries())
      .filter(entry => entry[0] !== Device.SoundName.Incoming)
      .forEach(entry => entry[1].setSinkIds(sinkIds));

    this._callSinkIds = sinkIds;
    const call = this._activeCall;
    return call
      ? call._setSinkIds(sinkIds)
      : Promise.resolve();
  }
}

/**
 * @mergeModuleWith Device
 */
namespace Device {
  /**
   * Emitted when the {@link Device} has been destroyed.
   * @event
   * @example
   * ```ts
   * device.on('destroyed', () => { });
   * ```
   */
  export declare function destroyedEvent(): void;

  /**
   * Emitted when the {@link Device} receives an error.
   * @event
   * @param error
   * @example
   * ```ts
   * device.on('error', call => { });
   * ```
   */
  export declare function errorEvent(error: TwilioError, call?: Call): void;

  /**
   * Emitted when an incoming {@link Call} is received. You can interact with the call object
   * using its public APIs, or you can forward it to a different {@link Device} using
   * {@link Device.connect} and {@link Call.connectToken}, enabling your application to
   * receive multiple incoming calls for the same identity.
   *
   * **Important:** When forwarding a call, the token for target device instance needs to have
   * the same identity as the token used in the device that originally received the call.
   * The target device instance must also have the same edge as the device that
   * originally received the call.
   *
   * @event
   * @param call - The incoming {@link Call}.
   * @example
   * ```js
   * const receiverDevice = new Device(token, options);
   * await receiverDevice.register();
   *
   * receiverDevice.on('incoming', (call) => {
   *   // Forward this call to a new Device instance using the call.connectToken string.
   *   forwardCall(call.connectToken, receiverDevice.edge);
   * });
   *
   * // The forwardCall function may look something like the following.
   * async function forwardCall(connectToken, edge) {
   *   // For every incoming call, we create a new Device instance which we can
   *   // interact with, without affecting other calls.
   *   // IMPORTANT: The token for this new device needs to have the same identity
   *   // as the token used in the receiverDevice.
   *   // The device must also be connected to the same edge as the receiverDevice.
   *   const options = { ..., edge };
   *   const device = new Device(token, options);
   *   const call = await device.connect({ connectToken });
   *
   *   // Destroy the device after the call is completed
   *   call.on('disconnect', () => device.destroy());
   * }
   * ```
   */
  export declare function incomingEvent(call: Call): void;

  /**
   * Emitted when the {@link Device} is unregistered.
   * @event
   * @example
   * ```ts
   * device.on('unregistered', () => { });
   * ```
   */
  export declare function unregisteredEvent(): void;

  /**
   * Emitted when the {@link Device} is registering.
   * @event
   * @example
   * ```ts
   * device.on('registering', () => { });
   * ```
   */
  export declare function registeringEvent(): void;

  /**
   * Emitted when the {@link Device} is registered.
   * @event
   * @example
   * ```ts
   * device.on('registered', () => { });
   * ```
   */
  export declare function registeredEvent(): void;

  /**
   * Emitted when the {@link Device}'s token is about to expire. Use DeviceOptions.refreshTokenMs
   * to set a custom warning time. Default is 10000 (10 seconds) prior to the token expiring.
   * @event
   * @param device
   * @example
   * ```ts
   * device.on('tokenWillExpire', device => {
   *   const token = getNewTokenViaAjax();
   *   device.updateToken(token);
   * });
   * ```
   */
  export declare function tokenWillExpireEvent(device: Device): void;

  /**
   * All valid {@link Device} event names.
   */
  export enum EventName {
    Error = 'error',
    Incoming = 'incoming',
    Destroyed = 'destroyed',
    Unregistered = 'unregistered',
    Registering = 'registering',
    Registered = 'registered',
    TokenWillExpire = 'tokenWillExpire',
  }

  /**
   * All possible {@link Device} states.
   */
  export enum State {
    Destroyed = 'destroyed',
    Unregistered = 'unregistered',
    Registering = 'registering',
    Registered = 'registered',
  }

  /**
   * Names of all sounds handled by the {@link Device}.
   */
  export enum SoundName {
    Incoming = 'incoming',
    Outgoing = 'outgoing',
    Disconnect = 'disconnect',
    Dtmf0 = 'dtmf0',
    Dtmf1 = 'dtmf1',
    Dtmf2 = 'dtmf2',
    Dtmf3 = 'dtmf3',
    Dtmf4 = 'dtmf4',
    Dtmf5 = 'dtmf5',
    Dtmf6 = 'dtmf6',
    Dtmf7 = 'dtmf7',
    Dtmf8 = 'dtmf8',
    Dtmf9 = 'dtmf9',
    DtmfS = 'dtmfs',
    DtmfH = 'dtmfh',
  }

  /**
   * Names of all togglable sounds.
   */
  export type ToggleableSound = Device.SoundName.Incoming | Device.SoundName.Outgoing | Device.SoundName.Disconnect;

  /**
   * Options to be passed to {@link Device.connect}.
   */
  export interface ConnectOptions extends Call.AcceptOptions {
    /**
     * The {@link Call.connectToken} to use to manually reconnect to an existing call.
     * A call can be manually reconnected if it was previously received (incoming)
     * or created (outgoing) from a {@link Device} instance.
     * A call is considered manually reconnected if it was created using the {@link Call.connectToken}.
     * It will always have a {@link Call.direction} property set to {@link Call.CallDirection.Outgoing}.
     *
     * **Warning: Only unanswered incoming calls can be manually reconnected at this time.**
     * **Invoking this method to an already answered call may introduce unexpected behavior.**
     *
     * See {@link Device.incomingEvent} for an example.
     */
    connectToken?: string;

    /**
     * A flat object containing key:value pairs to be sent to the TwiML app.
     */
    params?: Record<string, string>;
  }

  /**
   * Options that may be passed to the {@link Device} constructor, or Device.setup via public API
   */
  export interface Options {
    /**
     * Whether the Device should raise the {@link incomingEvent} event when a new call invite is
     * received while already on an active call. Default behavior is false.
     */
    allowIncomingWhileBusy?: boolean;

    /**
     * A name for the application that is instantiating the {@link Device}. This is used to improve logging
     * in Insights by associating Insights data with a specific application, particularly in the case where
     * one account may be connected to by multiple applications.
     */
    appName?: string;

    /**
     * A version for the application that is instantiating the {@link Device}. This is used to improve logging
     * in Insights by associating Insights data with a specific version of the given application. This can help
     * track down when application-level bugs were introduced.
     */
    appVersion?: string;

    /**
     * Whether to enable close protection, to prevent users from accidentally
     * navigating away from the page during a call. If string, the value will
     * be used as a custom message.
     */
    closeProtection?: boolean | string;

    /**
     * An ordered array of codec names, from most to least preferred.
     */
    codecPreferences?: Call.Codec[];

    /**
     * Whether AudioContext sounds should be disabled. Useful for trouble shooting sound issues
     * that may be caused by AudioContext-specific sounds. If set to true, will fall back to
     * HTMLAudioElement sounds.
     */
    disableAudioContextSounds?: boolean;

    /**
     * Whether to use googDscp in RTC constraints.
     */
    dscp?: boolean;

    /**
     * The edge value corresponds to the geographic location that the client
     * will use to connect to Twilio infrastructure. The default value is
     * "roaming" which automatically selects an edge based on the latency of the
     * client relative to available edges.
     */
    edge?: string[] | string;

    /**
     * Enhance the precision of errors emitted by `Device` and `Call` objects.
     *
     * The default value of this option is `false`.
     *
     * When this flag is enabled, some errors that would have been described
     * with a generic error code, namely `53000` and `31005`, are now described
     * with a more precise error code. With this feature, the following errors
     * now have their own error codes. Please see this
     * [page](https://www.twilio.com/docs/api/errors) for more details about
     * each error.
     *
     * - Device Error Changes
     *
     * @example
     * ```ts
     * const device = new Device(token, {
     *   enableImprovedSignalingErrorPrecision: true,
     * });
     * device.on('error', (deviceError) => {
     *   // the following table describes how deviceError will change with this feature flag
     * });
     * ```
     *
     * | Device Error Name | Device Error Code with Feature Flag Enabled | Device Error Code with Feature Flag Disabled |
     * | --- | --- | --- |
     * | `GeneralErrors.ApplicationNotFoundError` | `31001` | `53000` |
     * | `GeneralErrors.ConnectionDeclinedError` | `31002` | `53000` |
     * | `GeneralErrors.ConnectionTimeoutError` | `31003` | `53000` |
     * | `MalformedRequestErrors.MissingParameterArrayError` | `31101` | `53000` |
     * | `MalformedRequestErrors.AuthorizationTokenMissingError` | `31102` | `53000` |
     * | `MalformedRequestErrors.MaxParameterLengthExceededError` | `31103` | `53000` |
     * | `MalformedRequestErrors.InvalidBridgeTokenError` | `31104` | `53000` |
     * | `MalformedRequestErrors.InvalidClientNameError` | `31105` | `53000` |
     * | `MalformedRequestErrors.ReconnectParameterInvalidError` | `31107` | `53000` |
     * | `SignatureValidationErrors.AccessTokenSignatureValidationFailed` | `31202` | `53000` |
     * | `AuthorizationErrors.NoValidAccountError` | `31203` | `53000` |
     * | `AuthorizationErrors.JWTTokenExpirationTooLongError` | `31207` | `53000` |
     * | `ClientErrors.NotFound` | `31404` | `53000` |
     * | `ClientErrors.TemporarilyUnavilable` | `31480` | `53000` |
     * | `ClientErrors.BusyHere` | `31486` | `53000` |
     * | `SIPServerErrors.Decline` | `31603` | `53000` |
     *
     * - Call Error Changes
     *
     * @example
     * ```ts
     * const device = new Device(token, {
     *   enableImprovedSignalingErrorPrecision: true,
     * });
     * const call = device.connect(...);
     * call.on('error', (callError) => {
     *   // the following table describes how callError will change with this feature flag
     * });
     * ```
     *
     * | Call Error Name | Call Error Code with Feature Flag Enabled | Call Error Code with Feature Flag Disabled |
     * | --- | --- | --- |
     * | `GeneralErrors.ConnectionDeclinedError` | `31002` | `31005` |
     * | `AuthorizationErrors.InvalidJWTTokenError` | `31204` | `31005` |
     * | `AuthorizationErrors.JWTTokenExpiredError` | `31205` | `31005` |
     *
     */
    enableImprovedSignalingErrorPrecision?: boolean;

    /**
     * Overrides the native MediaDevices.enumerateDevices API.
     */
    enumerateDevices?: any;

    /**
     * Experimental feature.
     * Whether to use ICE Aggressive nomination.
     */
    forceAggressiveIceNomination?: boolean;

    /**
     * Overrides the native MediaDevices.getUserMedia API.
     */
    getUserMedia?: any;

    /**
     * Sets the log level.
     *
     * Possible values include any of the following numbers:
     * <br/>0 = trace, 1 = debug, 2 = info, 3 = warn, 4 = error, 5 = silent
     *
     * Or any of the following strings:
     * <br/>'trace', 'debug', 'info', 'warn', 'error', 'silent'
     * <br/>'TRACE', 'DEBUG', 'INFO', 'WARN', 'ERROR', 'SILENT'
     */
    logLevel?: LogLevelDesc;

    /**
     * The maximum average audio bitrate to use, in bits per second (bps) based on
     * [RFC-7587 7.1](https://tools.ietf.org/html/rfc7587#section-7.1). By default, the setting
     * is not used. If you specify 0, then the setting is not used. Any positive integer is allowed,
     * but values outside the range 6000 to 510000 are ignored and treated as 0. The recommended
     * bitrate for speech is between 8000 and 40000 bps as noted in
     * [RFC-7587 3.1.1](https://tools.ietf.org/html/rfc7587#section-3.1.1).
     */
    maxAverageBitrate?: number;

    /**
     * The maximum duration to attempt to reconnect to a preferred URI.
     * This is used by signaling reconnection in that during the existence of
     * any call, edge-fallback is disabled until this length of time has
     * elapsed.
     *
     * Using a value of 30000 as an example: while a call exists, the Device
     * will attempt to reconnect to the edge that the call was established on
     * for approximately 30 seconds. After the next failure to connect, the
     * Device will use edge-fallback.
     *
     * This feature is opt-in, and will not work until a number greater than 0
     * is explicitly specified within the Device options.
     *
     * Read more about edge fallback and signaling reconnection on the
     * [Edge Locations page](https://www.twilio.com/docs/voice/sdks/javascript/edges#edge-fallback-and-signaling-reconnection).
     *
     * **Note:** Setting this option to a value greater than zero means Twilio will not terminate the
     * call until the timeout has expired. Please take this into consideration if your application
     * contains webhooks that relies on [call status callbacks](https://www.twilio.com/docs/voice/twiml#callstatus-values).
     */
    maxCallSignalingTimeoutMs?: number;

    /**
     * Overrides the native MediaStream class.
     */
    MediaStream?: any;

    /**
     * Overrides the native RTCPeerConnection class.
     *
     * By default, the SDK will use the `unified-plan` SDP format if the browser supports it.
     * Unexpected behavior may happen if the `RTCPeerConnection` parameter uses an SDP format
     * that is different than what the SDK uses.
     *
     * For example, if the browser supports `unified-plan` and the `RTCPeerConnection`
     * parameter uses `plan-b` by default, the SDK will use `unified-plan`
     * which will cause conflicts with the usage of the `RTCPeerConnection`.
     *
     * In order to avoid this issue, you need to explicitly set the SDP format that you want
     * the SDK to use with the `RTCPeerConnection` via [[Device.ConnectOptions.rtcConfiguration]] for outgoing calls.
     * Or [[Call.AcceptOptions.rtcConfiguration]] for incoming calls.
     *
     * See the example below. Assuming the `RTCPeerConnection` you provided uses `plan-b` by default, the following
     * code sets the SDP format to `unified-plan` instead.
     *
     * ```ts
     * // Outgoing calls
     * const call = await device.connect({
     *   rtcConfiguration: {
     *     sdpSemantics: 'unified-plan'
     *   }
     *   // Other options
     * });
     *
     * // Incoming calls
     * device.on('incoming', call => {
     *   call.accept({
     *     rtcConfiguration: {
     *       sdpSemantics: 'unified-plan'
     *     }
     *     // Other options
     *   });
     * });
     * ```
     */
    RTCPeerConnection?: any;

    /**
     * A mapping of custom sound URLs by sound name.
     */
    sounds?: Partial<Record<Device.SoundName, string>>;

    /**
     * Number of milliseconds fewer than the token's TTL to emit the tokenWillExpire event.
     * Default is 10000 (10 seconds).
     */
    tokenRefreshMs?: number;
  }
}

export default Device;
