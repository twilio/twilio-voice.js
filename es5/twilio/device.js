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
                _this.register();
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
        _this._boundDestroy = _this.destroy.bind(_this);
        _this._boundConfirmClose = _this._confirmClose.bind(_this);
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('unload', _this._boundDestroy);
            window.addEventListener('pagehide', _this._boundDestroy);
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
                        if (this._activeCall) {
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
            window.removeEventListener('unload', this._boundDestroy);
            window.removeEventListener('pagehide', this._boundDestroy);
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
        // Setup close protection and make sure we clean up ongoing calls on unload.
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
                            var _a, _b, _c;
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
                            if ((_b = _this._audio) === null || _b === void 0 ? void 0 : _b.processedStream) {
                                (_c = _this._audioProcessorEventObserver) === null || _c === void 0 ? void 0 : _c.emit('enabled');
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
                var name = _a.name, group = _a.group;
                _this._publisher.info(group, name, {}, _this._activeCall);
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
