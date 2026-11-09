'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var events = require('events');
var loglevel = require('loglevel');
var audiohelper = require('./audiohelper.js');
var audioprocessoreventobserver = require('./audioprocessoreventobserver.js');
var call = require('./call.js');
var constants = require('./constants.js');
var dialtonePlayer = require('./dialtonePlayer.js');
var index$1 = require('./errors/index.js');
var eventpublisher = require('./eventpublisher.js');
var insightsoutbox = require('./insightsoutbox.js');
var log = require('./log.js');
var preflight = require('./preflight/preflight.js');
var pstream = require('./pstream.js');
var regions = require('./regions.js');
var index = require('./rtc/index.js');
var getusermedia = require('./rtc/getusermedia.js');
var sid = require('./sid.js');
var sound = require('./sound.js');
var util = require('./util.js');
var generated = require('./errors/generated.js');

function _interopNamespaceDefault(e) {
    var n = Object.create(null);
    if (e) {
        Object.keys(e).forEach(function (k) {
            if (k !== 'default') {
                var d = Object.getOwnPropertyDescriptor(e, k);
                Object.defineProperty(n, k, d.get ? d : {
                    enumerable: true,
                    get: function () { return e[k]; }
                });
            }
        });
    }
    n.default = e;
    return Object.freeze(n);
}

var loglevel__namespace = /*#__PURE__*/_interopNamespaceDefault(loglevel);

var REGISTRATION_INTERVAL = 30000;
var RINGTONE_PLAY_TIMEOUT = 2000;
var PUBLISHER_PRODUCT_NAME = 'twilio-js-sdk';
var INVALID_TOKEN_MESSAGE = 'Parameter "token" must be of type "string".';
/**
 * Twilio Device. Allows registration for incoming calls, and placing outgoing calls.
 */
