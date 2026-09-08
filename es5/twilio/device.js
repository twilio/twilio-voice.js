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
            _this.emit(Device.EventName.Error, twilioError, call);
        };
        /**
         * Called when an 'invite' event is received from the signaling stream.
         */
        _this._onSignalingInvite = function (payload) { return tslib.__awaiter(_this, void 0, void 0, function () {
            var wasBusy, callParameters, customParameters, call, play;
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
                            this.emit(Device.EventName.Error, new generated.ClientErrors.BadRequest('Malformed invite from gateway'));
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
            var customParameters, parameters, signalingReconnectToken, connectTokenParts, isReconnect, twimlParams, callOptions, activeCall, _a;
            if (options === void 0) { options = {}; }
            return tslib.__generator(this, function (_b) {
                switch (_b.label) {
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
                            catch (_c) {
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
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, , 3, 4]);
                        _a = this;
                        return [4 /*yield*/, this._makeCallPromise];
                    case 2:
                        activeCall = _a._activeCall = _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        this._makeCallPromise = null;
                        return [7 /*endfinally*/];
                    case 4:
                        // Make sure any incoming calls are ignored
                        this._calls.splice(0).forEach(function (call) { return call.ignore(); });
                        // Stop the incoming sound if it's playing
                        this._soundcache.get(Device.SoundName.Incoming).stop();
                        activeCall.accept({ rtcConstraints: options.rtcConstraints });
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
         * Whether the Device is currently on an active Call.
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
        this._options = tslib.__assign(tslib.__assign(tslib.__assign({}, this._defaultOptions), this._options), options);
        var originalChunderURIs = new Set(this._chunderURIs);
        var newChunderURIs = this._chunderURIs = (this._getChunderws() || regions.getChunderURIs(this._options.edge)).map(regions.createSignalingEndpointURL);
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
    Device.prototype._getChunderws = function () {
        return typeof this._options.chunderw === 'string' ? [this._options.chunderw]
            : Array.isArray(this._options.chunderw) ? this._options.chunderw : null;
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
                                if (!_this._activeCall || _this._activeCall === currentCall) {
                                    return;
                                }
                                _this._activeCall.disconnect();
                                _this._removeCall(_this._activeCall);
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
     * Remove a {@link Call} from device.calls by reference
     * @param call
     */
    Device.prototype._removeCall = function (call) {
        if (this._activeCall === call) {
            this._activeCall = null;
            this._makeCallPromise = null;
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
        var publisherOptions = {
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2aWNlLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2RldmljZS50cyJdLCJzb3VyY2VzQ29udGVudCI6W251bGxdLCJuYW1lcyI6WyJEZXZpY2UiLCJfX2V4dGVuZHMiLCJDYWxsIiwibG9nbGV2ZWwiLCJnZW5lcmF0ZVZvaWNlRXZlbnRTaWQiLCJMb2ciLCJydGMuZ2V0TWVkaWFFbmdpbmUiLCJDLlJFTEVBU0VfVkVSU0lPTiIsImdldFJlZ2lvblNob3J0Y29kZSIsInJlZ2lvblRvRWRnZSIsImNyZWF0ZUV2ZW50R2F0ZXdheVVSSSIsImdldENodW5kZXJVUklzIiwiY3JlYXRlU2lnbmFsaW5nRW5kcG9pbnRVUkwiLCJBdXRob3JpemF0aW9uRXJyb3JzIiwiZ2V0UHJlY2lzZVNpZ25hbGluZ0Vycm9yQnlDb2RlIiwiR2VuZXJhbEVycm9ycyIsIl9fYXdhaXRlciIsIkNsaWVudEVycm9ycyIsInF1ZXJ5VG9Kc29uIiwiSW52YWxpZFN0YXRlRXJyb3IiLCJpc0xlZ2FjeUVkZ2UiLCJOb3RTdXBwb3J0ZWRFcnJvciIsIkRpYWx0b25lUGxheWVyIiwicnRjLmVuYWJsZWQiLCJDLlBBQ0tBR0VfTkFNRSIsIlByZWZsaWdodFRlc3QiLCJJbnZhbGlkQXJndW1lbnRFcnJvciIsIkV2ZW50RW1pdHRlciIsInByb21pc2lmeUV2ZW50cyIsIl9fYXNzaWduIiwiQy5TT1VORFNfQkFTRV9VUkwiLCJzb3VuZCIsIlNvdW5kIiwiY2FsbCIsIkF1ZGlvUHJvY2Vzc29yRXZlbnRPYnNlcnZlciIsImdldFVzZXJNZWRpYSIsIkF1ZGlvSGVscGVyIiwiUHVibGlzaGVyIiwiUFN0cmVhbSJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFzREEsSUFBTSxxQkFBcUIsR0FBRyxLQUFLO0FBQ25DLElBQU0scUJBQXFCLEdBQUcsSUFBSTtBQUNsQyxJQUFNLHNCQUFzQixHQUFHLGVBQWU7QUFDOUMsSUFBTSxxQkFB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
