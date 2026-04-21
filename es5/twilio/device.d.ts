import { EventEmitter } from 'events';
import * as loglevel from 'loglevel';
import AudioHelper from './audiohelper';
import Call from './call';
import { TwilioError } from './errors';
import { PreflightTest } from './preflight/preflight';
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
declare class Device extends EventEmitter {
    /**
     * The AudioContext to be used by {@link Device} instances.
     * @private
     */
    static get audioContext(): AudioContext | undefined;
    /**
     * Which sound file extension is supported.
     * @private
     */
    static get extension(): 'mp3' | 'ogg';
    /**
     * Whether or not this SDK is supported by the current browser.
     */
    static get isSupported(): boolean;
    /**
     * Package name of the SDK.
     */
    static get packageName(): string;
    /**
     * Run some tests to identify issues, if any, prohibiting successful calling.
     * @param token - A Twilio JWT token string
     * @param options
     */
    static runPreflight(token: string, options?: PreflightTest.Options): PreflightTest;
    /**
     * String representation of {@link Device} class.
     * @private
     */
    static toString(): string;
    /**
     * Current SDK version.
     */
    static get version(): string;
    /**
     * An AudioContext to share between {@link Device}s.
     */
    private static _audioContext?;
    private static _defaultSounds;
    /**
     * A DialtonePlayer to play mock DTMF sounds through.
     */
    private static _dialtonePlayer?;
    /**
     * Initializes the AudioContext instance shared across the Voice SDK,
     * or returns the existing instance if one has already been initialized.
     */
    private static _getOrCreateAudioContext;
    /**
     * The currently active {@link Call}, if there is one.
     */
    private _activeCall;
    /**
     * The AudioHelper instance associated with this {@link Device}.
     */
    private _audio;
    /**
     * The AudioProcessorEventObserver instance to use
     */
    private _audioProcessorEventObserver;
    /**
     * {@link Device._confirmClose} bound to the specific {@link Device} instance.
     */
    private _boundConfirmClose;
    /**
     * {@link Device.destroy} bound to the specific {@link Device} instance.
     */
    private _boundDestroy;
    /**
     * An audio input MediaStream to pass to new {@link Call} instances.
     */
    private _callInputStream;
    /**
     * An array of {@link Call}s. Though only one can be active, multiple may exist when there
     * are multiple incoming, unanswered {@link Call}s.
     */
    private _calls;
    /**
     * An array of {@link Device} IDs to be used to play sounds through, to be passed to
     * new {@link Call} instances.
     */
    private _callSinkIds;
    /**
     * The list of chunder URIs that will be passed to PStream
     */
    private _chunderURIs;
    /**
     * Default options used by {@link Device}.
     */
    private readonly _defaultOptions;
    /**
     * The name of the edge the {@link Device} is connected to.
     */
    private _edge;
    /**
     * The name of the home region the {@link Device} is connected to.
     */
    private _home;
    /**
     * The identity associated with this Device.
     */
    private _identity;
    /**
     * Whether SDK is run as a browser extension
     */
    private _isBrowserExtension;
    /**
     * An instance of Logger to use.
     */
    private _log;
    /**
     * The internal promise created when calling {@link Device.makeCall}.
     */
    private _makeCallPromise;
    /**
     * Network related information
     * See https://developer.mozilla.org/en-US/docs/Web/API/Network_Information_API
     */
    private _networkInformation;
    /**
     * The options passed to {@link Device} constructor or {@link Device.updateOptions}.
     */
    private _options;
    /**
     * The preferred URI to (re)-connect signaling to.
     */
    private _preferredURI;
    /**
     * An Insights Event Publisher.
     */
    private _publisher;
    /**
     * The region the {@link Device} is connected to.
     */
    private _region;
    /**
     * A timeout ID for a setTimeout schedule to re-register the {@link Device}.
     */
    private _regTimer;
    /**
     * Boolean representing whether or not the {@link Device} was registered when
     * receiving a signaling `offline`. Determines if the {@link Device} attempts
     * a `re-register` once signaling is re-established when receiving a
     * `connected` event from the stream.
     */
    private _shouldReRegister;
    /**
     * A Map of Sounds to play.
     */
    private _soundcache;
    /**
     * The current status of the {@link Device}.
     */
    private _state;
    /**
     * A map from {@link Device.State} to {@link Device.EventName}.
     */
    private readonly _stateEventMapping;
    /**
     * The Signaling stream.
     */
    private _stream;
    /**
     * A promise that will resolve when the Signaling stream is ready.
     */
    private _streamConnectedPromise;
    /**
     * The JWT string currently being used to authenticate this {@link Device}.
     */
    private _token;
    /**
     * A timeout to track when the current AccessToken will expire.
     */
    private _tokenWillExpireTimeout;
    /**
     * Construct a {@link Device} instance. The {@link Device} can be registered
     * to make and listen for calls using {@link Device.register}.
     * @param options
     */
    constructor(token: string, options?: Device.Options);
    /**
     * Return the {@link AudioHelper} used by this {@link Device}.
     */
    get audio(): AudioHelper | null;
    /**
     * Make an outgoing Call.
     * @param options
     */
    connect(options?: Device.ConnectOptions): Promise<Call>;
    /**
     * Return the calls that this {@link Device} is maintaining.
     */
    get calls(): Call[];
    /**
     * Destroy the {@link Device}, freeing references to be garbage collected.
     */
    destroy(): void;
    /**
     * Disconnect all {@link Call}s.
     */
    disconnectAll(): void;
    /**
     * Returns the {@link Edge} value the {@link Device} is currently connected
     * to. The value will be `null` when the {@link Device} is offline.
     */
    get edge(): string | null;
    /**
     * Returns the home value the {@link Device} is currently connected
     * to. The value will be `null` when the {@link Device} is offline.
     */
    get home(): string | null;
    /**
     * Returns the identity associated with the {@link Device} for incoming calls. Only
     * populated when registered.
     */
    get identity(): string | null;
    /**
     * Whether the Device is currently on an active Call.
     */
    get isBusy(): boolean;
    /**
     * Register the `Device` to the Twilio backend, allowing it to receive calls.
     */
    register(): Promise<void>;
    /**
     * Get the state of this {@link Device} instance
     */
    get state(): Device.State;
    /**
     * Get the token used by this {@link Device}.
     */
    get token(): string | null;
    /**
     * String representation of {@link Device} instance.
     * @private
     */
    toString(): string;
    /**
     * Unregister the `Device` to the Twilio backend, disallowing it to receive
     * calls.
     */
    unregister(): Promise<void>;
    /**
     * Set the options used within the {@link Device}.
     * @param options
     */
    updateOptions(options?: Device.Options): void;
    /**
     * Update the token used by this {@link Device} to connect to Twilio.
     * It is recommended to call this API after [[Device.tokenWillExpireEvent]] is emitted,
     * and before or after a call to prevent a potential ~1s audio loss during the update process.
     * @param token
     */
    updateToken(token: string): void;
    /**
     * Called on window's beforeunload event if closeProtection is enabled,
     * preventing users from accidentally navigating away from an active call.
     * @param event
     */
    private _confirmClose;
    /**
     * Create the default Insights payload
     * @param call
     */
    private _createDefaultPayload;
    /**
     * Destroy the AudioHelper.
     */
    private _destroyAudioHelper;
    /**
     * Destroy the publisher.
     */
    private _destroyPublisher;
    /**
     * Destroy the connection to the signaling server.
     */
    private _destroyStream;
    /**
     * Find a {@link Call} by its CallSid.
     * @param callSid
     */
    private _findCall;
    /**
     * Get chunderws array from the chunderw param
     */
    private _getChunderws;
    /**
     * Utility function to log device options
     */
    private _logOptions;
    /**
     * Create a new {@link Call}.
     * @param twimlParams - A flat object containing key:value pairs to be sent to the TwiML app.
     * @param options - Options to be used to instantiate the {@link Call}.
     */
    private _makeCall;
    /**
     * Stop the incoming sound if no {@link Call}s remain.
     */
    private _maybeStopIncomingSound;
    /**
     * Called when a 'close' event is received from the signaling stream.
     */
    private _onSignalingClose;
    /**
     * Called when a 'connected' event is received from the signaling stream.
     */
    private _onSignalingConnected;
    /**
     * Called when an 'error' event is received from the signaling stream.
     */
    private _onSignalingError;
    /**
     * Called when an 'invite' event is received from the signaling stream.
     */
    private _onSignalingInvite;
    /**
     * Called when an 'offline' event is received from the signaling stream.
     */
    private _onSignalingOffline;
    /**
     * Called when a 'ready' event is received from the signaling stream.
     */
    private _onSignalingReady;
    /**
     * Publish a NetworkInformation#change event to Insights if there's an active {@link Call}.
     */
    private _publishNetworkChange;
    /**
     * Remove a {@link Call} from device.calls by reference
     * @param call
     */
    private _removeCall;
    /**
     * Register with the signaling server.
     */
    private _sendPresence;
    /**
     * Helper function that sets and emits the state of the device.
     * @param state The new state of the device.
     */
    private _setState;
    /**
     * Set up an audio helper for usage by this {@link Device}.
     */
    private _setupAudioHelper;
    /**
     * Setup logger's loglevel
     */
    private _setupLoglevel;
    /**
     * Create and set a publisher for the {@link Device} to use.
     */
    private _setupPublisher;
    /**
     * Set up the connection to the signaling server. Tears down an existing
     * stream if called while a stream exists.
     */
    private _setupStream;
    /**
     * Start playing the incoming ringtone, and subsequently emit the incoming event.
     * @param call
     * @param play - The function to be used to play the sound. Must return a Promise.
     */
    private _showIncomingCall;
    /**
     * Set a timeout to send another register message to the signaling server.
     */
    private _startRegistrationTimer;
    /**
     * Stop sending registration messages to the signaling server.
     */
    private _stopRegistrationTimer;
    /**
     * Throw an error if the {@link Device} is destroyed.
     */
    private _throwIfDestroyed;
    /**
     * Update the input stream being used for calls so that any current call and all future calls
     * will use the new input stream.
     * @param inputStream
     */
    private _updateInputStream;
    /**
     * Update the device IDs of output devices being used to play the incoming ringtone through.
     * @param sinkIds - An array of device IDs
     */
    private _updateRingtoneSinkIds;
    /**
     * Update the device IDs of output devices being used to play sounds through.
     * @param type - Whether to update ringtone or speaker sounds
     * @param sinkIds - An array of device IDs
     */
    private _updateSinkIds;
    /**
     * Update the device IDs of output devices being used to play the non-ringtone sounds
     * and Call audio through.
     * @param sinkIds - An array of device IDs
     */
    private _updateSpeakerSinkIds;
}
/**
 * @mergeModuleWith Device
 */
