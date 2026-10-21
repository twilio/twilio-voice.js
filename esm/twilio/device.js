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
import Log from './log.js';
import { PreflightTest } from './preflight/preflight.js';
import PStream from './pstream.js';
import { getRegionShortcode, regionToEdge, createEventGatewayURI, getChunderURIs, createSignalingEndpointURL } from './regions.js';
import { enabled, getMediaEngine } from './rtc/index.js';
import getUserMedia from './rtc/getusermedia.js';
import { generateVoiceEventSid } from './sid.js';
import Sound from './sound.js';
import { queryToJson, isLegacyEdge, promisifyEvents } from './util.js';
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
                this.emit(Device.EventName.Error, new ClientErrors.BadRequest('Malformed invite from gateway'));
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
        this._options = Object.assign(Object.assign(Object.assign({}, this._defaultOptions), this._options), options);
        const originalChunderURIs = new Set(this._chunderURIs);
        const newChunderURIs = this._chunderURIs = (this._getChunderws() || getChunderURIs(this._options.edge)).map(createSignalingEndpointURL);
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
    _getChunderws() {
        return typeof this._options.chunderw === 'string' ? [this._options.chunderw]
            : Array.isArray(this._options.chunderw) ? this._options.chunderw : null;
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
        const publisherOptions = {
            defaultPayload: this._createDefaultPayload,
            metadata: {
                app_name: this._options.appName,
                app_version: this._options.appVersion,
            },
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2aWNlLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2RldmljZS50cyJdLCJzb3VyY2VzQ29udGVudCI6W251bGxdLCJuYW1lcyI6WyJydGMuZW5hYmxlZCIsIkMuUEFDS0FHRV9OQU1FIiwiQy5SRUxFQVNFX1ZFUlNJT04iLCJydGMuZ2V0TWVkaWFFbmdpbmUiLCJDLlNPVU5EU19CQVNFX1VSTCIsIlB1Ymxpc2hlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBc0RBLE1BQU0scUJBQXFCLEdBQUcsS0FBSztBQUNuQyxNQUFNLHFCQUFxQixHQUFHLElBQUk7QUFDbEMsTUFBTSxzQkFBc0IsR0FBRyxlQUFlO0FBQzlDLE1BQU0scUJBQXFCLEdBQUcsNkNBQTZDO0FBd0czRTs7QUFFRztBQUNILE1BQU0sTUFBTyxTQUFRLFlBQVksQ0FBQTtBQUMvQjs7O0FBR0c7QUFDSCxJQUFBLFdBQVcsWUFBWSxHQUFBO1FBQ3JCLE9BQU8sTUFBTSxDQUFDLGFBQWE7SUFDN0I7QUFFQTs7O0FBR0c7QUFDSCxJQUFBLFdBQVcsU0FBUyxHQUFBOztBQUVsQixRQUFBLE1BQU0sQ0FBQyxHQUFRLE9BQU8sUUFBUSxLQUFLO0FBQ2pDLGNBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUU7QUFFNUQsUUFBQSxJQUFJLFVBQVU7QUFDZCxRQUFBLElBQUk7WUFDRixVQUFVLEdBQUcsQ0FBQyxDQUFDLFdBQVcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztRQUMvRTtRQUFFLE9BQU8sQ0FBQyxFQUFFO1lBQ1YsVUFBVSxHQUFHLEtBQUs7UUFDcEI7QUFFQSxRQUFBLElBQUksYUFBYTtBQUNqQixRQUFBLElBQUk7WUFDRixhQUFhLEdBQUcsQ0FBQyxDQUFDLFdBQVcsSUFBSSxDQUFDLENBQUMs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
