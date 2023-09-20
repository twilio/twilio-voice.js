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
        _this._log = log_1.default.getInstance();
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
            if (_this._signalingReconnectToken) {
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
                var error = new errors_1.GeneralErrors.ConnectionError('Error sent from gateway in HANGUP');
                _this._log.error('Received an error from the gateway:', error);
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
                        _this._log.info('Exceeded max ICE retries');
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
            _this.emit('messageReceived', {
                content: content,
                contentType: contenttype,
                messageType: messagetype,
                voiceEventSid: voiceeventsid,
            });
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
            _this.emit('transportClose');
            if (_this._signalingReconnectToken) {
                _this._status = Call.State.Reconnecting;
                _this._signalingStatus = Call.State.Reconnecting;
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
        _this._mediaHandler = new (_this._options.MediaHandler)(config.audioHelper, config.pstream, config.getUserMedia, {
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
            _this._log.info('Remote audio created');
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
            _this._log.info(msg);
            _this._publisher.warn('network-quality-warning-raised', 'ice-connectivity-lost', {
                message: msg,
            }, _this);
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
            _this.emit('warning-cleared', 'ice-connectivity-lost');
            _this._onMediaReconnected();
        };
        _this._mediaHandler.onerror = function (e) {
            if (e.disconnect === true) {
                _this._disconnect(e.info && e.info.message);
            }
            var error = e.info.twilioError || new errors_1.GeneralErrors.UnknownError(e.info.message);
            _this._log.error('Received an error from MediaStream:', e);
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
                _this.mute(false);
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
        options = options || {};
        var rtcConfiguration = options.rtcConfiguration || this._options.rtcConfiguration;
        var rtcConstraints = options.rtcConstraints || this._options.rtcConstraints || {};
        var audioConstraints = rtcConstraints.audio || { audio: true };
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
                _this._mediaHandler.answerIncomingCall(_this.parameters.CallSid, _this._options.offerSdp, rtcConstraints, rtcConfiguration, onAnswer);
            }
            else {
                var params = Array.from(_this.customParameters.entries()).map(function (pair) {
                    return encodeURIComponent(pair[0]) + "=" + encodeURIComponent(pair[1]);
                }).join('&');
                _this._pstream.on('answer', _this._onAnswer);
                _this._mediaHandler.makeOutgoingCall(_this._pstream.token, params, _this.outboundConnectionId, rtcConstraints, rtcConfiguration, onAnswer);
            }
        };
        if (this._options.beforeAccept) {
            this._options.beforeAccept(this);
        }
        var inputStream = typeof this._options.getInputStream === 'function' && this._options.getInputStream();
        var promise = inputStream
            ? this._mediaHandler.setInputTracksFromStream(inputStream)
            : this._mediaHandler.openWithConstraints(audioConstraints);
        promise.then(function () {
            _this._publisher.info('get-user-media', 'succeeded', {
                data: { audioConstraints: audioConstraints },
            }, _this);
            if (_this._options.onGetUserMedia) {
                _this._options.onGetUserMedia();
            }
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
            _this.emit('error', twilioError);
        });
    };
    /**
     * Disconnect from the {@link Call}.
     */
    Call.prototype.disconnect = function () {
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
        var wasMuted = this._mediaHandler.isMuted;
        this._mediaHandler.mute(shouldMute);
        var isMuted = this._mediaHandler.isMuted;
        if (wasMuted !== isMuted) {
            this._publisher.info('connection', isMuted ? 'muted' : 'unmuted', null, this);
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
        this._isRejected = true;
        this._pstream.reject(this.parameters.CallSid);
        this._mediaHandler.reject(this.parameters.CallSid);
        this._publisher.info('connection', 'rejected-by-local', null, this);
        this._cleanupEventListeners();
        this._mediaHandler.close();
        this._status = Call.State.Closed;
        this.emit('reject');
    };
    /**
     * Send a string of digits.
     * @param digits
     */
    Call.prototype.sendDigits = function (digits) {
        var _this = this;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vY2FsbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBOzs7OztHQUtHO0FBQ0gsaUNBQXNDO0FBQ3RDLHFDQUFnQztBQUNoQyxtQ0FBOEI7QUFFOUIsbUNBUWtCO0FBQ2xCLDZCQUF3QjtBQUN4Qiw2QkFBdUM7QUFDdkMsbURBQW1FO0FBRW5FLGlDQUFrRDtBQUVsRCwrQ0FBMEM7QUFDMUMsK0JBQWtDO0FBQ2xDLCtCQUErQztBQUUvQyx5Q0FBOEM7QUF3QjlDLElBQU0sY0FBYyxHQUFHO0lBQ3JCLE1BQU0sRUFBRSxHQUFHO0lBQ1gsTUFBTSxFQUFFLEdBQUc7SUFDWCxHQUFHLEVBQUUsS0FBSztJQUNWLEdBQUcsRUFBRSxDQUFDO0NBQ1AsQ0FBQztBQUVGLElBQU0sbUJBQW1CLEdBQVcsRUFBRSxDQUFDO0FBQ3ZDLElBQU0sbUJBQW1CLEdBQVcsR0FBRyxDQUFDO0FBQ3hDLElBQU0sa0JBQWtCLEdBQVcsR0FBRyxDQUFDO0FBRXZDLElBQU0sa0JBQWtCLEdBQVcsRUFBRSxDQUFDO0FBQ3RDLElBQU0sYUFBYSxHQUFXLElBQUksQ0FBQztBQUVuQyxJQUFNLHNCQUFzQixHQUFHO0lBQzdCLFVBQVUsRUFBRSxJQUFJO0lBQ2hCLElBQUksRUFBRTtRQUNKLElBQUksRUFBRSxLQUFLO1FBQ1gsT0FBTyxFQUFFLHlDQUF5QztRQUNsRCxXQUFXLEVBQUUsSUFBSSxvQkFBVyxDQUFDLGVBQWUsRUFBRTtLQUMvQztDQUNGLENBQUM7QUFFRixJQUFNLGdDQUFnQyxHQUEyQztJQUMvRSwwRUFBMEU7SUFDMUUseUVBQXlFO0lBQ3pFLG1CQUFtQixFQUFFO1FBQ25CLEdBQUcsRUFBRSxhQUFhO1FBQ2xCLFVBQVUsRUFBRSx1QkFBdUI7S0FDcEM7Q0FDRixDQUFDO0FBRUYsSUFBTSxhQUFhLEdBQTJCO0lBQzVDLGVBQWUsRUFB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