declare namespace Device {
    /**
     * Emitted when the {@link Device} has been destroyed.
     * @event
     * @example
     * ```ts
     * device.on('destroyed', () => { });
     * ```
     */
    function destroyedEvent(): void;
    /**
     * Emitted when the {@link Device} receives an error.
     * @event
     * @param error
     * @example
     * ```ts
     * device.on('error', call => { });
     * ```
     */
    function errorEvent(error: TwilioError, call?: Call): void;
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
    function incomingEvent(call: Call): void;
    /**
     * Emitted when the {@link Device} is unregistered.
     * @event
     * @example
     * ```ts
     * device.on('unregistered', () => { });
     * ```
     */
    function unregisteredEvent(): void;
    /**
     * Emitted when the {@link Device} is registering.
     * @event
     * @example
     * ```ts
     * device.on('registering', () => { });
     * ```
     */
    function registeringEvent(): void;
    /**
     * Emitted when the {@link Device} is registered.
     * @event
     * @example
     * ```ts
     * device.on('registered', () => { });
     * ```
     */
    function registeredEvent(): void;
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
    function tokenWillExpireEvent(device: Device): void;
    /**
     * All valid {@link Device} event names.
     */
    enum EventName {
        Error = "error",
        Incoming = "incoming",
        Destroyed = "destroyed",
        Unregistered = "unregistered",
        Registering = "registering",
        Registered = "registered",
        TokenWillExpire = "tokenWillExpire"
    }
    /**
     * All possible {@link Device} states.
     */
    enum State {
        Destroyed = "destroyed",
        Unregistered = "unregistered",
        Registering = "registering",
        Registered = "registered"
    }
    /**
     * Names of all sounds handled by the {@link Device}.
     */
    enum SoundName {
        Incoming = "incoming",
        Outgoing = "outgoing",
        Disconnect = "disconnect",
        Dtmf0 = "dtmf0",
        Dtmf1 = "dtmf1",
        Dtmf2 = "dtmf2",
        Dtmf3 = "dtmf3",
        Dtmf4 = "dtmf4",
        Dtmf5 = "dtmf5",
        Dtmf6 = "dtmf6",
        Dtmf7 = "dtmf7",
        Dtmf8 = "dtmf8",
        Dtmf9 = "dtmf9",
        DtmfS = "dtmfs",
        DtmfH = "dtmfh"
    }
    /**
     * Names of all togglable sounds.
     */
    type ToggleableSound = Device.SoundName.Incoming | Device.SoundName.Outgoing | Device.SoundName.Disconnect;
    /**
     * Options to be passed to {@link Device.connect}.
     */
    interface ConnectOptions extends Call.AcceptOptions {
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
    interface Options {
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
        logLevel?: loglevel.LogLevelDesc;
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
         * By default, the SDK will only use the `unified-plan` SDP format.
         * Unexpected behavior may happen if the `RTCPeerConnection` parameter uses an SDP format
         * that is different than what the SDK uses.
         *
         * For example, if the browser only supports `unified-plan` and the `RTCPeerConnection`
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
