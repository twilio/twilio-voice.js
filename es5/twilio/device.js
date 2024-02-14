"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @packageDocumentation
 * @module Voice
 * @preferred
 * @publicapi
 */
var events_1 = require("events");
var loglevel_1 = require("loglevel");
var audiohelper_1 = require("./audiohelper");
var audioprocessoreventobserver_1 = require("./audioprocessoreventobserver");
var call_1 = require("./call");
var C = require("./constants");
var dialtonePlayer_1 = require("./dialtonePlayer");
var errors_1 = require("./errors");
var eventpublisher_1 = require("./eventpublisher");
var log_1 = require("./log");
var preflight_1 = require("./preflight/preflight");
var pstream_1 = require("./pstream");
var regions_1 = require("./regions");
var rtc = require("./rtc");
var getusermedia_1 = require("./rtc/getusermedia");
var sound_1 = require("./sound");
var util_1 = require("./util");
var uuid_1 = require("./uuid");
var REGISTRATION_INTERVAL = 30000;
var RINGTONE_PLAY_TIMEOUT = 2000;
var PUBLISHER_PRODUCT_NAME = 'twilio-js-sdk';
var INVALID_TOKEN_MESSAGE = 'Parameter "token" must be of type "string".';
/**
 * Twilio Device. Allows registration for incoming calls, and placing outgoing calls.
 * @publicapi
 */