exports.default = /** @class */ (function (_super) {
    tslib.__extends(Device, _super);
    /**
     * Construct a {@link Device} instance. The {@link Device} can be registered
     * to make and listen for calls using {@link Device.register}.
     * @param options
     */
    function Device(token, options) {
        var _a;
        if (options === void 0) { options = {}; }
        var _this = _super.call(this) || this;
        /**
         * The currently active {@link Call}, if there is one.
         */
        _this._activeCall = null;
        /**
         * The outgoing {@link Call} that connect() is accepting. When an accepted incoming call holds the slot,
         * it is neither the active call nor in _calls until beforeAccept claims it, so disconnectAll() reaches it here.
         */
        _this._acceptingCall = null;
        /**
         * The AudioHelper instance associated with this {@link Device}.
         */
        _this._audio = null;
        /**
         * The AudioProcessorEventObserver instance to use
         */
        _this._audioProcessorEventObserver = null;
        /**
         * An audio input MediaStream to pass to new {@link Call} instances.
         */
        _this._callInputStream = null;
        /**
         * An array of {@link Call}s. Though only one can be active, multiple may exist when there
         * are multiple incoming, unanswered {@link Call}s.
         */
        _this._calls = [];
        /**
         * An array of {@link Device} IDs to be used to play sounds through, to be passed to
         * new {@link Call} instances.
         */
        _this._callSinkIds = ['default'];
        /**
         * The list of chunder URIs that will be passed to PStream
         */
        _this._chunderURIs = [];
        /**
         * Default options used by {@link Device}.
         */
        _this._defaultOptions = {
            allowIncomingWhileBusy: false,
            closeProtection: false,
            codecPreferences: [call.default.Codec.PCMU, call.default.Codec.Opus],
            dscp: true,
            enableImprovedSignalingErrorPrecision: false,
            forceAggressiveIceNomination: false,
            logLevel: loglevel__namespace.levels.ERROR,
            maxCallSignalingTimeoutMs: 0,
            preflight: false,
            sounds: {},
            tokenRefreshMs: 10000,
            voiceEventSidGenerator: sid.generateVoiceEventSid,
        };
        /**
         * The name of the edge the {@link Device} is connected to.
         */
        _this._edge = null;
        /**
         * The name of the home region the {@link Device} is connected to.
         */
        _this._home = null;
        /**
         * The identity associated with this Device.
         */
        _this._identity = null;
        /**
         * The Insights event buffer and retry loop. Created once and shared by every
         * publisher this Device creates, so buffered events survive
         * {@link Device.updateOptions} replacing the publisher, and Calls holding a
         * replaced publisher post into the same buffer.
         */
        _this._insightsOutbox = null;
        /**
         * An instance of Logger to use.
         */
        _this._log = new log.default('Device');
        /**
         * The internal promise created when calling {@link Device.makeCall}.
         */
        _this._makeCallPromise = null;
        /**
         * The options passed to {@link Device} constructor or {@link Device.updateOptions}.
         */
        _this._options = {};
        /**
         * The preferred URI to (re)-connect signaling to.
         */
        _this._preferredURI = null;
        /**
         * An Insights Event Publisher.
         */
        _this._publisher = null;
        /**
         * The region the {@link Device} is connected to.
         */
        _this._region = null;
        /**
         * A timeout ID for a setTimeout schedule to re-register the {@link Device}.
         */
        _this._regTimer = null;
        /**
         * Boolean representing whether or not the {@link Device} was registered when
         * receiving a signaling `offline`. Determines if the {@link Device} attempts
         * a `re-register` once signaling is re-established when receiving a
         * `connected` event from the stream.
         */
        _this._shouldReRegister = false;
        /**
         * A Map of Sounds to play.
         */
        _this._soundcache = new Map();
        /**
         * The current status of the {@link Device}.
         */
        _this._state = Device.State.Unregistered;
        /**
         * A map from {@link Device.State} to {@link Device.EventName}.
         */
        _this._stateEventMapping = (_a = {},
            _a[Device.State.Destroyed] = Device.EventName.Destroyed,
            _a[Device.State.Unregistered] = Device.EventName.Unregistered,
            _a[Device.State.Registering] = Device.EventName.Registering,
            _a[Device.State.Registered] = Device.EventName.Registered,
            _a);
        /**
         * Whether a transport error has been published to Insights since the
         * signaling connection was last established. Transport errors repeat on
         * every reconnect attempt, so only the first one per lost connection is
         * published. Device `error` is still emitted for each one.
         */
        _this._isTransportErrorPublished = false;
        /**
         * The Signaling stream.
         */
        _this._stream = null;
        /**
         * A promise that will resolve when the Signaling stream is ready.
         */
        _this._streamConnectedPromise = null;
        /**
         * A timeout to track when the current AccessToken will expire.
         */
        _this._tokenWillExpireTimeout = null;
        /**
         * Create the default Insights payload
         * @param call
         */
        _this._createDefaultPayload = function (call) {
            var payload = {
                aggressive_nomination: _this._options.forceAggressiveIceNomination,
                browser_extension: _this._isBrowserExtension,
                dscp: !!_this._options.dscp,
                ice_restart_enabled: true,
                platform: index.getMediaEngine(),
                sdk_version: constants.RELEASE_VERSION,
            };
            function setIfDefined(propertyName, value) {
                if (value) {
                    payload[propertyName] = value;
                }
            }
            if (call) {
                var callSid = call.parameters.CallSid;
                setIfDefined('call_sid', /^TJ/.test(callSid) ? undefined : callSid);
                setIfDefined('temp_call_sid', call.outboundConnectionId);
                setIfDefined('audio_codec', call.codec);
                payload.direction = call.direction;
            }
            setIfDefined('gateway', _this._stream && _this._stream.gateway);
            setIfDefined('region', _this._stream && _this._stream.region);
            // Signaling connection scope: set with or without a Call.
            setIfDefined('signaling_connection_id', _this._stream && _this._stream.signalingConnectionId);
            return payload;
        };
        /**
         * Called when a 'close' event is received from the signaling stream.
         */
        _this._onSignalingClose = function () {
            _this._stream = null;
            _this._streamConnectedPromise = null;
        };
        /**
         * Called when a 'connected' event is received from the signaling stream.
         */
        _this._onSignalingConnected = function (payload) {
            var _a;
            _this._isTransportErrorPublished = false;
            var region = regions.getRegionShortcode(payload.region);
            _this._edge = payload.edge || regions.regionToEdge[region] || payload.region;
            _this._region = region || payload.region;
            _this._home = payload.home;
            (_a = _this._publisher) === null || _a === void 0 ? void 0 : _a.setHost(regions.createEventGatewayURI(payload.home));
            if (payload.token) {
                _this._identity = payload.token.identity;
                if (typeof payload.token.ttl === 'number' &&
                    typeof _this._options.tokenRefreshMs === 'number') {
                    var ttlMs = payload.token.ttl * 1000;
                    var timeoutMs = Math.max(0, ttlMs - _this._options.tokenRefreshMs);
                    _this._tokenWillExpireTimeout = setTimeout(function () {
                        _this._log.debug('#tokenWillExpire');
                        _this.emit('tokenWillExpire', _this);
                        if (_this._tokenWillExpireTimeout) {
                            clearTimeout(_this._tokenWillExpireTimeout);
                            _this._tokenWillExpireTimeout = null;
                        }
                    }, timeoutMs);
                }
            }
            var preferredURIs = _this._getChunderws() || regions.getChunderURIs(_this._edge);
            if (preferredURIs.length > 0) {
                var preferredURI = preferredURIs[0];
                _this._preferredURI = regions.createSignalingEndpointURL(preferredURI);
            }
            else {
                _this._log.warn('Could not parse a preferred URI from the stream#connected event.');
            }
            // The signaling stream emits a `connected` event after reconnection, if the
            // device was registered before this, then register again.
            if (_this._shouldReRegister) {
                _this.register().catch(function (error) {
                    _this._log.warn('Failed to re-register after signaling reconnect', error);
                });
            }
        };
        /**
         * Called when an 'error' event is received from the signaling stream.
         */
        _this._onSignalingError = function (payload) {
            if (typeof payload !== 'object') {
                _this._log.warn('Invalid signaling error payload', payload);
                return;
            }
            var originalError = payload.error, callsid = payload.callsid, voiceeventsid = payload.voiceeventsid;
            // voiceeventsid is for call message events which are handled in the call object
            // missing originalError shouldn't be possible but check here to fail properly
            if (typeof originalError !== 'object' || !!voiceeventsid) {
                _this._log.warn('Ignoring signaling error payload', { originalError: originalError, voiceeventsid: voiceeventsid });
                return;
            }
            var call = (typeof callsid === 'string' && _this._findCall(callsid)) || undefined;
            var code = originalError.code, customMessage = originalError.message;
            var twilioError = originalError.twilioError;
            if (typeof code === 'number') {
                if (code === 31201) {
                    twilioError = new generated.AuthorizationErrors.AuthenticationFailed(originalError);
                }
                else if (code === 31204) {
                    twilioError = new generated.AuthorizationErrors.AccessTokenInvalid(originalError);
                }
                else if (code === 31205) {
                    // Stop trying to register presence after token expires
                    _this._stopRegistrationTimer();
                    twilioError = new generated.AuthorizationErrors.AccessTokenExpired(originalError);
                }
                else {
                    var errorConstructor = index$1.getPreciseSignalingErrorByCode(!!_this._options.enableImprovedSignalingErrorPrecision, code);
                    if (typeof errorConstructor !== 'undefined') {
                        twilioError = new errorConstructor(originalError);
                    }
                }
            }
            if (!twilioError) {
                _this._log.error('Unknown signaling error: ', originalError);
                twilioError = new generated.GeneralErrors.UnknownError(customMessage, originalError);
            }
            _this._log.error('Received error: ', twilioError);
            _this._log.debug('#error', originalError);
            if (!pstream.isTransportErrorPayload(payload)) {
                _this._publishError(twilioError, call);
            }
            else if (!_this._isTransportErrorPublished) {
                _this._isTransportErrorPublished = true;
                _this._publishError(twilioError, call, _this._getDroppedSignalingConnectionId());
            }
            _this.emit(Device.EventName.Error, twilioError, call);
        };
        /**
         * Called when an 'invite' event is received from the signaling stream.
         */
        _this._onSignalingInvite = function (payload) { return tslib.__awaiter(_this, void 0, void 0, function () {
            var wasBusy, error, callParameters, customParameters, call, play;
            var _this = this;
            var _a;
            return tslib.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        wasBusy = !!this._activeCall;
                        if (wasBusy && !this._options.allowIncomingWhileBusy) {
                            this._log.info('Device busy; ignoring incoming invite');
                            return [2 /*return*/];
                        }
                        if (!payload.callsid || !payload.sdp) {
                            this._log.debug('#error', payload);
                            error = new generated.ClientErrors.BadRequest('Malformed invite from gateway');
                            this._publishError(error);
                            this.emit(Device.EventName.Error, error);
                            return [2 /*return*/];
                        }
                        callParameters = payload.parameters || {};
                        callParameters.CallSid = callParameters.CallSid || payload.callsid;
                        customParameters = Object.assign({}, util.queryToJson(callParameters.Params));
                        this._makeCallPromise = this._makeCall(customParameters, {
                            callParameters: callParameters,
                            enableImprovedSignalingErrorPrecision: !!this._options.enableImprovedSignalingErrorPrecision,
                            offerSdp: payload.sdp,
                            reconnectToken: payload.reconnect,
                            voiceEventSidGenerator: this._options.voiceEventSidGenerator,
                        });
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, , 3, 4]);
                        return [4 /*yield*/, this._makeCallPromise];
                    case 2:
                        call = _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        this._makeCallPromise = null;
                        return [7 /*endfinally*/];
                    case 4:
                        this._calls.push(call);
                        call.once('accept', function () {
                            _this._soundcache.get(Device.SoundName.Incoming).stop();
                            _this._publishNetworkChange();
                        });
                        play = (((_a = this._audio) === null || _a === void 0 ? void 0 : _a.incoming()) && !wasBusy)
                            ? function () { return _this._soundcache.get(Device.SoundName.Incoming).play(); }
                            : function () { return Promise.resolve(); };
                        this._showIncomingCall(call, play);
                        return [2 /*return*/];
                }
            });
        }); };
        /**
         * Called when an 'offline' event is received from the signaling stream.
         */
        _this._onSignalingOffline = function () {
            _this._log.info('Stream is offline');
            _this._edge = null;
            _this._region = null;
            // A tick landing before the server validates the token earns a 31204.
            _this._stopRegistrationTimer();
            _this._shouldReRegister = _this.state !== Device.State.Unregistered;
            _this._setState(Device.State.Unregistered);
        };
        /**
         * Called when a 'ready' event is received from the signaling stream.
         */
        _this._onSignalingReady = function () {
            _this._log.info('Stream is ready');
            _this._setState(Device.State.Registered);
        };
        /**
         * Publish a NetworkInformation#change event to Insights if there's an active {@link Call}.
         */
        _this._publishNetworkChange = function () {
            if (!_this._activeCall) {
                return;
            }
            if (_this._networkInformation) {
                _this._publisher.info('network-information', 'network-change', {
                    connection_type: _this._networkInformation.type,
                    downlink: _this._networkInformation.downlink,
                    downlinkMax: _this._networkInformation.downlinkMax,
                    effective_type: _this._networkInformation.effectiveType,
                    rtt: _this._networkInformation.rtt,
                }, _this._activeCall);
            }
        };
        /**
         * Update the input stream being used for calls so that any current call and all future calls
         * will use the new input stream.
         * @param inputStream
         */
        _this._updateInputStream = function (inputStream) {
            var call = _this._activeCall;
            if (call && !inputStream) {
                return Promise.reject(new index$1.InvalidStateError('Cannot unset input device while a call is in progress.'));
            }
            _this._callInputStream = inputStream;
            return call
                ? call._setInputTracksFromStream(inputStream)
                : Promise.resolve();
        };
        /**
         * Update the device IDs of output devices being used to play sounds through.
         * @param type - Whether to update ringtone or speaker sounds
         * @param sinkIds - An array of device IDs
         */
        _this._updateSinkIds = function (type, sinkIds) {
            var promise = type === 'ringtone'
                ? _this._updateRingtoneSinkIds(sinkIds)
                : _this._updateSpeakerSinkIds(sinkIds);
            return promise.then(function () {
                _this._publisher.info('audio', "".concat(type, "-devices-set"), {
                    audio_device_ids: sinkIds,
                }, _this._activeCall);
            }, function (error) {
                _this._publisher.error('audio', "".concat(type, "-devices-set-failed"), {
                    audio_device_ids: sinkIds,
                    message: error.message,
                }, _this._activeCall);
                throw error;
            });
        };
        // Setup loglevel asap to avoid missed logs
        _this._setupLoglevel(options.logLevel);
        _this._logOptions('constructor', options);
        _this.updateToken(token);
        if (util.isLegacyEdge()) {
            throw new index$1.NotSupportedError('Microsoft Edge Legacy (https://support.microsoft.com/en-us/help/4533505/what-is-microsoft-edge-legacy) ' +
                'is deprecated and will not be able to connect to Twilio to make or receive calls after September 1st, 2020. ' +
                'Please see this documentation for a list of supported browsers ' +
                'https://www.twilio.com/docs/voice/client/javascript#supported-browsers');
        }
        if (!Device.isSupported && options.ignoreBrowserSupport) {
            if (window && window.location && window.location.protocol === 'http:') {
                throw new index$1.NotSupportedError("twilio.js wasn't able to find WebRTC browser support.           This is most likely because this page is served over http rather than https,           which does not support WebRTC in many browsers. Please load this page over https and           try again.");
            }
            throw new index$1.NotSupportedError("twilio.js 1.3+ SDKs require WebRTC browser support.         For more information, see <https://www.twilio.com/docs/api/client/twilio-js>.         If you have any questions about this announcement, please contact         Twilio Support at <help@twilio.com>.");
        }
        var root = globalThis;
        var browser = root.msBrowser || root.browser || root.chrome;
        _this._isBrowserExtension = (!!browser && !!browser.runtime && !!browser.runtime.id)
            || (!!root.safari && !!root.safari.extension);
        if (_this._isBrowserExtension) {
            _this._log.info('Running as browser extension.');
        }
        if (navigator) {
            var n = navigator;
            _this._networkInformation = n.connection
                || n.mozConnection
                || n.webkitConnection;
        }
        if (_this._networkInformation && typeof _this._networkInformation.addEventListener === 'function') {
            _this._networkInformation.addEventListener('change', _this._publishNetworkChange);
        }
        Device._getOrCreateAudioContext();
        if (Device._audioContext) {
            if (!Device._dialtonePlayer) {
                Device._dialtonePlayer = new dialtonePlayer.default(Device._audioContext);
            }
        }
        _this._boundConfirmClose = _this._confirmClose.bind(_this);
        _this._boundOnPageHide = _this._onPageHide.bind(_this);
        _this._boundOnPageShow = _this._onPageShow.bind(_this);
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('pagehide', _this._boundOnPageHide);
            window.addEventListener('pageshow', _this._boundOnPageShow);
        }
        _this.updateOptions(options);
        return _this;
    }
    Object.defineProperty(Device, "audioContext", {
        /**
         * The AudioContext to be used by {@link Device} instances.
         * @private
         */
        get: function () {
            return Device._audioContext;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Device, "extension", {
        /**
         * Which sound file extension is supported.
         * @private
         */
        get: function () {
            // NOTE(mroberts): Node workaround.
            var a = typeof document !== 'undefined'
                ? document.createElement('audio') : { canPlayType: false };
            var canPlayMp3;
            try {
                canPlayMp3 = a.canPlayType && !!a.canPlayType('audio/mpeg').replace(/no/, '');
            }
            catch (e) {
                canPlayMp3 = false;
            }
            var canPlayVorbis;
            try {
                canPlayVorbis = a.canPlayType && !!a.canPlayType('audio/ogg;codecs=\'vorbis\'').replace(/no/, '');
            }
            catch (e) {
                canPlayVorbis = false;
            }
            return (canPlayVorbis && !canPlayMp3) ? 'ogg' : 'mp3';
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Device, "isSupported", {
        /**
         * Whether or not this SDK is supported by the current browser.
         */
        get: function () { return index.enabled(); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Device, "packageName", {
        /**
         * Package name of the SDK.
         */
        get: function () { return constants.PACKAGE_NAME; },
        enumerable: false,
        configurable: true
    });
    /**
     * Run some tests to identify issues, if any, prohibiting successful calling.
     * @param token - A Twilio JWT token string
     * @param options
     */
    Device.runPreflight = function (token, options) {
        return new preflight.PreflightTest(token, tslib.__assign({ audioContext: Device._getOrCreateAudioContext() }, options));
    };
    /**
     * String representation of {@link Device} class.
     * @private
     */
    Device.toString = function () {
        return '[Twilio.Device class]';
    };
    Object.defineProperty(Device, "version", {
        /**
         * Current SDK version.
         */
        get: function () { return constants.RELEASE_VERSION; },
        enumerable: false,
        configurable: true
    });
    /**
     * Initializes the AudioContext instance shared across the Voice SDK,
     * or returns the existing instance if one has already been initialized.
     */
    Device._getOrCreateAudioContext = function () {
        if (!Device._audioContext) {
            if (typeof AudioContext !== 'undefined') {
                Device._audioContext = new AudioContext();
            }
            else if (typeof webkitAudioContext !== 'undefined') {
                Device._audioContext = new webkitAudioContext();
            }
        }
        return Device._audioContext;
    };
    /**
     * Whether two tokens are for the same account SID and identity. A token that
     * cannot be decoded counts as a different principal.
     * @param a
     * @param b
     */
    Device._isSameTokenPrincipal = function (a, b) {
        var first = util.getTokenPrincipal(a);
        var second = util.getTokenPrincipal(b);
        return !!first && !!second
            && first.accountSid === second.accountSid
            && first.identity === second.identity;
    };
    Object.defineProperty(Device.prototype, "audio", {
        /**
         * Return the {@link AudioHelper} used by this {@link Device}.
         */
        get: function () {
            return this._audio;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Make an outgoing Call.
     * @param options
     */
    Device.prototype.connect = function () {
        return tslib.__awaiter(this, arguments, void 0, function (options) {
            var customParameters, parameters, signalingReconnectToken, connectTokenParts, isReconnect, twimlParams, callOptions, activeCall;
            if (options === void 0) { options = {}; }
            return tslib.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this._log.debug('.connect', JSON.stringify(options));
                        this._throwIfDestroyed();
                        if (this._activeCall || this._makeCallPromise) {
                            throw new index$1.InvalidStateError('A Call is already active');
                        }
                        if (options.connectToken) {
                            try {
                                connectTokenParts = JSON.parse(decodeURIComponent(atob(options.connectToken)));
                                customParameters = connectTokenParts.customParameters;
                                parameters = connectTokenParts.parameters;
                                signalingReconnectToken = connectTokenParts.signalingReconnectToken;
                            }
                            catch (_b) {
                                throw new index$1.InvalidArgumentError('Cannot parse connectToken');
                            }
                            if (!parameters || !parameters.CallSid || !signalingReconnectToken) {
                                throw new index$1.InvalidArgumentError('Invalid connectToken');
                            }
                        }
                        isReconnect = false;
                        twimlParams = {};
                        callOptions = {
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
                        this._makeCallPromise = this._makeCall(twimlParams, callOptions, isReconnect);
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, , 3, 4]);
                        return [4 /*yield*/, this._makeCallPromise];
                    case 2:
                        activeCall = _a.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        this._makeCallPromise = null;
                        return [7 /*endfinally*/];
                    case 4:
                        // An incoming call accepted meanwhile keeps the slot until accept() below replaces it.
                        if (!this._activeCall) {
                            this._activeCall = activeCall;
                        }
                        // Make sure any incoming calls are ignored
                        this._calls.splice(0).forEach(function (call) { return call.ignore(); });
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
                        return [2 /*return*/, activeCall];
                }
            });
        });
    };
    Object.defineProperty(Device.prototype, "calls", {
        /**
         * Return the calls that this {@link Device} is maintaining.
         */
        get: function () {
            return this._calls;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Destroy the {@link Device}, freeing references to be garbage collected.
     */
    Device.prototype.destroy = function () {
        var _a;
        this._log.debug('.destroy');
        this._log.debug('Rejecting any incoming calls');
        var calls = this._calls.slice(0);
        calls.forEach(function (call) { return call.reject(); });
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
        events.EventEmitter.prototype.removeAllListeners.call(this);
    };
    /**
     * Disconnect all {@link Call}s.
     */
    Device.prototype.disconnectAll = function () {
        this._log.debug('.disconnectAll');
        var calls = this._calls.splice(0);
        calls.forEach(function (call) { return call.disconnect(); });
        if (this._activeCall) {
            this._activeCall.disconnect();
        }
        if (this._acceptingCall) {
            this._acceptingCall.disconnect();
        }
    };
    Object.defineProperty(Device.prototype, "edge", {
        /**
         * Returns the {@link Edge} value the {@link Device} is currently connected
         * to. The value will be `null` when the {@link Device} is offline.
         */
        get: function () {
            return this._edge;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Device.prototype, "home", {
        /**
         * Returns the home value the {@link Device} is currently connected
         * to. The value will be `null` when the {@link Device} is offline.
         */
        get: function () {
            return this._home;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Device.prototype, "identity", {
        /**
         * Returns the identity associated with the {@link Device} for incoming calls. Only
         * populated when registered.
         */
        get: function () {
            return this._identity;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Device.prototype, "isBusy", {
        /**
         * Whether the Device is currently on an active Call. A Call counts as active from `call.accept()`,
         * which `device.connect()` calls before it resolves, until it ends, even before its media has
         * connected. When accepting a Call replaces the active one, the replaced Call's disconnect handlers
         * see the Device idle, and a Call they accept or connect, or a `disconnectAll()` they call, ends
         * the accepting Call instead.
         */
        get: function () {
            return !!this._activeCall;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Register the `Device` to the Twilio backend, allowing it to receive calls.
     */
    Device.prototype.register = function () {
        return tslib.__awaiter(this, void 0, void 0, function () {
            return tslib.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this._log.debug('.register');
                        if (this.state !== Device.State.Unregistered) {
                            throw new index$1.InvalidStateError("Attempt to register when device is in state \"".concat(this.state, "\". ") +
                                "Must be \"".concat(Device.State.Unregistered, "\"."));
                        }
                        this._shouldReRegister = false;
                        this._setState(Device.State.Registering);
                        return [4 /*yield*/, (this._streamConnectedPromise || this._setupStream())];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this._sendPresence(true)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, util.promisifyEvents(this, Device.State.Registered, Device.State.Unregistered)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Object.defineProperty(Device.prototype, "state", {
        /**
         * Get the state of this {@link Device} instance
         */
        get: function () {
            return this._state;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Device.prototype, "token", {
        /**
         * Get the token used by this {@link Device}.
         */
        get: function () {
            return this._token;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * String representation of {@link Device} instance.
     * @private
     */
    Device.prototype.toString = function () {
        return '[Twilio.Device instance]';
    };
    /**
     * Unregister the `Device` to the Twilio backend, disallowing it to receive
     * calls.
     */
    Device.prototype.unregister = function () {
        return tslib.__awaiter(this, void 0, void 0, function () {
            var stream, streamOfflinePromise;
            return tslib.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this._log.debug('.unregister');
                        if (this.state !== Device.State.Registered) {
                            throw new index$1.InvalidStateError("Attempt to unregister when device is in state \"".concat(this.state, "\". ") +
                                "Must be \"".concat(Device.State.Registered, "\"."));
                        }
                        this._shouldReRegister = false;
                        return [4 /*yield*/, this._streamConnectedPromise];
                    case 1:
                        stream = _a.sent();
                        streamOfflinePromise = new Promise(function (resolve) {
                            stream.on('offline', resolve);
                        });
                        return [4 /*yield*/, this._sendPresence(false)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, streamOfflinePromise];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Set the options used within the {@link Device}.
     * @param options
     */
    Device.prototype.updateOptions = function (options) {
        if (options === void 0) { options = {}; }
        this._logOptions('updateOptions', options);
        if (this.state === Device.State.Destroyed) {
            throw new index$1.InvalidStateError("Attempt to \"updateOptions\" when device is in state \"".concat(this.state, "\"."));
        }
        var newOptions = tslib.__assign(tslib.__assign(tslib.__assign({}, this._defaultOptions), this._options), options);
        var originalChunderURIs = new Set(this._chunderURIs);
        var newChunderURIs = (this._getChunderws(newOptions) || regions.getChunderURIs(newOptions.edge)).map(regions.createSignalingEndpointURL);
        var hasChunderURIsChanged = originalChunderURIs.size !== newChunderURIs.length;
        if (!hasChunderURIsChanged) {
            for (var _i = 0, newChunderURIs_1 = newChunderURIs; _i < newChunderURIs_1.length; _i++) {
                var uri = newChunderURIs_1[_i];
                if (!originalChunderURIs.has(uri)) {
                    hasChunderURIsChanged = true;
                    break;
                }
            }
        }
        if (this.isBusy && hasChunderURIsChanged) {
            throw new index$1.InvalidStateError('Cannot change Edge while on an active Call');
        }
        // Store only once validated, so a rejected call leaves the Device unchanged.
        this._options = newOptions;
        this._chunderURIs = newChunderURIs;
        this._setupLoglevel(this._options.logLevel);
        for (var _a = 0, _b = Object.keys(Device._defaultSounds); _a < _b.length; _a++) {
            var name_1 = _b[_a];
            var soundDef = Device._defaultSounds[name_1];
            var defaultUrl = "".concat(constants.SOUNDS_BASE_URL, "/").concat(soundDef.filename, ".").concat(Device.extension)
                + "?cache=".concat(constants.RELEASE_VERSION);
            var soundUrl = this._options.sounds && this._options.sounds[name_1] || defaultUrl;
            var sound$1 = new (this._options.Sound || sound.default)(name_1, soundUrl, {
                audioContext: this._options.disableAudioContextSounds ? null : Device.audioContext,
                maxDuration: soundDef.maxDuration,
                shouldLoop: soundDef.shouldLoop,
            });
            this._soundcache.set(name_1, sound$1);
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
    };
    /**
     * Update the token used by this {@link Device} to connect to Twilio.
     * It is recommended to call this API after [[Device.tokenWillExpireEvent]] is emitted,
     * and before or after a call to prevent a potential ~1s audio loss during the update process.
     * @param token
     */
    Device.prototype.updateToken = function (token) {
        this._log.debug('.updateToken');
        if (this.state === Device.State.Destroyed) {
            throw new index$1.InvalidStateError("Attempt to \"updateToken\" when device is in state \"".concat(this.state, "\"."));
        }
        if (typeof token !== 'string') {
            throw new index$1.InvalidArgumentError(INVALID_TOKEN_MESSAGE);
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
    };
    /**
     * Called on window's beforeunload event if closeProtection is enabled,
     * preventing users from accidentally navigating away from an active call.
     * @param event
     */
    Device.prototype._confirmClose = function (event) {
        if (!this._activeCall) {
            return '';
        }
        var closeProtection = this._options.closeProtection || false;
        var confirmationMsg = typeof closeProtection !== 'string'
            ? 'A call is currently in-progress. Leaving or reloading this page will end the call.'
            : closeProtection;
        (event || window.event).returnValue = confirmationMsg;
        return confirmationMsg;
    };
    /**
     * Destroy the AudioHelper.
     */
    Device.prototype._destroyAudioHelper = function () {
        if (!this._audio) {
            return;
        }
        this._audio._destroy();
        this._audio = null;
    };
    /**
     * Send buffered Insights events once (no retries) and stop the retry timer.
     */
    Device.prototype._destroyInsightsOutbox = function () {
        if (!this._insightsOutbox) {
            return;
        }
        this._insightsOutbox.destroy();
        this._insightsOutbox = null;
    };
    /**
     * Destroy the publisher.
     */
    Device.prototype._destroyPublisher = function () {
        // Attempt to destroy non-existent publisher.
        if (!this._publisher) {
            return;
        }
        this._publisher = null;
    };
    /**
     * Destroy the connection to the signaling server.
     */
    Device.prototype._destroyStream = function () {
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
    };
    /**
     * Find a {@link Call} by its CallSid.
     * @param callSid
     */
    Device.prototype._findCall = function (callSid) {
        return this._calls.find(function (call) { return call.parameters.CallSid === callSid
            || call.outboundConnectionId === callSid; }) || null;
    };
    /**
     * Get chunderws array from the chunderw param
     */
    Device.prototype._getChunderws = function (options) {
        if (options === void 0) { options = this._options; }
        return typeof options.chunderw === 'string' ? [options.chunderw]
            : Array.isArray(options.chunderw) ? options.chunderw : null;
    };
    /**
     * Utility function to log device options
     */
    Device.prototype._logOptions = function (caller, options) {
        if (options === void 0) { options = {}; }
        // Selectively log options that users can modify.
        // Also, convert user overrides.
        // This prevents potential app crash when calling JSON.stringify
        // and when sending log strings remotely
        var userOptions = [
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
        var userOptionOverrides = [
            'RTCPeerConnection',
            'enumerateDevices',
            'getUserMedia',
            'MediaStream',
        ];
        if (typeof options === 'object') {
            var toLog_1 = tslib.__assign({}, options);
            Object.keys(toLog_1).forEach(function (key) {
                if (!userOptions.includes(key) && !userOptionOverrides.includes(key)) {
                    delete toLog_1[key];
                }
                if (userOptionOverrides.includes(key)) {
                    toLog_1[key] = true;
                }
            });
            this._log.debug(".".concat(caller), JSON.stringify(toLog_1));
        }
    };
    /**
     * Create a new {@link Call}.
     * @param twimlParams - A flat object containing key:value pairs to be sent to the TwiML app.
     * @param options - Options to be used to instantiate the {@link Call}.
     */
    Device.prototype._makeCall = function (twimlParams_1, options_1) {
        return tslib.__awaiter(this, arguments, void 0, function (twimlParams, options, isReconnect) {
            var inputDevicePromise, config, maybeUnsetPreferredUri, call$1;
            var _a;
            var _this = this;
            var _b;
            if (isReconnect === void 0) { isReconnect = false; }
            return tslib.__generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        inputDevicePromise = (_b = this._audio) === null || _b === void 0 ? void 0 : _b._getInputDevicePromise();
                        if (!inputDevicePromise) return [3 /*break*/, 2];
                        this._log.debug('inputDevicePromise detected, waiting...');
                        return [4 /*yield*/, inputDevicePromise];
                    case 1:
                        _c.sent();
                        this._log.debug('inputDevicePromise resolved');
                        _c.label = 2;
                    case 2:
                        _a = {
                            audioHelper: this._audio,
                            onIgnore: function () {
                                _this._soundcache.get(Device.SoundName.Incoming).stop();
                            }
                        };
                        return [4 /*yield*/, (this._streamConnectedPromise || this._setupStream())];
                    case 3:
                        config = (_a.pstream = _c.sent(),
                            _a.publisher = this._publisher,
                            _a.soundcache = this._soundcache,
                            _a);
                        options = Object.assign({
                            MediaStream: this._options.MediaStream,
                            RTCPeerConnection: this._options.RTCPeerConnection,
                            beforeAccept: function (currentCall) {
                                var previousCall = _this._activeCall;
                                if (previousCall && previousCall !== currentCall) {
                                    // Disconnect before claiming the slot; the Device's own disconnect listener frees it,
                                    // so the previous call's handlers see the Device idle.
                                    previousCall.disconnect();
                                    _this._removeCall(previousCall);
                                }
                                // A disconnect handler above ended this call, or accepted another one, which wins.
                                if (currentCall.status() !== call.default.State.Connecting) {
                                    return;
                                }
                                if (_this._activeCall && _this._activeCall !== currentCall) {
                                    _this._log.info('Another call was accepted while replacing the active call; disconnecting this one');
                                    currentCall.disconnect();
                                    return;
                                }
                                // Claim the slot now; 'accept' only fires once media is open.
                                _this._activeCall = currentCall;
                            },
                            codecPreferences: this._options.codecPreferences,
                            customSounds: this._options.sounds,
                            dialtonePlayer: Device._dialtonePlayer,
                            dscp: this._options.dscp,
                            // TODO(csantos): Remove forceAggressiveIceNomination option in 3.x
                            forceAggressiveIceNomination: this._options.forceAggressiveIceNomination,
                            getInputStream: function () { return _this._options.fileInputStream || _this._callInputStream; },
                            getSinkIds: function () { return _this._callSinkIds; },
                            maxAverageBitrate: this._options.maxAverageBitrate,
                            preflight: this._options.preflight,
                            rtcConstraints: this._options.rtcConstraints,
                            shouldPlayDisconnect: function () { var _a; return (_a = _this._audio) === null || _a === void 0 ? void 0 : _a.disconnect(); },
                            twimlParams: twimlParams,
                            voiceEventSidGenerator: this._options.voiceEventSidGenerator,
                        }, options);
                        maybeUnsetPreferredUri = function () {
                            if (!_this._stream) {
                                _this._log.warn('UnsetPreferredUri called without a stream');
                                return;
                            }
                            if (_this._activeCall === null && _this._calls.length === 0) {
                                _this._stream.updatePreferredURI(null);
                            }
                        };
                        call$1 = new (this._options.Call || call.default)(config, options);
                        this._publisher.info('settings', 'init', {
                            MediaStream: !!this._options.MediaStream,
                            RTCPeerConnection: !!this._options.RTCPeerConnection,
                            enumerateDevices: !!this._options.enumerateDevices,
                            getUserMedia: !!this._options.getUserMedia,
                        }, call$1);
                        call$1.once('accept', function () {
                            var _a, _b, _c, _d, _e;
                            _this._stream.updatePreferredURI(_this._preferredURI);
                            _this._removeCall(call$1);
                            _this._activeCall = call$1;
                            if (_this._audio) {
                                _this._audio._maybeStartPollingVolume();
                            }
                            if (call$1.direction === call.default.CallDirection.Outgoing && ((_a = _this._audio) === null || _a === void 0 ? void 0 : _a.outgoing()) && !isReconnect) {
                                _this._soundcache.get(Device.SoundName.Outgoing).play();
                            }
                            var data = { edge: _this._edge || _this._region };
                            if (_this._options.edge) {
                                data['selected_edge'] = Array.isArray(_this._options.edge)
                                    ? _this._options.edge
                                    : [_this._options.edge];
                            }
                            _this._publisher.info('settings', 'edge', data, call$1);
                            if ((_b = _this._audio) === null || _b === void 0 ? void 0 : _b.localProcessedStream) {
                                (_c = _this._audioProcessorEventObserver) === null || _c === void 0 ? void 0 : _c.emit('enabled', false);
                            }
                            if ((_d = _this._audio) === null || _d === void 0 ? void 0 : _d.remoteProcessedStream) {
                                (_e = _this._audioProcessorEventObserver) === null || _e === void 0 ? void 0 : _e.emit('enabled', true);
                            }
                        });
                        call$1.addListener('error', function (error) {
                            if (call$1.status() === 'closed') {
                                _this._removeCall(call$1);
                                maybeUnsetPreferredUri();
                            }
                            if (_this._audio) {
                                _this._audio._maybeStopPollingVolume();
                            }
                            _this._maybeStopIncomingSound();
                        });
                        call$1.once('cancel', function () {
                            _this._log.info("Canceled: ".concat(call$1.parameters.CallSid));
                            _this._removeCall(call$1);
                            maybeUnsetPreferredUri();
                            if (_this._audio) {
                                _this._audio._maybeStopPollingVolume();
                            }
                            _this._maybeStopIncomingSound();
                        });
                        call$1.once('disconnect', function () {
                            if (_this._audio) {
                                _this._audio._maybeStopPollingVolume();
                            }
                            _this._removeCall(call$1);
                            maybeUnsetPreferredUri();
                            /**
                             * NOTE(kamalbennani): We need to stop the incoming sound when the call is
                             * disconnected right after the user has accepted the call (activeCall.accept()), and before
                             * the call has been fully connected (i.e. before the `pstream.answer` event)
                             */
                            _this._maybeStopIncomingSound();
                        });
                        call$1.once('reject', function () {
                            _this._log.info("Rejected: ".concat(call$1.parameters.CallSid));
                            if (_this._audio) {
                                _this._audio._maybeStopPollingVolume();
                            }
                            _this._removeCall(call$1);
                            maybeUnsetPreferredUri();
                            _this._maybeStopIncomingSound();
                        });
                        call$1.on('transportClose', function () {
                            if (call$1.status() !== call.default.State.Pending) {
                                return;
                            }
                            if (_this._audio) {
                                _this._audio._maybeStopPollingVolume();
                            }
                            _this._removeCall(call$1);
                            /**
                             * NOTE(mhuynh): We don't want to call `maybeUnsetPreferredUri` because
                             * a `transportClose` will happen during signaling reconnection.
                             */
                            _this._maybeStopIncomingSound();
                        });
                        return [2 /*return*/, call$1];
                }
            });
        });
    };
    /**
     * Stop the incoming sound if no {@link Call}s remain.
     */
    Device.prototype._maybeStopIncomingSound = function () {
        if (!this._calls.length) {
            this._soundcache.get(Device.SoundName.Incoming).stop();
        }
    };
    /**
     * Called on the window's `pagehide` event. When the page is entering the
     * back/forward cache (`event.persisted === true`) and there are no active
     * calls, the signaling connection is quiesced without permanently destroying
     * the {@link Device}, so it can be restored on `pageshow`. Otherwise the
     * {@link Device} is destroyed, preserving the historical behavior (a normal
     * page unload, or a persisted transition while media is active and cannot
     * survive the cache).
     */
    Device.prototype._onPageHide = function (event) {
        if (event && event.persisted && this._calls.length === 0 && !this._activeCall && !this._makeCallPromise) {
            this._log.debug('Page entering BFCache; quiescing signaling');
            this._stopRegistrationTimer();
            this._destroyStream();
        }
        else {
            this.destroy();
        }
    };
    /**
     * Called on the window's `pageshow` event. When the page is restored from the
     * back/forward cache (`event.persisted === true`), re-register if the
     * {@link Device} was registered before entering the cache. A previously
     * destroyed or unregistered {@link Device} is left untouched.
     */
    Device.prototype._onPageShow = function (event) {
        var _this = this;
        if (!event || !event.persisted) {
            return;
        }
        if (this.state === Device.State.Destroyed) {
            return;
        }
        if (this._shouldReRegister && this.state === Device.State.Unregistered) {
            this._log.debug('Page restored from BFCache; re-registering');
            this.register().catch(function (error) {
                _this._log.warn('Failed to re-register after BFCache restore', error);
            });
        }
    };
    /**
     * The id of the signaling connection that dropped, when the current
     * connection has none: the transport closed and has not reconnected yet.
     * @returns The id, or `undefined` while connected or if none is known.
     */
    Device.prototype._getDroppedSignalingConnectionId = function () {
        var stream = this._stream;
        if (!stream || stream.signalingConnectionId) {
            return;
        }
        var droppedId = stream.lastClosedSignalingConnectionId;
        return typeof droppedId === 'string' && droppedId ? droppedId : undefined;
    };
    /**
     * Publish an error to Insights. Without a Call, the event has no call ids.
     * @param twilioError - The error to publish.
     * @param call - The Call the error belongs to, if any.
     * @param droppedSignalingConnectionId - The id of the signaling connection
     *   that dropped, set on this event only when the current one has none.
     */
    Device.prototype._publishError = function (twilioError, call, droppedSignalingConnectionId) {
        var _a;
        var payload = {
            code: twilioError.code,
            message: twilioError.message,
        };
        if (droppedSignalingConnectionId) {
            payload.signaling_connection_id = droppedSignalingConnectionId;
        }
        (_a = this._publisher) === null || _a === void 0 ? void 0 : _a.error('connection', 'error', payload, call);
    };
    /**
     * Remove a {@link Call} from device.calls by reference
     * @param call
     */
    Device.prototype._removeCall = function (call) {
        if (this._activeCall === call) {
            this._activeCall = null;
        }
        for (var i = this._calls.length - 1; i >= 0; i--) {
            if (call === this._calls[i]) {
                this._calls.splice(i, 1);
            }
        }
    };
    /**
     * Register with the signaling server.
     */
    Device.prototype._sendPresence = function (presence) {
        return tslib.__awaiter(this, void 0, void 0, function () {
            var stream;
            return tslib.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._streamConnectedPromise];
                    case 1:
                        stream = _a.sent();
                        if (!stream) {
                            return [2 /*return*/];
                        }
                        stream.register({ audio: presence });
                        if (presence) {
                            this._startRegistrationTimer();
                        }
                        else {
                            this._stopRegistrationTimer();
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Helper function that sets and emits the state of the device.
     * @param state The new state of the device.
     */
    Device.prototype._setState = function (state) {
        if (state === this.state) {
            return;
        }
        this._state = state;
        var name = this._stateEventMapping[state];
        this._log.debug("#".concat(name));
        this.emit(name);
    };
    /**
     * Set up an audio helper for usage by this {@link Device}.
     */
    Device.prototype._setupAudioHelper = function () {
        var _this = this;
        if (!this._audioProcessorEventObserver) {
            this._audioProcessorEventObserver = new audioprocessoreventobserver.AudioProcessorEventObserver();
            this._audioProcessorEventObserver.on('event', function (_a) {
                var name = _a.name, group = _a.group, isRemote = _a.isRemote;
                _this._publisher.info(group, name, { is_remote: isRemote }, _this._activeCall);
            });
        }
        var audioOptions = {
            audioContext: Device.audioContext,
            audioProcessorEventObserver: this._audioProcessorEventObserver,
            beforeSetInputDevice: function () {
                if (_this._makeCallPromise) {
                    _this._log.debug('beforeSetInputDevice pause detected');
                    return _this._makeCallPromise;
                }
                else {
                    _this._log.debug('beforeSetInputDevice pause not detected, setting default');
                    return Promise.resolve();
                }
            },
            enumerateDevices: this._options.enumerateDevices,
            getUserMedia: this._options.getUserMedia || getusermedia.default,
        };
        if (this._audio) {
            this._log.info('Found existing audio helper; updating options...');
            this._audio._updateUserOptions(audioOptions);
            return;
        }
        this._audio = new (this._options.AudioHelper || audiohelper.default)(this._updateSinkIds, this._updateInputStream, audioOptions);
        this._audio.on('deviceChange', function (lostActiveDevices) {
            var activeCall = _this._activeCall;
            var deviceIds = lostActiveDevices.map(function (device) { return device.deviceId; });
            _this._publisher.info('audio', 'device-change', {
                lost_active_device_ids: deviceIds,
            }, activeCall);
            if (activeCall) {
                activeCall['_mediaHandler']._onInputDevicesChanged();
            }
        });
    };
    /**
     * Setup logger's loglevel
     */
    Device.prototype._setupLoglevel = function (logLevel) {
        var level = typeof logLevel === 'number' ||
            typeof logLevel === 'string' ?
            logLevel : loglevel__namespace.levels.ERROR;
        this._log.setDefaultLevel(level);
        this._log.info('Set logger default level to', level);
    };
    /**
     * Create and set a publisher for the {@link Device} to use.
     */
    Device.prototype._setupPublisher = function () {
        var _this = this;
        if (this._publisher) {
            this._log.info('Found existing publisher; destroying...');
            this._destroyPublisher();
        }
        if (!this._insightsOutbox) {
            this._insightsOutbox = new insightsoutbox.default();
        }
        var publisherOptions = {
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
            publisherOptions.host = regions.createEventGatewayURI(this._home);
        }
        this._publisher = new (this._options.Publisher || eventpublisher.default)(PUBLISHER_PRODUCT_NAME, this.token, publisherOptions);
        if (this._options.publishEvents === false) {
            this._publisher.disable();
        }
        else {
            this._publisher.on('error', function (error) {
                _this._log.warn('Cannot connect to insights.', error);
            });
        }
        // Send events buffered before this publisher replaced the previous one.
        // No-op when the host is unknown, and the buffer is already empty when
        // publishing is disabled.
        this._insightsOutbox.flush();
        return this._publisher;
    };
    /**
     * Set up the connection to the signaling server. Tears down an existing
     * stream if called while a stream exists.
     */
    Device.prototype._setupStream = function () {
        var _this = this;
        if (this._stream) {
            this._log.info('Found existing stream; destroying...');
            this._destroyStream();
        }
        this._log.info('Setting up VSP');
        this._isTransportErrorPublished = false;
        this._stream = new (this._options.PStream || pstream.default)(this.token, this._chunderURIs, {
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
            util.promisifyEvents(this._stream, 'connected', 'close').then(function () { return _this._stream; });
    };
    /**
     * Start playing the incoming ringtone, and subsequently emit the incoming event.
     * @param call
     * @param play - The function to be used to play the sound. Must return a Promise.
     */
    Device.prototype._showIncomingCall = function (call, play) {
        var _this = this;
        var timeout;
        return Promise.race([
            play(),
            new Promise(function (resolve, reject) {
                timeout = setTimeout(function () {
                    var msg = 'Playing incoming ringtone took too long; it might not play. Continuing execution...';
                    reject(new Error(msg));
                }, RINGTONE_PLAY_TIMEOUT);
            }),
        ]).catch(function (reason) {
            _this._log.warn(reason.message);
        }).then(function () {
            clearTimeout(timeout);
            _this._log.debug('#incoming', JSON.stringify({
                customParameters: call.customParameters,
                parameters: call.parameters,
            }));
            _this.emit(Device.EventName.Incoming, call);
        });
    };
    /**
     * Set a timeout to send another register message to the signaling server.
     */
    Device.prototype._startRegistrationTimer = function () {
        var _this = this;
        this._stopRegistrationTimer();
        this._regTimer = setTimeout(function () {
            _this._sendPresence(true);
        }, REGISTRATION_INTERVAL);
    };
    /**
     * Stop sending registration messages to the signaling server.
     */
    Device.prototype._stopRegistrationTimer = function () {
        if (this._regTimer) {
            clearTimeout(this._regTimer);
        }
    };
    /**
     * Throw an error if the {@link Device} is destroyed.
     */
    Device.prototype._throwIfDestroyed = function () {
        if (this.state === Device.State.Destroyed) {
            throw new index$1.InvalidStateError('Device has been destroyed.');
        }
    };
    /**
     * Update the device IDs of output devices being used to play the incoming ringtone through.
     * @param sinkIds - An array of device IDs
     */
    Device.prototype._updateRingtoneSinkIds = function (sinkIds) {
        return Promise.resolve(this._soundcache.get(Device.SoundName.Incoming).setSinkIds(sinkIds));
    };
    /**
     * Update the device IDs of output devices being used to play the non-ringtone sounds
     * and Call audio through.
     * @param sinkIds - An array of device IDs
     */
    Device.prototype._updateSpeakerSinkIds = function (sinkIds) {
        Array.from(this._soundcache.entries())
            .filter(function (entry) { return entry[0] !== Device.SoundName.Incoming; })
            .forEach(function (entry) { return entry[1].setSinkIds(sinkIds); });
        this._callSinkIds = sinkIds;
        var call = this._activeCall;
        return call
            ? call._setSinkIds(sinkIds)
            : Promise.resolve();
    };
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
    return Device;
}(events.EventEmitter));
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
})(exports.default || (exports.default = {}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2aWNlLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2RldmljZS50cyJdLCJzb3VyY2VzQ29udGVudCI6W251bGxdLCJuYW1lcyI6WyJEZXZpY2UiLCJfX2V4dGVuZHMiLCJDYWxsIiwibG9nbGV2ZWwiLCJnZW5lcmF0ZVZvaWNlRXZlbnRTaWQiLCJMb2ciLCJydGMuZ2V0TWVkaWFFbmdpbmUiLCJDLlJFTEVBU0VfVkVSU0lPTiIsImdldFJlZ2lvblNob3J0Y29kZSIsInJlZ2lvblRvRWRnZSIsImNyZWF0ZUV2ZW50R2F0ZXdheVVSSSIsImdldENodW5kZXJVUklzIiwiY3JlYXRlU2lnbmFsaW5nRW5kcG9pbnRVUkwiLCJBdXRob3JpemF0aW9uRXJyb3JzIiwiZ2V0UHJlY2lzZVNpZ25hbGluZ0Vycm9yQnlDb2RlIiwiR2VuZXJhbEVycm9ycyIsImlzVHJhbnNwb3J0RXJyb3JQYXlsb2FkIiwiX19hd2FpdGVyIiwiQ2xpZW50RXJyb3JzIiwicXVlcnlUb0pzb24iLCJJbnZhbGlkU3RhdGVFcnJvciIsImlzTGVnYWN5RWRnZSIsIk5vdFN1cHBvcnRlZEVycm9yIiwiRGlhbHRvbmVQbGF5ZXIiLCJydGMuZW5hYmxlZCIsIkMuUEFDS0FHRV9OQU1FIiwiUHJlZmxpZ2h0VGVzdCIsImdldFRva2VuUHJpbmNpcGFsIiwiSW52YWxpZEFyZ3VtZW50RXJyb3IiLCJFdmVudEVtaXR0ZXIiLCJwcm9taXNpZnlFdmVudHMiLCJfX2Fzc2lnbiIsIkMuU09VTkRTX0JBU0VfVVJMIiwic291bmQiLCJTb3VuZCIsImNhbGwiLCJBdWRpb1Byb2Nlc3NvckV2ZW50T2JzZXJ2ZXIiLCJnZXRVc2VyTWVkaWEiLCJBdWRpb0hlbHBlciIsIkluc2lnaHRzT3V0Ym94IiwiUHVibGlzaGVyIiwiUFN0cmVhbSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBd0RBLElBQU0scUJBQXFCLEdBQUcsS0FBSztBQUNuQyxJ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WUFBWSxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUU7UUFDekQsS0FBSyxFQUFFLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFO1FBQ2hELEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRTtRQUNoRCxLQUFLLEVBQUUsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUU7UUFDaEQsS0FBSyxFQUFFLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFO1FBQ2hELEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRTtRQUNoRCxLQUFLLEVBQUUsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUU7UUFDaEQsS0FBSyxFQUFFLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFO1FBQ2hELEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRTtRQUNoRCxLQUFLLEVBQUUsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUU7UUFDaEQsS0FBSyxFQUFFLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsSUFBSSxFQUFFO1FBQ2hELEtBQUssRUFBRSxFQUFFLFFBQVEsRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRTtRQUNuRCxLQUFLLEVBQUUsRUFBRSxRQUFRLEVBQUUsV0FBVyxFQUFFLFdBQVcsRUFBRSxJQUFJLEVBQUU7UUFDbkQsUUFBUSxFQUFFLEVBQUUsUUFBUSxFQUFFLFVBQVUsRUFBRSxVQUFVLEVBQUUsSUFBSSxFQUFFO1FBQ3BELFFBQVEsRUFBRSxFQUFFLFFBQVEsRUFBRSxVQUFVLEVBQUUsV0FBVyxFQUFFLElBQUksRUFBRTtBQUN0RCxLQWhCNEI7SUFn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
