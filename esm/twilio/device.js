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
                activeCall = this._activeCall = yield this._makeCallPromise;
            }
            finally {
                this._makeCallPromise = null;
            }
            // Make sure any incoming calls are ignored
            this._calls.splice(0).forEach(call => call.ignore());
            // Stop the incoming sound if it's playing
            this._soundcache.get(Device.SoundName.Incoming).stop();
            activeCall.accept({ rtcConstraints: options.rtcConstraints });
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
     * Whether the Device is currently on an active Call.
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
