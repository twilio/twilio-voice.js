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
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @packageDocumentation
 * @module Voice
 * @publicapi
 * @internal
 */
var events_1 = require("events");
var backoff_1 = require("./backoff");
var device_1 = require("./device");
var errors_1 = require("./errors");
var log_1 = require("./log");
var rtc_1 = require("./rtc");
var icecandidate_1 = require("./rtc/icecandidate");
var sdp_1 = require("./rtc/sdp");
var statsMonitor_1 = require("./statsMonitor");
var util_1 = require("./util");
var uuid_1 = require("./uuid");
var constants_1 = require("./constants");
var BACKOFF_CONFIG = {
    factor: 1.1,
    jitter: 0.5,
    max: 30000,
    min: 1,
};
var DTMF_INTER_TONE_GAP = 70;
var DTMF_PAUSE_DURATION = 500;
var DTMF_TONE_DURATION = 160;
var METRICS_BATCH_SIZE = 10;
var METRICS_DELAY = 5000;
var MEDIA_DISCONNECT_ERROR = {
    disconnect: true,
    info: {
        code: 31003,
        message: 'Connection with Twilio was interrupted.',
        twilioError: new errors_1.MediaErrors.ConnectionError(),
    },
};
var MULTIPLE_THRESHOLD_WARNING_NAMES = {
    // The stat `packetsLostFraction` is monitored by two separate thresholds,
    // `maxAverage` and `max`. Each threshold emits a different warning name.
    packetsLostFraction: {
        max: 'packet-loss',
        maxAverage: 'packets-lost-fraction',
    },
};
var WARNING_NAMES = {
    audioInputLevel: 'audio-input-level',
    audioOutputLevel: 'audio-output-level',
    bytesReceived: 'bytes-received',
    bytesSent: 'bytes-sent',
    jitter: 'jitter',
    mos: 'mos',
    rtt: 'rtt',
};
var WARNING_PREFIXES = {
    max: 'high-',
    maxAverage: 'high-',
    maxDuration: 'constant-',
    min: 'low-',
    minStandardDeviation: 'constant-',
};
/**
 * A {@link Call} represents a media and signaling connection to a TwiML application.
 * @publicapi
 */