var Device = /** @class */ (function (_super) {
    __extends(Device, _super);
    /**
     * Construct a {@link Device} instance. The {@link Device} can be registered
     * to make and listen for calls using {@link Device.register}.
     * @constructor
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
            codecPreferences: [call_1.default.Codec.PCMU, call_1.default.Codec.Opus],
            dscp: true,
            enableImprovedSignalingErrorPrecision: false,
            forceAggressiveIceNomination: false,
            logLevel: loglevel_1.levels.ERROR,
            maxCallSignalingTimeoutMs: 0,
            preflight: false,
            sounds: {},
            tokenRefreshMs: 10000,
            voiceEventSidGenerator: uuid_1.generateVoiceEventSid,
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
        _this._log = new log_1.default('Device');
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
                platform: rtc.getMediaEngine(),
                sdk_version: C.RELEASE_VERSION,
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
            var region = regions_1.getRegionShortcode(payload.region);
            _this._edge = payload.edge || regions_1.regionToEdge[region] || payload.region;
            _this._region = region || payload.region;
            _this._home = payload.home;
            (_a = _this._publisher) === null || _a === void 0 ? void 0 : _a.setHost(regions_1.createEventGatewayURI(payload.home));
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
            var preferredURIs = regions_1.getChunderURIs(_this._edge);
            if (preferredURIs.length > 0) {
                var preferredURI = preferredURIs[0];
                _this._preferredURI = regions_1.createSignalingEndpointURL(preferredURI);
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
                return;
            }
            var originalError = payload.error, callsid = payload.callsid;
            if (typeof originalError !== 'object') {
                return;
            }
            var call = (typeof callsid === 'string' && _this._findCall(callsid)) || undefined;
            var code = originalError.code, customMessage = originalError.message;
            var twilioError = originalError.twilioError;
            if (typeof code === 'number') {
                if (code === 31201) {
                    twilioError = new errors_1.AuthorizationErrors.AuthenticationFailed(originalError);
                }
                else if (code === 31204) {
                    twilioError = new errors_1.AuthorizationErrors.AccessTokenInvalid(originalError);
                }
                else if (code === 31205) {
                    // Stop trying to register presence after token expires
                    _this._stopRegistrationTimer();
                    twilioError = new errors_1.AuthorizationErrors.AccessTokenExpired(originalError);
                }
                else {
                    var errorConstructor = errors_1.getPreciseSignalingErrorByCode(!!_this._options.enableImprovedSignalingErrorPrecision, code);
                    if (typeof errorConstructor !== 'undefined') {
                        twilioError = new errorConstructor(originalError);
                    }
                }
            }
            if (!twilioError) {
                _this._log.error('Unknown signaling error: ', originalError);
                twilioError = new errors_1.GeneralErrors.UnknownError(customMessage, originalError);
            }
            _this._log.error('Received error: ', twilioError);
            _this._log.debug('#error', originalError);
            _this.emit(Device.EventName.Error, twilioError, call);
        };
        /**
         * Called when an 'invite' event is received from the signaling stream.
         */
        _this._onSignalingInvite = function (payload) { return __awaiter(_this, void 0, void 0, function () {
            var wasBusy, callParameters, customParameters, call, play;
            var _this = this;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        wasBusy = !!this._activeCall;
                        if (wasBusy && !this._options.allowIncomingWhileBusy) {
                            this._log.info('Device busy; ignoring incoming invite');
                            return [2 /*return*/];
                        }
                        if (!payload.callsid || !payload.sdp) {
                            this._log.debug('#error', payload);
                            this.emit(Device.EventName.Error, new errors_1.ClientErrors.BadRequest('Malformed invite from gateway'));
                            return [2 /*return*/];
                        }
                        callParameters = payload.parameters || {};
                        callParameters.CallSid = callParameters.CallSid || payload.callsid;
                        customParameters = Object.assign({}, util_1.queryToJson(callParameters.Params));
                        return [4 /*yield*/, this._makeCall(customParameters, {
                                callParameters: callParameters,
                                enableImprovedSignalingErrorPrecision: !!this._options.enableImprovedSignalingErrorPrecision,
                                offerSdp: payload.sdp,
                                reconnectToken: payload.reconnect,
                                voiceEventSidGenerator: this._options.voiceEventSidGenerator,
                            })];
                    case 1:
                        call = _b.sent();
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
                return Promise.reject(new errors_1.InvalidStateError('Cannot unset input device while a call is in progress.'));
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
                _this._publisher.info('audio', type + "-devices-set", {
                    audio_device_ids: sinkIds,
                }, _this._activeCall);
            }, function (error) {
                _this._publisher.error('audio', type + "-devices-set-failed", {
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
        if (util_1.isLegacyEdge()) {
            throw new errors_1.NotSupportedError('Microsoft Edge Legacy (https://support.microsoft.com/en-us/help/4533505/what-is-microsoft-edge-legacy) ' +
                'is deprecated and will not be able to connect to Twilio to make or receive calls after September 1st, 2020. ' +
                'Please see this documentation for a list of supported browsers ' +
                'https://www.twilio.com/docs/voice/client/javascript#supported-browsers');
        }
        if (!Device.isSupported && options.ignoreBrowserSupport) {
            if (window && window.location && window.location.protocol === 'http:') {
                throw new errors_1.NotSupportedError("twilio.js wasn't able to find WebRTC browser support.           This is most likely because this page is served over http rather than https,           which does not support WebRTC in many browsers. Please load this page over https and           try again.");
            }
            throw new errors_1.NotSupportedError("twilio.js 1.3+ SDKs require WebRTC browser support.         For more information, see <https://www.twilio.com/docs/api/client/twilio-js>.         If you have any questions about this announcement, please contact         Twilio Support at <help@twilio.com>.");
        }
        if (window) {
            var root = window;
            var browser = root.msBrowser || root.browser || root.chrome;
            _this._isBrowserExtension = (!!browser && !!browser.runtime && !!browser.runtime.id)
                || (!!root.safari && !!root.safari.extension);
        }
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
                Device._dialtonePlayer = new dialtonePlayer_1.default(Device._audioContext);
            }
        }
        if (typeof Device._isUnifiedPlanDefault === 'undefined') {
            Device._isUnifiedPlanDefault = typeof window !== 'undefined'
                && typeof RTCPeerConnection !== 'undefined'
                && typeof RTCRtpTransceiver !== 'undefined'
                ? util_1.isUnifiedPlanDefault(window, window.navigator, RTCPeerConnection, RTCRtpTransceiver)
                : false;
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
        get: function () { return rtc.enabled(); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Device, "packageName", {
        /**
         * Package name of the SDK.
         */
        get: function () { return C.PACKAGE_NAME; },
        enumerable: false,
        configurable: true
    });
    /**
     * Run some tests to identify issues, if any, prohibiting successful calling.
     * @param token - A Twilio JWT token string
     * @param options
     */
    Device.runPreflight = function (token, options) {
        return new preflight_1.PreflightTest(token, __assign({ audioContext: Device._getOrCreateAudioContext() }, options));
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
        get: function () { return C.RELEASE_VERSION; },
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
    Device.prototype.connect = function (options) {
        if (options === void 0) { options = {}; }
        return __awaiter(this, void 0, void 0, function () {
            var activeCall, _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this._log.debug('.connect', JSON.stringify(options && options.params || {}), options);
                        this._throwIfDestroyed();
                        if (this._activeCall) {
                            throw new errors_1.InvalidStateError('A Call is already active');
                        }
                        _a = this;
                        return [4 /*yield*/, this._makeCall(options.params || {}, {
                                enableImprovedSignalingErrorPrecision: !!this._options.enableImprovedSignalingErrorPrecision,
                                rtcConfiguration: options.rtcConfiguration,
                                voiceEventSidGenerator: this._options.voiceEventSidGenerator,
                            })];
                    case 1:
                        activeCall = _a._activeCall = _b.sent();
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
        this._destroyPublisher();
        this._destroyAudioHelper();
        (_a = this._audioProcessorEventObserver) === null || _a === void 0 ? void 0 : _a.destroy();
        if (this._networkInformation && typeof this._networkInformation.removeEventListener === 'function') {
            this._networkInformation.removeEventListener('change', this._publishNetworkChange);
        }
        if (typeof window !== 'undefined' && window.removeEventListener) {
            window.removeEventListener('beforeunload', this._boundConfirmClose);
            window.removeEventListener('unload', this._boundDestroy);
            window.removeEventListener('pagehide', this._boundDestroy);
        }
        this._setState(Device.State.Destroyed);
        events_1.EventEmitter.prototype.removeAllListeners.call(this);
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
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this._log.debug('.register');
                        if (this.state !== Device.State.Unregistered) {
                            throw new errors_1.InvalidStateError("Attempt to register when device is in state \"" + this.state + "\". " +
                                ("Must be \"" + Device.State.Unregistered + "\"."));
                        }
                        this._shouldReRegister = false;
                        this._setState(Device.State.Registering);
                        return [4 /*yield*/, (this._streamConnectedPromise || this._setupStream())];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this._sendPresence(true)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, util_1.promisifyEvents(this, Device.State.Registered, Device.State.Unregistered)];
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
        return __awaiter(this, void 0, void 0, function () {
            var stream, streamOfflinePromise;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this._log.debug('.unregister');
                        if (this.state !== Device.State.Registered) {
                            throw new errors_1.InvalidStateError("Attempt to unregister when device is in state \"" + this.state + "\". " +
                                ("Must be \"" + Device.State.Registered + "\"."));
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
            throw new errors_1.InvalidStateError("Attempt to \"updateOptions\" when device is in state \"" + this.state + "\".");
        }
        this._options = __assign(__assign(__assign({}, this._defaultOptions), this._options), options);
        var originalChunderURIs = new Set(this._chunderURIs);
        var chunderw = typeof this._options.chunderw === 'string'
            ? [this._options.chunderw]
            : Array.isArray(this._options.chunderw) && this._options.chunderw;
        var newChunderURIs = this._chunderURIs = (chunderw || regions_1.getChunderURIs(this._options.edge)).map(regions_1.createSignalingEndpointURL);
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
            throw new errors_1.InvalidStateError('Cannot change Edge while on an active Call');
        }
        this._setupLoglevel(this._options.logLevel);
        for (var _a = 0, _b = Object.keys(Device._defaultSounds); _a < _b.length; _a++) {
            var name_1 = _b[_a];
            var soundDef = Device._defaultSounds[name_1];
            var defaultUrl = C.SOUNDS_BASE_URL + "/" + soundDef.filename + "." + Device.extension
                + ("?cache=" + C.RELEASE_VERSION);
            var soundUrl = this._options.sounds && this._options.sounds[name_1] || defaultUrl;
            var sound = new (this._options.Sound || sound_1.default)(name_1, soundUrl, {
                audioContext: this._options.disableAudioContextSounds ? null : Device.audioContext,
                maxDuration: soundDef.maxDuration,
                shouldLoop: soundDef.shouldLoop,
            });
            this._soundcache.set(name_1, sound);
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
            throw new errors_1.InvalidStateError("Attempt to \"updateToken\" when device is in state \"" + this.state + "\".");
        }
        if (typeof token !== 'string') {
            throw new errors_1.InvalidArgumentError(INVALID_TOKEN_MESSAGE);
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
        ];
        if (typeof options === 'object') {
            var toLog_1 = __assign({}, options);
            Object.keys(toLog_1).forEach(function (key) {
                if (!userOptions.includes(key) && !userOptionOverrides.includes(key)) {
                    delete toLog_1[key];
                }
                if (userOptionOverrides.includes(key)) {
                    toLog_1[key] = true;
                }
            });
            this._log.debug("." + caller, JSON.stringify(toLog_1));
        }
    };
    /**
     * Create a new {@link Call}.
     * @param twimlParams - A flat object containing key:value pairs to be sent to the TwiML app.
     * @param options - Options to be used to instantiate the {@link Call}.
     */
    Device.prototype._makeCall = function (twimlParams, options) {
        return __awaiter(this, void 0, void 0, function () {
            var config, maybeUnsetPreferredUri, call;
            var _a;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (typeof Device._isUnifiedPlanDefault === 'undefined') {
                            throw new errors_1.InvalidStateError('Device has not been initialized.');
                        }
                        _a = {
                            audioHelper: this._audio,
                            isUnifiedPlanDefault: Device._isUnifiedPlanDefault,
                            onIgnore: function () {
                                _this._soundcache.get(Device.SoundName.Incoming).stop();
                            }
                        };
                        return [4 /*yield*/, (this._streamConnectedPromise || this._setupStream())];
                    case 1:
                        config = (_a.pstream = _b.sent(),
                            _a.publisher = this._publisher,
                            _a.soundcache = this._soundcache,
                            _a);
                        options = Object.assign({
                            MediaStream: this._options.MediaStream || rtc.PeerConnection,
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
                        call = new (this._options.Call || call_1.default)(config, options);
                        this._publisher.info('settings', 'init', {
                            RTCPeerConnection: !!this._options.RTCPeerConnection,
                            enumerateDevices: !!this._options.enumerateDevices,
                            getUserMedia: !!this._options.getUserMedia,
                        }, call);
                        call.once('accept', function () {
                            var _a, _b, _c;
                            _this._stream.updatePreferredURI(_this._preferredURI);
                            _this._removeCall(call);
                            _this._activeCall = call;
                            if (_this._audio) {
                                _this._audio._maybeStartPollingVolume();
                            }
                            if (call.direction === call_1.default.CallDirection.Outgoing && ((_a = _this._audio) === null || _a === void 0 ? void 0 : _a.outgoing())) {
                                _this._soundcache.get(Device.SoundName.Outgoing).play();
                            }
                            var data = { edge: _this._edge || _this._region };
                            if (_this._options.edge) {
                                data['selected_edge'] = Array.isArray(_this._options.edge)
                                    ? _this._options.edge
                                    : [_this._options.edge];
                            }
                            _this._publisher.info('settings', 'edge', data, call);
                            if ((_b = _this._audio) === null || _b === void 0 ? void 0 : _b.processedStream) {
                                (_c = _this._audioProcessorEventObserver) === null || _c === void 0 ? void 0 : _c.emit('enabled');
                            }
                        });
                        call.addListener('error', function (error) {
                            if (call.status() === 'closed') {
                                _this._removeCall(call);
                                maybeUnsetPreferredUri();
                            }
                            if (_this._audio) {
                                _this._audio._maybeStopPollingVolume();
                            }
                            _this._maybeStopIncomingSound();
                        });
                        call.once('cancel', function () {
                            _this._log.info("Canceled: " + call.parameters.CallSid);
                            _this._removeCall(call);
                            maybeUnsetPreferredUri();
                            if (_this._audio) {
                                _this._audio._maybeStopPollingVolume();
                            }
                            _this._maybeStopIncomingSound();
                        });
                        call.once('disconnect', function () {
                            if (_this._audio) {
                                _this._audio._maybeStopPollingVolume();
                            }
                            _this._removeCall(call);
                            maybeUnsetPreferredUri();
                            /**
                             * NOTE(kamalbennani): We need to stop the incoming sound when the call is
                             * disconnected right after the user has accepted the call (activeCall.accept()), and before
                             * the call has been fully connected (i.e. before the `pstream.answer` event)
                             */
                            _this._maybeStopIncomingSound();
                        });
                        call.once('reject', function () {
                            _this._log.info("Rejected: " + call.parameters.CallSid);
                            if (_this._audio) {
                                _this._audio._maybeStopPollingVolume();
                            }
                            _this._removeCall(call);
                            maybeUnsetPreferredUri();
                            _this._maybeStopIncomingSound();
                        });
                        call.on('transportClose', function () {
                            if (call.status() !== call_1.default.State.Pending) {
                                return;
                            }
                            if (_this._audio) {
                                _this._audio._maybeStopPollingVolume();
                            }
                            _this._removeCall(call);
                            /**
                             * NOTE(mhuynh): We don't want to call `maybeUnsetPreferredUri` because
                             * a `transportClose` will happen during signaling reconnection.
                             */
                            _this._maybeStopIncomingSound();
                        });
                        return [2 /*return*/, call];
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
        return __awaiter(this, void 0, void 0, function () {
            var stream;
            return __generator(this, function (_a) {
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
        this._log.debug("#" + name);
        this.emit(name);
    };
    /**
     * Set up an audio helper for usage by this {@link Device}.
     */
    Device.prototype._setupAudioHelper = function () {
        var _this = this;
        if (!this._audioProcessorEventObserver) {
            this._audioProcessorEventObserver = new audioprocessoreventobserver_1.AudioProcessorEventObserver();
            this._audioProcessorEventObserver.on('event', function (_a) {
                var name = _a.name, group = _a.group;
                _this._publisher.info(group, name, {}, _this._activeCall);
            });
        }
        var audioOptions = {
            audioContext: Device.audioContext,
            audioProcessorEventObserver: this._audioProcessorEventObserver,
            enumerateDevices: this._options.enumerateDevices,
            getUserMedia: this._options.getUserMedia || getusermedia_1.default,
        };
        if (this._audio) {
            this._log.info('Found existing audio helper; updating options...');
            this._audio._updateUserOptions(audioOptions);
            return;
        }
        this._audio = new (this._options.AudioHelper || audiohelper_1.default)(this._updateSinkIds, this._updateInputStream, audioOptions);
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
            logLevel : loglevel_1.levels.ERROR;
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
            publisherOptions.host = regions_1.createEventGatewayURI(this._home);
        }
        this._publisher = new (this._options.Publisher || eventpublisher_1.default)(PUBLISHER_PRODUCT_NAME, this.token, publisherOptions);
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
        this._stream = new (this._options.PStream || pstream_1.default)(this.token, this._chunderURIs, {
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
            util_1.promisifyEvents(this._stream, 'connected', 'close').then(function () { return _this._stream; });
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
            throw new errors_1.InvalidStateError('Device has been destroyed.');
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
}(events_1.EventEmitter));
(function (Device) {
    /**
     * All valid {@link Device} event names.
     */
    var EventName;
    (function (EventName) {
        EventName["Error"] = "error";
        EventName["Incoming"] = "incoming";
        EventName["Destroyed"] = "destroyed";
        EventName["Unregistered"] = "unregistered";
        EventName["Registering"] = "registering";
        EventName["Registered"] = "registered";
        EventName["TokenWillExpire"] = "tokenWillExpire";
    })(EventName = Device.EventName || (Device.EventName = {}));
    /**
     * All possible {@link Device} states.
     */
    var State;
    (function (State) {
        State["Destroyed"] = "destroyed";
        State["Unregistered"] = "unregistered";
        State["Registering"] = "registering";
        State["Registered"] = "registered";
    })(State = Device.State || (Device.State = {}));
    /**
     * Names of all sounds handled by the {@link Device}.
     */
    var SoundName;
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
    })(SoundName = Device.SoundName || (Device.SoundName = {}));
})(Device || (Device = {}));
exports.default = Device;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9kZXZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7R0FLRztBQUNILGlDQUFzQztBQUN0QyxxQ0FBNkQ7QUFDN0QsNkNBQXdDO0FBQ3hDLDZFQUE0RTtBQUM1RSwrQkFBMEI7QUFDMUIsK0JBQWlDO0FBQ2pDLG1EQUE4QztBQUM5QyxtQ0FTa0I7QUFDbEIsbURBQXlDO0FBQ3pDLDZCQUF3QjtBQUN4QixtREFBc0Q7QUFDdEQscUNBQWdDO0FBQ2hDLHFDQVFtQjtBQUNuQiwyQkFBNkI7QUFDN0IsbURBQThDO0FBQzlDLGlDQUE0QjtBQUM1QiwrQkFLZ0I7QUFDaEIsK0JBQStDO0FBZ0IvQyxJQUFNLHFCQUFxQixHQUFHLEtBQUssQ0FBQztBQUNwQyxJQUFNLHFCQUFxQixHQUFHLElBQUksQ0FBQztBQUNuQyxJQUFNLHNCQUFzQixHQUFHLGVBQWUsQ0FBQztBQUMvQyxJQUFNLHFCQUFxQixHQUFHLDZDQUE2QyxDQUFDO0FBNkc1RTs7O0dBR0c7QUFDSDtJQUFxQiwwQkFBWTtJQTRSL0I7Ozs7O09BS0c7SUFDSCxnQkFBWSxLQUFhLEVBQUUsT0FBNkI7O1FBQTdCLHdCQUFBLEVBQUEsWUFBNkI7UUFBeEQsWUFDRSxpQkFBTyxTQStFUjtRQS9QRDs7V0FFRztRQUNLLGlCQUFXLEdBQWdCLElBQUksQ0FBQztRQUV4Qzs7V0FFRztRQUNLLFlBQU0sR0FBdUIsSUFBSSxDQUFDO1FBRTFDOztXQUVHO1FBQ0ssa0NBQTRCLEdBQXVDLElBQUksQ0FBQztRQVloRjs7V0FFRztRQUNLLHNCQUFnQixHQUF1QixJQUFJLENBQUM7UUFFcEQ7OztXQUdHO1FBQ0ssWUFBTSxHQUFXLEVBQUUsQ0FBQztRQUU1Qjs7O1dBR0c7UUFDSyxrQkFBWSxHQUFh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