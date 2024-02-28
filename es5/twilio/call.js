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
                    : new errors_1.GeneralErrors.ConnectionError('Error sent from gateway in HANGUP');
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
            var callsid = payload.callsid, voiceeventsid = payload.voiceeventsid;
            if (_this.parameters.CallSid !== callsid) {
                _this._log.warn("Received an error from a different callsid: " + callsid);
                return;
            }
            if (voiceeventsid && _this._messages.has(voiceeventsid)) {
                // Do not emit an error here. Device is handling all signaling related errors.
                _this._messages.delete(voiceeventsid);
                _this._log.warn("Received an error while sending a message.", payload);
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
        _this._direction = _this.parameters.CallSid ? Call.CallDirection.Incoming : Call.CallDirection.Outgoing;
        if (_this._direction === Call.CallDirection.Incoming && _this.parameters) {
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
            publisher.info('connection', 'outgoing', { preflight: _this._options.preflight }, _this);
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
            preflight: _this._options.preflight,
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
        if (this._status !== Call.State.Pending) {
            return;
        }
        this._log.debug('.accept', options);
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
            var onAnswer = function (pc, reconnectToken) {
                // Report that the call was answered, and directionality
                var eventName = _this._direction === Call.CallDirection.Incoming
                    ? 'accepted-by-local'
                    : 'accepted-by-remote';
                _this._publisher.info('connection', eventName, null, _this);
                if (typeof reconnectToken === 'string') {
                    _this._signalingReconnectToken = reconnectToken;
                }
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
                _this._mediaHandler.makeOutgoingCall(_this._pstream.token, params, _this.outboundConnectionId, rtcConfiguration, onAnswer);
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
        if (this._status !== Call.State.Pending) {
            return;
        }
        this._log.debug('.ignore');
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
        if (this._status !== Call.State.Pending) {
            return;
        }
        this._log.debug('.reject');
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
            throw new errors_1.InvalidArgumentError('`messageType` must be an enumeration value of `Call.MessageType` or ' +
                'a string.');
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
    /**
     * Known call message types.
     */
    var MessageType;
    (function (MessageType) {
        /**
         * Allows for any object types to be defined by the user.
         * When this value is used in the {@link Call.Message} object,
         * The {@link Call.Message.content} can be of any type as long as
         * it matches the MIME type defined in {@link Call.Message.contentType}.
         */
        MessageType["UserDefinedMessage"] = "user-defined-message";
    })(MessageType = Call.MessageType || (Call.MessageType = {}));
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