var Call = /** @class */ (function (_super) {
    __extends(Call, _super);
    /**
     * @constructor
     * @private
     * @param config - Mandatory configuration options
     * @param [options] - Optional settings
     */
    function Call(config, options) {
        var _this = _super.call(this) || this;
        /**
         * Call parameters received from Twilio for an incoming call.
         */
        _this.parameters = {};
        /**
         * The number of times input volume has been the same consecutively.
         */
        _this._inputVolumeStreak = 0;
        /**
         * Whether the call has been answered.
         */
        _this._isAnswered = false;
        /**
         * Whether the call has been cancelled.
         */
        _this._isCancelled = false;
        /**
         * Whether the call has been rejected
         */
        _this._isRejected = false;
        /**
         * The most recent public input volume value. 0 -> 1 representing -100 to -30 dB.
         */
        _this._latestInputVolume = 0;
        /**
         * The most recent public output volume value. 0 -> 1 representing -100 to -30 dB.
         */
        _this._latestOutputVolume = 0;
        /**
         * An instance of Logger to use.
         */
        _this._log = new log_1.default('Call');
        /**
         * State of the {@link Call}'s media.
         */
        _this._mediaStatus = Call.State.Pending;
        /**
         * A map of messages sent via sendMessage API using voiceEventSid as the key.
         * The message will be deleted once an 'ack' or an error is received from the server.
         */
        _this._messages = new Map();
        /**
         * A batch of metrics samples to send to Insights. Gets cleared after
         * each send and appended to on each new sample.
         */
        _this._metricsSamples = [];
        /**
         * Options passed to this {@link Call}.
         */
        _this._options = {
            MediaHandler: rtc_1.PeerConnection,
            enableImprovedSignalingErrorPrecision: false,
            offerSdp: null,
            shouldPlayDisconnect: function () { return true; },
            voiceEventSidGenerator: uuid_1.generateVoiceEventSid,
        };
        /**
         * The number of times output volume has been the same consecutively.
         */
        _this._outputVolumeStreak = 0;
        /**
         * Whether the {@link Call} should send a hangup on disconnect.
         */
        _this._shouldSendHangup = true;
        /**
         * State of the {@link Call}'s signaling.
         */
        _this._signalingStatus = Call.State.Pending;
        /**
         * A Map of Sounds to play.
         */
        _this._soundcache = new Map();
        /**
         * State of the {@link Call}.
         */
        _this._status = Call.State.Pending;
        /**
         * Whether the {@link Call} has been connected. Used to determine if we are reconnected.
         */
        _this._wasConnected = false;
        /**
         * String representation of {@link Call} instance.
         * @private
         */
        _this.toString = function () { return '[Twilio.Call instance]'; };
        _this._emitWarning = function (groupPrefix, warningName, threshold, value, wasCleared, warningData) {
            var groupSuffix = wasCleared ? '-cleared' : '-raised';
            var groupName = groupPrefix + "warning" + groupSuffix;
            // Ignore constant input if the Call is muted (Expected)
            if (warningName === 'constant-audio-input-level' && _this.isMuted()) {
                return;
            }
            var level = wasCleared ? 'info' : 'warning';
            // Avoid throwing false positives as warnings until we refactor volume metrics
            if (warningName === 'constant-audio-output-level') {
                level = 'info';
            }
            var payloadData = { threshold: threshold };
            if (value) {
                if (value instanceof Array) {
                    payloadData.values = value.map(function (val) {
                        if (typeof val === 'number') {
                            return Math.round(val * 100) / 100;
                        }
                        return value;
                    });
                }
                else {
                    payloadData.value = value;
                }
            }
            _this._publisher.post(level, groupName, warningName, { data: payloadData }, _this);
            if (warningName !== 'constant-audio-output-level') {
                var emitName = wasCleared ? 'warning-cleared' : 'warning';
                _this._log.debug("#" + emitName, warningName);
                _this.emit(emitName, warningName, warningData && !wasCleared ? warningData : null);
            }
        };
        /**
         * Called when the {@link Call} receives an ack from signaling
         * @param payload
         */
        _this._onAck = function (payload) {
            var acktype = payload.acktype, callsid = payload.callsid, voiceeventsid = payload.voiceeventsid;
            if (_this.parameters.CallSid !== callsid) {
                _this._log.warn("Received ack from a different callsid: " + callsid);
                return;
            }
            if (acktype === 'message') {
                _this._onMessageSent(voiceeventsid);
            }
        };
        /**
         * Called when the {@link Call} is answered.
         * @param payload
         */
        _this._onAnswer = function (payload) {
            if (typeof payload.reconnect === 'string') {
                _this._signalingReconnectToken = payload.reconnect;
            }
            // answerOnBridge=false will send a 183 which we need to catch in _onRinging when
            // the enableRingingState flag is disabled. In that case, we will receive a 200 after
            // the callee accepts the call firing a second `accept` event if we don't
            // short circuit here.
            if (_this._isAnswered && _this._status !== Call.State.Reconnecting) {
                return;
            }
            _this._setCallSid(payload);
            _this._isAnswered = true;
            _this._maybeTransitionToOpen();
        };
        /**
         * Called when the {@link Call} is cancelled.
         * @param payload
         */
        _this._onCancel = function (payload) {
            // (rrowland) Is this check necessary? Verify, and if so move to pstream / VSP module.
            var callsid = payload.callsid;
            if (_this.parameters.CallSid === callsid) {
                _this._isCancelled = true;
                _this._publisher.info('connection', 'cancel', null, _this);
                _this._cleanupEventListeners();
                _this._mediaHandler.close();
                _this._status = Call.State.Closed;
                _this._log.debug('#cancel');
                _this.emit('cancel');
                _this._pstream.removeListener('cancel', _this._onCancel);
            }
        };
        /**
         * Called when we receive a connected event from pstream.
         * Re-emits the event.
         */
        _this._onConnected = function () {
            _this._log.info('Received connected from pstream');
            if (_this._signalingReconnectToken && _this._mediaHandler.version) {
                _this._pstream.reconnect(_this._mediaHandler.version.getSDP(), _this.parameters.CallSid, _this._signalingReconnectToken);
            }
        };
        /**
         * Called when the {@link Call} is hung up.
         * @param payload
         */
        _this._onHangup = function (payload) {
            if (_this.status() === Call.State.Closed) {
                return;
            }
            /**
             *  see if callsid passed in message matches either callsid or outbound id
             *  call should always have either callsid or outbound id
             *  if no callsid passed hangup anyways
             */
            if (payload.callsid && (_this.parameters.CallSid || _this.outboundConnectionId)) {
                if (payload.callsid !== _this.parameters.CallSid
                    && payload.callsid !== _this.outboundConnectionId) {
                    return;
                }
            }
            else if (payload.callsid) {
                // hangup is for another call
                return;
            }
            _this._log.info('Received HANGUP from gateway');
            if (payload.error) {
                var code = payload.error.code;
                var errorConstructor = errors_1.getPreciseSignalingErrorByCode(_this._options.enableImprovedSignalingErrorPrecision, code);
                var error = typeof errorConstructor !== 'undefined'
                    ? new errorConstructor(payload.error.message)
                    : new errors_1.GeneralErrors.ConnectionError('Error sent from gateway in HANGUP', payload.error);
                _this._log.error('Received an error from the gateway:', error);
                _this._log.debug('#error', error);
                _this.emit('error', error);
            }
            _this._shouldSendHangup = false;
            _this._publisher.info('connection', 'disconnected-by-remote', null, _this);
            _this._disconnect(null, true);
            _this._cleanupEventListeners();
        };
        /**
         * Called when there is a media failure.
         * Manages all media-related states and takes action base on the states
         * @param type - Type of media failure
         */
        _this._onMediaFailure = function (type) {
            var _a = Call.MediaFailure, ConnectionDisconnected = _a.ConnectionDisconnected, ConnectionFailed = _a.ConnectionFailed, IceGatheringFailed = _a.IceGatheringFailed, LowBytes = _a.LowBytes;
            // These types signifies the end of a single ICE cycle
            var isEndOfIceCycle = type === ConnectionFailed || type === IceGatheringFailed;
            // All browsers except chrome doesn't update pc.iceConnectionState and pc.connectionState
            // after issuing an ICE Restart, which we use to determine if ICE Restart is complete.
            // Since we cannot detect if ICE Restart is complete, we will not retry.
            if (!util_1.isChrome(window, window.navigator) && type === ConnectionFailed) {
                return _this._mediaHandler.onerror(MEDIA_DISCONNECT_ERROR);
            }
            // Ignore subsequent requests if ice restart is in progress
            if (_this._mediaStatus === Call.State.Reconnecting) {
                // This is a retry. Previous ICE Restart failed
                if (isEndOfIceCycle) {
                    // We already exceeded max retry time.
                    if (Date.now() - _this._mediaReconnectStartTime > BACKOFF_CONFIG.max) {
                        _this._log.warn('Exceeded max ICE retries');
                        return _this._mediaHandler.onerror(MEDIA_DISCONNECT_ERROR);
                    }
                    // Issue ICE restart with backoff
                    try {
                        _this._mediaReconnectBackoff.backoff();
                    }
                    catch (error) {
                        // Catch and ignore 'Backoff in progress.' errors. If a backoff is
                        // ongoing and we try to start another one, there shouldn't be a
                        // problem.
                        if (!(error.message && error.message === 'Backoff in progress.')) {
                            throw error;
                        }
                    }
                }
                return;
            }
            var pc = _this._mediaHandler.version.pc;
            var isIceDisconnected = pc && pc.iceConnectionState === 'disconnected';
            var hasLowBytesWarning = _this._monitor.hasActiveWarning('bytesSent', 'min')
                || _this._monitor.hasActiveWarning('bytesReceived', 'min');
            // Only certain conditions can trigger media reconnection
            if ((type === LowBytes && isIceDisconnected)
                || (type === ConnectionDisconnected && hasLowBytesWarning)
                || isEndOfIceCycle) {
                var mediaReconnectionError = new errors_1.MediaErrors.ConnectionError('Media connection failed.');
                _this._log.warn('ICE Connection disconnected.');
                _this._publisher.warn('connection', 'error', mediaReconnectionError, _this);
                _this._publisher.info('connection', 'reconnecting', null, _this);
                _this._mediaReconnectStartTime = Date.now();
                _this._status = Call.State.Reconnecting;
                _this._mediaStatus = Call.State.Reconnecting;
                _this._mediaReconnectBackoff.reset();
                _this._mediaReconnectBackoff.backoff();
                _this._log.debug('#reconnecting');
                _this.emit('reconnecting', mediaReconnectionError);
            }
        };
        /**
         * Called when media call is restored
         */
        _this._onMediaReconnected = function () {
            // Only trigger once.
            // This can trigger on pc.onIceConnectionChange and pc.onConnectionChange.
            if (_this._mediaStatus !== Call.State.Reconnecting) {
                return;
            }
            _this._log.info('ICE Connection reestablished.');
            _this._mediaStatus = Call.State.Open;
            if (_this._signalingStatus === Call.State.Open) {
                _this._publisher.info('connection', 'reconnected', null, _this);
                _this._log.debug('#reconnected');
                _this.emit('reconnected');
                _this._status = Call.State.Open;
            }
        };
        /**
         * Raised when a Call receives a message from the backend.
         * @param payload - A record representing the payload of the message from the
         * Twilio backend.
         */
        _this._onMessageReceived = function (payload) {
            var callsid = payload.callsid, content = payload.content, contenttype = payload.contenttype, messagetype = payload.messagetype, voiceeventsid = payload.voiceeventsid;
            if (_this.parameters.CallSid !== callsid) {
                _this._log.warn("Received a message from a different callsid: " + callsid);
                return;
            }
            var data = {
                content: content,
                contentType: contenttype,
                messageType: messagetype,
                voiceEventSid: voiceeventsid,
            };
            _this._publisher.info('call-message', messagetype, {
                content_type: contenttype,
                event_type: 'received',
                voice_event_sid: voiceeventsid,
            }, _this);
            _this._log.debug('#messageReceived', JSON.stringify(data));
            _this.emit('messageReceived', data);
        };
        /**
         * Raised when a Call receives an 'ack' with an 'acktype' of 'message.
         * This means that the message sent via sendMessage API has been received by the signaling server.
         * @param voiceEventSid
         */
        _this._onMessageSent = function (voiceEventSid) {
            if (!_this._messages.has(voiceEventSid)) {
                _this._log.warn("Received a messageSent with a voiceEventSid that doesn't exists: " + voiceEventSid);
                return;
            }
            var message = _this._messages.get(voiceEventSid);
            _this._messages.delete(voiceEventSid);
            _this._publisher.info('call-message', message === null || message === void 0 ? void 0 : message.messageType, {
                content_type: message === null || message === void 0 ? void 0 : message.contentType,
                event_type: 'sent',
                voice_event_sid: voiceEventSid,
            }, _this);
            _this._log.debug('#messageSent', JSON.stringify(message));
            _this.emit('messageSent', message);
        };
        /**
         * When we get a RINGING signal from PStream, update the {@link Call} status.
         * @param payload
         */
        _this._onRinging = function (payload) {
            _this._setCallSid(payload);
            // If we're not in 'connecting' or 'ringing' state, this event was received out of order.
            if (_this._status !== Call.State.Connecting && _this._status !== Call.State.Ringing) {
                return;
            }
            var hasEarlyMedia = !!payload.sdp;
            _this._status = Call.State.Ringing;
            _this._publisher.info('connection', 'outgoing-ringing', { hasEarlyMedia: hasEarlyMedia }, _this);
            _this._log.debug('#ringing');
            _this.emit('ringing', hasEarlyMedia);
        };
        /**
         * Called each time StatsMonitor emits a sample.
         * Emits stats event and batches the call stats metrics and sends them to Insights.
         * @param sample
         */
        _this._onRTCSample = function (sample) {
            var callMetrics = __assign(__assign({}, sample), { inputVolume: _this._latestInputVolume, outputVolume: _this._latestOutputVolume });
            _this._codec = callMetrics.codecName;
            _this._metricsSamples.push(callMetrics);
            if (_this._metricsSamples.length >= METRICS_BATCH_SIZE) {
                _this._publishMetrics();
            }
            _this.emit('sample', sample);
        };
        /**
         * Called when an 'error' event is received from the signaling stream.
         */
        _this._onSignalingError = function (payload) {
            var callsid = payload.callsid, voiceeventsid = payload.voiceeventsid, error = payload.error;
            if (_this.parameters.CallSid !== callsid) {
                _this._log.warn("Received an error from a different callsid: " + callsid);
                return;
            }
            if (voiceeventsid && _this._messages.has(voiceeventsid)) {
                // Do not emit an error here. Device is handling all signaling related errors.
                _this._messages.delete(voiceeventsid);
                _this._log.warn("Received an error while sending a message.", payload);
                _this._publisher.error('call-message', 'error', {
                    code: error.code,
                    message: error.message,
                    voice_event_sid: voiceeventsid,
                }, _this);
                var twilioError = void 0;
                var errorConstructor = errors_1.getPreciseSignalingErrorByCode(!!_this._options.enableImprovedSignalingErrorPrecision, error.code);
                if (typeof errorConstructor !== 'undefined') {
                    twilioError = new errorConstructor(error);
                }
                if (!twilioError) {
                    _this._log.error('Unknown Call Message Error: ', error);
                    twilioError = new errors_1.GeneralErrors.UnknownError(error.message, error);
                }
                _this._log.debug('#error', error, twilioError);
                _this.emit('error', twilioError);
            }
        };
        /**
         * Called when signaling is restored
         */
        _this._onSignalingReconnected = function () {
            if (_this._signalingStatus !== Call.State.Reconnecting) {
                return;
            }
            _this._log.info('Signaling Connection reestablished.');
            _this._signalingStatus = Call.State.Open;
            if (_this._mediaStatus === Call.State.Open) {
                _this._publisher.info('connection', 'reconnected', null, _this);
                _this._log.debug('#reconnected');
                _this.emit('reconnected');
                _this._status = Call.State.Open;
            }
        };
        /**
         * Called when we receive a transportClose event from pstream.
         * Re-emits the event.
         */
        _this._onTransportClose = function () {
            _this._log.error('Received transportClose from pstream');
            _this._log.debug('#transportClose');
            _this.emit('transportClose');
            if (_this._signalingReconnectToken) {
                _this._status = Call.State.Reconnecting;
                _this._signalingStatus = Call.State.Reconnecting;
                _this._log.debug('#reconnecting');
                _this.emit('reconnecting', new errors_1.SignalingErrors.ConnectionDisconnected());
            }
            else {
                _this._status = Call.State.Closed;
                _this._signalingStatus = Call.State.Closed;
            }
        };
        /**
         * Re-emit an StatsMonitor warning as a {@link Call}.warning or .warning-cleared event.
         * @param warningData
         * @param wasCleared - Whether this is a -cleared or -raised event.
         */
        _this._reemitWarning = function (warningData, wasCleared) {
            var groupPrefix = /^audio/.test(warningData.name) ?
                'audio-level-' : 'network-quality-';
            var warningPrefix = WARNING_PREFIXES[warningData.threshold.name];
            /**
             * NOTE: There are two "packet-loss" warnings: `high-packet-loss` and
             * `high-packets-lost-fraction`, so in this case we need to use a different
             * `WARNING_NAME` mapping.
             */
            var warningName;
            if (warningData.name in MULTIPLE_THRESHOLD_WARNING_NAMES) {
                warningName = MULTIPLE_THRESHOLD_WARNING_NAMES[warningData.name][warningData.threshold.name];
            }
            else if (warningData.name in WARNING_NAMES) {
                warningName = WARNING_NAMES[warningData.name];
            }
            var warning = warningPrefix + warningName;
            _this._emitWarning(groupPrefix, warning, warningData.threshold.value, warningData.values || warningData.value, wasCleared, warningData);
        };
        /**
         * Re-emit an StatsMonitor warning-cleared as a .warning-cleared event.
         * @param warningData
         */
        _this._reemitWarningCleared = function (warningData) {
            _this._reemitWarning(warningData, true);
        };
        _this._isUnifiedPlanDefault = config.isUnifiedPlanDefault;
        _this._soundcache = config.soundcache;
        if (typeof config.onIgnore === 'function') {
            _this._onIgnore = config.onIgnore;
        }
        var message = options && options.twimlParams || {};
        _this.customParameters = new Map(Object.entries(message).map(function (_a) {
            var key = _a[0], val = _a[1];
            return [key, String(val)];
        }));
        Object.assign(_this._options, options);
        if (_this._options.callParameters) {
            _this.parameters = _this._options.callParameters;
        }
        if (_this._options.reconnectToken) {
            _this._signalingReconnectToken = _this._options.reconnectToken;
        }
        _this._voiceEventSidGenerator =
            _this._options.voiceEventSidGenerator || uuid_1.generateVoiceEventSid;
        _this._direction = _this.parameters.CallSid && !_this._options.reconnectCallSid ?
            Call.CallDirection.Incoming : Call.CallDirection.Outgoing;
        if (_this.parameters) {
            _this.callerInfo = _this.parameters.StirStatus
                ? { isVerified: _this.parameters.StirStatus === 'TN-Validation-Passed-A' }
                : null;
        }
        else {
            _this.callerInfo = null;
        }
        _this._mediaReconnectBackoff = new backoff_1.default(BACKOFF_CONFIG);
        _this._mediaReconnectBackoff.on('ready', function () { return _this._mediaHandler.iceRestart(); });
        // temporary call sid to be used for outgoing calls
        _this.outboundConnectionId = generateTempCallSid();
        var publisher = _this._publisher = config.publisher;
        if (_this._direction === Call.CallDirection.Incoming) {
            publisher.info('connection', 'incoming', null, _this);
        }
        else {
            publisher.info('connection', 'outgoing', {
                preflight: _this._options.preflight,
                reconnect: !!_this._options.reconnectCallSid,
            }, _this);
        }
        var monitor = _this._monitor = new (_this._options.StatsMonitor || statsMonitor_1.default)();
        monitor.on('sample', _this._onRTCSample);
        // First 20 seconds or so are choppy, so let's not bother with these warnings.
        monitor.disableWarnings();
        setTimeout(function () { return monitor.enableWarnings(); }, METRICS_DELAY);
        monitor.on('warning', function (data, wasCleared) {
            if (data.name === 'bytesSent' || data.name === 'bytesReceived') {
                _this._onMediaFailure(Call.MediaFailure.LowBytes);
            }
            _this._reemitWarning(data, wasCleared);
        });
        monitor.on('warning-cleared', function (data) {
            _this._reemitWarningCleared(data);
        });
        _this._mediaHandler = new (_this._options.MediaHandler)(config.audioHelper, config.pstream, {
            RTCPeerConnection: _this._options.RTCPeerConnection,
            codecPreferences: _this._options.codecPreferences,
            dscp: _this._options.dscp,
            forceAggressiveIceNomination: _this._options.forceAggressiveIceNomination,
            isUnifiedPlan: _this._isUnifiedPlanDefault,
            maxAverageBitrate: _this._options.maxAverageBitrate,
        });
        _this.on('volume', function (inputVolume, outputVolume) {
            _this._inputVolumeStreak = _this._checkVolume(inputVolume, _this._inputVolumeStreak, _this._latestInputVolume, 'input');
            _this._outputVolumeStreak = _this._checkVolume(outputVolume, _this._outputVolumeStreak, _this._latestOutputVolume, 'output');
            _this._latestInputVolume = inputVolume;
            _this._latestOutputVolume = outputVolume;
        });
        _this._mediaHandler.onaudio = function (remoteAudio) {
            _this._log.debug('#audio');
            _this.emit('audio', remoteAudio);
        };
        _this._mediaHandler.onvolume = function (inputVolume, outputVolume, internalInputVolume, internalOutputVolume) {
            // (rrowland) These values mock the 0 -> 32767 format used by legacy getStats. We should look into
            // migrating to a newer standard, either 0.0 -> linear or -127 to 0 in dB, matching the range
            // chosen below.
            monitor.addVolumes((internalInputVolume / 255) * 32767, (internalOutputVolume / 255) * 32767);
            // (rrowland) 0.0 -> 1.0 linear
            _this.emit('volume', inputVolume, outputVolume);
        };
        _this._mediaHandler.ondtlstransportstatechange = function (state) {
            var level = state === 'failed' ? 'error' : 'debug';
            _this._publisher.post(level, 'dtls-transport-state', state, null, _this);
        };
        _this._mediaHandler.onpcconnectionstatechange = function (state) {
            var level = 'debug';
            var dtlsTransport = _this._mediaHandler.getRTCDtlsTransport();
            if (state === 'failed') {
                level = dtlsTransport && dtlsTransport.state === 'failed' ? 'error' : 'warning';
            }
            _this._publisher.post(level, 'pc-connection-state', state, null, _this);
        };
        _this._mediaHandler.onicecandidate = function (candidate) {
            var payload = new icecandidate_1.IceCandidate(candidate).toPayload();
            _this._publisher.debug('ice-candidate', 'ice-candidate', payload, _this);
        };
        _this._mediaHandler.onselectedcandidatepairchange = function (pair) {
            var localCandidatePayload = new icecandidate_1.IceCandidate(pair.local).toPayload();
            var remoteCandidatePayload = new icecandidate_1.IceCandidate(pair.remote, true).toPayload();
            _this._publisher.debug('ice-candidate', 'selected-ice-candidate-pair', {
                local_candidate: localCandidatePayload,
                remote_candidate: remoteCandidatePayload,
            }, _this);
        };
        _this._mediaHandler.oniceconnectionstatechange = function (state) {
            var level = state === 'failed' ? 'error' : 'debug';
            _this._publisher.post(level, 'ice-connection-state', state, null, _this);
        };
        _this._mediaHandler.onicegatheringfailure = function (type) {
            _this._publisher.warn('ice-gathering-state', type, null, _this);
            _this._onMediaFailure(Call.MediaFailure.IceGatheringFailed);
        };
        _this._mediaHandler.onicegatheringstatechange = function (state) {
            _this._publisher.debug('ice-gathering-state', state, null, _this);
        };
        _this._mediaHandler.onsignalingstatechange = function (state) {
            _this._publisher.debug('signaling-state', state, null, _this);
        };
        _this._mediaHandler.ondisconnected = function (msg) {
            _this._log.warn(msg);
            _this._publisher.warn('network-quality-warning-raised', 'ice-connectivity-lost', {
                message: msg,
            }, _this);
            _this._log.debug('#warning', 'ice-connectivity-lost');
            _this.emit('warning', 'ice-connectivity-lost');
            _this._onMediaFailure(Call.MediaFailure.ConnectionDisconnected);
        };
        _this._mediaHandler.onfailed = function (msg) {
            _this._onMediaFailure(Call.MediaFailure.ConnectionFailed);
        };
        _this._mediaHandler.onconnected = function () {
            // First time _mediaHandler is connected, but ICE Gathering issued an ICE restart and succeeded.
            if (_this._status === Call.State.Reconnecting) {
                _this._onMediaReconnected();
            }
        };
        _this._mediaHandler.onreconnected = function (msg) {
            _this._log.info(msg);
            _this._publisher.info('network-quality-warning-cleared', 'ice-connectivity-lost', {
                message: msg,
            }, _this);
            _this._log.debug('#warning-cleared', 'ice-connectivity-lost');
            _this.emit('warning-cleared', 'ice-connectivity-lost');
            _this._onMediaReconnected();
        };
        _this._mediaHandler.onerror = function (e) {
            if (e.disconnect === true) {
                _this._disconnect(e.info && e.info.message);
            }
            var error = e.info.twilioError || new errors_1.GeneralErrors.UnknownError(e.info.message);
            _this._log.error('Received an error from MediaStream:', e);
            _this._log.debug('#error', error);
            _this.emit('error', error);
        };
        _this._mediaHandler.onopen = function () {
            // NOTE(mroberts): While this may have been happening in previous
            // versions of Chrome, since Chrome 45 we have seen the
            // PeerConnection's onsignalingstatechange handler invoked multiple
            // times in the same signalingState 'stable'. When this happens, we
            // invoke this onopen function. If we invoke it twice without checking
            // for _status 'open', we'd accidentally close the PeerConnection.
            //
            // See <https://code.google.com/p/webrtc/issues/detail?id=4996>.
            if (_this._status === Call.State.Open || _this._status === Call.State.Reconnecting) {
                return;
            }
            else if (_this._status === Call.State.Ringing || _this._status === Call.State.Connecting) {
                _this.mute(_this._mediaHandler.isMuted);
                _this._mediaStatus = Call.State.Open;
                _this._maybeTransitionToOpen();
            }
            else {
                // call was probably canceled sometime before this
                _this._mediaHandler.close();
            }
        };
        _this._mediaHandler.onclose = function () {
            _this._status = Call.State.Closed;
            if (_this._options.shouldPlayDisconnect && _this._options.shouldPlayDisconnect()
                // Don't play disconnect sound if this was from a cancel event. i.e. the call
                // was ignored or hung up even before it was answered.
                // Similarly, don't play disconnect sound if the call was rejected.
                && !_this._isCancelled && !_this._isRejected) {
                _this._soundcache.get(device_1.default.SoundName.Disconnect).play();
            }
            monitor.disable();
            _this._publishMetrics();
            if (!_this._isCancelled && !_this._isRejected) {
                // tslint:disable no-console
                _this._log.debug('#disconnect');
                _this.emit('disconnect', _this);
            }
        };
        _this._pstream = config.pstream;
        _this._pstream.on('ack', _this._onAck);
        _this._pstream.on('cancel', _this._onCancel);
        _this._pstream.on('error', _this._onSignalingError);
        _this._pstream.on('ringing', _this._onRinging);
        _this._pstream.on('transportClose', _this._onTransportClose);
        _this._pstream.on('connected', _this._onConnected);
        _this._pstream.on('message', _this._onMessageReceived);
        _this.on('error', function (error) {
            _this._publisher.error('connection', 'error', {
                code: error.code, message: error.message,
            }, _this);
            if (_this._pstream && _this._pstream.status === 'disconnected') {
                _this._cleanupEventListeners();
            }
        });
        _this.on('disconnect', function () {
            _this._cleanupEventListeners();
        });
        return _this;
    }
    Object.defineProperty(Call.prototype, "direction", {
        /**
         * Whether this {@link Call} is incoming or outgoing.
         */
        get: function () {
            return this._direction;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Call.prototype, "codec", {
        /**
         * Audio codec used for this {@link Call}. Expecting {@link Call.Codec} but
         * will copy whatever we get from RTC stats.
         */
        get: function () {
            return this._codec;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Call.prototype, "connectToken", {
        /**
         * The connect token is available as soon as the call is established
         * and connected to Twilio. Use this token to reconnect to a call via the {@link Device.connect}
         * method.
         *
         * For incoming calls, it is available in the call object after the {@link Device.incomingEvent} is emitted.
         * For outgoing calls, it is available after the {@link Call.acceptEvent} is emitted.
         */
        get: function () {
            var _this = this;
            var signalingReconnectToken = this._signalingReconnectToken;
            var callSid = this.parameters && this.parameters.CallSid ? this.parameters.CallSid : undefined;
            if (!signalingReconnectToken || !callSid) {
                return;
            }
            var customParameters = this.customParameters && typeof this.customParameters.keys === 'function' ?
                Array.from(this.customParameters.keys()).reduce(function (result, key) {
                    result[key] = _this.customParameters.get(key);
                    return result;
                }, {}) : {};
            var parameters = this.parameters || {};
            return btoa(encodeURIComponent(JSON.stringify({
                customParameters: customParameters,
                parameters: parameters,
                signalingReconnectToken: signalingReconnectToken,
            })));
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Set the audio input tracks from a given stream.
     * @param stream
     * @private
     */
    Call.prototype._setInputTracksFromStream = function (stream) {
        return this._mediaHandler.setInputTracksFromStream(stream);
    };
    /**
     * Set the audio output sink IDs.
     * @param sinkIds
     * @private
     */
    Call.prototype._setSinkIds = function (sinkIds) {
        return this._mediaHandler._setSinkIds(sinkIds);
    };
    /**
     * Accept the incoming {@link Call}.
     * @param [options]
     */
    Call.prototype.accept = function (options) {
        var _this = this;
        this._log.debug('.accept', options);
        if (this._status !== Call.State.Pending) {
            this._log.debug(".accept noop. status is '" + this._status + "'");
            return;
        }
        options = options || {};
        var rtcConfiguration = options.rtcConfiguration || this._options.rtcConfiguration;
        var rtcConstraints = options.rtcConstraints || this._options.rtcConstraints || {};
        var audioConstraints = {
            audio: typeof rtcConstraints.audio !== 'undefined' ? rtcConstraints.audio : true,
        };
        this._status = Call.State.Connecting;
        var connect = function () {
            if (_this._status !== Call.State.Connecting) {
                // call must have been canceled
                _this._cleanupEventListeners();
                _this._mediaHandler.close();
                return;
            }
            var onAnswer = function (pc) {
                // Report that the call was answered, and directionality
                var eventName = _this._direction === Call.CallDirection.Incoming
                    ? 'accepted-by-local'
                    : 'accepted-by-remote';
                _this._publisher.info('connection', eventName, null, _this);
                // Report the preferred codec and params as they appear in the SDP
                var _a = sdp_1.getPreferredCodecInfo(_this._mediaHandler.version.getSDP()), codecName = _a.codecName, codecParams = _a.codecParams;
                _this._publisher.info('settings', 'codec', {
                    codec_params: codecParams,
                    selected_codec: codecName,
                }, _this);
                // Enable RTC monitoring
                _this._monitor.enable(pc);
            };
            var sinkIds = typeof _this._options.getSinkIds === 'function' && _this._options.getSinkIds();
            if (Array.isArray(sinkIds)) {
                _this._mediaHandler._setSinkIds(sinkIds).catch(function () {
                    // (rrowland) We don't want this to throw to console since the customer
                    // can't control this. This will most commonly be rejected on browsers
                    // that don't support setting sink IDs.
                });
            }
            _this._pstream.addListener('hangup', _this._onHangup);
            if (_this._direction === Call.CallDirection.Incoming) {
                _this._isAnswered = true;
                _this._pstream.on('answer', _this._onAnswer);
                _this._mediaHandler.answerIncomingCall(_this.parameters.CallSid, _this._options.offerSdp, rtcConfiguration, onAnswer);
            }
            else {
                var params = Array.from(_this.customParameters.entries()).map(function (pair) {
                    return encodeURIComponent(pair[0]) + "=" + encodeURIComponent(pair[1]);
                }).join('&');
                _this._pstream.on('answer', _this._onAnswer);
                _this._mediaHandler.makeOutgoingCall(params, _this._signalingReconnectToken, _this._options.reconnectCallSid || _this.outboundConnectionId, rtcConfiguration, onAnswer);
            }
        };
        if (this._options.beforeAccept) {
            this._options.beforeAccept(this);
        }
        var inputStream = typeof this._options.getInputStream === 'function' && this._options.getInputStream();
        var promise = inputStream
            ? this._mediaHandler.setInputTracksFromStream(inputStream)
            : this._mediaHandler.openDefaultDeviceWithConstraints(audioConstraints);
        promise.then(function () {
            _this._publisher.info('get-user-media', 'succeeded', {
                data: { audioConstraints: audioConstraints },
            }, _this);
            connect();
        }, function (error) {
            var twilioError;
            if (error.code === 31208
                || ['PermissionDeniedError', 'NotAllowedError'].indexOf(error.name) !== -1) {
                twilioError = new errors_1.UserMediaErrors.PermissionDeniedError();
                _this._publisher.error('get-user-media', 'denied', {
                    data: {
                        audioConstraints: audioConstraints,
                        error: error,
                    },
                }, _this);
            }
            else {
                twilioError = new errors_1.UserMediaErrors.AcquisitionFailedError();
                _this._publisher.error('get-user-media', 'failed', {
                    data: {
                        audioConstraints: audioConstraints,
                        error: error,
                    },
                }, _this);
            }
            _this._disconnect();
            _this._log.debug('#error', error);
            _this.emit('error', twilioError);
        });
    };
    /**
     * Disconnect from the {@link Call}.
     */
    Call.prototype.disconnect = function () {
        this._log.debug('.disconnect');
        this._disconnect();
    };
    /**
     * Get the local MediaStream, if set.
     */
    Call.prototype.getLocalStream = function () {
        return this._mediaHandler && this._mediaHandler.stream;
    };
    /**
     * Get the remote MediaStream, if set.
     */
    Call.prototype.getRemoteStream = function () {
        return this._mediaHandler && this._mediaHandler._remoteStream;
    };
    /**
     * Ignore the incoming {@link Call}.
     */
    Call.prototype.ignore = function () {
        this._log.debug('.ignore');
        if (this._status !== Call.State.Pending) {
            this._log.debug(".ignore noop. status is '" + this._status + "'");
            return;
        }
        this._status = Call.State.Closed;
        this._mediaHandler.ignore(this.parameters.CallSid);
        this._publisher.info('connection', 'ignored-by-local', null, this);
        if (this._onIgnore) {
            this._onIgnore();
        }
    };
    /**
     * Check whether call is muted
     */
    Call.prototype.isMuted = function () {
        return this._mediaHandler.isMuted;
    };
    /**
     * Mute incoming audio.
     * @param shouldMute - Whether the incoming audio should be muted. Defaults to true.
     */
    Call.prototype.mute = function (shouldMute) {
        if (shouldMute === void 0) { shouldMute = true; }
        this._log.debug('.mute', shouldMute);
        var wasMuted = this._mediaHandler.isMuted;
        this._mediaHandler.mute(shouldMute);
        var isMuted = this._mediaHandler.isMuted;
        if (wasMuted !== isMuted) {
            this._publisher.info('connection', isMuted ? 'muted' : 'unmuted', null, this);
            this._log.debug('#mute', isMuted);
            this.emit('mute', isMuted, this);
        }
    };
    /**
     * Post an event to Endpoint Analytics indicating that the end user
     *   has given call quality feedback. Called without a score, this
     *   will report that the customer declined to give feedback.
     * @param score - The end-user's rating of the call; an
     *   integer 1 through 5. Or undefined if the user declined to give
     *   feedback.
     * @param issue - The primary issue the end user
     *   experienced on the call. Can be: ['one-way-audio', 'choppy-audio',
     *   'dropped-call', 'audio-latency', 'noisy-call', 'echo']
     */
    Call.prototype.postFeedback = function (score, issue) {
        if (typeof score === 'undefined' || score === null) {
            return this._postFeedbackDeclined();
        }
        if (!Object.values(Call.FeedbackScore).includes(score)) {
            throw new errors_1.InvalidArgumentError("Feedback score must be one of: " + Object.values(Call.FeedbackScore));
        }
        if (typeof issue !== 'undefined' && issue !== null && !Object.values(Call.FeedbackIssue).includes(issue)) {
            throw new errors_1.InvalidArgumentError("Feedback issue must be one of: " + Object.values(Call.FeedbackIssue));
        }
        return this._publisher.info('feedback', 'received', {
            issue_name: issue,
            quality_score: score,
        }, this, true);
    };
    /**
     * Reject the incoming {@link Call}.
     */
    Call.prototype.reject = function () {
        this._log.debug('.reject');
        if (this._status !== Call.State.Pending) {
            this._log.debug(".reject noop. status is '" + this._status + "'");
            return;
        }
        this._isRejected = true;
        this._pstream.reject(this.parameters.CallSid);
        this._mediaHandler.reject(this.parameters.CallSid);
        this._publisher.info('connection', 'rejected-by-local', null, this);
        this._cleanupEventListeners();
        this._mediaHandler.close();
        this._status = Call.State.Closed;
        this._log.debug('#reject');
        this.emit('reject');
    };
    /**
     * Send a string of digits.
     * @param digits
     */
    Call.prototype.sendDigits = function (digits) {
        var _this = this;
        this._log.debug('.sendDigits', digits);
        if (digits.match(/[^0-9*#w]/)) {
            throw new errors_1.InvalidArgumentError('Illegal character passed into sendDigits');
        }
        var customSounds = this._options.customSounds || {};
        var sequence = [];
        digits.split('').forEach(function (digit) {
            var dtmf = (digit !== 'w') ? "dtmf" + digit : '';
            if (dtmf === 'dtmf*') {
                dtmf = 'dtmfs';
            }
            if (dtmf === 'dtmf#') {
                dtmf = 'dtmfh';
            }
            sequence.push(dtmf);
        });
        var playNextDigit = function () {
            var digit = sequence.shift();
            if (digit) {
                if (_this._options.dialtonePlayer && !customSounds[digit]) {
                    _this._options.dialtonePlayer.play(digit);
                }
                else {
                    _this._soundcache.get(digit).play();
                }
            }
            if (sequence.length) {
                setTimeout(function () { return playNextDigit(); }, 200);
            }
        };
        playNextDigit();
        var dtmfSender = this._mediaHandler.getOrCreateDTMFSender();
        function insertDTMF(dtmfs) {
            if (!dtmfs.length) {
                return;
            }
            var dtmf = dtmfs.shift();
            if (dtmf && dtmf.length) {
                dtmfSender.insertDTMF(dtmf, DTMF_TONE_DURATION, DTMF_INTER_TONE_GAP);
            }
            setTimeout(insertDTMF.bind(null, dtmfs), DTMF_PAUSE_DURATION);
        }
        if (dtmfSender) {
            if (!('canInsertDTMF' in dtmfSender) || dtmfSender.canInsertDTMF) {
                this._log.info('Sending digits using RTCDTMFSender');
                // NOTE(mroberts): We can't just map 'w' to ',' since
                // RTCDTMFSender's pause duration is 2 s and Twilio's is more
                // like 500 ms. Instead, we will fudge it with setTimeout.
                insertDTMF(digits.split('w'));
                return;
            }
            this._log.info('RTCDTMFSender cannot insert DTMF');
        }
        // send pstream message to send DTMF
        this._log.info('Sending digits over PStream');
        if (this._pstream !== null && this._pstream.status !== 'disconnected') {
            this._pstream.dtmf(this.parameters.CallSid, digits);
        }
        else {
            var error = new errors_1.GeneralErrors.ConnectionError('Could not send DTMF: Signaling channel is disconnected');
            this._log.debug('#error', error);
            this.emit('error', error);
        }
    };
    /**
     * Send a message to Twilio. Your backend application can listen for these
     * messages to allow communication between your frontend and backend applications.
     * <br/><br/>This feature is currently in Beta.
     * @param message - The message object to send.
     * @returns A voice event sid that uniquely identifies the message that was sent.
     */
    Call.prototype.sendMessage = function (message) {
        this._log.debug('.sendMessage', JSON.stringify(message));
        var content = message.content, contentType = message.contentType, messageType = message.messageType;
        if (typeof content === 'undefined' || content === null) {
            throw new errors_1.InvalidArgumentError('`content` is empty');
        }
        if (typeof messageType !== 'string') {
            throw new errors_1.InvalidArgumentError('`messageType` must be a string.');
        }
        if (messageType.length === 0) {
            throw new errors_1.InvalidArgumentError('`messageType` must be a non-empty string.');
        }
        if (this._pstream === null) {
            throw new errors_1.InvalidStateError('Could not send CallMessage; Signaling channel is disconnected');
        }
        var callSid = this.parameters.CallSid;
        if (typeof this.parameters.CallSid === 'undefined') {
            throw new errors_1.InvalidStateError('Could not send CallMessage; Call has no CallSid');
        }
        var voiceEventSid = this._voiceEventSidGenerator();
        this._messages.set(voiceEventSid, { content: content, contentType: contentType, messageType: messageType, voiceEventSid: voiceEventSid });
        this._pstream.sendMessage(callSid, content, contentType, messageType, voiceEventSid);
        return voiceEventSid;
    };
    /**
     * Get the current {@link Call} status.
     */
    Call.prototype.status = function () {
        return this._status;
    };
    /**
     * Check the volume passed, emitting a warning if one way audio is detected or cleared.
     * @param currentVolume - The current volume for this direction
     * @param streakFieldName - The name of the field on the {@link Call} object that tracks how many times the
     *   current value has been repeated consecutively.
     * @param lastValueFieldName - The name of the field on the {@link Call} object that tracks the most recent
     *   volume for this direction
     * @param direction - The directionality of this audio track, either 'input' or 'output'
     * @returns The current streak; how many times in a row the same value has been polled.
     */
    Call.prototype._checkVolume = function (currentVolume, currentStreak, lastValue, direction) {
        var wasWarningRaised = currentStreak >= 10;
        var newStreak = 0;
        if (lastValue === currentVolume) {
            newStreak = currentStreak;
        }
        if (newStreak >= 10) {
            this._emitWarning('audio-level-', "constant-audio-" + direction + "-level", 10, newStreak, false);
        }
        else if (wasWarningRaised) {
            this._emitWarning('audio-level-', "constant-audio-" + direction + "-level", 10, newStreak, true);
        }
        return newStreak;
    };
    /**
     * Clean up event listeners.
     */
    Call.prototype._cleanupEventListeners = function () {
        var _this = this;
        var cleanup = function () {
            if (!_this._pstream) {
                return;
            }
            _this._pstream.removeListener('ack', _this._onAck);
            _this._pstream.removeListener('answer', _this._onAnswer);
            _this._pstream.removeListener('cancel', _this._onCancel);
            _this._pstream.removeListener('error', _this._onSignalingError);
            _this._pstream.removeListener('hangup', _this._onHangup);
            _this._pstream.removeListener('ringing', _this._onRinging);
            _this._pstream.removeListener('transportClose', _this._onTransportClose);
            _this._pstream.removeListener('connected', _this._onConnected);
            _this._pstream.removeListener('message', _this._onMessageReceived);
        };
        // This is kind of a hack, but it lets us avoid rewriting more code.
        // Basically, there's a sequencing problem with the way PeerConnection raises
        // the
        //
        //   Cannot establish call. SDK is disconnected
        //
        // error in Call#accept. It calls PeerConnection#onerror, which emits
        // the error event on Call. An error handler on Call then calls
        // cleanupEventListeners, but then control returns to Call#accept. It's
        // at this point that we add a listener for the answer event that never gets
        // removed. setTimeout will allow us to rerun cleanup again, _after_
        // Call#accept returns.
        cleanup();
        setTimeout(cleanup, 0);
    };
    /**
     * Create the payload wrapper for a batch of metrics to be sent to Insights.
     */
    Call.prototype._createMetricPayload = function () {
        var payload = {
            call_sid: this.parameters.CallSid,
            dscp: !!this._options.dscp,
            sdk_version: constants_1.RELEASE_VERSION,
        };
        if (this._options.gateway) {
            payload.gateway = this._options.gateway;
        }
        payload.direction = this._direction;
        return payload;
    };
    /**
     * Disconnect the {@link Call}.
     * @param message - A message explaining why the {@link Call} is being disconnected.
     * @param wasRemote - Whether the disconnect was triggered locally or remotely.
     */
    Call.prototype._disconnect = function (message, wasRemote) {
        message = typeof message === 'string' ? message : null;
        if (this._status !== Call.State.Open
            && this._status !== Call.State.Connecting
            && this._status !== Call.State.Reconnecting
            && this._status !== Call.State.Ringing) {
            return;
        }
        this._log.info('Disconnecting...');
        // send pstream hangup message
        if (this._pstream !== null && this._pstream.status !== 'disconnected' && this._shouldSendHangup) {
            var callsid = this.parameters.CallSid || this.outboundConnectionId;
            if (callsid) {
                this._pstream.hangup(callsid, message);
            }
        }
        this._cleanupEventListeners();
        this._mediaHandler.close();
        if (!wasRemote) {
            this._publisher.info('connection', 'disconnected-by-local', null, this);
        }
    };
    /**
     * Transition to {@link CallStatus.Open} if criteria is met.
     */
    Call.prototype._maybeTransitionToOpen = function () {
        var wasConnected = this._wasConnected;
        if (this._isAnswered) {
            this._onSignalingReconnected();
            this._signalingStatus = Call.State.Open;
            if (this._mediaHandler && this._mediaHandler.status === 'open') {
                this._status = Call.State.Open;
                if (!this._wasConnected) {
                    this._wasConnected = true;
                    this._log.debug('#accept');
                    this.emit('accept', this);
                }
            }
        }
    };
    /**
     * Post an event to Endpoint Analytics indicating that the end user
     *   has ignored a request for feedback.
     */
    Call.prototype._postFeedbackDeclined = function () {
        return this._publisher.info('feedback', 'received-none', null, this, true);
    };
    /**
     * Publish the current set of queued metrics samples to Insights.
     */
    Call.prototype._publishMetrics = function () {
        var _this = this;
        if (this._metricsSamples.length === 0) {
            return;
        }
        this._publisher.postMetrics('quality-metrics-samples', 'metrics-sample', this._metricsSamples.splice(0), this._createMetricPayload(), this).catch(function (e) {
            _this._log.warn('Unable to post metrics to Insights. Received error:', e);
        });
    };
    /**
     * Set the CallSid
     * @param payload
     */
    Call.prototype._setCallSid = function (payload) {
        var callSid = payload.callsid;
        if (!callSid) {
            return;
        }
        this.parameters.CallSid = callSid;
        this._mediaHandler.callSid = callSid;
    };
    /**
     * String representation of the {@link Call} class.
     * @private
     */
    Call.toString = function () { return '[Twilio.Call class]'; };
    return Call;
}(events_1.EventEmitter));
(function (Call) {
    /**
     * Possible states of the {@link Call}.
     */
    var State;
    (function (State) {
        State["Closed"] = "closed";
        State["Connecting"] = "connecting";
        State["Open"] = "open";
        State["Pending"] = "pending";
        State["Reconnecting"] = "reconnecting";
        State["Ringing"] = "ringing";
    })(State = Call.State || (Call.State = {}));
    /**
     * Different issues that may have been experienced during a call, that can be
     * reported to Twilio Insights via {@link Call}.postFeedback().
     */
    var FeedbackIssue;
    (function (FeedbackIssue) {
        FeedbackIssue["AudioLatency"] = "audio-latency";
        FeedbackIssue["ChoppyAudio"] = "choppy-audio";
        FeedbackIssue["DroppedCall"] = "dropped-call";
        FeedbackIssue["Echo"] = "echo";
        FeedbackIssue["NoisyCall"] = "noisy-call";
        FeedbackIssue["OneWayAudio"] = "one-way-audio";
    })(FeedbackIssue = Call.FeedbackIssue || (Call.FeedbackIssue = {}));
    /**
     * A rating of call quality experienced during a call, to be reported to Twilio Insights
     * via {@link Call}.postFeedback().
     */
    var FeedbackScore;
    (function (FeedbackScore) {
        FeedbackScore[FeedbackScore["One"] = 1] = "One";
        FeedbackScore[FeedbackScore["Two"] = 2] = "Two";
        FeedbackScore[FeedbackScore["Three"] = 3] = "Three";
        FeedbackScore[FeedbackScore["Four"] = 4] = "Four";
        FeedbackScore[FeedbackScore["Five"] = 5] = "Five";
    })(FeedbackScore = Call.FeedbackScore || (Call.FeedbackScore = {}));
    /**
     * The directionality of the {@link Call}, whether incoming or outgoing.
     */
    var CallDirection;
    (function (CallDirection) {
        CallDirection["Incoming"] = "INCOMING";
        CallDirection["Outgoing"] = "OUTGOING";
    })(CallDirection = Call.CallDirection || (Call.CallDirection = {}));
    /**
     * Valid audio codecs to use for the media connection.
     */
    var Codec;
    (function (Codec) {
        Codec["Opus"] = "opus";
        Codec["PCMU"] = "pcmu";
    })(Codec = Call.Codec || (Call.Codec = {}));
    /**
     * Possible ICE Gathering failures
     */
    var IceGatheringFailureReason;
    (function (IceGatheringFailureReason) {
        IceGatheringFailureReason["None"] = "none";
        IceGatheringFailureReason["Timeout"] = "timeout";
    })(IceGatheringFailureReason = Call.IceGatheringFailureReason || (Call.IceGatheringFailureReason = {}));
    /**
     * Possible media failures
     */
    var MediaFailure;
    (function (MediaFailure) {
        MediaFailure["ConnectionDisconnected"] = "ConnectionDisconnected";
        MediaFailure["ConnectionFailed"] = "ConnectionFailed";
        MediaFailure["IceGatheringFailed"] = "IceGatheringFailed";
        MediaFailure["LowBytes"] = "LowBytes";
    })(MediaFailure = Call.MediaFailure || (Call.MediaFailure = {}));
})(Call || (Call = {}));
function generateTempCallSid() {
    return 'TJSxxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        /* tslint:disable:no-bitwise */
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        /* tslint:enable:no-bitwise */
        return v.toString(16);
    });
}
exports.default = Call;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vY2FsbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBOzs7OztHQUtHO0FBQ0gsaUNBQXNDO0FBQ3RDLHFDQUFnQztBQUNoQyxtQ0FBOEI7QUFFOUIsbUNBU2tCO0FBQ2xCLDZCQUF3QjtBQUN4Qiw2QkFBdUM7QUFDdkMsbURBQW1FO0FBRW5FLGlDQUFrRDtBQUVsRCwrQ0FBMEM7QUFDMUMsK0JBQWtDO0FBQ2xDLCtCQUErQztBQUUvQyx5Q0FBOEM7QUF3QjlDLElBQU0sY0FBYyxHQUFHO0lBQ3JCLE1BQU0sRUFBRSxHQUFHO0lBQ1gsTUFBTSxFQUFFLEdBQUc7SUFDWCxHQUFHLEVBQUUsS0FBSztJQUNWLEdBQUcsRUFBRSxDQUFDO0NBQ1AsQ0FBQztBQUVGLElBQU0sbUJBQW1CLEdBQVcsRUFBRSxDQUFDO0FBQ3ZDLElBQU0sbUJBQW1CLEdBQVcsR0FBRyxDQUFDO0FBQ3hDLElBQU0sa0JBQWtCLEdBQVcsR0FBRyxDQUFDO0FBRXZDLElBQU0sa0JBQWtCLEdBQVcsRUFBRSxDQUFDO0FBQ3RDLElBQU0sYUFBYSxHQUFXLElBQUksQ0FBQztBQUVuQyxJQUFNLHNCQUFzQixHQUFHO0lBQzdCLFVBQVUsRUFBRSxJQUFJO0lBQ2hCLElBQUksRUFBRTtRQUNKLElBQUksRUFBRSxLQUFLO1FBQ1gsT0FBTyxFQUFFLHlDQUF5QztRQUNsRCxXQUFXLEVBQUUsSUFBSSxvQkFBVyxDQUFDLGVBQWUsRUFBRTtLQUMvQztDQUNGLENBQUM7QUFFRixJQUFNLGdDQUFnQyxHQUEyQztJQUMvRSwwRUFBMEU7SUFDMUUseUVBQXlFO0lBQ3pFLG1CQUFtQixFQUFFO1FBQ25CLEdBQUcsRUFBRSxhQUFhO1FBQ2xCLFVBQVUsRUFBRSx1QkFBdUI7S0FDcEM7Q0FDRixDQUFDO0FBRUYsSUFBTSxhQUFhLEdBQTJCO0lBQzVDLGVBQWUsRUFB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