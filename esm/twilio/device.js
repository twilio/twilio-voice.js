import { __awaiter } from 'tslib';
import { EventEmitter } from 'events';
import * as loglevel from 'loglevel';
import AudioHelper from './audiohelper.js';
import { AudioProcessorEventObserver } from './audioprocessoreventobserver.js';
import Call from './call.js';
import { PACKAGE_NAME, RELEASE_VERSION, SOUNDS_BASE_URL } from './constants.js';
import DialtonePlayer from './dialtonePlayer.js';
import { getPreciseSignalingErrorByCode, InvalidStateError, NotSupportedError, InvalidArgumentError } from './errors/index.js';
import EventPublisher from './eventpublisher.js';
import InsightsOutbox from './insightsoutbox.js';
import Log from './log.js';
import { PreflightTest } from './preflight/preflight.js';
import PStream, { isTransportErrorPayload } from './pstream.js';
import { getRegionShortcode, regionToEdge, createEventGatewayURI, getChunderURIs, createSignalingEndpointURL } from './regions.js';
import { enabled, getMediaEngine } from './rtc/index.js';
import getUserMedia from './rtc/getusermedia.js';
import { generateVoiceEventSid } from './sid.js';
import Sound from './sound.js';
import { getTokenPrincipal, queryToJson, isLegacyEdge, promisifyEvents } from './util.js';
import { AuthorizationErrors, GeneralErrors, ClientErrors } from './errors/generated.js';

const REGISTRATION_INTERVAL = 30000;
const RINGTONE_PLAY_TIMEOUT = 2000;
const PUBLISHER_PRODUCT_NAME = 'twilio-js-sdk';
const INVALID_TOKEN_MESSAGE = 'Parameter "token" must be of type "string".';
/**
 * Twilio Device. Allows registration for incoming calls, and placing outgoing calls.
 */
