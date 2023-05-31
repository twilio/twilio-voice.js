"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
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
        _this._log = log_1.default.getInstance();
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
                _this._log.info('Could not parse a preferred URI from the stream#connected event.');
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
                else if (errors_1.hasErrorByCode(code)) {
                    twilioError = new (errors_1.getErrorByCode(code))(originalError);
                }
            }
            if (!twilioError) {
                _this._log.error('Unknown signaling error: ', originalError);
                twilioError = new errors_1.GeneralErrors.UnknownError(customMessage, originalError);
            }
            _this._log.info('Received error: ', twilioError);
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
                            this.emit(Device.EventName.Error, new errors_1.ClientErrors.BadRequest('Malformed invite from gateway'));
                            return [2 /*return*/];
                        }
                        callParameters = payload.parameters || {};
                        callParameters.CallSid = callParameters.CallSid || payload.callsid;
                        customParameters = Object.assign({}, util_1.queryToJson(callParameters.Params));
                        return [4 /*yield*/, this._makeCall(customParameters, {
                                callParameters: callParameters,
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
        enumerable: true,
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
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Device, "isSupported", {
        /**
         * Whether or not this SDK is supported by the current browser.
         */
        get: function () { return rtc.enabled(); },
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Device, "packageName", {
        /**
         * Package name of the SDK.
         */
        get: function () { return C.PACKAGE_NAME; },
        enumerable: true,
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
        enumerable: true,
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
        enumerable: true,
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
                        this._throwIfDestroyed();
                        if (this._activeCall) {
                            throw new errors_1.InvalidStateError('A Call is already active');
                        }
                        _a = this;
                        return [4 /*yield*/, this._makeCall(options.params || {}, {
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
        enumerable: true,
        configurable: true
    });
    /**
     * Destroy the {@link Device}, freeing references to be garbage collected.
     */
    Device.prototype.destroy = function () {
        this.disconnectAll();
        this._stopRegistrationTimer();
        if (this._audio) {
            this._audio._unbind();
        }
        this._destroyStream();
        this._destroyPublisher();
        this._destroyAudioHelper();
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
        enumerable: true,
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
        enumerable: true,
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
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Device.prototype, "isBusy", {
        /**
         * Whether the Device is currently on an active Call.
         */
        get: function () {
            return !!this._activeCall;
        },
        enumerable: true,
        configurable: true
    });
    /**
     * Register the `Device` to the Twilio backend, allowing it to receive calls.
     */
    Device.prototype.register = function () {
        return __awaiter(this, void 0, void 0, function () {
            var stream, streamReadyPromise;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (this.state !== Device.State.Unregistered) {
                            throw new errors_1.InvalidStateError("Attempt to register when device is in state \"" + this.state + "\". " +
                                ("Must be \"" + Device.State.Unregistered + "\"."));
                        }
                        this._setState(Device.State.Registering);
                        return [4 /*yield*/, (this._streamConnectedPromise || this._setupStream())];
                    case 1:
                        stream = _a.sent();
                        streamReadyPromise = new Promise(function (resolve) {
                            _this.once(Device.State.Registered, resolve);
                        });
                        return [4 /*yield*/, this._sendPresence(true)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, streamReadyPromise];
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
        enumerable: true,
        configurable: true
    });
    Object.defineProperty(Device.prototype, "token", {
        /**
         * Get the token used by this {@link Device}.
         */
        get: function () {
            return this._token;
        },
        enumerable: true,
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
        this._log.setDefaultLevel(typeof this._options.logLevel === 'number'
            ? this._options.logLevel
            : loglevel_1.levels.ERROR);
        if (this._options.dscp) {
            if (!this._options.rtcConstraints) {
                this._options.rtcConstraints = {};
            }
            this._options.rtcConstraints.optional = [{ googDscp: true }];
        }
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
        this._audio.removeAllListeners();
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
     * Create a new {@link Call}.
     * @param twimlParams - A flat object containing key:value pairs to be sent to the TwiML app.
     * @param options - Options to be used to instantiate the {@link Call}.
     */
    Device.prototype._makeCall = function (twimlParams, options) {
        return __awaiter(this, void 0, void 0, function () {
            var config, _a, maybeUnsetPreferredUri, call;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (typeof Device._isUnifiedPlanDefault === 'undefined') {
                            throw new errors_1.InvalidStateError('Device has not been initialized.');
                        }
                        _a = {
                            audioHelper: this._audio,
                            getUserMedia: this._options.getUserMedia || getusermedia_1.default,
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
                            dialtonePlayer: Device._dialtonePlayer,
                            dscp: this._options.dscp,
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
                            var _a;
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
        this.emit(this._stateEventMapping[state]);
    };
    /**
     * Set up an audio helper for usage by this {@link Device}.
     */
    Device.prototype._setupAudioHelper = function () {
        var _this = this;
        if (this._audio) {
            this._log.info('Found existing audio helper; destroying...');
            this._destroyAudioHelper();
        }
        this._audio = new (this._options.AudioHelper || audiohelper_1.default)(this._updateSinkIds, this._updateInputStream, this._options.getUserMedia || getusermedia_1.default, {
            audioContext: Device.audioContext,
            enumerateDevices: this._options.enumerateDevices,
        });
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
            log: this._log,
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
        return this._streamConnectedPromise = new Promise(function (resolve) {
            return _this._stream.once('connected', function () {
                resolve(_this._stream);
            });
        });
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
            _this._log.info(reason.message);
        }).then(function () {
            clearTimeout(timeout);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2aWNlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9kZXZpY2UudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7R0FLRztBQUNILGlDQUFzQztBQUN0QyxxQ0FBNkQ7QUFDN0QsNkNBQXdDO0FBQ3hDLCtCQUEwQjtBQUMxQiwrQkFBaUM7QUFDakMsbURBQThDO0FBQzlDLG1DQVVrQjtBQUNsQixtREFBeUM7QUFDekMsNkJBQXdCO0FBQ3hCLG1EQUFzRDtBQUN0RCxxQ0FBZ0M7QUFDaEMscUNBUW1CO0FBQ25CLDJCQUE2QjtBQUM3QixtREFBOEM7QUFDOUMsaUNBQTRCO0FBQzVCLCtCQUlnQjtBQUNoQiwrQkFBK0M7QUFnQi9DLElBQU0scUJBQXFCLEdBQUcsS0FBSyxDQUFDO0FBQ3BDLElBQU0scUJBQXFCLEdBQUcsSUFBSSxDQUFDO0FBQ25DLElBQU0sc0JBQXNCLEdBQUcsZUFBZSxDQUFDO0FBQy9DLElBQU0scUJBQXFCLEdBQUcsNkNBQTZDLENBQUM7QUE2RzVFOzs7R0FHRztBQUNIO0lBQXFCLDBCQUFZO0lBc1IvQjs7Ozs7T0FLRztJQUNILGdCQUFZLEtBQWEsRUFBRSxPQUE2Qjs7UUFBN0Isd0JBQUEsRUFBQSxZQUE2QjtRQUF4RCxZQUNFLGlCQUFPLFNBMkVSO1FBclBEOztXQUVHO1FBQ0ssaUJBQVcsR0FBZ0IsSUFBSSxDQUFDO1FBRXhDOztXQUVHO1FBQ0ssWUFBTSxHQUF1QixJQUFJLENBQUM7UUFZMUM7O1dBRUc7UUFDSyxzQkFBZ0IsR0FBdUIsSUFBSSxDQUFDO1FBRXBEOzs7V0FHRztRQUNLLFlBQU0sR0FBVyxFQUFFLENBQUM7UUFFNUI7OztXQUdHO1FBQ0ssa0JBQVksR0FBYSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRTdDOztXQUVHO1FBQ0ssa0JBQVksR0FBYSxFQUFF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