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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2aWNlLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2RldmljZS50cyJdLCJzb3VyY2VzQ29udGVudCI6W251bGxdLCJuYW1lcyI6WyJydGMuZW5hYmxlZCIsIkMuUEFDS0FHRV9OQU1FIiwiQy5SRUxFQVNFX1ZFUlNJT04iLCJydGMuZ2V0TWVkaWFFbmdpbmUiLCJDLlNPVU5EU19CQVNFX1VSTCIsIlB1Ymxpc2hlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBc0RBLE1BQU0scUJBQXFCLEdBQUcsS0FBSztBQUNuQyxNQUFNLHFCQUFxQixHQUFHLElBQUk7QUFDbEMsTUFBTSxzQkFBc0IsR0FBRyxlQUFlO0FBQzlDLE1BQU0scUJBQXFCLEdBQUcsNkNBQTZDO0FBd0czRTs7QUFFRztBQUNILE1BQU0sTUFBTyxTQUFRLFlBQVksQ0FBQTtBQUMvQjs7O0FBR0c7QUFDSCxJQUFBLFdBQVcsWUFBWSxHQUFBO1FBQ3JCLE9BQU8sTUFBTSxDQUFDLGFBQWE7SUFDN0I7QUFFQTs7O0FBR0c7QUFDSCxJQUFBLFdBQVcsU0FBUyxHQUFBOztBQUVsQixRQUFBLE1BQU0sQ0FBQyxHQUFRLE9BQU8sUUFBUSxLQUFLO0FBQ2pDLGNBQUUsUUFBUSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFLFdBQVcsRUFBRSxLQUFLLEVBQUU7QUFFNUQsUUFBQSxJQUFJLFVBQVU7QUFDZCxRQUFBLElBQUk7WUFDRixVQUFVLEdBQUcsQ0FBQyxDQUFDLFdBQVcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxZQUFZLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztRQUMvRTtRQUFFLE9BQU8sQ0FBQyxFQUFFO1lBQ1YsVUFBVSxHQUFHLEtBQUs7UUFDcEI7QUFFQSxRQUFBLElBQUksYUFBYTtBQUNqQixRQUFBLElBQUk7WUFDRixhQUFhLEdBQUcsQ0FBQyxDQUFDLFdBQVcsSUFBSSxDQUFDLENBQUMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDO1FBQ25HO1FBQUUsT0FBTyxDQUFDLEVBQUU7WUFDVixhQUFhLEdBQUcsS0FBSztRQUN2QjtBQUVBLFFBQUEsT0FBTyxDQUFDLGFBQWEsSUFBSSxDQUFDLFVBQVUsSUFBSSxLQUFLLEdBQUcsS0FBSztJQUN2RDtBQUVBOztBQUVHO0lBQ0gsV0FBVyxXQUFXLEdBQUEsRUFBYyxPQUFPQSxPQUFXLEVBQUUsQ0FBQyxDQUFDO0FBRTFEOztBQUVHO0lBQ0gsV0FBVyxXQUFXLEdBQUEsRUFBYSxPQUFPQyxZQUFjLENBQUMsQ0FBQztBQUUxRDs7OztBQUlHO0FBQ0gsSUFBQSxPQUFPLFlBQVksQ0FBQyxLQUFhLEVBQUUsT0FBK0IsRUFBQTtBQUNoRSxRQUFBLE9BQU8sSUFBSSxhQUFhLENBQUMsS0FBSyxrQkFBSSxZQUFZLEVBQUUsTUFBTSxDQUFDLHdCQUF3QixFQUFFLEVBQUEsRUFBSyxPQUFPLEVBQUc7SUFDbEc7QUFFQTs7O0FBR0c7QUFDSCxJQUFBLE9BQU8sUUFBUSxHQUFBO0FBQ2IsUUFBQSxPQUFPLHVCQUF1QjtJQUNoQztBQUVBOztBQUVHO0lBQ0gsV0FBVyxPQUFPLEdBQUEsRUFBYSxPQUFPQyxlQUFpQixDQUFDLENBQUM7QUE4QnpEOzs7QUFHRztBQUNLLElBQUEsT0FBTyx3QkFBd0IsR0FBQTtBQUNyQyxRQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsYUFBYSxFQUFFO0FBQ3pCLFlBQUEsSUFBSSxPQUFPLFlBQVksS0FBSyxXQUFXLEVBQUU7QUFDdkMsZ0JBQUEsTUFBTSxDQUFDLGFBQWEsR0FBRyxJQUFJLFlBQVksRUFBRTtZQUMzQztBQUFPLGlCQUFBLElBQUksT0FBTyxrQkFBa0IsS0FBSyxXQUFXLEVBQUU7QUFDcEQsZ0JBQUEsTUFBTSxDQUFDLGFBQWEsR0FBRyxJQUFJLGtCQUFrQixFQUFFO1lBQ2pEO1FBQ0Y7UUFDQSxPQUFPLE1BQU0sQ0FBQyxhQUFhO0lBQzdCO0FBcUxBOzs7O0FBSUc7SUFDSCxXQUFBLENBQVksS0FBYSxFQUFFLE9BQUEsR0FBMEIsRUFBRyxFQUFBO0FBQ3RELFFBQUEsS0FBSyxFQUFFO0FBekxUOztBQUVHO1FBQ0ssSUFBQSxDQUFBLFdBQVcsR0FBZ0IsSUFBSTtBQUV2Qzs7QUFFRztRQUNLLElBQUEsQ0FBQSxNQUFNLEdBQXVCLElBQUk7QUFFekM7O0FBRUc7UUFDSyxJQUFBLENBQUEsNEJBQTRCLEdBQXVDLElBQUk7QUFpQi9FOztBQUVHO1FBQ0ssSUFBQSxDQUFBLGdCQUFnQixHQUF1QixJQUFJO0FBRW5EOzs7QUFHRztRQUNLLElBQUEsQ0FBQSxNQUFNLEdBQVcsRUFBRTtBQUUzQjs7O0FBR0c7QUFDSyxRQUFBLElBQUEsQ0FBQSxZQUFZLEdBQWEsQ0FBQyxTQUFTLENBQUM7QUFFNUM7O0FBRUc7UUFDSyxJQUFBLENBQUEsWUFBWSxHQUFhLEVBQUU7QUFFbkM7O0FBRUc7QUFDYyxRQUFBLElBQUEsQ0FBQSxlQUFlLEdBQTJCO0FBQ3pELFlBQUEsc0JBQXNCLEVBQUUsS0FBSztBQUM3QixZQUFBLGVBQWUsRUFBRSxLQUFLO0FBQ3RCLFlBQUEsZ0JBQWdCLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztBQUNwRCxZQUFBLElBQUksRUFBRSxJQUFJO0FBQ1YsWUFBQSxxQ0FBcUMsRUFBRSxLQUFLO0FBQzVDLFlBQUEsNEJBQTRCLEVBQUUsS0FBSztBQUNuQyxZQUFBLFFBQVEsRUFBRSxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUs7QUFDL0IsWUFBQSx5QkFBeUIsRUFBRSxDQUFDO0FBQzVCLFlBQUEsU0FBUyxFQUFFLEtBQUs7QUFDaEIsWUFBQSxNQUFNLEVBQUUsRUFBRztBQUNYLFlBQUEsY0FBYyxFQUFFLEtBQUs7QUFDckIsWUFBQSxzQkFBc0IsRUFBRSxxQkFBcUI7U0FDOUM7QUFFRDs7QUFFRztRQUNLLElBQUEsQ0FBQSxLQUFLLEdBQWtCLElBQUk7QUFFbkM7O0FBRUc7UUFDSyxJQUFBLENBQUEsS0FBSyxHQUFrQixJQUFJO0FBRW5DOztBQUVHO1FBQ0ssSUFBQSxDQUFBLFNBQVMsR0FBa0IsSUFBSTtBQU92Qzs7QUFFRztBQUNLLFFBQUEsSUFBQSxDQUFBLElBQUksR0FBUSxJQUFJLEdBQUcsQ0FBQyxRQUFRLENBQUM7QUFFckM7O0FBRUc7UUFDSyxJQUFBLENBQUEsZ0JBQWdCLEdBQXdCLElBQUk7QUFRcEQ7O0FBRUc7UUFDSyxJQUFBLENBQUEsUUFBUSxHQUEyQixFQUFHO0FBRTlDOztBQUVHO1FBQ0ssSUFBQSxDQUFBLGFBQWEsR0FBa0IsSUFBSTtBQUUzQzs7QUFFRztRQUNLLElBQUEsQ0FBQSxVQUFVLEdBQXNCLElBQUk7QUFFNUM7O0FBRUc7UUFDSyxJQUFBLENBQUEsT0FBTyxHQUFrQixJQUFJO0FBRXJDOztBQUVHO1FBQ0ssSUFBQSxDQUFBLFNBQVMsR0FBMEIsSUFBSTtBQUUvQzs7Ozs7QUFLRztRQUNLLElBQUEsQ0FBQSxpQkFBaUIsR0FBWSxLQUFLO0FBRTFDOztBQUVHO0FBQ0ssUUFBQSxJQUFBLENBQUEsV0FBVyxHQUFrQyxJQUFJLEdBQUcsRUFBRTtBQUU5RDs7QUFFRztBQUNLLFFBQUEsSUFBQSxDQUFBLE1BQU0sR0FBaUIsTUFBTSxDQUFDLEtBQUssQ0FBQyxZQUFZO0FBRXhEOztBQUVHO0FBQ2MsUUFBQSxJQUFBLENBQUEsa0JBQWtCLEdBQTJDO1lBQzVFLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxTQUFTO1lBQ3BELENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxZQUFZLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxZQUFZO1lBQzFELENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxXQUFXLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxXQUFXO1lBQ3hELENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxVQUFVLEdBQUcsTUFBTSxDQUFDLFNBQVMsQ0FBQyxVQUFVO1NBQ3ZEO0FBRUQ7O0FBRUc7UUFDSyxJQUFBLENBQUEsT0FBTyxHQUFvQixJQUFJO0FBRXZDOztBQUVHO1FBQ0ssSUFBQSxDQUFBLHVCQUF1QixHQUE2QixJQUFJO0FBT2hFOztBQUVHO1FBQ0ssSUFBQSxDQUFBLHVCQUF1QixHQUEwQixJQUFJO0FBb2E3RDs7O0FBR0c7QUFDSyxRQUFBLElBQUEsQ0FBQSxxQkFBcUIsR0FBRyxDQUFDLElBQVcsS0FBeUI7QUFDbkUsWUFBQSxNQUFNLE9BQU8sR0FBd0I7QUFDbkMsZ0JBQUEscUJBQXFCLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyw0QkFBNEI7Z0JBQ2pFLGlCQUFpQixFQUFFLElBQUksQ0FBQyxtQkFBbUI7QUFDM0MsZ0JBQUEsSUFBSSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUk7QUFDMUIsZ0JBQUEsbUJBQW1CLEVBQUUsSUFBSTtBQUN6QixnQkFBQSxRQUFRLEVBQUVDLGNBQWtCLEVBQUU7Z0JBQzlCLFdBQVcsRUFBRUQsZUFBaUI7YUFDL0I7QUFFRCxZQUFBLFNBQVMsWUFBWSxDQUFDLFlBQW9CLEVBQUUsS0FBZ0MsRUFBQTtnQkFDMUUsSUFBSSxLQUFLLEVBQUU7QUFBRSxvQkFBQSxPQUFPLENBQUMsWUFBWSxDQUFDLEdBQUcsS0FBSztnQkFBRTtZQUM5QztZQUVBLElBQUksSUFBSSxFQUFFO0FBQ1IsZ0JBQUEsTUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPO0FBQ3ZDLGdCQUFBLFlBQVksQ0FBQyxVQUFVLEVBQUUsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxTQUFTLEdBQUcsT0FBTyxDQUFDO0FBQ25FLGdCQUFBLFlBQVksQ0FBQyxlQUFlLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDO0FBQ3hELGdCQUFBLFlBQVksQ0FBQyxhQUFhLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQztBQUN2QyxnQkFBQSxPQUFPLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxTQUFTO1lBQ3BDO0FBRUEsWUFBQSxZQUFZLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUM7QUFDN0QsWUFBQSxZQUFZLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7QUFFM0QsWUFBQSxPQUFPLE9BQU87QUFDaEIsUUFBQSxDQUFDO0FBMlREOztBQUVHO1FBQ0ssSUFBQSxDQUFBLGlCQUFpQixHQUFHLE1BQUs7QUFDL0IsWUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUk7QUFDbkIsWUFBQSxJQUFJLENBQUMsdUJBQXVCLEdBQUcsSUFBSTtBQUNyQyxRQUFBLENBQUM7QUFFRDs7QUFFRztBQUNLLFFBQUEsSUFBQSxDQUFBLHFCQUFxQixHQUFHLENBQUMsT0FBNEIsS0FBSTs7WUFDL0QsTUFBTSxNQUFNLEdBQUcsa0JBQWtCLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztBQUNqRCxZQUFBLElBQUksQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDLElBQUksSUFBSSxZQUFZLENBQUMsTUFBZ0IsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxNQUFNO1lBQzdFLElBQUksQ0FBQyxPQUFPLEdBQUcsTUFBTSxJQUFJLE9BQU8sQ0FBQyxNQUFNO0FBQ3ZDLFlBQUEsSUFBSSxDQUFDLEtBQUssR0FBRyxPQUFPLENBQUMsSUFBSTtBQUN6QixZQUFBLENBQUEsRUFBQSxHQUFBLElBQUksQ0FBQyxVQUFVLE1BQUEsSUFBQSxJQUFBLEVBQUEsS0FBQSxNQUFBLEdBQUEsTUFBQSxHQUFBLEVBQUEsQ0FBRSxPQUFPLENBQUMscUJBQXFCLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBRTdELFlBQUEsSUFBSSxPQUFPLENBQUMsS0FBSyxFQUFFO2dCQUNqQixJQUFJLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxLQUFLLENBQUMsUUFBUTtBQUN2QyxnQkFBQSxJQUNFLE9BQU8sT0FBTyxDQUFDLEtBQUssQ0FBQyxHQUFHLEtBQUssUUFBUTtvQkFDckMsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsS0FBSyxRQUFRLEVBQ2hEO29CQUNBLE1BQU0sS0FBSyxHQUFXLE9BQU8sQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLElBQUk7QUFDOUMsb0JBQUEsTUFBTSxTQUFTLEdBQVcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQUUsS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDO0FBQzNFLG9CQUFBLElBQUksQ0FBQyx1QkFBdUIsR0FBRyxVQUFVLENBQUMsTUFBSztBQUM3Qyx3QkFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQztBQUNuQyx3QkFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLElBQUksQ0FBQztBQUNsQyx3QkFBQSxJQUFJLElBQUksQ0FBQyx1QkFBdUIsRUFBRTtBQUNoQyw0QkFBQSxZQUFZLENBQUMsSUFBSSxDQUFDLHVCQUF1QixDQUFDO0FBQzFDLDRCQUFBLElBQUksQ0FBQyx1QkFBdUIsR0FBRyxJQUFJO3dCQUNyQztvQkFDRixDQUFDLEVBQUUsU0FBUyxDQUFDO2dCQUNmO1lBQ0Y7QUFFQSxZQUFBLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxhQUFhLEVBQUUsSUFBSSxjQUFjLENBQUMsSUFBSSxDQUFDLEtBQWEsQ0FBQztBQUNoRixZQUFBLElBQUksYUFBYSxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7QUFDNUIsZ0JBQUEsTUFBTSxDQUFDLFlBQVksQ0FBQyxHQUFHLGFBQWE7QUFDcEMsZ0JBQUEsSUFBSSxDQUFDLGFBQWEsR0FBRywwQkFBMEIsQ0FBQyxZQUFZLENBQUM7WUFDL0Q7aUJBQU87QUFDTCxnQkFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxrRUFBa0UsQ0FBQztZQUNwRjs7O0FBSUEsWUFBQSxJQUFJLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtnQkFDMUIsSUFBSSxDQUFDLFFBQVEsRUFBRSxDQUFDLEtBQUssQ0FBQyxDQUFDLEtBQVUsS0FBSTtvQkFDbkMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsaURBQWlELEVBQUUsS0FBSyxDQUFDO0FBQzFFLGdCQUFBLENBQUMsQ0FBQztZQUNKO0FBQ0YsUUFBQSxDQUFDO0FBRUQ7O0FBRUc7QUFDSyxRQUFBLElBQUEsQ0FBQSxpQkFBaUIsR0FBRyxDQUFDLE9BQTRCLEtBQUk7QUFDM0QsWUFBQSxJQUFJLE9BQU8sT0FBTyxLQUFLLFFBQVEsRUFBRTtnQkFDL0IsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsaUNBQWlDLEVBQUUsT0FBTyxDQUFDO2dCQUMxRDtZQUNGO1lBRUEsTUFBTSxFQUFFLEtBQUssRUFBRSxhQUFhLEVBQUUsT0FBTyxFQUFFLGFBQWEsRUFBRSxHQUFHLE9BQU87OztZQUloRSxJQUFJLE9BQU8sYUFBYSxLQUFLLFFBQVEsSUFBSSxDQUFDLENBQUMsYUFBYSxFQUFFO0FBQ3hELGdCQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGtDQUFrQyxFQUFFLEVBQUUsYUFBYSxFQUFFLGFBQWEsRUFBRSxDQUFDO2dCQUNwRjtZQUNGO0FBRUEsWUFBQSxNQUFNLElBQUksR0FDUixDQUFDLE9BQU8sT0FBTyxLQUFLLFFBQVEsSUFBSSxJQUFJLENBQUMsU0FBUyxDQUFDLE9BQU8sQ0FBQyxLQUFLLFNBQVM7WUFFdkUsTUFBTSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsYUFBYSxFQUFFLEdBQUcsYUFBYTtBQUN0RCxZQUFBLElBQUksRUFBRSxXQUFXLEVBQUUsR0FBRyxhQUFhO0FBRW5DLFlBQUEsSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLEVBQUU7QUFDNUIsZ0JBQUEsSUFBSSxJQUFJLEtBQUssS0FBSyxFQUFFO29CQUNsQixXQUFXLEdBQUcsSUFBSSxtQkFBbUIsQ0FBQyxvQkFBb0IsQ0FBQyxhQUFhLENBQUM7Z0JBQzNFO0FBQU8scUJBQUEsSUFBSSxJQUFJLEtBQUssS0FBSyxFQUFFO29CQUN6QixXQUFXLEdBQUcsSUFBSSxtQkFBbUIsQ0FBQyxrQkFBa0IsQ0FBQyxhQUFhLENBQUM7Z0JBQ3pFO0FBQU8scUJBQUEsSUFBSSxJQUFJLEtBQUssS0FBSyxFQUFFOztvQkFFekIsSUFBSSxDQUFDLHNCQUFzQixFQUFFO29CQUM3QixXQUFXLEdBQUcsSUFBSSxtQkFBbUIsQ0FBQyxrQkFBa0IsQ0FBQyxhQUFhLENBQUM7Z0JBQ3pFO3FCQUFPO0FBQ0wsb0JBQUEsTUFBTSxnQkFBZ0IsR0FBRyw4QkFBOEIsQ0FDckQsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMscUNBQXFDLEVBQ3JELElBQUksQ0FDTDtBQUNELG9CQUFBLElBQUksT0FBTyxnQkFBZ0IsS0FBSyxXQUFXLEVBQUU7QUFDM0Msd0JBQUEsV0FBVyxHQUFHLElBQUksZ0JBQWdCLENBQUMsYUFBYSxDQUFDO29CQUNuRDtnQkFDRjtZQUNGO1lBRUEsSUFBSSxDQUFDLFdBQVcsRUFBRTtnQkFDaEIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsMkJBQTJCLEVBQUUsYUFBYSxDQUFDO2dCQUMzRCxXQUFXLEdBQUcsSUFBSSxhQUFhLENBQUMsWUFBWSxDQUFDLGFBQWEsRUFBRSxhQUFhLENBQUM7WUFDNUU7WUFFQSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsRUFBRSxXQUFXLENBQUM7WUFDaEQsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsUUFBUSxFQUFFLGFBQWEsQ0FBQztBQUN4QyxZQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsV0FBVyxFQUFFLElBQUksQ0FBQztBQUN0RCxRQUFBLENBQUM7QUFFRDs7QUFFRztBQUNLLFFBQUEsSUFBQSxDQUFBLGtCQUFrQixHQUFHLENBQU8sT0FBNEIsS0FBSSxTQUFBLENBQUEsSUFBQSxFQUFBLE1BQUEsRUFBQSxNQUFBLEVBQUEsYUFBQTs7QUFDbEUsWUFBQSxNQUFNLE9BQU8sR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVc7WUFDbEMsSUFBSSxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLHNCQUFzQixFQUFFO0FBQ3BELGdCQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHVDQUF1QyxDQUFDO2dCQUN2RDtZQUNGO1lBRUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUMsR0FBRyxFQUFFO2dCQUNwQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxRQUFRLEVBQUUsT0FBTyxDQUFDO0FBQ2xDLGdCQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsSUFBSSxZQUFZLENBQUMsVUFBVSxDQUFDLCtCQUErQixDQUFDLENBQUM7Z0JBQy9GO1lBQ0Y7QUFFQSxZQUFBLE1BQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxVQUFVLElBQUksRUFBRztZQUNoRCxjQUFjLENBQUMsT0FBTyxHQUFHLGNBQWMsQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDLE9BQU87QUFFbEUsWUFBQSxNQUFNLGdCQUFnQixHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsRUFBRyxFQUFFLFdBQVcsQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFDLENBQUM7WUFFL0UsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksQ0FBQyxTQUFTLENBQ3BDLGdCQUFnQixFQUNoQjtnQkFDRSxjQUFjO0FBQ2QsZ0JBQUEscUNBQXFDLEVBQ25DLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLHFDQUFxQztnQkFDdkQsUUFBUSxFQUFFLE9BQU8sQ0FBQyxHQUFHO2dCQUNyQixjQUFjLEVBQUUsT0FBTyxDQUFDLFNBQVM7QUFDakMsZ0JBQUEsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxzQkFBc0I7QUFDN0QsYUFBQSxDQUNGO0FBRUQsWUFBQSxJQUFJLElBQUk7QUFDUixZQUFBLElBQUk7QUFDRixnQkFBQSxJQUFJLEdBQUcsTUFBTSxJQUFJLENBQUMsZ0JBQWdCO1lBQ3BDO29CQUFVO0FBQ1IsZ0JBQUEsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUk7WUFDOUI7QUFFQSxZQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztBQUV0QixZQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLE1BQUs7QUFDdkIsZ0JBQUEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLEVBQUU7Z0JBQ3RELElBQUksQ0FBQyxxQkFBcUIsRUFBRTtBQUM5QixZQUFBLENBQUMsQ0FBQztBQUVGLFlBQUEsTUFBTSxJQUFJLEdBQUcsQ0FBQyxDQUFBLE1BQUEsSUFBSSxDQUFDLE1BQU0sTUFBQSxJQUFBLElBQUEsRUFBQSxLQUFBLE1BQUEsR0FBQSxNQUFBLEdBQUEsRUFBQSxDQUFFLFFBQVEsRUFBRSxLQUFJLENBQUMsT0FBTztBQUMvQyxrQkFBRSxNQUFNLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsSUFBSTtrQkFDMUQsTUFBTSxPQUFPLENBQUMsT0FBTyxFQUFFO0FBRTNCLFlBQUEsSUFBSSxDQUFDLGlCQUFpQixDQUFDLElBQUksRUFBRSxJQUFJLENBQUM7QUFDcEMsUUFBQSxDQUFDLENBQUE7QUFFRDs7QUFFRztRQUNLLElBQUEsQ0FBQSxtQkFBbUIsR0FBRyxNQUFLO0FBQ2pDLFlBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUM7QUFFbkMsWUFBQSxJQUFJLENBQUMsS0FBSyxHQUFHLElBQUk7QUFDakIsWUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUk7O1lBR25CLElBQUksQ0FBQyxzQkFBc0IsRUFBRTtBQUU3QixZQUFBLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLENBQUMsS0FBSyxLQUFLLE1BQU0sQ0FBQyxLQUFLLENBQUMsWUFBWTtZQUVqRSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFDO0FBQzNDLFFBQUEsQ0FBQztBQUVEOztBQUVHO1FBQ0ssSUFBQSxDQUFBLGlCQUFpQixHQUFHLE1BQUs7QUFDL0IsWUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztZQUVqQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDO0FBQ3pDLFFBQUEsQ0FBQztBQUVEOztBQUVHO1FBQ0ssSUFBQSxDQUFBLHFCQUFxQixHQUFHLE1BQUs7QUFDbkMsWUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRTtnQkFDckI7WUFDRjtBQUVBLFlBQUEsSUFBSSxJQUFJLENBQUMsbUJBQW1CLEVBQUU7Z0JBQzVCLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLHFCQUFxQixFQUFFLGdCQUFnQixFQUFFO0FBQzVELG9CQUFBLGVBQWUsRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsSUFBSTtBQUM5QyxvQkFBQSxRQUFRLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFFBQVE7QUFDM0Msb0JBQUEsV0FBVyxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxXQUFXO0FBQ2pELG9CQUFBLGNBQWMsRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUMsYUFBYTtBQUN0RCxvQkFBQSxHQUFHLEVBQUUsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUc7QUFDbEMsaUJBQUEsRUFBRSxJQUFJLENBQUMsV0FBVyxDQUFDO1lBQ3RCO0FBQ0YsUUFBQSxDQUFDO0FBK09EOzs7O0FBSUc7QUFDSyxRQUFBLElBQUEsQ0FBQSxrQkFBa0IsR0FBRyxDQUFDLFdBQStCLEtBQW1CO0FBQzlFLFlBQUEsTUFBTSxJQUFJLEdBQWdCLElBQUksQ0FBQyxXQUFXO0FBRTFDLFlBQUEsSUFBSSxJQUFJLElBQUksQ0FBQyxXQUFXLEVBQUU7Z0JBQ3hCLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLGlCQUFpQixDQUFDLHdEQUF3RCxDQUFDLENBQUM7WUFDeEc7QUFFQSxZQUFBLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxXQUFXO0FBQ25DLFlBQUEsT0FBTztBQUNMLGtCQUFFLElBQUksQ0FBQyx5QkFBeUIsQ0FBQyxXQUFXO0FBQzVDLGtCQUFFLE9BQU8sQ0FBQyxPQUFPLEVBQUU7QUFDdkIsUUFBQSxDQUFDO0FBVUQ7Ozs7QUFJRztBQUNLLFFBQUEsSUFBQSxDQUFBLGNBQWMsR0FBRyxDQUFDLElBQTRCLEVBQUUsT0FBaUIsS0FBbUI7QUFDMUYsWUFBQSxNQUFNLE9BQU8sR0FBa0IsSUFBSSxLQUFLO0FBQ3RDLGtCQUFFLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxPQUFPO0FBQ3JDLGtCQUFFLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxPQUFPLENBQUM7QUFFdkMsWUFBQSxPQUFPLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBSztnQkFDdkIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLENBQUEsRUFBRyxJQUFJLENBQUEsWUFBQSxDQUFjLEVBQUU7QUFDbkQsb0JBQUEsZ0JBQWdCLEVBQUUsT0FBTztBQUMxQixpQkFBQSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUM7WUFDdEIsQ0FBQyxFQUFFLEtBQUssSUFBRztnQkFDVCxJQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQSxFQUFHLElBQUksQ0FBQSxtQkFBQSxDQUFxQixFQUFFO0FBQzNELG9CQUFBLGdCQUFnQixFQUFFLE9BQU87b0JBQ3pCLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTztBQUN2QixpQkFBQSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUM7QUFFcEIsZ0JBQUEsTUFBTSxLQUFLO0FBQ2IsWUFBQSxDQUFDLENBQUM7QUFDSixRQUFBLENBQUM7O0FBOXRDQyxRQUFBLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLFFBQVEsQ0FBQztBQUNyQyxRQUFBLElBQUksQ0FBQyxXQUFXLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQztBQUV4QyxRQUFBLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxDQUFDO1FBRXZCLElBQUksWUFBWSxFQUFFLEVBQUU7WUFDbEIsTUFBTSxJQUFJLGlCQUFpQixDQUN6Qix5R0FBeUc7Z0JBQ3pHLDhHQUE4RztnQkFDOUcsaUVBQWlFO0FBQ2pFLGdCQUFBLHdFQUF3RSxDQUN6RTtRQUNIO1FBRUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxXQUFXLElBQUssT0FBa0MsQ0FBQyxvQkFBb0IsRUFBRTtBQUNuRixZQUFBLElBQUksTUFBTSxJQUFJLE1BQU0sQ0FBQyxRQUFRLElBQUksTUFBTSxDQUFDLFFBQVEsQ0FBQyxRQUFRLEtBQUssT0FBTyxFQUFFO2dCQUNyRSxNQUFNLElBQUksaUJBQWlCLENBQUMsQ0FBQTs7O0FBR2Ysb0JBQUEsQ0FBQSxDQUFDO1lBQ2hCO1lBRUEsTUFBTSxJQUFJLGlCQUFpQixDQUFDLENBQUE7OztBQUdXLDRDQUFBLENBQUEsQ0FBQztRQUMxQztRQUVBLE1BQU0sSUFBSSxHQUFRLFVBQWlCO0FBQ25DLFFBQUEsTUFBTSxPQUFPLEdBQVEsSUFBSSxDQUFDLFNBQVMsSUFBSSxJQUFJLENBQUMsT0FBTyxJQUFJLElBQUksQ0FBQyxNQUFNO1FBRWxFLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxDQUFDLENBQUMsQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLElBQUksQ0FBQyxDQUFDLE9BQU8sQ0FBQyxPQUFPLENBQUMsRUFBRTtBQUM3RSxnQkFBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7QUFFL0MsUUFBQSxJQUFJLElBQUksQ0FBQyxtQkFBbUIsRUFBRTtBQUM1QixZQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLCtCQUErQixDQUFDO1FBQ2pEO1FBRUEsSUFBSSxTQUFTLEVBQUU7WUFDYixNQUFNLENBQUMsR0FBRyxTQUFnQjtBQUMxQixZQUFBLElBQUksQ0FBQyxtQkFBbUIsR0FBRyxDQUFDLENBQUM7QUFDeEIsbUJBQUEsQ0FBQyxDQUFDO21CQUNGLENBQUMsQ0FBQyxnQkFBZ0I7UUFDekI7QUFFQSxRQUFBLElBQUksSUFBSSxDQUFDLG1CQUFtQixJQUFJLE9BQU8sSUFBSSxDQUFDLG1CQUFtQixDQUFDLGdCQUFnQixLQUFLLFVBQVUsRUFBRTtZQUMvRixJQUFJLENBQUMsbUJBQW1CLENBQUMsZ0JBQWdCLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxxQkFBcUIsQ0FBQztRQUNqRjtRQUVBLE1BQU0sQ0FBQyx3QkFBd0IsRUFBRTtBQUVqQyxRQUFBLElBQUksTUFBTSxDQUFDLGFBQWEsRUFBRTtBQUN4QixZQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsZUFBZSxFQUFFO2dCQUMzQixNQUFNLENBQUMsZUFBZSxHQUFHLElBQUksY0FBYyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUM7WUFDbkU7UUFDRjtRQUVBLElBQUksQ0FBQyxrQkFBa0IsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7UUFDdkQsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztRQUNuRCxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1FBRW5ELElBQUksT0FBTyxNQUFNLEtBQUssV0FBVyxJQUFJLE1BQU0sQ0FBQyxnQkFBZ0IsRUFBRTtZQUM1RCxNQUFNLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztZQUMxRCxNQUFNLENBQUMsZ0JBQWdCLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztRQUM1RDtBQUVBLFFBQUEsSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUM7SUFDN0I7QUFFQTs7QUFFRztBQUNILElBQUEsSUFBSSxLQUFLLEdBQUE7UUFDUCxPQUFPLElBQUksQ0FBQyxNQUFNO0lBQ3BCO0FBRUE7OztBQUdHO0lBQ0csT0FBTyxHQUFBO0FBQUMsUUFBQSxPQUFBLFNBQUEsQ0FBQSxJQUFBLEVBQUEsU0FBQSxFQUFBLE1BQUEsRUFBQSxXQUFBLE9BQUEsR0FBaUMsRUFBRyxFQUFBO0FBQ2hELFlBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDcEQsSUFBSSxDQUFDLGlCQUFpQixFQUFFO1lBQ3hCLElBQUksSUFBSSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7QUFDN0MsZ0JBQUEsTUFBTSxJQUFJLGlCQUFpQixDQUFDLDBCQUEwQixDQUFDO1lBQ3pEO0FBRUEsWUFBQSxJQUFJLGdCQUFnQjtBQUNwQixZQUFBLElBQUksVUFBVTtBQUNkLFlBQUEsSUFBSSx1QkFBdUI7QUFFM0IsWUFBQSxJQUFJLE9BQU8sQ0FBQyxZQUFZLEVBQUU7QUFDeEIsZ0JBQUEsSUFBSTtBQUNGLG9CQUFBLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7QUFDcEYsb0JBQUEsZ0JBQWdCLEdBQUcsaUJBQWlCLENBQUMsZ0JBQWdCO0FBQ3JELG9CQUFBLFVBQVUsR0FBRyxpQkFBaUIsQ0FBQyxVQUFVO0FBQ3pDLG9CQUFBLHVCQUF1QixHQUFHLGlCQUFpQixDQUFDLHVCQUF1QjtnQkFDckU7QUFBRSxnQkFBQSxPQUFBLEVBQUEsRUFBTTtBQUNOLG9CQUFBLE1BQU0sSUFBSSxvQkFBb0IsQ0FBQywyQkFBMkIsQ0FBQztnQkFDN0Q7Z0JBRUEsSUFBSSxDQUFDLFVBQVUsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLElBQUksQ0FBQyx1QkFBdUIsRUFBRTtBQUNsRSxvQkFBQSxNQUFNLElBQUksb0JBQW9CLENBQUMsc0JBQXNCLENBQUM7Z0JBQ3hEO1lBQ0Y7WUFFQSxJQUFJLFdBQVcsR0FBRyxLQUFLO1lBQ3ZCLElBQUksV0FBVyxHQUEyQixFQUFFO0FBQzVDLFlBQUEsTUFBTSxXQUFXLEdBQWlCO0FBQ2hDLGdCQUFBLHFDQUFxQyxFQUNyQyxDQUFDLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxxQ0FBcUM7Z0JBQ3JELGdCQUFnQixFQUFFLE9BQU8sQ0FBQyxnQkFBZ0I7QUFDMUMsZ0JBQUEsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxzQkFBc0I7YUFDN0Q7QUFFRCxZQUFBLElBQUksdUJBQXVCLElBQUksVUFBVSxFQUFFO2dCQUN6QyxXQUFXLEdBQUcsSUFBSTtBQUNsQixnQkFBQSxXQUFXLENBQUMsY0FBYyxHQUFHLFVBQVU7QUFDdkMsZ0JBQUEsV0FBVyxDQUFDLGdCQUFnQixHQUFHLFVBQVUsQ0FBQyxPQUFPO0FBQ2pELGdCQUFBLFdBQVcsQ0FBQyxjQUFjLEdBQUcsdUJBQXVCO0FBQ3BELGdCQUFBLFdBQVcsR0FBRyxnQkFBZ0IsSUFBSSxXQUFXO1lBQy9DO2lCQUFPO0FBQ0wsZ0JBQUEsV0FBVyxHQUFHLE9BQU8sQ0FBQyxNQUFNLElBQUksV0FBVztZQUM3QztBQUVBLFlBQUEsSUFBSSxVQUFVO0FBQ2QsWUFBQSxJQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxXQUFXLEVBQUUsV0FBVyxFQUFFLFdBQVcsQ0FBQztBQUM3RSxZQUFBLElBQUk7Z0JBQ0YsVUFBVSxHQUFHLElBQUksQ0FBQyxXQUFXLEdBQUcsTUFBTSxJQUFJLENBQUMsZ0JBQWdCO1lBQzdEO29CQUFVO0FBQ1IsZ0JBQUEsSUFBSSxDQUFDLGdCQUFnQixHQUFHLElBQUk7WUFDOUI7O0FBR0EsWUFBQSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQzs7QUFHcEQsWUFBQSxJQUFJLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQyxDQUFDLElBQUksRUFBRTtZQUV0RCxVQUFVLENBQUMsTUFBTSxDQUFDLEVBQUUsY0FBYyxFQUFFLE9BQU8sQ0FBQyxjQUFjLEVBQUUsQ0FBQztZQUM3RCxJQUFJLENBQUMscUJBQXFCLEVBQUU7QUFDNUIsWUFBQSxPQUFPLFVBQVU7UUFDbkIsQ0FBQyxDQUFBO0FBQUEsSUFBQTtBQUVEOztBQUVHO0FBQ0gsSUFBQSxJQUFJLEtBQUssR0FBQTtRQUNQLE9BQU8sSUFBSSxDQUFDLE1BQU07SUFDcEI7QUFFQTs7QUFFRztJQUNILE9BQU8sR0FBQTs7QUFDTCxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQztBQUUzQixRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLDhCQUE4QixDQUFDO1FBQy9DLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztBQUNsQyxRQUFBLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFVLEtBQUssSUFBSSxDQUFDLE1BQU0sRUFBRSxDQUFDO1FBRTVDLElBQUksQ0FBQyxhQUFhLEVBQUU7UUFDcEIsSUFBSSxDQUFDLHNCQUFzQixFQUFFO1FBRTdCLElBQUksQ0FBQyxjQUFjLEVBQUU7UUFDckIsSUFBSSxDQUFDLG1CQUFtQixFQUFFO0FBQzFCLFFBQUEsQ0FBQSxFQUFBLEdBQUEsSUFBSSxDQUFDLDRCQUE0QixNQUFBLElBQUEsSUFBQSxFQUFBLEtBQUEsTUFBQSxHQUFBLE1BQUEsR0FBQSxFQUFBLENBQUUsT0FBTyxFQUFFO1FBQzVDLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtBQUV4QixRQUFBLElBQUksSUFBSSxDQUFDLG1CQUFtQixJQUFJLE9BQU8sSUFBSSxDQUFDLG1CQUFtQixDQUFDLG1CQUFtQixLQUFLLFVBQVUsRUFBRTtZQUNsRyxJQUFJLENBQUMsbUJBQW1CLENBQUMsbUJBQW1CLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxxQkFBcUIsQ0FBQztRQUNwRjtRQUVBLElBQUksT0FBTyxNQUFNLEtBQUssV0FBVyxJQUFJLE1BQU0sQ0FBQyxtQkFBbUIsRUFBRTtZQUMvRCxNQUFNLENBQUMsbUJBQW1CLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQztZQUNuRSxNQUFNLENBQUMsbUJBQW1CLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztZQUM3RCxNQUFNLENBQUMsbUJBQW1CLENBQUMsVUFBVSxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQztRQUMvRDtRQUVBLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLENBQUM7UUFDdEMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ3REO0FBRUE7O0FBRUc7SUFDSCxhQUFhLEdBQUE7QUFDWCxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGdCQUFnQixDQUFDO1FBQ2pDLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztBQUNuQyxRQUFBLEtBQUssQ0FBQyxPQUFPLENBQUMsQ0FBQyxJQUFVLEtBQUssSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO0FBRWhELFFBQUEsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFO0FBQ3BCLFlBQUEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLEVBQUU7UUFDL0I7SUFDRjtBQUVBOzs7QUFHRztBQUNILElBQUEsSUFBSSxJQUFJLEdBQUE7UUFDTixPQUFPLElBQUksQ0FBQyxLQUFLO0lBQ25CO0FBRUE7OztBQUdHO0FBQ0gsSUFBQSxJQUFJLElBQUksR0FBQTtRQUNOLE9BQU8sSUFBSSxDQUFDLEtBQUs7SUFDbkI7QUFFQTs7O0FBR0c7QUFDSCxJQUFBLElBQUksUUFBUSxHQUFBO1FBQ1YsT0FBTyxJQUFJLENBQUMsU0FBUztJQUN2QjtBQUVBOztBQUVHO0FBQ0gsSUFBQSxJQUFJLE1BQU0sR0FBQTtBQUNSLFFBQUEsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVc7SUFDM0I7QUFFQTs7QUFFRztJQUNHLFFBQVEsR0FBQTs7QUFDWixZQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFdBQVcsQ0FBQztZQUM1QixJQUFJLElBQUksQ0FBQyxLQUFLLEtBQUssTUFBTSxDQUFDLEtBQUssQ0FBQyxZQUFZLEVBQUU7QUFDNUMsZ0JBQUEsTUFBTSxJQUFJLGlCQUFpQixDQUN6QixnREFBZ0QsSUFBSSxDQUFDLEtBQUssQ0FBQSxHQUFBLENBQUs7QUFDL0Qsb0JBQUEsQ0FBQSxTQUFBLEVBQVksTUFBTSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUEsRUFBQSxDQUFJLENBQzFDO1lBQ0g7QUFFQSxZQUFBLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxLQUFLO1lBQzlCLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQyxXQUFXLENBQUM7WUFFeEMsT0FBTyxJQUFJLENBQUMsdUJBQXVCLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRSxDQUFDO0FBQzNELFlBQUEsTUFBTSxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQztBQUM5QixZQUFBLE1BQU0sZUFBZSxDQUFDLElBQUksRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQztRQUNqRixDQUFDLENBQUE7QUFBQSxJQUFBO0FBRUQ7O0FBRUc7QUFDSCxJQUFBLElBQUksS0FBSyxHQUFBO1FBQ1AsT0FBTyxJQUFJLENBQUMsTUFBTTtJQUNwQjtBQUVBOztBQUVHO0FBQ0gsSUFBQSxJQUFJLEtBQUssR0FBQTtRQUNQLE9BQU8sSUFBSSxDQUFDLE1BQU07SUFDcEI7QUFFQTs7O0FBR0c7SUFDSCxRQUFRLEdBQUE7QUFDTixRQUFBLE9BQU8sMEJBQTBCO0lBQ25DO0FBRUE7OztBQUdHO0lBQ0csVUFBVSxHQUFBOztBQUNkLFlBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsYUFBYSxDQUFDO1lBQzlCLElBQUksSUFBSSxDQUFDLEtBQUssS0FBSyxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRTtBQUMxQyxnQkFBQSxNQUFNLElBQUksaUJBQWlCLENBQ3pCLGtEQUFrRCxJQUFJLENBQUMsS0FBSyxDQUFBLEdBQUEsQ0FBSztBQUNqRSxvQkFBQSxDQUFBLFNBQUEsRUFBWSxNQUFNLENBQUMsS0FBSyxDQUFDLFVBQVUsQ0FBQSxFQUFBLENBQUksQ0FDeEM7WUFDSDtBQUVBLFlBQUEsSUFBSSxDQUFDLGlCQUFpQixHQUFHLEtBQUs7QUFFOUIsWUFBQSxNQUFNLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyx1QkFBdUI7QUFDakQsWUFBQSxNQUFNLG9CQUFvQixHQUFHLElBQUksT0FBTyxDQUFDLE9BQU8sSUFBRztBQUNqRCxnQkFBQSxNQUFNLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxPQUFPLENBQUM7QUFDL0IsWUFBQSxDQUFDLENBQUM7QUFDRixZQUFBLE1BQU0sSUFBSSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUM7QUFDL0IsWUFBQSxNQUFNLG9CQUFvQjtRQUM1QixDQUFDLENBQUE7QUFBQSxJQUFBO0FBRUQ7OztBQUdHO0lBQ0gsYUFBYSxDQUFDLFVBQTBCLEVBQUcsRUFBQTtBQUN6QyxRQUFBLElBQUksQ0FBQyxXQUFXLENBQUMsZUFBZSxFQUFFLE9BQU8sQ0FBQztRQUMxQyxJQUFJLElBQUksQ0FBQyxLQUFLLEtBQUssTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUU7WUFDekMsTUFBTSxJQUFJLGlCQUFpQixDQUN6QixDQUFBLG9EQUFBLEVBQXVELElBQUksQ0FBQyxLQUFLLENBQUEsRUFBQSxDQUFJLENBQ3RFO1FBQ0g7QUFFQSxRQUFBLElBQUksQ0FBQyxRQUFRLEdBQUEsTUFBQSxDQUFBLE1BQUEsQ0FBQSxNQUFBLENBQUEsTUFBQSxDQUFBLE1BQUEsQ0FBQSxNQUFBLENBQUEsRUFBQSxFQUFRLElBQUksQ0FBQyxlQUFlLENBQUEsRUFBSyxJQUFJLENBQUMsUUFBUSxDQUFBLEVBQUssT0FBTyxDQUFFO1FBRXpFLE1BQU0sbUJBQW1CLEdBQWdCLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUM7UUFFbkUsTUFBTSxjQUFjLEdBQUcsSUFBSSxDQUFDLFlBQVksR0FBRyxDQUN6QyxJQUFJLENBQUMsYUFBYSxFQUFFLElBQUksY0FBYyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxDQUFDLEVBQzFELEdBQUcsQ0FBQywwQkFBMEIsQ0FBQztRQUVqQyxJQUFJLHFCQUFxQixHQUFHLG1CQUFtQixDQUFDLElBQUksS0FBSyxjQUFjLENBQUMsTUFBTTtRQUU5RSxJQUFJLENBQUMscUJBQXFCLEVBQUU7QUFDMUIsWUFBQSxLQUFLLE1BQU0sR0FBRyxJQUFJLGNBQWMsRUFBRTtnQkFDaEMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRTtvQkFDakMscUJBQXFCLEdBQUcsSUFBSTtvQkFDNUI7Z0JBQ0Y7WUFDRjtRQUNGO0FBRUEsUUFBQSxJQUFJLElBQUksQ0FBQyxNQUFNLElBQUkscUJBQXFCLEVBQUU7QUFDeEMsWUFBQSxNQUFNLElBQUksaUJBQWlCLENBQUMsNENBQTRDLENBQUM7UUFDM0U7UUFFQSxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxDQUFDO0FBRTNDLFFBQUEsS0FBSyxNQUFNLElBQUksSUFBSSxNQUFNLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsRUFBRTtZQUNyRCxNQUFNLFFBQVEsR0FBcUIsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUM7QUFFOUQsWUFBQSxNQUFNLFVBQVUsR0FBVyxDQUFBLEVBQUdFLGVBQWlCLENBQUEsQ0FBQSxFQUFJLFFBQVEsQ0FBQyxRQUFRLENBQUEsQ0FBQSxFQUFJLE1BQU0sQ0FBQyxTQUFTLENBQUE7QUFDcEYsa0JBQUEsQ0FBQSxPQUFBLEVBQVVGLGVBQWlCLENBQUEsQ0FBRTtBQUVqQyxZQUFBLE1BQU0sUUFBUSxHQUFXLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQXdCLENBQUMsSUFBSSxVQUFVO0FBQzdHLFlBQUEsTUFBTSxLQUFLLEdBQVEsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssSUFBSSxLQUFLLEVBQUUsSUFBSSxFQUFFLFFBQVEsRUFBRTtBQUNwRSxnQkFBQSxZQUFZLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyx5QkFBeUIsR0FBRyxJQUFJLEdBQUcsTUFBTSxDQUFDLFlBQVk7Z0JBQ2xGLFdBQVcsRUFBRSxRQUFRLENBQUMsV0FBVztnQkFDakMsVUFBVSxFQUFFLFFBQVEsQ0FBQyxVQUFVO0FBQ2hDLGFBQUEsQ0FBQztZQUVGLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLElBQXdCLEVBQUUsS0FBSyxDQUFDO1FBQ3ZEO1FBRUEsSUFBSSxDQUFDLGlCQUFpQixFQUFFO1FBQ3hCLElBQUksQ0FBQyxlQUFlLEVBQUU7QUFFdEIsUUFBQSxJQUFJLHFCQUFxQixJQUFJLElBQUksQ0FBQyx1QkFBdUIsRUFBRTtZQUN6RCxJQUFJLENBQUMsWUFBWSxFQUFFO1FBQ3JCOztRQUdBLElBQ0UsT0FBTyxNQUFNLEtBQUssV0FBVztBQUM3QixZQUFBLE9BQU8sTUFBTSxDQUFDLGdCQUFnQixLQUFLLFVBQVU7QUFDN0MsWUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsRUFDN0I7WUFDQSxNQUFNLENBQUMsbUJBQW1CLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQztZQUNuRSxNQUFNLENBQUMsZ0JBQWdCLENBQUMsY0FBYyxFQUFFLElBQUksQ0FBQyxrQkFBa0IsQ0FBQztRQUNsRTtJQUNGO0FBRUE7Ozs7O0FBS0c7QUFDSCxJQUFBLFdBQVcsQ0FBQyxLQUFhLEVBQUE7QUFDdkIsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxjQUFjLENBQUM7UUFDL0IsSUFBSSxJQUFJLENBQUMsS0FBSyxLQUFLLE1BQU0sQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFO1lBQ3pDLE1BQU0sSUFBSSxpQkFBaUIsQ0FDekIsQ0FBQSxrREFBQSxFQUFxRCxJQUFJLENBQUMsS0FBSyxDQUFBLEVBQUEsQ0FBSSxDQUNwRTtRQUNIO0FBRUEsUUFBQSxJQUFJLE9BQU8sS0FBSyxLQUFLLFFBQVEsRUFBRTtBQUM3QixZQUFBLE1BQU0sSUFBSSxvQkFBb0IsQ0FBQyxxQkFBcUIsQ0FBQztRQUN2RDtBQUVBLFFBQUEsSUFBSSxDQUFDLE1BQU0sR0FBRyxLQUFLO0FBRW5CLFFBQUEsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ2hCLElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUM7UUFDcEM7QUFFQSxRQUFBLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNuQixJQUFJLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQ3ZDO0lBQ0Y7QUFFQTs7OztBQUlHO0FBQ0ssSUFBQSxhQUFhLENBQUMsS0FBVSxFQUFBO0FBQzlCLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUU7QUFBRSxZQUFBLE9BQU8sRUFBRTtRQUFFO1FBRXBDLE1BQU0sZUFBZSxHQUFxQixJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsSUFBSSxLQUFLO0FBQ2hGLFFBQUEsTUFBTSxlQUFlLEdBQVcsT0FBTyxlQUFlLEtBQUs7QUFDekQsY0FBRTtjQUNBLGVBQWU7UUFFbkIsQ0FBQyxLQUFLLElBQUksTUFBTSxDQUFDLEtBQUssRUFBRSxXQUFXLEdBQUcsZUFBZTtBQUNyRCxRQUFBLE9BQU8sZUFBZTtJQUN4QjtBQWtDQTs7QUFFRztJQUNLLG1CQUFtQixHQUFBO0FBQ3pCLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUU7WUFBRTtRQUFRO0FBQzVCLFFBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyxRQUFRLEVBQUU7QUFDdEIsUUFBQSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUk7SUFDcEI7QUFFQTs7QUFFRztJQUNLLGlCQUFpQixHQUFBOztBQUV2QixRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFO1lBQUU7UUFBUTtBQUVoQyxRQUFBLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSTtJQUN4QjtBQUVBOztBQUVHO0lBQ0ssY0FBYyxHQUFBO0FBQ3BCLFFBQUEsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQ2hCLElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsaUJBQWlCLENBQUM7WUFDNUQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsV0FBVyxFQUFFLElBQUksQ0FBQyxxQkFBcUIsQ0FBQztZQUNwRSxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDO1lBQzVELElBQUksQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsa0JBQWtCLENBQUM7WUFDOUQsSUFBSSxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxtQkFBbUIsQ0FBQztZQUNoRSxJQUFJLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDO0FBRTVELFlBQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUU7QUFDdEIsWUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUk7UUFDckI7UUFFQSxJQUFJLENBQUMsbUJBQW1CLEVBQUU7QUFFMUIsUUFBQSxJQUFJLENBQUMsdUJBQXVCLEdBQUcsSUFBSTtJQUNyQztBQUVBOzs7QUFHRztBQUNLLElBQUEsU0FBUyxDQUFDLE9BQWUsRUFBQTtBQUMvQixRQUFBLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxLQUFLO0FBQ3ZELGVBQUEsSUFBSSxDQUFDLG9CQUFvQixLQUFLLE9BQU8sQ0FBQyxJQUFJLElBQUk7SUFDckQ7QUFFQTs7QUFFRztJQUNLLGFBQWEsR0FBQTtBQUNuQixRQUFBLE9BQU8sT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsS0FBSyxRQUFRLEdBQUcsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVE7Y0FDdkUsS0FBSyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsQ0FBQyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxHQUFHLElBQUk7SUFDM0U7QUFFQTs7QUFFRztBQUNLLElBQUEsV0FBVyxDQUFDLE1BQWMsRUFBRSxPQUFBLEdBQTBCLEVBQUcsRUFBQTs7Ozs7QUFLL0QsUUFBQSxNQUFNLFdBQVcsR0FBRztZQUNsQix3QkFBd0I7WUFDeEIsU0FBUztZQUNULFlBQVk7WUFDWixpQkFBaUI7WUFDakIsa0JBQWtCO1lBQ2xCLDJCQUEyQjtZQUMzQixNQUFNO1lBQ04sTUFBTTtZQUNOLHVDQUF1QztZQUN2Qyw4QkFBOEI7WUFDOUIsVUFBVTtZQUNWLG1CQUFtQjtZQUNuQiwyQkFBMkI7WUFDM0IsUUFBUTtZQUNSLGdCQUFnQjtTQUNqQjtBQUNELFFBQUEsTUFBTSxtQkFBbUIsR0FBRztZQUMxQixtQkFBbUI7WUFDbkIsa0JBQWtCO1lBQ2xCLGNBQWM7WUFDZCxhQUFhO1NBQ2Q7QUFDRCxRQUFBLElBQUksT0FBTyxPQUFPLEtBQUssUUFBUSxFQUFFO0FBQy9CLFlBQUEsTUFBTSxLQUFLLEdBQUEsTUFBQSxDQUFBLE1BQUEsQ0FBQSxFQUFBLEVBQWEsT0FBTyxDQUFFO1lBQ2pDLE1BQU0sQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsR0FBVyxLQUFJO0FBQ3pDLGdCQUFBLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsbUJBQW1CLENBQUMsUUFBUSxDQUFDLEdBQUcsQ0FBQyxFQUFFO0FBQ3BFLG9CQUFBLE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQztnQkFDbkI7QUFDQSxnQkFBQSxJQUFJLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRTtBQUNyQyxvQkFBQSxLQUFLLENBQUMsR0FBRyxDQUFDLEdBQUcsSUFBSTtnQkFDbkI7QUFDRixZQUFBLENBQUMsQ0FBQztBQUNGLFlBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxNQUFNLENBQUEsQ0FBRSxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDdEQ7SUFDRjtBQUVBOzs7O0FBSUc7SUFDVyxTQUFTLENBQUEsYUFBQSxFQUFBLFNBQUEsRUFBQTtBQUFDLFFBQUEsT0FBQSxTQUFBLENBQUEsSUFBQSxFQUFBLFNBQUEsRUFBQSxNQUFBLEVBQUEsV0FBQSxXQUFtQyxFQUFFLE9BQXNCLEVBQUUsV0FBQSxHQUF1QixLQUFLLEVBQUE7OztZQUUvRyxNQUFNLGtCQUFrQixHQUFHLENBQUEsRUFBQSxHQUFBLElBQUksQ0FBQyxNQUFNLE1BQUEsSUFBQSxJQUFBLEVBQUEsS0FBQSxNQUFBLEdBQUEsTUFBQSxHQUFBLEVBQUEsQ0FBRSxzQkFBc0IsRUFBRTtZQUNoRSxJQUFJLGtCQUFrQixFQUFFO0FBQ3RCLGdCQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLHlDQUF5QyxDQUFDO0FBQzFELGdCQUFBLE1BQU0sa0JBQWtCO0FBQ3hCLGdCQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLDZCQUE2QixDQUFDO1lBQ2hEO0FBRUEsWUFBQSxNQUFNLE1BQU0sR0FBZ0I7Z0JBQzFCLFdBQVcsRUFBRSxJQUFJLENBQUMsTUFBTTtnQkFDeEIsUUFBUSxFQUFFLE1BQVc7QUFDbkIsb0JBQUEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLEVBQUU7Z0JBQ3hELENBQUM7Z0JBQ0QsT0FBTyxFQUFFLE9BQU8sSUFBSSxDQUFDLHVCQUF1QixJQUFJLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztnQkFDcEUsU0FBUyxFQUFFLElBQUksQ0FBQyxVQUFVO2dCQUMxQixVQUFVLEVBQUUsSUFBSSxDQUFDLFdBQVc7YUFDN0I7QUFFRCxZQUFBLE9BQU8sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0FBQ3RCLGdCQUFBLFdBQVcsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVc7QUFDdEMsZ0JBQUEsaUJBQWlCLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxpQkFBaUI7QUFDbEQsZ0JBQUEsWUFBWSxFQUFFLENBQUMsV0FBaUIsS0FBSTtvQkFDbEMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLElBQUksSUFBSSxDQUFDLFdBQVcsS0FBSyxXQUFXLEVBQUU7d0JBQ3pEO29CQUNGO0FBRUEsb0JBQUEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxVQUFVLEVBQUU7QUFDN0Isb0JBQUEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDO2dCQUNwQyxDQUFDO0FBQ0QsZ0JBQUEsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0I7QUFDaEQsZ0JBQUEsWUFBWSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTTtnQkFDbEMsY0FBYyxFQUFFLE1BQU0sQ0FBQyxlQUFlO0FBQ3RDLGdCQUFBLElBQUksRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUk7O0FBRXhCLGdCQUFBLDRCQUE0QixFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsNEJBQTRCO0FBQ3hFLGdCQUFBLGNBQWMsRUFBRSxNQUEwQixJQUFJLENBQUMsUUFBUSxDQUFDLGVBQWUsSUFBSSxJQUFJLENBQUMsZ0JBQWdCO0FBQ2hHLGdCQUFBLFVBQVUsRUFBRSxNQUFnQixJQUFJLENBQUMsWUFBWTtBQUM3QyxnQkFBQSxpQkFBaUIsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLGlCQUFpQjtBQUNsRCxnQkFBQSxTQUFTLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTO0FBQ2xDLGdCQUFBLGNBQWMsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLGNBQWM7QUFDNUMsZ0JBQUEsb0JBQW9CLEVBQUUsTUFBSyxFQUFBLElBQUEsRUFBQSxDQUFBLENBQUMsT0FBQSxDQUFBLEVBQUEsR0FBQSxJQUFJLENBQUMsTUFBTSxNQUFBLElBQUEsSUFBQSxFQUFBLEtBQUEsTUFBQSxHQUFBLE1BQUEsR0FBQSxFQUFBLENBQUUsVUFBVSxFQUFFLENBQUEsQ0FBQSxDQUFBO2dCQUNyRCxXQUFXO0FBQ1gsZ0JBQUEsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxzQkFBc0I7YUFDN0QsRUFBRSxPQUFPLENBQUM7WUFFWCxNQUFNLHNCQUFzQixHQUFHLE1BQUs7QUFDbEMsZ0JBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUU7QUFDakIsb0JBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsMkNBQTJDLENBQUM7b0JBQzNEO2dCQUNGO0FBQ0EsZ0JBQUEsSUFBSSxJQUFJLENBQUMsV0FBVyxLQUFLLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sS0FBSyxDQUFDLEVBQUU7QUFDekQsb0JBQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxJQUFJLENBQUM7Z0JBQ3ZDO0FBQ0YsWUFBQSxDQUFDO0FBRUQsWUFBQSxNQUFNLElBQUksR0FBRyxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSSxJQUFJLElBQUksRUFBRSxNQUFNLEVBQUUsT0FBTyxDQUFDO1lBRTlELElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFVBQVUsRUFBRSxNQUFNLEVBQUU7QUFDdkMsZ0JBQUEsV0FBVyxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVc7QUFDeEMsZ0JBQUEsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsaUJBQWlCO0FBQ3BELGdCQUFBLGdCQUFnQixFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLGdCQUFnQjtBQUNsRCxnQkFBQSxZQUFZLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsWUFBWTthQUMzQyxFQUFFLElBQUksQ0FBQztBQUVSLFlBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsTUFBSzs7Z0JBQ3ZCLElBQUksQ0FBQyxPQUFPLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQztBQUNuRCxnQkFBQSxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztBQUN0QixnQkFBQSxJQUFJLENBQUMsV0FBVyxHQUFHLElBQUk7QUFDdkIsZ0JBQUEsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQ2Ysb0JBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyx3QkFBd0IsRUFBRTtnQkFDeEM7Z0JBRUEsSUFBSSxJQUFJLENBQUMsU0FBUyxLQUFLLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxLQUFJLENBQUEsRUFBQSxHQUFBLElBQUksQ0FBQyxNQUFNLDBDQUFFLFFBQVEsRUFBRSxDQUFBLElBQUksQ0FBQyxXQUFXLEVBQUU7QUFDN0Ysb0JBQUEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLEVBQUU7Z0JBQ3hEO0FBRUEsZ0JBQUEsTUFBTSxJQUFJLEdBQVEsRUFBRSxJQUFJLEVBQUUsSUFBSSxDQUFDLEtBQUssSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO0FBQ3RELGdCQUFBLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUU7QUFDdEIsb0JBQUEsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLEtBQUssQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJO0FBQ3RELDBCQUFFLElBQUksQ0FBQyxRQUFRLENBQUM7MEJBQ2QsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQztnQkFDMUI7QUFFQSxnQkFBQSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxVQUFVLEVBQUUsTUFBTSxFQUFFLElBQUksRUFBRSxJQUFJLENBQUM7QUFFcEQsZ0JBQUEsSUFBSSxNQUFBLElBQUksQ0FBQyxNQUFNLE1BQUEsSUFBQSxJQUFBLEVBQUEsS0FBQSxNQUFBLEdBQUEsTUFBQSxHQUFBLEVBQUEsQ0FBRSxvQkFBb0IsRUFBRTtvQkFDckMsQ0FBQSxFQUFBLEdBQUEsSUFBSSxDQUFDLDRCQUE0QixNQUFBLElBQUEsSUFBQSxFQUFBLEtBQUEsTUFBQSxHQUFBLE1BQUEsR0FBQSxFQUFBLENBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUM7Z0JBQzNEO0FBQ0EsZ0JBQUEsSUFBSSxNQUFBLElBQUksQ0FBQyxNQUFNLE1BQUEsSUFBQSxJQUFBLEVBQUEsS0FBQSxNQUFBLEdBQUEsTUFBQSxHQUFBLEVBQUEsQ0FBRSxxQkFBcUIsRUFBRTtvQkFDdEMsQ0FBQSxFQUFBLEdBQUEsSUFBSSxDQUFDLDRCQUE0QixNQUFBLElBQUEsSUFBQSxFQUFBLEtBQUEsTUFBQSxHQUFBLE1BQUEsR0FBQSxFQUFBLENBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUM7Z0JBQzFEO0FBQ0YsWUFBQSxDQUFDLENBQUM7WUFFRixJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRSxDQUFDLEtBQWtCLEtBQUk7QUFDL0MsZ0JBQUEsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLEtBQUssUUFBUSxFQUFFO0FBQzlCLG9CQUFBLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO0FBQ3RCLG9CQUFBLHNCQUFzQixFQUFFO2dCQUMxQjtBQUNBLGdCQUFBLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtBQUNmLG9CQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsdUJBQXVCLEVBQUU7Z0JBQ3ZDO2dCQUNBLElBQUksQ0FBQyx1QkFBdUIsRUFBRTtBQUNoQyxZQUFBLENBQUMsQ0FBQztBQUVGLFlBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsTUFBSztBQUN2QixnQkFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBLFVBQUEsRUFBYSxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQSxDQUFFLENBQUM7QUFDdEQsZ0JBQUEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7QUFDdEIsZ0JBQUEsc0JBQXNCLEVBQUU7QUFDeEIsZ0JBQUEsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQ2Ysb0JBQUEsSUFBSSxDQUFDLE1BQU0sQ0FBQyx1QkFBdUIsRUFBRTtnQkFDdkM7Z0JBQ0EsSUFBSSxDQUFDLHVCQUF1QixFQUFFO0FBQ2hDLFlBQUEsQ0FBQyxDQUFDO0FBRUYsWUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxNQUFLO0FBQzNCLGdCQUFBLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtBQUNmLG9CQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsdUJBQXVCLEVBQUU7Z0JBQ3ZDO0FBQ0EsZ0JBQUEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7QUFDdEIsZ0JBQUEsc0JBQXNCLEVBQUU7QUFDeEI7Ozs7QUFJRztnQkFDSCxJQUFJLENBQUMsdUJBQXVCLEVBQUU7QUFDaEMsWUFBQSxDQUFDLENBQUM7QUFFRixZQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLE1BQUs7QUFDdkIsZ0JBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQSxVQUFBLEVBQWEsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUEsQ0FBRSxDQUFDO0FBQ3RELGdCQUFBLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtBQUNmLG9CQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsdUJBQXVCLEVBQUU7Z0JBQ3ZDO0FBQ0EsZ0JBQUEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUM7QUFDdEIsZ0JBQUEsc0JBQXNCLEVBQUU7Z0JBQ3hCLElBQUksQ0FBQyx1QkFBdUIsRUFBRTtBQUNoQyxZQUFBLENBQUMsQ0FBQztBQUVGLFlBQUEsSUFBSSxDQUFDLEVBQUUsQ0FBQyxnQkFBZ0IsRUFBRSxNQUFLO2dCQUM3QixJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRTtvQkFDeEM7Z0JBQ0Y7QUFDQSxnQkFBQSxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7QUFDZixvQkFBQSxJQUFJLENBQUMsTUFBTSxDQUFDLHVCQUF1QixFQUFFO2dCQUN2QztBQUNBLGdCQUFBLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO0FBQ3RCOzs7QUFHRztnQkFDSCxJQUFJLENBQUMsdUJBQXVCLEVBQUU7QUFDaEMsWUFBQSxDQUFDLENBQUM7QUFFRixZQUFBLE9BQU8sSUFBSTtRQUNiLENBQUMsQ0FBQTtBQUFBLElBQUE7QUFFRDs7QUFFRztJQUNLLHVCQUF1QixHQUFBO0FBQzdCLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFO0FBQ3ZCLFlBQUEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLEVBQUU7UUFDeEQ7SUFDRjtBQUVBOzs7Ozs7OztBQVFHO0FBQ0ssSUFBQSxXQUFXLENBQUMsS0FBMkIsRUFBQTtRQUM3QyxJQUFJLEtBQUssSUFBSSxLQUFLLENBQUMsU0FBUyxJQUFJLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7QUFDdkcsWUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyw0Q0FBNEMsQ0FBQztZQUM3RCxJQUFJLENBQUMsc0JBQXNCLEVBQUU7WUFDN0IsSUFBSSxDQUFDLGNBQWMsRUFBRTtRQUN2QjthQUFPO1lBQ0wsSUFBSSxDQUFDLE9BQU8sRUFBRTtRQUNoQjtJQUNGO0FBRUE7Ozs7O0FBS0c7QUFDSyxJQUFBLFdBQVcsQ0FBQyxLQUEyQixFQUFBO1FBQzdDLElBQUksQ0FBQyxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFO1lBQzlCO1FBQ0Y7UUFDQSxJQUFJLElBQUksQ0FBQyxLQUFLLEtBQUssTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUU7WUFDekM7UUFDRjtBQUNBLFFBQUEsSUFBSSxJQUFJLENBQUMsaUJBQWlCLElBQUksSUFBSSxDQUFDLEtBQUssS0FBSyxNQUFNLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRTtBQUN0RSxZQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLDRDQUE0QyxDQUFDO1lBQzdELElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQyxLQUFLLENBQUMsQ0FBQyxLQUFVLEtBQUk7Z0JBQ25DLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLDZDQUE2QyxFQUFFLEtBQUssQ0FBQztBQUN0RSxZQUFBLENBQUMsQ0FBQztRQUNKO0lBQ0Y7QUFpTkE7OztBQUdHO0FBQ0ssSUFBQSxXQUFXLENBQUMsSUFBVSxFQUFBO0FBQzVCLFFBQUEsSUFBSSxJQUFJLENBQUMsV0FBVyxLQUFLLElBQUksRUFBRTtBQUM3QixZQUFBLElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSTtBQUN2QixZQUFBLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJO1FBQzlCO0FBRUEsUUFBQSxLQUFLLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFO1lBQ2hELElBQUksSUFBSSxLQUFLLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUU7Z0JBQzNCLElBQUksQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDMUI7UUFDRjtJQUNGO0FBRUE7O0FBRUc7QUFDVyxJQUFBLGFBQWEsQ0FBQyxRQUFpQixFQUFBOztBQUMzQyxZQUFBLE1BQU0sTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLHVCQUF1QjtZQUVqRCxJQUFJLENBQUMsTUFBTSxFQUFFO2dCQUFFO1lBQVE7WUFFdkIsTUFBTSxDQUFDLFFBQVEsQ0FBQyxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsQ0FBQztZQUNwQyxJQUFJLFFBQVEsRUFBRTtnQkFDWixJQUFJLENBQUMsdUJBQXVCLEVBQUU7WUFDaEM7aUJBQU87Z0JBQ0wsSUFBSSxDQUFDLHNCQUFzQixFQUFFO1lBQy9CO1FBQ0YsQ0FBQyxDQUFBO0FBQUEsSUFBQTtBQUVEOzs7QUFHRztBQUNNLElBQUEsU0FBUyxDQUFDLEtBQW1CLEVBQUE7QUFDcEMsUUFBQSxJQUFJLEtBQUssS0FBSyxJQUFJLENBQUMsS0FBSyxFQUFFO1lBQ3hCO1FBQ0Y7QUFFQSxRQUFBLElBQUksQ0FBQyxNQUFNLEdBQUcsS0FBSztRQUNuQixNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsa0JBQWtCLENBQUMsS0FBSyxDQUFDO1FBQzNDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUEsQ0FBQSxFQUFJLElBQUksQ0FBQSxDQUFFLENBQUM7QUFDM0IsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztJQUNqQjtBQUVBOztBQUVHO0lBQ0ssaUJBQWlCLEdBQUE7QUFDdkIsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLDRCQUE0QixFQUFFO0FBQ3RDLFlBQUEsSUFBSSxDQUFDLDRCQUE0QixHQUFHLElBQUksMkJBQTJCLEVBQUU7QUFDckUsWUFBQSxJQUFJLENBQUMsNEJBQTRCLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxDQUFDLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUUsS0FBSTtBQUMxRSxnQkFBQSxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLEVBQUUsU0FBUyxFQUFFLFFBQVEsRUFBRSxFQUFFLElBQUksQ0FBQyxXQUFXLENBQUM7QUFDOUUsWUFBQSxDQUFDLENBQUM7UUFDSjtBQUVBLFFBQUEsTUFBTSxZQUFZLEdBQXdCO1lBQ3hDLFlBQVksRUFBRSxNQUFNLENBQUMsWUFBWTtZQUNqQywyQkFBMkIsRUFBRSxJQUFJLENBQUMsNEJBQTRCO1lBQzlELG9CQUFvQixFQUFFLE1BQUs7QUFDekIsZ0JBQUEsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLEVBQUU7QUFDekIsb0JBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMscUNBQXFDLENBQUM7b0JBQ3RELE9BQU8sSUFBSSxDQUFDLGdCQUFnQjtnQkFDOUI7cUJBQU87QUFDTCxvQkFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQywwREFBMEQsQ0FBQztBQUMzRSxvQkFBQSxPQUFPLE9BQU8sQ0FBQyxPQUFPLEVBQUU7Z0JBQzFCO1lBQ0YsQ0FBQztBQUNELFlBQUEsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0I7QUFDaEQsWUFBQSxZQUFZLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLElBQUksWUFBWTtTQUN6RDtBQUVELFFBQUEsSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQ2YsWUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxrREFBa0QsQ0FBQztBQUNsRSxZQUFBLElBQUksQ0FBQyxNQUFNLENBQUMsa0JBQWtCLENBQUMsWUFBWSxDQUFDO1lBQzVDO1FBQ0Y7UUFFQSxJQUFJLENBQUMsTUFBTSxHQUFHLEtBQUssSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLElBQUksV0FBVyxFQUN6RCxJQUFJLENBQUMsY0FBYyxFQUNuQixJQUFJLENBQUMsa0JBQWtCLEVBQ3ZCLFlBQVksQ0FDYjtRQUVELElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLGNBQWMsRUFBRSxDQUFDLGlCQUFvQyxLQUFJO0FBQ3RFLFlBQUEsTUFBTSxVQUFVLEdBQWdCLElBQUksQ0FBQyxXQUFXO0FBQ2hELFlBQUEsTUFBTSxTQUFTLEdBQWEsaUJBQWlCLENBQUMsR0FBRyxDQUFDLENBQUMsTUFBdUIsS0FBSyxNQUFNLENBQUMsUUFBUSxDQUFDO1lBRS9GLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxlQUFlLEVBQUU7QUFDN0MsZ0JBQUEsc0JBQXNCLEVBQUUsU0FBUzthQUNsQyxFQUFFLFVBQVUsQ0FBQztZQUVkLElBQUksVUFBVSxFQUFFO0FBQ2QsZ0JBQUEsVUFBVSxDQUFDLGVBQWUsQ0FBQyxDQUFDLHNCQUFzQixFQUFFO1lBQ3REO0FBQ0YsUUFBQSxDQUFDLENBQUM7SUFDSjtBQUVBOztBQUVHO0FBQ0ssSUFBQSxjQUFjLENBQUMsUUFBZ0MsRUFBQTtBQUNyRCxRQUFBLE1BQU0sS0FBSyxHQUFHLE9BQU8sUUFBUSxLQUFLLFFBQVE7QUFDeEMsWUFBQSxPQUFPLFFBQVEsS0FBSyxRQUFRO1lBQzVCLFFBQVEsR0FBRyxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUs7QUFFbEMsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxLQUFLLENBQUM7UUFDaEMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsNkJBQTZCLEVBQUUsS0FBSyxDQUFDO0lBQ3REO0FBRUE7O0FBRUc7SUFDSyxlQUFlLEdBQUE7QUFDckIsUUFBQSxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUU7QUFDbkIsWUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyx5Q0FBeUMsQ0FBQztZQUN6RCxJQUFJLENBQUMsaUJBQWlCLEVBQUU7UUFDMUI7QUFFQSxRQUFBLE1BQU0sZ0JBQWdCLEdBQUc7WUFDdkIsY0FBYyxFQUFFLElBQUksQ0FBQyxxQkFBcUI7QUFDMUMsWUFBQSxRQUFRLEVBQUU7QUFDUixnQkFBQSxRQUFRLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxPQUFPO0FBQy9CLGdCQUFBLFdBQVcsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVU7QUFDdEMsYUFBQTtTQUNLO0FBRVIsUUFBQSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxFQUFFO1lBQ3pCLGdCQUFnQixDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU87UUFDL0M7QUFFQSxRQUFBLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRTtZQUNkLGdCQUFnQixDQUFDLElBQUksR0FBRyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDO1FBQzNEO1FBRUEsSUFBSSxDQUFDLFVBQVUsR0FBRyxLQUFLLElBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxJQUFJRyxjQUFTLEVBQUUsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLEtBQUssRUFBRSxnQkFBZ0IsQ0FBQztRQUVsSCxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsYUFBYSxLQUFLLEtBQUssRUFBRTtBQUN6QyxZQUFBLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxFQUFFO1FBQzNCO2FBQU87WUFDTCxJQUFJLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsQ0FBQyxLQUFZLEtBQUk7Z0JBQzNDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLDZCQUE2QixFQUFFLEtBQUssQ0FBQztBQUN0RCxZQUFBLENBQUMsQ0FBQztRQUNKO1FBRUEsT0FBTyxJQUFJLENBQUMsVUFBVTtJQUN4QjtBQUVBOzs7QUFHRztJQUNLLFlBQVksR0FBQTtBQUNsQixRQUFBLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtBQUNoQixZQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHNDQUFzQyxDQUFDO1lBQ3RELElBQUksQ0FBQyxjQUFjLEVBQUU7UUFDdkI7QUFFQSxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDO1FBQ2hDLElBQUksQ0FBQyxPQUFPLEdBQUcsS0FBSyxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sSUFBSSxPQUFPLEVBQ2xELElBQUksQ0FBQyxLQUFLLEVBQ1YsSUFBSSxDQUFDLFlBQVksRUFDakI7QUFDRSxZQUFBLFlBQVksRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVk7QUFDeEMsWUFBQSxzQkFBc0IsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLHlCQUF5QjtBQUNoRSxTQUFBLENBQ0Y7UUFFRCxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLGlCQUFpQixDQUFDO1FBQ3pELElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMscUJBQXFCLENBQUM7UUFDakUsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztRQUN6RCxJQUFJLENBQUMsT0FBTyxDQUFDLFdBQVcsQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDLGtCQUFrQixDQUFDO1FBQzNELElBQUksQ0FBQyxPQUFPLENBQUMsV0FBVyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsbUJBQW1CLENBQUM7UUFDN0QsSUFBSSxDQUFDLE9BQU8sQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxpQkFBaUIsQ0FBQztRQUV6RCxPQUFPLElBQUksQ0FBQyx1QkFBdUI7QUFDakMsWUFBQSxlQUFlLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxXQUFXLEVBQUUsT0FBTyxDQUFDLENBQUMsSUFBSSxDQUFDLE1BQU0sSUFBSSxDQUFDLE9BQU8sQ0FBQztJQUNoRjtBQUVBOzs7O0FBSUc7SUFDSyxpQkFBaUIsQ0FBQyxJQUFVLEVBQUUsSUFBYyxFQUFBO0FBQ2xELFFBQUEsSUFBSSxPQUF1QjtRQUMzQixPQUFPLE9BQU8sQ0FBQyxJQUFJLENBQUM7QUFDbEIsWUFBQSxJQUFJLEVBQUU7QUFDTixZQUFBLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSTtBQUM5QixnQkFBQSxPQUFPLEdBQUcsVUFBVSxDQUFDLE1BQUs7b0JBQ3hCLE1BQU0sR0FBRyxHQUFHLHFGQUFxRjtBQUNqRyxvQkFBQSxNQUFNLENBQUMsSUFBSSxLQUFLLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQ3hCLENBQUMsRUFBRSxxQkFBcUIsQ0FBQztBQUMzQixZQUFBLENBQUMsQ0FBQztBQUNILFNBQUEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLElBQUc7WUFDaEIsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztBQUNoQyxRQUFBLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFLO1lBQ1gsWUFBWSxDQUFDLE9BQU8sQ0FBQztZQUNyQixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQztnQkFDMUMsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLGdCQUFnQjtnQkFDdkMsVUFBVSxFQUFFLElBQUksQ0FBQyxVQUFVO0FBQzVCLGFBQUEsQ0FBQyxDQUFDO1lBQ0gsSUFBSSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUM7QUFDNUMsUUFBQSxDQUFDLENBQUM7SUFDSjtBQUVBOztBQUVHO0lBQ0ssdUJBQXVCLEdBQUE7UUFDN0IsSUFBSSxDQUFDLHNCQUFzQixFQUFFO0FBQzdCLFFBQUEsSUFBSSxDQUFDLFNBQVMsR0FBRyxVQUFVLENBQUMsTUFBSztBQUMvQixZQUFBLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDO1FBQzFCLENBQUMsRUFBRSxxQkFBcUIsQ0FBQztJQUMzQjtBQUVBOztBQUVHO0lBQ0ssc0JBQXNCLEdBQUE7QUFDNUIsUUFBQSxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUU7QUFDbEIsWUFBQSxZQUFZLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUM5QjtJQUNGO0FBRUE7O0FBRUc7SUFDSyxpQkFBaUIsR0FBQTtRQUN2QixJQUFJLElBQUksQ0FBQyxLQUFLLEtBQUssTUFBTSxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUU7QUFDekMsWUFBQSxNQUFNLElBQUksaUJBQWlCLENBQUMsNEJBQTRCLENBQUM7UUFDM0Q7SUFDRjtBQW9CQTs7O0FBR0c7QUFDSyxJQUFBLHNCQUFzQixDQUFDLE9BQWlCLEVBQUE7UUFDOUMsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUSxDQUFDLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQzdGO0FBMEJBOzs7O0FBSUc7QUFDSyxJQUFBLHFCQUFxQixDQUFDLE9BQWlCLEVBQUE7UUFDN0MsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRTtBQUNsQyxhQUFBLE1BQU0sQ0FBQyxLQUFLLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxLQUFLLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUTtBQUN0RCxhQUFBLE9BQU8sQ0FBQyxLQUFLLElBQUksS0FBSyxDQUFDLENBQUMsQ0FBQyxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQztBQUVqRCxRQUFBLElBQUksQ0FBQyxZQUFZLEdBQUcsT0FBTztBQUMzQixRQUFBLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxXQUFXO0FBQzdCLFFBQUEsT0FBTztBQUNMLGNBQUUsSUFBSSxDQUFDLFdBQVcsQ0FBQyxPQUFPO0FBQzFCLGNBQUUsT0FBTyxDQUFDLE9BQU8sRUFBRTtJQUN2Qjs7QUFqOUNlLE1BQUEsQ0FBQSxjQUFjLEdBQXFDO0lBQ2hFLFVBQVUsRUFBRSxFQUFFLFFBQVEsRUFBRSxZQUFZLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRTtJQUN6RCxLQUFLLEVBQUUsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUU7SUFDaEQsS0FBSyxFQUFFLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFO0lBQ2hELEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRTtJQUNoRCxLQUFLLEVBQUUsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUU7SUFDaEQsS0FBSyxFQUFFLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFO0lBQ2hELEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRTtJQUNoRCxLQUFLLEVBQUUsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUU7SUFDaEQsS0FBSyxFQUFFLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFO0lBQ2hELEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRTtJQUNoRCxLQUFLLEVBQUUsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUU7SUFDaEQsS0FBSyxFQUFFLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFO0lBQ25ELEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRTtJQUNuRCxRQUFRLEVBQUUsRUFBRSxRQUFRLEVBQUUsVUFBVSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUU7SUFDcEQsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFO0FBQ3RELENBaEI0QjtBQW85Qy9COztBQUVHO0FBQ0gsQ0FBQSxVQUFVLE1BQU0sRUFBQTtBQStHZCxJQUFBLENBQUEsVUFBWSxTQUFTLEVBQUE7QUFDbkIsUUFBQSxTQUFBLENBQUEsT0FBQSxDQUFBLEdBQUEsT0FBZTtBQUNmLFFBQUEsU0FBQSxDQUFBLFVBQUEsQ0FBQSxHQUFBLFVBQXFCO0FBQ3JCLFFBQUEsU0FBQSxDQUFBLFdBQUEsQ0FBQSxHQUFBLFdBQXVCO0FBQ3ZCLFFBQUEsU0FBQSxDQUFBLGNBQUEsQ0FBQSxHQUFBLGNBQTZCO0FBQzdCLFFBQUEsU0FBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLGFBQTJCO0FBQzNCLFFBQUEsU0FBQSxDQUFBLFlBQUEsQ0FBQSxHQUFBLFlBQXlCO0FBQ3pCLFFBQUEsU0FBQSxDQUFBLGlCQUFBLENBQUEsR0FBQSxpQkFBbUM7QUFDckMsSUFBQSxDQUFDLEVBUlcsTUFBQSxDQUFBLFNBQVMsS0FBVCxnQkFBUyxHQUFBLEVBQUEsQ0FBQSxDQUFBO0FBYXJCLElBQUEsQ0FBQSxVQUFZLEtBQUssRUFBQTtBQUNmLFFBQUEsS0FBQSxDQUFBLFdBQUEsQ0FBQSxHQUFBLFdBQXVCO0FBQ3ZCLFFBQUEsS0FBQSxDQUFBLGNBQUEsQ0FBQSxHQUFBLGNBQTZCO0FBQzdCLFFBQUEsS0FBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLGFBQTJCO0FBQzNCLFFBQUEsS0FBQSxDQUFBLFlBQUEsQ0FBQSxHQUFBLFlBQXlCO0FBQzNCLElBQUEsQ0FBQyxFQUxXLE1BQUEsQ0FBQSxLQUFLLEtBQUwsWUFBSyxHQUFBLEVBQUEsQ0FBQSxDQUFBO0FBVWpCLElBQUEsQ0FBQSxVQUFZLFNBQVMsRUFBQTtBQUNuQixRQUFBLFNBQUEsQ0FBQSxVQUFBLENBQUEsR0FBQSxVQUFxQjtBQUNyQixRQUFBLFNBQUEsQ0FBQSxVQUFBLENBQUEsR0FBQSxVQUFxQjtBQUNyQixRQUFBLFNBQUEsQ0FBQSxZQUFBLENBQUEsR0FBQSxZQUF5QjtBQUN6QixRQUFBLFNBQUEsQ0FBQSxPQUFBLENBQUEsR0FBQSxPQUFlO0FBQ2YsUUFBQSxTQUFBLENBQUEsT0FBQSxDQUFBLEdBQUEsT0FBZTtBQUNmLFFBQUEsU0FBQSxDQUFBLE9BQUEsQ0FBQSxHQUFBLE9BQWU7QUFDZixRQUFBLFNBQUEsQ0FBQSxPQUFBLENBQUEsR0FBQSxPQUFlO0FBQ2YsUUFBQSxTQUFBLENBQUEsT0FBQSxDQUFBLEdBQUEsT0FBZTtBQUNmLFFBQUEsU0FBQSxDQUFBLE9BQUEsQ0FBQSxHQUFBLE9BQWU7QUFDZixRQUFBLFNBQUEsQ0FBQSxPQUFBLENBQUEsR0FBQSxPQUFlO0FBQ2YsUUFBQSxTQUFBLENBQUEsT0FBQSxDQUFBLEdBQUEsT0FBZTtBQUNmLFFBQUEsU0FBQSxDQUFBLE9BQUEsQ0FBQSxHQUFBLE9BQWU7QUFDZixRQUFBLFNBQUEsQ0FBQSxPQUFBLENBQUEsR0FBQSxPQUFlO0FBQ2YsUUFBQSxTQUFBLENBQUEsT0FBQSxDQUFBLEdBQUEsT0FBZTtBQUNmLFFBQUEsU0FBQSxDQUFBLE9BQUEsQ0FBQSxHQUFBLE9BQWU7QUFDakIsSUFBQSxDQUFDLEVBaEJXLE1BQUEsQ0FBQSxTQUFTLEtBQVQsZ0JBQVMsR0FBQSxFQUFBLENBQUEsQ0FBQTtBQTZSdkIsQ0FBQyxFQW5hUyxNQUFNLEtBQU4sTUFBTSxHQUFBLEVBQUEsQ0FBQSxDQUFBOzs7OyJ9