class Device extends EventEmitter {
    /**
     * The AudioContext to be used by {@link Device} instances.
     * @private
     */
    static get audioContext() {
        return Device._audioContext;
    }
    /**
     * Which sound file extension is supported.
     * @private
     */
    static get extension() {
        // NOTE(mroberts): Node workaround.
        const a = typeof document !== 'undefined'
            ? document.createElement('audio') : { canPlayType: false };
        let canPlayMp3;
        try {
            canPlayMp3 = a.canPlayType && !!a.canPlayType('audio/mpeg').replace(/no/, '');
        }
        catch (e) {
            canPlayMp3 = false;
        }
        let canPlayVorbis;
        try {
            canPlayVorbis = a.canPlayType && !!a.canPlayType('audio/ogg;codecs=\'vorbis\'').replace(/no/, '');
        }
        catch (e) {
            canPlayVorbis = false;
        }
        return (canPlayVorbis && !canPlayMp3) ? 'ogg' : 'mp3';
    }
    /**
     * Whether or not this SDK is supported by the current browser.
     */
    static get isSupported() { return enabled(); }
    /**
     * Package name of the SDK.
     */
    static get packageName() { return PACKAGE_NAME; }
    /**
     * Run some tests to identify issues, if any, prohibiting successful calling.
     * @param token - A Twilio JWT token string
     * @param options
     */
    static runPreflight(token, options) {
        return new PreflightTest(token, Object.assign({ audioContext: Device._getOrCreateAudioContext() }, options));
    }
    /**
     * String representation of {@link Device} class.
     * @private
     */
    static toString() {
        return '[Twilio.Device class]';
    }
    /**
     * Current SDK version.
     */
    static get version() { return RELEASE_VERSION; }
    /**
     * Initializes the AudioContext instance shared across the Voice SDK,
     * or returns the existing instance if one has already been initialized.
     */
    static _getOrCreateAudioContext() {
        if (!Device._audioContext) {
            if (typeof AudioContext !== 'undefined') {
                Device._audioContext = new AudioContext();
            }
            else if (typeof webkitAudioContext !== 'undefined') {
                Device._audioContext = new webkitAudioContext();
            }
        }
        return Device._audioContext;
    }
    /**
     * Whether two tokens are for the same account SID and identity. A token that
     * cannot be decoded counts as a different principal.
     * @param a
     * @param b
     */
    static _isSameTokenPrincipal(a, b) {
        const first = getTokenPrincipal(a);
        const second = getTokenPrincipal(b);
        return !!first && !!second
            && first.accountSid === second.accountSid
            && first.identity === second.identity;
    }
    /**
     * Construct a {@link Device} instance. The {@link Device} can be registered
     * to make and listen for calls using {@link Device.register}.
     * @param options
     */
    constructor(token, options = {}) {
        super();
        /**
         * The currently active {@link Call}, if there is one.
         */
        this._activeCall = null;
        /**
         * The outgoing {@link Call} that connect() is accepting. When an accepted incoming call holds the slot,
         * it is neither the active call nor in _calls until beforeAccept claims it, so disconnectAll() reaches it here.
         */
        this._acceptingCall = null;
        /**
         * The AudioHelper instance associated with this {@link Device}.
         */
        this._audio = null;
        /**
         * The AudioProcessorEventObserver instance to use
         */
        this._audioProcessorEventObserver = null;
        /**
         * An audio input MediaStream to pass to new {@link Call} instances.
         */
        this._callInputStream = null;
        /**
         * An array of {@link Call}s. Though only one can be active, multiple may exist when there
         * are multiple incoming, unanswered {@link Call}s.
         */
        this._calls = [];
        /**
         * An array of {@link Device} IDs to be used to play sounds through, to be passed to
         * new {@link Call} instances.
         */
        this._callSinkIds = ['default'];
        /**
         * The list of chunder URIs that will be passed to PStream
         */
        this._chunderURIs = [];
        /**
         * Default options used by {@link Device}.
         */
        this._defaultOptions = {
            allowIncomingWhileBusy: false,
            closeProtection: false,
            codecPreferences: [Call.Codec.PCMU, Call.Codec.Opus],
            dscp: true,
            enableImprovedSignalingErrorPrecision: false,
            forceAggressiveIceNomination: false,
            logLevel: loglevel.levels.ERROR,
            maxCallSignalingTimeoutMs: 0,
            preflight: false,
            sounds: {},
            tokenRefreshMs: 10000,
            voiceEventSidGenerator: generateVoiceEventSid,
        };
        /**
         * The name of the edge the {@link Device} is connected to.
         */
        this._edge = null;
        /**
         * The name of the home region the {@link Device} is connected to.
         */
        this._home = null;
        /**
         * The identity associated with this Device.
         */
        this._identity = null;
        /**
         * The Insights event buffer and retry loop. Created once and shared by every
         * publisher this Device creates, so buffered events survive
         * {@link Device.updateOptions} replacing the publisher, and Calls holding a
         * replaced publisher post into the same buffer.
         */
        this._insightsOutbox = null;
        /**
         * An instance of Logger to use.
         */
        this._log = new Log('Device');
        /**
         * The internal promise created when calling {@link Device.makeCall}.
         */
        this._makeCallPromise = null;
        /**
         * The options passed to {@link Device} constructor or {@link Device.updateOptions}.
         */
        this._options = {};
        /**
         * The preferred URI to (re)-connect signaling to.
         */
        this._preferredURI = null;
        /**
         * An Insights Event Publisher.
         */
        this._publisher = null;
        /**
         * The region the {@link Device} is connected to.
         */
        this._region = null;
        /**
         * A timeout ID for a setTimeout schedule to re-register the {@link Device}.
         */
        this._regTimer = null;
        /**
         * Boolean representing whether or not the {@link Device} was registered when
         * receiving a signaling `offline`. Determines if the {@link Device} attempts
         * a `re-register` once signaling is re-established when receiving a
         * `connected` event from the stream.
         */
        this._shouldReRegister = false;
        /**
         * A Map of Sounds to play.
         */
        this._soundcache = new Map();
        /**
         * The current status of the {@link Device}.
         */
        this._state = Device.State.Unregistered;
        /**
         * A map from {@link Device.State} to {@link Device.EventName}.
         */
        this._stateEventMapping = {
            [Device.State.Destroyed]: Device.EventName.Destroyed,
            [Device.State.Unregistered]: Device.EventName.Unregistered,
            [Device.State.Registering]: Device.EventName.Registering,
            [Device.State.Registered]: Device.EventName.Registered,
        };
        /**
         * Whether a transport error has been published to Insights since the
         * signaling connection was last established. Transport errors repeat on
         * every reconnect attempt, so only the first one per lost connection is
         * published. Device `error` is still emitted for each one.
         */
        this._isTransportErrorPublished = false;
        /**
         * The Signaling stream.
         */
        this._stream = null;
        /**
         * A promise that will resolve when the Signaling stream is ready.
         */
        this._streamConnectedPromise = null;
        /**
         * A timeout to track when the current AccessToken will expire.
         */
        this._tokenWillExpireTimeout = null;
        /**
         * Create the default Insights payload
         * @param call
         */
        this._createDefaultPayload = (call) => {
            const payload = {
                aggressive_nomination: this._options.forceAggressiveIceNomination,
                browser_extension: this._isBrowserExtension,
                dscp: !!this._options.dscp,
                ice_restart_enabled: true,
                platform: getMediaEngine(),
                sdk_version: RELEASE_VERSION,
            };
            function setIfDefined(propertyName, value) {
                if (value) {
                    payload[propertyName] = value;
                }
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
            // Signaling connection scope: set with or without a Call.
            setIfDefined('signaling_connection_id', this._stream && this._stream.signalingConnectionId);
            return payload;
        };
        /**
         * Called when a 'close' event is received from the signaling stream.
         */
        this._onSignalingClose = () => {
            this._stream = null;
            this._streamConnectedPromise = null;
        };
        /**
         * Called when a 'connected' event is received from the signaling stream.
         */
        this._onSignalingConnected = (payload) => {
            var _a;
            this._isTransportErrorPublished = false;
            const region = getRegionShortcode(payload.region);
            this._edge = payload.edge || regionToEdge[region] || payload.region;
            this._region = region || payload.region;
            this._home = payload.home;
            (_a = this._publisher) === null || _a === void 0 ? void 0 : _a.setHost(createEventGatewayURI(payload.home));
            if (payload.token) {
                this._identity = payload.token.identity;
                if (typeof payload.token.ttl === 'number' &&
                    typeof this._options.tokenRefreshMs === 'number') {
                    const ttlMs = payload.token.ttl * 1000;
                    const timeoutMs = Math.max(0, ttlMs - this._options.tokenRefreshMs);
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
            const preferredURIs = this._getChunderws() || getChunderURIs(this._edge);
            if (preferredURIs.length > 0) {
                const [preferredURI] = preferredURIs;
                this._preferredURI = createSignalingEndpointURL(preferredURI);
            }
            else {
                this._log.warn('Could not parse a preferred URI from the stream#connected event.');
            }
            // The signaling stream emits a `connected` event after reconnection, if the
            // device was registered before this, then register again.
            if (this._shouldReRegister) {
                this.register().catch((error) => {
                    this._log.warn('Failed to re-register after signaling reconnect', error);
                });
            }
        };
        /**
         * Called when an 'error' event is received from the signaling stream.
         */
        this._onSignalingError = (payload) => {
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
            const call = (typeof callsid === 'string' && this._findCall(callsid)) || undefined;
            const { code, message: customMessage } = originalError;
            let { twilioError } = originalError;
            if (typeof code === 'number') {
                if (code === 31201) {
                    twilioError = new AuthorizationErrors.AuthenticationFailed(originalError);
                }
                else if (code === 31204) {
                    twilioError = new AuthorizationErrors.AccessTokenInvalid(originalError);
                }
                else if (code === 31205) {
                    // Stop trying to register presence after token expires
                    this._stopRegistrationTimer();
                    twilioError = new AuthorizationErrors.AccessTokenExpired(originalError);
                }
                else {
                    const errorConstructor = getPreciseSignalingErrorByCode(!!this._options.enableImprovedSignalingErrorPrecision, code);
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
            if (!isTransportErrorPayload(payload)) {
                this._publishError(twilioError, call);
            }
            else if (!this._isTransportErrorPublished) {
                this._isTransportErrorPublished = true;
                this._publishError(twilioError, call, this._getDroppedSignalingConnectionId());
            }
            this.emit(Device.EventName.Error, twilioError, call);
        };
        /**
         * Called when an 'invite' event is received from the signaling stream.
         */
        this._onSignalingInvite = (payload) => __awaiter(this, void 0, void 0, function* () {
            var _a;
            const wasBusy = !!this._activeCall;
            if (wasBusy && !this._options.allowIncomingWhileBusy) {
                this._log.info('Device busy; ignoring incoming invite');
                return;
            }
            if (!payload.callsid || !payload.sdp) {
                this._log.debug('#error', payload);
                const error = new ClientErrors.BadRequest('Malformed invite from gateway');
                this._publishError(error);
                this.emit(Device.EventName.Error, error);
                return;
            }
            const callParameters = payload.parameters || {};
            callParameters.CallSid = callParameters.CallSid || payload.callsid;
            const customParameters = Object.assign({}, queryToJson(callParameters.Params));
            this._makeCallPromise = this._makeCall(customParameters, {
                callParameters,
                enableImprovedSignalingErrorPrecision: !!this._options.enableImprovedSignalingErrorPrecision,
                offerSdp: payload.sdp,
                reconnectToken: payload.reconnect,
                voiceEventSidGenerator: this._options.voiceEventSidGenerator,
            });
            let call;
            try {
                call = yield this._makeCallPromise;
            }
            finally {
                this._makeCallPromise = null;
            }
            this._calls.push(call);
            call.once('accept', () => {
                this._soundcache.get(Device.SoundName.Incoming).stop();
                this._publishNetworkChange();
            });
            const play = (((_a = this._audio) === null || _a === void 0 ? void 0 : _a.incoming()) && !wasBusy)
                ? () => this._soundcache.get(Device.SoundName.Incoming).play()
                : () => Promise.resolve();
            this._showIncomingCall(call, play);
        });
        /**
         * Called when an 'offline' event is received from the signaling stream.
         */
        this._onSignalingOffline = () => {
            this._log.info('Stream is offline');
            this._edge = null;
            this._region = null;
            // A tick landing before the server validates the token earns a 31204.
            this._stopRegistrationTimer();
            this._shouldReRegister = this.state !== Device.State.Unregistered;
            this._setState(Device.State.Unregistered);
        };
        /**
         * Called when a 'ready' event is received from the signaling stream.
         */
        this._onSignalingReady = () => {
            this._log.info('Stream is ready');
            this._setState(Device.State.Registered);
        };
        /**
         * Publish a NetworkInformation#change event to Insights if there's an active {@link Call}.
         */
        this._publishNetworkChange = () => {
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
        };
        /**
         * Update the input stream being used for calls so that any current call and all future calls
         * will use the new input stream.
         * @param inputStream
         */
        this._updateInputStream = (inputStream) => {
            const call = this._activeCall;
            if (call && !inputStream) {
                return Promise.reject(new InvalidStateError('Cannot unset input device while a call is in progress.'));
            }
            this._callInputStream = inputStream;
            return call
                ? call._setInputTracksFromStream(inputStream)
                : Promise.resolve();
        };
        /**
         * Update the device IDs of output devices being used to play sounds through.
         * @param type - Whether to update ringtone or speaker sounds
         * @param sinkIds - An array of device IDs
         */
        this._updateSinkIds = (type, sinkIds) => {
            const promise = type === 'ringtone'
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
        };
        // Setup loglevel asap to avoid missed logs
        this._setupLoglevel(options.logLevel);
        this._logOptions('constructor', options);
        this.updateToken(token);
        if (isLegacyEdge()) {
            throw new NotSupportedError('Microsoft Edge Legacy (https://support.microsoft.com/en-us/help/4533505/what-is-microsoft-edge-legacy) ' +
                'is deprecated and will not be able to connect to Twilio to make or receive calls after September 1st, 2020. ' +
                'Please see this documentation for a list of supported browsers ' +
                'https://www.twilio.com/docs/voice/client/javascript#supported-browsers');
        }
        if (!Device.isSupported && options.ignoreBrowserSupport) {
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
        const root = globalThis;
        const browser = root.msBrowser || root.browser || root.chrome;
        this._isBrowserExtension = (!!browser && !!browser.runtime && !!browser.runtime.id)
            || (!!root.safari && !!root.safari.extension);
        if (this._isBrowserExtension) {
            this._log.info('Running as browser extension.');
        }
        if (navigator) {
            const n = navigator;
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
        this._boundConfirmClose = this._confirmClose.bind(this);
        this._boundOnPageHide = this._onPageHide.bind(this);
        this._boundOnPageShow = this._onPageShow.bind(this);
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('pagehide', this._boundOnPageHide);
            window.addEventListener('pageshow', this._boundOnPageShow);
        }
        this.updateOptions(options);
    }
    /**
     * Return the {@link AudioHelper} used by this {@link Device}.
     */
    get audio() {
        return this._audio;
    }
    /**
     * Make an outgoing Call.
     * @param options
     */
    connect() {
        return __awaiter(this, arguments, void 0, function* (options = {}) {
            this._log.debug('.connect', JSON.stringify(options));
            this._throwIfDestroyed();
            if (this._activeCall || this._makeCallPromise) {
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
                }
                catch (_a) {
                    throw new InvalidArgumentError('Cannot parse connectToken');
                }
                if (!parameters || !parameters.CallSid || !signalingReconnectToken) {
                    throw new InvalidArgumentError('Invalid connectToken');
                }
            }
            let isReconnect = false;
            let twimlParams = {};
            const callOptions = {
                enableImprovedSignalingErrorPrecision: !!this._options.enableImprovedSignalingErrorPrecision,
                rtcConfiguration: options.rtcConfiguration,
                voiceEventSidGenerator: this._options.voiceEventSidGenerator,
            };
            if (signalingReconnectToken && parameters) {
                isReconnect = true;
                callOptions.callParameters = parameters;
                callOptions.reconnectCallSid = parameters.CallSid;
                callOptions.reconnectToken = signalingReconnectToken;
                twimlParams = customParameters || twimlParams;
            }
            else {
                twimlParams = options.params || twimlParams;
            }
            let activeCall;
            this._makeCallPromise = this._makeCall(twimlParams, callOptions, isReconnect);
            try {
                activeCall = yield this._makeCallPromise;
            }
            finally {
                this._makeCallPromise = null;
            }
            // An incoming call accepted meanwhile keeps the slot until accept() below replaces it.
            if (!this._activeCall) {
                this._activeCall = activeCall;
            }
            // Make sure any incoming calls are ignored
            this._calls.splice(0).forEach(call => call.ignore());
            // Stop the incoming sound if it's playing
            this._soundcache.get(Device.SoundName.Incoming).stop();
            this._acceptingCall = activeCall;
            try {
                activeCall.accept({ rtcConstraints: options.rtcConstraints });
            }
            finally {
                this._acceptingCall = null;
            }
            this._publishNetworkChange();
            return activeCall;
        });
    }
    /**
     * Return the calls that this {@link Device} is maintaining.
     */
    get calls() {
        return this._calls;
    }
    /**
     * Destroy the {@link Device}, freeing references to be garbage collected.
     */
    destroy() {
        var _a;
        this._log.debug('.destroy');
        this._log.debug('Rejecting any incoming calls');
        const calls = this._calls.slice(0);
        calls.forEach((call) => call.reject());
        this.disconnectAll();
        this._stopRegistrationTimer();
        this._destroyStream();
        this._destroyAudioHelper();
        (_a = this._audioProcessorEventObserver) === null || _a === void 0 ? void 0 : _a.destroy();
        this._destroyPublisher();
        this._destroyInsightsOutbox();
        if (this._networkInformation && typeof this._networkInformation.removeEventListener === 'function') {
            this._networkInformation.removeEventListener('change', this._publishNetworkChange);
        }
        if (typeof window !== 'undefined' && window.removeEventListener) {
            window.removeEventListener('beforeunload', this._boundConfirmClose);
            window.removeEventListener('pagehide', this._boundOnPageHide);
            window.removeEventListener('pageshow', this._boundOnPageShow);
        }
        this._setState(Device.State.Destroyed);
        EventEmitter.prototype.removeAllListeners.call(this);
    }
    /**
     * Disconnect all {@link Call}s.
     */
    disconnectAll() {
        this._log.debug('.disconnectAll');
        const calls = this._calls.splice(0);
        calls.forEach((call) => call.disconnect());
        if (this._activeCall) {
            this._activeCall.disconnect();
        }
        if (this._acceptingCall) {
            this._acceptingCall.disconnect();
        }
    }
    /**
     * Returns the {@link Edge} value the {@link Device} is currently connected
     * to. The value will be `null` when the {@link Device} is offline.
     */
    get edge() {
        return this._edge;
    }
    /**
     * Returns the home value the {@link Device} is currently connected
     * to. The value will be `null` when the {@link Device} is offline.
     */
    get home() {
        return this._home;
    }
    /**
     * Returns the identity associated with the {@link Device} for incoming calls. Only
     * populated when registered.
     */
    get identity() {
        return this._identity;
    }
    /**
     * Whether the Device is currently on an active Call. A Call counts as active from `call.accept()`,
     * which `device.connect()` calls before it resolves, until it ends, even before its media has
     * connected. When accepting a Call replaces the active one, the replaced Call's disconnect handlers
     * see the Device idle, and a Call they accept or connect, or a `disconnectAll()` they call, ends
     * the accepting Call instead.
     */
    get isBusy() {
        return !!this._activeCall;
    }
    /**
     * Register the `Device` to the Twilio backend, allowing it to receive calls.
     */
    register() {
        return __awaiter(this, void 0, void 0, function* () {
            this._log.debug('.register');
            if (this.state !== Device.State.Unregistered) {
                throw new InvalidStateError(`Attempt to register when device is in state "${this.state}". ` +
                    `Must be "${Device.State.Unregistered}".`);
            }
            this._shouldReRegister = false;
            this._setState(Device.State.Registering);
            yield (this._streamConnectedPromise || this._setupStream());
            yield this._sendPresence(true);
            yield promisifyEvents(this, Device.State.Registered, Device.State.Unregistered);
        });
    }
    /**
     * Get the state of this {@link Device} instance
     */
    get state() {
        return this._state;
    }
    /**
     * Get the token used by this {@link Device}.
     */
    get token() {
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
    unregister() {
        return __awaiter(this, void 0, void 0, function* () {
            this._log.debug('.unregister');
            if (this.state !== Device.State.Registered) {
                throw new InvalidStateError(`Attempt to unregister when device is in state "${this.state}". ` +
                    `Must be "${Device.State.Registered}".`);
            }
            this._shouldReRegister = false;
            const stream = yield this._streamConnectedPromise;
            const streamOfflinePromise = new Promise(resolve => {
                stream.on('offline', resolve);
            });
            yield this._sendPresence(false);
            yield streamOfflinePromise;
        });
    }
    /**
     * Set the options used within the {@link Device}.
     * @param options
     */
    updateOptions(options = {}) {
        this._logOptions('updateOptions', options);
        if (this.state === Device.State.Destroyed) {
            throw new InvalidStateError(`Attempt to "updateOptions" when device is in state "${this.state}".`);
        }
        const newOptions = Object.assign(Object.assign(Object.assign({}, this._defaultOptions), this._options), options);
        const originalChunderURIs = new Set(this._chunderURIs);
        const newChunderURIs = (this._getChunderws(newOptions) || getChunderURIs(newOptions.edge)).map(createSignalingEndpointURL);
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
        // Store only once validated, so a rejected call leaves the Device unchanged.
        this._options = newOptions;
        this._chunderURIs = newChunderURIs;
        this._setupLoglevel(this._options.logLevel);
        for (const name of Object.keys(Device._defaultSounds)) {
            const soundDef = Device._defaultSounds[name];
            const defaultUrl = `${SOUNDS_BASE_URL}/${soundDef.filename}.${Device.extension}`
                + `?cache=${RELEASE_VERSION}`;
            const soundUrl = this._options.sounds && this._options.sounds[name] || defaultUrl;
            const sound = new (this._options.Sound || Sound)(name, soundUrl, {
                audioContext: this._options.disableAudioContextSounds ? null : Device.audioContext,
                maxDuration: soundDef.maxDuration,
                shouldLoop: soundDef.shouldLoop,
            });
            this._soundcache.set(name, sound);
        }
        this._setupAudioHelper();
        this._setupPublisher();
        if (hasChunderURIsChanged && this._streamConnectedPromise) {
            this._setupStream();
        }
        // Setup close protection and make sure we clean up ongoing calls on page close.
        if (typeof window !== 'undefined' &&
            typeof window.addEventListener === 'function' &&
            this._options.closeProtection) {
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
    updateToken(token) {
        this._log.debug('.updateToken');
        if (this.state === Device.State.Destroyed) {
            throw new InvalidStateError(`Attempt to "updateToken" when device is in state "${this.state}".`);
        }
        if (typeof token !== 'string') {
            throw new InvalidArgumentError(INVALID_TOKEN_MESSAGE);
        }
        // Buffered Insights events are sent with the token current at send time.
        // Drop them when the new token is for another account or identity, so
        // they are not reported under it. A refresh for the same identity keeps them.
        if (this._insightsOutbox && this._token && token !== this._token
            && !Device._isSameTokenPrincipal(this._token, token)) {
            this._insightsOutbox.clear('the new access token is for a different account or identity');
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
    _confirmClose(event) {
        if (!this._activeCall) {
            return '';
        }
        const closeProtection = this._options.closeProtection || false;
        const confirmationMsg = typeof closeProtection !== 'string'
            ? 'A call is currently in-progress. Leaving or reloading this page will end the call.'
            : closeProtection;
        (event || window.event).returnValue = confirmationMsg;
        return confirmationMsg;
    }
    /**
     * Destroy the AudioHelper.
     */
    _destroyAudioHelper() {
        if (!this._audio) {
            return;
        }
        this._audio._destroy();
        this._audio = null;
    }
    /**
     * Send buffered Insights events once (no retries) and stop the retry timer.
     */
    _destroyInsightsOutbox() {
        if (!this._insightsOutbox) {
            return;
        }
        this._insightsOutbox.destroy();
        this._insightsOutbox = null;
    }
    /**
     * Destroy the publisher.
     */
    _destroyPublisher() {
        // Attempt to destroy non-existent publisher.
        if (!this._publisher) {
            return;
        }
        this._publisher = null;
    }
    /**
     * Destroy the connection to the signaling server.
     */
    _destroyStream() {
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
    _findCall(callSid) {
        return this._calls.find(call => call.parameters.CallSid === callSid
            || call.outboundConnectionId === callSid) || null;
    }
    /**
     * Get chunderws array from the chunderw param
     */
    _getChunderws(options = this._options) {
        return typeof options.chunderw === 'string' ? [options.chunderw]
            : Array.isArray(options.chunderw) ? options.chunderw : null;
    }
    /**
     * Utility function to log device options
     */
    _logOptions(caller, options = {}) {
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
            const toLog = Object.assign({}, options);
            Object.keys(toLog).forEach((key) => {
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
    _makeCall(twimlParams_1, options_1) {
        return __awaiter(this, arguments, void 0, function* (twimlParams, options, isReconnect = false) {
            var _a;
            // Wait for the input device if it's set by the user
            const inputDevicePromise = (_a = this._audio) === null || _a === void 0 ? void 0 : _a._getInputDevicePromise();
            if (inputDevicePromise) {
                this._log.debug('inputDevicePromise detected, waiting...');
                yield inputDevicePromise;
                this._log.debug('inputDevicePromise resolved');
            }
            const config = {
                audioHelper: this._audio,
                onIgnore: () => {
                    this._soundcache.get(Device.SoundName.Incoming).stop();
                },
                pstream: yield (this._streamConnectedPromise || this._setupStream()),
                publisher: this._publisher,
                soundcache: this._soundcache,
            };
            options = Object.assign({
                MediaStream: this._options.MediaStream,
                RTCPeerConnection: this._options.RTCPeerConnection,
                beforeAccept: (currentCall) => {
                    const previousCall = this._activeCall;
                    if (previousCall && previousCall !== currentCall) {
                        // Disconnect before claiming the slot; the Device's own disconnect listener frees it,
                        // so the previous call's handlers see the Device idle.
                        previousCall.disconnect();
                        this._removeCall(previousCall);
                    }
                    // A disconnect handler above ended this call, or accepted another one, which wins.
                    if (currentCall.status() !== Call.State.Connecting) {
                        return;
                    }
                    if (this._activeCall && this._activeCall !== currentCall) {
                        this._log.info('Another call was accepted while replacing the active call; disconnecting this one');
                        currentCall.disconnect();
                        return;
                    }
                    // Claim the slot now; 'accept' only fires once media is open.
                    this._activeCall = currentCall;
                },
                codecPreferences: this._options.codecPreferences,
                customSounds: this._options.sounds,
                dialtonePlayer: Device._dialtonePlayer,
                dscp: this._options.dscp,
                // TODO(csantos): Remove forceAggressiveIceNomination option in 3.x
                forceAggressiveIceNomination: this._options.forceAggressiveIceNomination,
                getInputStream: () => this._options.fileInputStream || this._callInputStream,
                getSinkIds: () => this._callSinkIds,
                maxAverageBitrate: this._options.maxAverageBitrate,
                preflight: this._options.preflight,
                rtcConstraints: this._options.rtcConstraints,
                shouldPlayDisconnect: () => { var _a; return (_a = this._audio) === null || _a === void 0 ? void 0 : _a.disconnect(); },
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
                var _a, _b, _c, _d, _e;
                this._stream.updatePreferredURI(this._preferredURI);
                this._removeCall(call);
                this._activeCall = call;
                if (this._audio) {
                    this._audio._maybeStartPollingVolume();
                }
                if (call.direction === Call.CallDirection.Outgoing && ((_a = this._audio) === null || _a === void 0 ? void 0 : _a.outgoing()) && !isReconnect) {
                    this._soundcache.get(Device.SoundName.Outgoing).play();
                }
                const data = { edge: this._edge || this._region };
                if (this._options.edge) {
                    data['selected_edge'] = Array.isArray(this._options.edge)
                        ? this._options.edge
                        : [this._options.edge];
                }
                this._publisher.info('settings', 'edge', data, call);
                if ((_b = this._audio) === null || _b === void 0 ? void 0 : _b.localProcessedStream) {
                    (_c = this._audioProcessorEventObserver) === null || _c === void 0 ? void 0 : _c.emit('enabled', false);
                }
                if ((_d = this._audio) === null || _d === void 0 ? void 0 : _d.remoteProcessedStream) {
                    (_e = this._audioProcessorEventObserver) === null || _e === void 0 ? void 0 : _e.emit('enabled', true);
                }
            });
            call.addListener('error', (error) => {
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
        });
    }
    /**
     * Stop the incoming sound if no {@link Call}s remain.
     */
    _maybeStopIncomingSound() {
        if (!this._calls.length) {
            this._soundcache.get(Device.SoundName.Incoming).stop();
        }
    }
    /**
     * Called on the window's `pagehide` event. When the page is entering the
     * back/forward cache (`event.persisted === true`) and there are no active
     * calls, the signaling connection is quiesced without permanently destroying
     * the {@link Device}, so it can be restored on `pageshow`. Otherwise the
     * {@link Device} is destroyed, preserving the historical behavior (a normal
     * page unload, or a persisted transition while media is active and cannot
     * survive the cache).
     */
    _onPageHide(event) {
        if (event && event.persisted && this._calls.length === 0 && !this._activeCall && !this._makeCallPromise) {
            this._log.debug('Page entering BFCache; quiescing signaling');
            this._stopRegistrationTimer();
            this._destroyStream();
        }
        else {
            this.destroy();
        }
    }
    /**
     * Called on the window's `pageshow` event. When the page is restored from the
     * back/forward cache (`event.persisted === true`), re-register if the
     * {@link Device} was registered before entering the cache. A previously
     * destroyed or unregistered {@link Device} is left untouched.
     */
    _onPageShow(event) {
        if (!event || !event.persisted) {
            return;
        }
        if (this.state === Device.State.Destroyed) {
            return;
        }
        if (this._shouldReRegister && this.state === Device.State.Unregistered) {
            this._log.debug('Page restored from BFCache; re-registering');
            this.register().catch((error) => {
                this._log.warn('Failed to re-register after BFCache restore', error);
            });
        }
    }
    /**
     * The id of the signaling connection that dropped, when the current
     * connection has none: the transport closed and has not reconnected yet.
     * @returns The id, or `undefined` while connected or if none is known.
     */
    _getDroppedSignalingConnectionId() {
        const stream = this._stream;
        if (!stream || stream.signalingConnectionId) {
            return;
        }
        const droppedId = stream.lastClosedSignalingConnectionId;
        return typeof droppedId === 'string' && droppedId ? droppedId : undefined;
    }
    /**
     * Publish an error to Insights. Without a Call, the event has no call ids.
     * @param twilioError - The error to publish.
     * @param call - The Call the error belongs to, if any.
     * @param droppedSignalingConnectionId - The id of the signaling connection
     *   that dropped, set on this event only when the current one has none.
     */
    _publishError(twilioError, call, droppedSignalingConnectionId) {
        var _a;
        const payload = {
            code: twilioError.code,
            message: twilioError.message,
        };
        if (droppedSignalingConnectionId) {
            payload.signaling_connection_id = droppedSignalingConnectionId;
        }
        (_a = this._publisher) === null || _a === void 0 ? void 0 : _a.error('connection', 'error', payload, call);
    }
    /**
     * Remove a {@link Call} from device.calls by reference
     * @param call
     */
    _removeCall(call) {
        if (this._activeCall === call) {
            this._activeCall = null;
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
    _sendPresence(presence) {
        return __awaiter(this, void 0, void 0, function* () {
            const stream = yield this._streamConnectedPromise;
            if (!stream) {
                return;
            }
            stream.register({ audio: presence });
            if (presence) {
                this._startRegistrationTimer();
            }
            else {
                this._stopRegistrationTimer();
            }
        });
    }
    /**
     * Helper function that sets and emits the state of the device.
     * @param state The new state of the device.
     */
    _setState(state) {
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
    _setupAudioHelper() {
        if (!this._audioProcessorEventObserver) {
            this._audioProcessorEventObserver = new AudioProcessorEventObserver();
            this._audioProcessorEventObserver.on('event', ({ name, group, isRemote }) => {
                this._publisher.info(group, name, { is_remote: isRemote }, this._activeCall);
            });
        }
        const audioOptions = {
            audioContext: Device.audioContext,
            audioProcessorEventObserver: this._audioProcessorEventObserver,
            beforeSetInputDevice: () => {
                if (this._makeCallPromise) {
                    this._log.debug('beforeSetInputDevice pause detected');
                    return this._makeCallPromise;
                }
                else {
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
        this._audio = new (this._options.AudioHelper || AudioHelper)(this._updateSinkIds, this._updateInputStream, audioOptions);
        this._audio.on('deviceChange', (lostActiveDevices) => {
            const activeCall = this._activeCall;
            const deviceIds = lostActiveDevices.map((device) => device.deviceId);
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
    _setupLoglevel(logLevel) {
        const level = typeof logLevel === 'number' ||
            typeof logLevel === 'string' ?
            logLevel : loglevel.levels.ERROR;
        this._log.setDefaultLevel(level);
        this._log.info('Set logger default level to', level);
    }
    /**
     * Create and set a publisher for the {@link Device} to use.
     */
    _setupPublisher() {
        if (this._publisher) {
            this._log.info('Found existing publisher; destroying...');
            this._destroyPublisher();
        }
        if (!this._insightsOutbox) {
            this._insightsOutbox = new InsightsOutbox();
        }
        const publisherOptions = {
            defaultPayload: this._createDefaultPayload,
            metadata: {
                app_name: this._options.appName,
                app_version: this._options.appVersion,
            },
            outbox: this._insightsOutbox,
        };
        if (this._options.eventgw) {
            publisherOptions.host = this._options.eventgw;
        }
        if (this._home) {
            publisherOptions.host = createEventGatewayURI(this._home);
        }
        this._publisher = new (this._options.Publisher || EventPublisher)(PUBLISHER_PRODUCT_NAME, this.token, publisherOptions);
        if (this._options.publishEvents === false) {
            this._publisher.disable();
        }
        else {
            this._publisher.on('error', (error) => {
                this._log.warn('Cannot connect to insights.', error);
            });
        }
        // Send events buffered before this publisher replaced the previous one.
        // No-op when the host is unknown, and the buffer is already empty when
        // publishing is disabled.
        this._insightsOutbox.flush();
        return this._publisher;
    }
    /**
     * Set up the connection to the signaling server. Tears down an existing
     * stream if called while a stream exists.
     */
    _setupStream() {
        if (this._stream) {
            this._log.info('Found existing stream; destroying...');
            this._destroyStream();
        }
        this._log.info('Setting up VSP');
        this._isTransportErrorPublished = false;
        this._stream = new (this._options.PStream || PStream)(this.token, this._chunderURIs, {
            backoffMaxMs: this._options.backoffMaxMs,
            maxPreferredDurationMs: this._options.maxCallSignalingTimeoutMs,
        });
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
    _showIncomingCall(call, play) {
        let timeout;
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
    _startRegistrationTimer() {
        this._stopRegistrationTimer();
        this._regTimer = setTimeout(() => {
            this._sendPresence(true);
        }, REGISTRATION_INTERVAL);
    }
    /**
     * Stop sending registration messages to the signaling server.
     */
    _stopRegistrationTimer() {
        if (this._regTimer) {
            clearTimeout(this._regTimer);
        }
    }
    /**
     * Throw an error if the {@link Device} is destroyed.
     */
    _throwIfDestroyed() {
        if (this.state === Device.State.Destroyed) {
            throw new InvalidStateError('Device has been destroyed.');
        }
    }
    /**
     * Update the device IDs of output devices being used to play the incoming ringtone through.
     * @param sinkIds - An array of device IDs
     */
    _updateRingtoneSinkIds(sinkIds) {
        return Promise.resolve(this._soundcache.get(Device.SoundName.Incoming).setSinkIds(sinkIds));
    }
    /**
     * Update the device IDs of output devices being used to play the non-ringtone sounds
     * and Call audio through.
     * @param sinkIds - An array of device IDs
     */
    _updateSpeakerSinkIds(sinkIds) {
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
Device._defaultSounds = {
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
 * @mergeModuleWith Device
 */
(function (Device) {
    (function (EventName) {
        EventName["Error"] = "error";
        EventName["Incoming"] = "incoming";
        EventName["Destroyed"] = "destroyed";
        EventName["Unregistered"] = "unregistered";
        EventName["Registering"] = "registering";
        EventName["Registered"] = "registered";
        EventName["TokenWillExpire"] = "tokenWillExpire";
    })(Device.EventName || (Device.EventName = {}));
    (function (State) {
        State["Destroyed"] = "destroyed";
        State["Unregistered"] = "unregistered";
        State["Registering"] = "registering";
        State["Registered"] = "registered";
    })(Device.State || (Device.State = {}));
    (function (SoundName) {
        SoundName["Incoming"] = "incoming";
        SoundName["Outgoing"] = "outgoing";
        SoundName["Disconnect"] = "disconnect";
        SoundName["Dtmf0"] = "dtmf0";
        SoundName["Dtmf1"] = "dtmf1";
        SoundName["Dtmf2"] = "dtmf2";
        SoundName["Dtmf3"] = "dtmf3";
        SoundName["Dtmf4"] = "dtmf4";
        SoundName["Dtmf5"] = "dtmf5";
        SoundName["Dtmf6"] = "dtmf6";
        SoundName["Dtmf7"] = "dtmf7";
        SoundName["Dtmf8"] = "dtmf8";
        SoundName["Dtmf9"] = "dtmf9";
        SoundName["DtmfS"] = "dtmfs";
        SoundName["DtmfH"] = "dtmfh";
    })(Device.SoundName || (Device.SoundName = {}));
})(Device || (Device = {}));

export { Device as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2aWNlLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2RldmljZS50cyJdLCJzb3VyY2VzQ29udGVudCI6W251bGxdLCJuYW1lcyI6WyJydGMuZW5hYmxlZCIsIkMuUEFDS0FHRV9OQU1FIiwiQy5SRUxFQVNFX1ZFUlNJT04iLCJydGMuZ2V0TWVkaWFFbmdpbmUiLCJDLlNPVU5EU19CQVNFX1VSTCIsIlB1Ymxpc2hlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQXdEQSxNQUFNLHFCQUFxQixHQUFHLEtBQUs7QUFDbkMsTUFBTSxxQkFBcUIsR0FBRyxJQUFJO0FBQ2xDLE1BQU0sc0JBQXNCLEdBQUcsZUFBZTtBQUM5QyxNQUFNLHFCQUFxQixHQUFHLDZDQUE2QztBQXdHM0U7O0FBRUc7QUFDSCxNQUFNLE1BQU8sU0FBUSxZQUFZLENBQUE7QUFDL0I7OztBQUdHO0FBQ0gsSUFBQSxXQUFXLFlBQVksR0FBQTtRQUNyQixPQUFPLE1BQU0sQ0FBQyxhQUFhO0lBQzdCO0FBRUE7OztBQUdHO0FBQ0gsSUFBQSxXQUFXLFNBQVMsR0FBQTs7QUFFbEIsUUFBQSxNQUFNLENBQUMsR0FBUSxPQUFPLFFBQVEsS0FBSztBQUNqQyxjQUFFLFFBQVEsQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLEdBQUcsRUFBRSxXQUFXLEVBQUUsS0FBSyxFQUFFO0FBRTVELFFBQUEsSUFBSSxVQUFVO0FBQ2QsUUFBQSxJQUFJO1lBQ0YsVUFBVSxHQUFHLENBQUMsQ0FBQyxXQUFXLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsWUFBWSxDQUFDLENBQUMsT0FBTyxDQUFDLElBQUksRUFBRSxFQUFFLENBQUM7UUFDL0U7UUFBRSxPQUFPLENBQUMsRUFBRTtZQUNWLFVBQVUsR0FBRyxLQUFLO1FBQ3BCO0FBRUEsUUFBQSxJQUFJLGFBQWE7QUFDakIsUUFBQSxJQUFJO1lBQ0YsYUFBYSxHQUFHLENBQUMsQ0FBQyxXQUFXLElBQUksQ0FBQyxDQUFD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
