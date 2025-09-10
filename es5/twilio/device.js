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
            logLevel: loglevel.levels.ERROR,
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
            logLevel : loglevel.levels.ERROR;
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGV2aWNlLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2RldmljZS50cyJdLCJzb3VyY2VzQ29udGVudCI6W251bGxdLCJuYW1lcyI6WyJEZXZpY2UiLCJfX2V4dGVuZHMiLCJDYWxsIiwiZ2VuZXJhdGVWb2ljZUV2ZW50U2lkIiwiTG9nIiwicnRjLmdldE1lZGlhRW5naW5lIiwiQy5SRUxFQVNFX1ZFUlNJT04iLCJnZXRSZWdpb25TaG9ydGNvZGUiLCJyZWdpb25Ub0VkZ2UiLCJjcmVhdGVFdmVudEdhdGV3YXlVUkkiLCJnZXRDaHVuZGVyVVJJcyIsImNyZWF0ZVNpZ25hbGluZ0VuZHBvaW50VVJMIiwiQXV0aG9yaXphdGlvbkVycm9ycyIsImdldFByZWNpc2VTaWduYWxpbmdFcnJvckJ5Q29kZSIsIkdlbmVyYWxFcnJvcnMiLCJfX2F3YWl0ZXIiLCJDbGllbnRFcnJvcnMiLCJxdWVyeVRvSnNvbiIsIkludmFsaWRTdGF0ZUVycm9yIiwiaXNMZWdhY3lFZGdlIiwiTm90U3VwcG9ydGVkRXJyb3IiLCJEaWFsdG9uZVBsYXllciIsInJ0Yy5lbmFibGVkIiwiQy5QQUNLQUdFX05BTUUiLCJQcmVmbGlnaHRUZXN0IiwiSW52YWxpZEFyZ3VtZW50RXJyb3IiLCJFdmVudEVtaXR0ZXIiLCJwcm9taXNpZnlFdmVudHMiLCJfX2Fzc2lnbiIsIkMuU09VTkRTX0JBU0VfVVJMIiwic291bmQiLCJTb3VuZCIsImNhbGwiLCJBdWRpb1Byb2Nlc3NvckV2ZW50T2JzZXJ2ZXIiLCJnZXRVc2VyTWVkaWEiLCJBdWRpb0hlbHBlciIsIlB1Ymxpc2hlciIsIlBTdHJlYW0iXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFzREEsSUFBTSxxQkFBcUIsR0FBRyxLQUFLO0FBQ25DLElBQU0scUJBQXFCLEdBQUcsSUFBSTtBQUNsQyxJQUFNLHNCQUFzQixHQUFHLGVBQWU7QUFDOUMsSUFBTSxxQkFBcUIsR0FBRyw2Q0FBNkM7QUF3RzNFOztBQUVHO0FB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
