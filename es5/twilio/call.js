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
var RELEASE_VERSION = require('./constants').RELEASE_VERSION;
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
        if (digits.match(/[^0-9*#w]/)) {
            throw new errors_1.InvalidArgumentError('Illegal character passed into sendDigits');
        }
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
        // Binds soundCache to be used in recursion until all digits have been played.
        (function playNextDigit(soundCache, dialtonePlayer) {
            var digit = sequence.shift();
            if (digit) {
                if (dialtonePlayer) {
                    dialtonePlayer.play(digit);
                }
                else {
                    soundCache.get(digit).play();
                }
            }
            if (sequence.length) {
                setTimeout(playNextDigit.bind(null, soundCache), 200);
            }
        })(this._soundcache, this._options.dialtonePlayer);
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
            sdk_version: RELEASE_VERSION,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vY2FsbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBOzs7OztHQUtHO0FBQ0gsaUNBQXNDO0FBQ3RDLHFDQUFnQztBQUNoQyxtQ0FBOEI7QUFFOUIsbUNBUWtCO0FBQ2xCLDZCQUF3QjtBQUN4Qiw2QkFBdUM7QUFDdkMsbURBQW1FO0FBRW5FLGlDQUFrRDtBQUVsRCwrQ0FBMEM7QUFDMUMsK0JBQWtDO0FBQ2xDLCtCQUErQztBQUV2QyxJQUFBLGVBQWUsR0FBSyxPQUFPLENBQUMsYUFBYSxDQUFDLGdCQUEzQixDQUE0QjtBQXdCbkQsSUFBTSxjQUFjLEdBQUc7SUFDckIsTUFBTSxFQUFFLEdBQUc7SUFDWCxNQUFNLEVBQUUsR0FBRztJQUNYLEdBQUcsRUFBRSxLQUFLO0lBQ1YsR0FBRyxFQUFFLENBQUM7Q0FDUCxDQUFDO0FBRUYsSUFBTSxtQkFBbUIsR0FBVyxFQUFFLENBQUM7QUFDdkMsSUFBTSxtQkFBbUIsR0FBVyxHQUFHLENBQUM7QUFDeEMsSUFBTSxrQkFBa0IsR0FBVyxHQUFHLENBQUM7QUFFdkMsSUFBTSxrQkFBa0IsR0FBVyxFQUFFLENBQUM7QUFDdEMsSUFBTSxhQUFhLEdBQVcsSUFBSSxDQUFDO0FBRW5DLElBQU0sc0JBQXNCLEdBQUc7SUFDN0IsVUFBVSxFQUFFLElBQUk7SUFDaEIsSUFBSSxFQUFFO1FBQ0osSUFBSSxFQUFFLEtBQUs7UUFDWCxPQUFPLEVBQUUseUNBQXlDO1FBQ2xELFdBQVcsRUFBRSxJQUFJLG9CQUFXLENBQUMsZUFBZSxFQUFFO0tBQy9DO0NBQ0YsQ0FBQztBQUVGLElBQU0sZ0NBQWdDLEdBQTJDO0lBQy9FLDBFQUEwRTtJQUMxRSx5RUFBeUU7SUFDekUsbUJBQW1CLEVBQUU7UUFDbkIsR0FBRyxFQUFFLGFBQWE7UUFDbEIsVUFBVSxFQUFFLHVCQUF1QjtLQUNwQztDQUNGLENBQUM7QUFFRixJQUFNLGFBQWEsR0FBMkI7SUFDNUMsZUFBZSxFQUFFLG1CQUFtQjtJQUNwQyxnQkFBZ0IsRUFBRSxvQkFBb0I7SUFDdEMsYUFBYSxFQUFFLGdCQUFnQjtJQUMvQixTQUFTLEVBQUUsWUFBWTtJQUN2QixNQUFNLEVBQUUsUUFBUTtJQUNoQixHQUFHLEVBQUUsS0FBSztJQUNWLEdBQUcsRUFBRSxLQUFLO0NBQ1gsQ0FBQztBQUVGLElBQU0sZ0JBQWdCLEdBQTJCO0lBQy9DLEdBQUcsRUFBRSxPQUFPO0lBQ1osVUFBVSxFQUFFLE9BQU87SUFDbkIsV0FBVyxFQUFFLFdBQVc7SUFDeEIsR0FBRyxFQUFFLE1BQU07SUFDWCxvQkFBb0IsRUFBRSxXQUFXO0NBQ2xDLENBQUM7QUFFRjs7O0dBR0c7QUFDSDtJQUFtQix3QkFBWTtJQXFNN0I7Ozs7O09BS0c7SUFDSCxjQUFZLE1BQW1CLEVBQUUsT0FBc0I7UUFBdkQsWUFDRSxpQkFBTyxTQThQUjtRQXBhRDs7V0FFRztRQUNILGdCQUFVLEdBQTJCLEVBQUcsQ0FBQztRQWF6Qzs7V0FFRztRQUNLLHdCQUFrQixHQUFXLENBQUMsQ0FBQztRQUV2Qzs7V0FFRztRQUNLLGlCQUFXLEdBQVksS0FBSyxDQUFDO1FBRXJDOztXQUVHO1FBQ0ssa0JBQVksR0FBWSxLQUFLLENBQUM7UUFFdEM7O1dBRUc7UUFDSyxpQkFBVyxHQUFZLEtBQUssQ0FBQztRQU9yQzs7V0FFRztRQUNLLHdCQUFrQixHQUFXLENBQUMsQ0FBQztRQUV2Qzs7V0FFRztRQUNLLHlCQUFtQixHQUFXLENBQUMsQ0FBQztRQUV4Qzs7V0FFRztRQUNLLFVBQUksR0FBUSxhQUFHLENBQUMsV0FBVyxFQUFFLENBQUM7UUFrQnRDOztXQUVHO1FBQ0ssa0JBQVksR0FBZSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQztRQUV0RDs7O1dBR0c7UUFDSyxlQUFTLEdBQThCLElBQUksR0FBRyxFQUFFLENBQUM7UUFFekQ7OztXQUdHO1FBQ2MscUJBQWUsR0FBdUIsRUFBRSxDQUFDO1FBWTFEOztXQUVHO1FBQ0ssY0FBUSxHQUFpQjtZQUMvQixZQUFZLEVBQUUsb0JBQWM7WUFDNUIsUUFBUSxFQUFFLElBQUk7WUFDZCxvQkFBb0IsRUFBRSxjQUFNLE9BQUEsSUFBSSxFQUFKLENBQUk7WUFDaEMsc0JBQXNCLEVBQUUsNEJBQXFCO1NBQzlDLENBQUM7UUFFRjs7V0FFRztRQUNLLHlCQUFtQixHQUFXLENBQUMsQ0FBQztRQVl4Qzs7V0FFRztRQUNLLHVCQUFpQixHQUFZLElBQUksQ0FBQztRQU8xQzs7V0FFRztRQUNLLHNCQUFnQixHQUFlLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDO1FBRTFEOztXQUVHO1FBQ2MsaUJBQVcsR0FBa0MsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQUV4RTs7V0FFRztRQUNLLGFBQU8sR0FBZSxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQztRQU9qRDs7V0FFRztRQUNLLG1CQUFhLEdBQVksS0FBSyxDQUFDO1FBc25CdkM7OztXQUdHO1FBQ0gsY0FBUSxHQUFHLGNBQU0sT0FBQSx3QkFBd0IsRUFBeEIsQ0FBd0IsQ0FBQztRQW1IbEMsa0JBQVksR0FBRyxVQUFDLFdBQW1CLEVBQUUsV0FBbUIsRUFBRSxTQUFpQixFQUMzRCxLQUFzQixFQUFFLFVBQW9CLEVBQUUsV0FBd0I7WUFDNUYsSUFBTSxXQUFXLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztZQUN4RCxJQUFNLFNBQVMsR0FBTSxXQUFXLGVBQVUsV0FBYSxDQUFDO1lBRXhELHdEQUF3RDtZQUN4RCxJQUFJLFdBQVcsS0FBSyw0QkFBNEIsSUFBSSxLQUFJLENBQUMsT0FBTyxFQUFFLEVBQUU7Z0JBQ2xFLE9BQU87YUFDUjtZQUVELElBQUksS0FBSyxHQUFHLFVBQVUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7WUFFNUMsOEVBQThFO1lBQzlFLElBQUksV0FBVyxLQUFLLDZCQUE2QixFQUFFO2dCQUNqRCxLQUFLLEdBQUcsTUFBTSxDQUFDO2FBQ2hCO1lBRUQsSUFBTSxXQUFXLEdBQXdCLEVBQUUsU0FBUyxXQUFBLEVBQUUsQ0FBQztZQUV2RCxJQUFJLEtBQUssRUFBRTtnQkFDVCxJQUFJLEtBQUssWUFBWSxLQUFLLEVBQUU7b0JBQzFCLFdBQVcsQ0FBQyxNQUFNLEdBQUcsS0FBSyxDQUFDLEdBQUcsQ0FBQyxVQUFDLEdBQVE7d0JBQ3RDLElBQUksT0FBTyxHQUFHLEtBQUssUUFBUSxFQUFFOzRCQUMzQixPQUFPLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxHQUFHLEdBQUcsQ0FBQyxHQUFHLEdBQUcsQ0FBQzt5QkFDcEM7d0JBRUQsT0FBTyxLQUFLLENBQUM7b0JBQ2YsQ0FBQyxDQUFDLENBQUM7aUJBQ0o7cUJBQU07b0JBQ0wsV0FBVyxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7aUJBQzNCO2FBQ0Y7WUFFRCxLQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsU0FBUyxFQUFFLFdBQVcsRUFBRSxFQUFFLElBQUksRUFBRSxXQUFXLEVBQUUsRUFBRSxLQUFJLENBQUMsQ0FBQztZQUVqRixJQUFJLFdBQVcsS0FBSyw2QkFBNkIsRUFBRTtnQkFDakQsSUFBTSxRQUFRLEdBQUcsVUFBVSxDQUFDLENBQUMsQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO2dCQUM1RCxLQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxXQUFXLEVBQUUsV0FBVyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQ25GO1FBQ0gsQ0FBQyxDQUFBO1FBb0JEOzs7V0FHRztRQUNLLFlBQU0sR0FBRyxVQUFDLE9BQTRCO1lBQ3BDLElBQUEsT0FBTyxHQUE2QixPQUFPLFFBQXBDLEVBQUUsT0FBTyxHQUFvQixPQUFPLFFBQTNCLEVBQUUsYUFBYSxHQUFLLE9BQU8sY0FBWixDQUFhO1lBQ3BELElBQUksS0FBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEtBQUssT0FBTyxFQUFFO2dCQUN2QyxLQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyw0Q0FBMEMsT0FBUyxDQUFDLENBQUM7Z0JBQ3BFLE9BQU87YUFDUjtZQUNELElBQUksT0FBTyxLQUFLLFNBQVMsRUFBRTtnQkFDekIsS0FBSSxDQUFDLGNBQWMsQ0FBQyxhQUFhLENBQUMsQ0FBQzthQUNwQztRQUNILENBQUMsQ0FBQTtRQUVEOzs7V0FHRztRQUNLLGVBQVMsR0FBRyxVQUFDLE9BQTRCO1lBQy9DLElBQUksT0FBTyxPQUFPLENBQUMsU0FBUyxLQUFLLFFBQVEsRUFBRTtnQkFDekMsS0FBSSxDQUFDLHdCQUF3QixHQUFHLE9BQU8sQ0FBQyxTQUFTLENBQUM7YUFDbkQ7WUFFRCxpRkFBaUY7WUFDakYscUZBQXFGO1lBQ3JGLHlFQUF5RTtZQUN6RSxzQkFBc0I7WUFDdEIsSUFBSSxLQUFJLENBQUMsV0FBVyxJQUFJLEtBQUksQ0FBQyxPQUFPLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLEVBQUU7Z0JBQ2hFLE9BQU87YUFDUjtZQUVELEtBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUM7WUFDMUIsS0FBSSxDQUFDLFdBQVcsR0FBRyxJQUFJLENBQUM7WUFDeEIsS0FBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7UUFDaEMsQ0FBQyxDQUFBO1FBRUQ7OztXQUdHO1FBQ0ssZUFBUyxHQUFHLFVBQUMsT0FBNEI7WUFDL0Msc0ZBQXNGO1lBQ3RGLElBQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLENBQUM7WUFDaEMsSUFBSSxLQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sS0FBSyxPQUFPLEVBQUU7Z0JBQ3ZDLEtBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDO2dCQUN6QixLQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsUUFBUSxFQUFFLElBQUksRUFBRSxLQUFJLENBQUMsQ0FBQztnQkFDekQsS0FBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7Z0JBQzlCLEtBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBRTNCLEtBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7Z0JBQ2pDLEtBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3BCLEtBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxLQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7YUFDeEQ7UUFDSCxDQUFDLENBQUE7UUFFRDs7O1dBR0c7UUFDSyxrQkFBWSxHQUFHO1lBQ3JCLEtBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGlDQUFpQyxDQUFDLENBQUM7WUFDbEQsSUFBSSxLQUFJLENBQUMsd0JBQXdCLEVBQUU7Z0JBQ2pDLEtBQUksQ0FBQyxRQUFRLENBQUMsU0FBUyxDQUNyQixLQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxNQUFNLEVBQUUsRUFDbkMsS0FBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEVBQ3ZCLEtBQUksQ0FBQyx3QkFBd0IsQ0FDOUIsQ0FBQzthQUNIO1FBQ0gsQ0FBQyxDQUFBO1FBRUQ7OztXQUdHO1FBQ0ssZUFBUyxHQUFHLFVBQUMsT0FBNEI7WUFDL0MsSUFBSSxLQUFJLENBQUMsTUFBTSxFQUFFLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUU7Z0JBQ3ZDLE9BQU87YUFDUjtZQUVEOzs7O2VBSUc7WUFDSCxJQUFJLE9BQU8sQ0FBQyxPQUFPLElBQUksQ0FBQyxLQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sSUFBSSxLQUFJLENBQUMsb0JBQW9CLENBQUMsRUFBRTtnQkFDN0UsSUFBSSxPQUFPLENBQUMsT0FBTyxLQUFLLEtBQUksQ0FBQyxVQUFVLENBQUMsT0FBTzt1QkFDeEMsT0FBTyxDQUFDLE9BQU8sS0FBSyxLQUFJLENBQUMsb0JBQW9CLEVBQUU7b0JBQ3BELE9BQU87aUJBQ1I7YUFDRjtpQkFBTSxJQUFJLE9BQU8sQ0FBQyxPQUFPLEVBQUU7Z0JBQzFCLDZCQUE2QjtnQkFDN0IsT0FBTzthQUNSO1lBRUQsS0FBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsOEJBQThCLENBQUMsQ0FBQztZQUMvQyxJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUU7Z0JBQ2pCLElBQU0sS0FBSyxHQUFHLElBQUksc0JBQWEsQ0FBQyxlQUFlLENBQUMsbUNBQW1DLENBQUMsQ0FBQztnQkFDckYsS0FBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMscUNBQXFDLEVBQUUsS0FBSyxDQUFDLENBQUM7Z0JBQzlELEtBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO2FBQzNCO1lBQ0QsS0FBSSxDQUFDLGlCQUFpQixHQUFHLEtBQUssQ0FBQztZQUMvQixLQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsd0JBQXdCLEVBQUUsSUFBSSxFQUFFLEtBQUksQ0FBQyxDQUFDO1lBQ3pFLEtBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzdCLEtBQUksQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO1FBQ2hDLENBQUMsQ0FBQTtRQUVEOzs7O1dBSUc7UUFDSyxxQkFBZSxHQUFHLFVBQUMsSUFBdUI7WUFDMUMsSUFBQSxLQUVGLElBQUksQ0FBQyxZQUFZLEVBRG5CLHNCQUFzQiw0QkFBQSxFQUFFLGdCQUFnQixzQkFBQSxFQUFFLGtCQUFrQix3QkFBQSxFQUFFLFFBQVEsY0FDbkQsQ0FBQztZQUV0QixzREFBc0Q7WUFDdEQsSUFBTSxlQUFlLEdBQUcsSUFBSSxLQUFLLGdCQUFnQixJQUFJLElBQUksS0FBSyxrQkFBa0IsQ0FBQztZQUVqRix5RkFBeUY7WUFDekYsc0ZBQXNGO1lBQ3RGLHdFQUF3RTtZQUN4RSxJQUFJLENBQUMsZUFBUSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLElBQUksSUFBSSxLQUFLLGdCQUFnQixFQUFFO2dCQUNwRSxPQUFPLEtBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLHNCQUFzQixDQUFDLENBQUM7YUFDM0Q7WUFFRCwyREFBMkQ7WUFDM0QsSUFBSSxLQUFJLENBQUMsWUFBWSxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxFQUFFO2dCQUVqRCwrQ0FBK0M7Z0JBQy9DLElBQUksZUFBZSxFQUFFO29CQUVuQixzQ0FBc0M7b0JBQ3RDLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRSxHQUFHLEtBQUksQ0FBQyx3QkFBd0IsR0FBRyxjQUFjLENBQUMsR0FBRyxFQUFFO3dCQUNuRSxLQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO3dCQUMzQyxPQUFPLEtBQUksQ0FBQyxhQUFhLENBQUMsT0FBTyxDQUFDLHNCQUFzQixDQUFDLENBQUM7cUJBQzNEO29CQUVELGlDQUFpQztvQkFDakMsSUFBSTt3QkFDRixLQUFJLENBQUMsc0JBQXNCLENBQUMsT0FBTyxFQUFFLENBQUM7cUJBQ3ZDO29CQUFDLE9BQU8sS0FBSyxFQUFFO3dCQUNkLGtFQUFrRTt3QkFDbEUsZ0VBQWdFO3dCQUNoRSxXQUFXO3dCQUNYLElBQUksQ0FBQyxDQUFDLEtBQUssQ0FBQyxPQUFPLElBQUksS0FBSyxDQUFDLE9BQU8sS0FBSyxzQkFBc0IsQ0FBQyxFQUFFOzRCQUNoRSxNQUFNLEtBQUssQ0FBQzt5QkFDYjtxQkFDRjtpQkFDRjtnQkFFRCxPQUFPO2FBQ1I7WUFFRCxJQUFNLEVBQUUsR0FBRyxLQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7WUFDekMsSUFBTSxpQkFBaUIsR0FBRyxFQUFFLElBQUksRUFBRSxDQUFDLGtCQUFrQixLQUFLLGNBQWMsQ0FBQztZQUN6RSxJQUFNLGtCQUFrQixHQUFHLEtBQUksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLENBQUMsV0FBVyxFQUFFLEtBQUssQ0FBQzttQkFDeEUsS0FBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsQ0FBQyxlQUFlLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFFNUQseURBQXlEO1lBQ3pELElBQUksQ0FBQyxJQUFJLEtBQUssUUFBUSxJQUFJLGlCQUFpQixDQUFDO21CQUN2QyxDQUFDLElBQUksS0FBSyxzQkFBc0IsSUFBSSxrQkFBa0IsQ0FBQzttQkFDdkQsZUFBZSxFQUFFO2dCQUVwQixJQUFNLHNCQUFzQixHQUFHLElBQUksb0JBQVcsQ0FBQyxlQUFlLENBQUMsMEJBQTBCLENBQUMsQ0FBQztnQkFDM0YsS0FBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsOEJBQThCLENBQUMsQ0FBQztnQkFDL0MsS0FBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLE9BQU8sRUFBRSxzQkFBc0IsRUFBRSxLQUFJLENBQUMsQ0FBQztnQkFDMUUsS0FBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLGNBQWMsRUFBRSxJQUFJLEVBQUUsS0FBSSxDQUFDLENBQUM7Z0JBRS9ELEtBQUksQ0FBQyx3QkFBd0IsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7Z0JBQzNDLEtBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUM7Z0JBQ3ZDLEtBQUksQ0FBQyxZQUFZLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUM7Z0JBQzVDLEtBQUksQ0FBQyxzQkFBc0IsQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFDcEMsS0FBSSxDQUFDLHNCQUFzQixDQUFDLE9BQU8sRUFBRSxDQUFDO2dCQUV0QyxLQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxzQkFBc0IsQ0FBQyxDQUFDO2FBQ25EO1FBQ0gsQ0FBQyxDQUFBO1FBRUQ7O1dBRUc7UUFDSyx5QkFBbUIsR0FBRztZQUM1QixxQkFBcUI7WUFDckIsMEVBQTBFO1lBQzFFLElBQUksS0FBSSxDQUFDLFlBQVksS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRTtnQkFDakQsT0FBTzthQUNSO1lBQ0QsS0FBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsK0JBQStCLENBQUMsQ0FBQztZQUNoRCxLQUFJLENBQUMsWUFBWSxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBRXBDLElBQUksS0FBSSxDQUFDLGdCQUFnQixLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFO2dCQUM3QyxLQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsYUFBYSxFQUFFLElBQUksRUFBRSxLQUFJLENBQUMsQ0FBQztnQkFDOUQsS0FBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsQ0FBQztnQkFDekIsS0FBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQzthQUNoQztRQUNILENBQUMsQ0FBQTtRQUVEOzs7O1dBSUc7UUFDSyx3QkFBa0IsR0FBRyxVQUFDLE9BQTRCO1lBQ2hELElBQUEsT0FBTyxHQUF1RCxPQUFPLFFBQTlELEVBQUUsT0FBTyxHQUE4QyxPQUFPLFFBQXJELEVBQUUsV0FBVyxHQUFpQyxPQUFPLFlBQXhDLEVBQUUsV0FBVyxHQUFvQixPQUFPLFlBQTNCLEVBQUUsYUFBYSxHQUFLLE9BQU8sY0FBWixDQUFhO1lBRTlFLElBQUksS0FBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLEtBQUssT0FBTyxFQUFFO2dCQUN2QyxLQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxrREFBZ0QsT0FBUyxDQUFDLENBQUM7Z0JBQzFFLE9BQU87YUFDUjtZQUVELEtBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLEVBQUU7Z0JBQzNCLE9BQU8sU0FBQTtnQkFDUCxXQUFXLEVBQUUsV0FBVztnQkFDeEIsV0FBVyxFQUFFLFdBQVc7Z0JBQ3hCLGFBQWEsRUFBRSxhQUFhO2FBQzdCLENBQUMsQ0FBQztRQUNMLENBQUMsQ0FBQTtRQUVEOzs7O1dBSUc7UUFDSyxvQkFBYyxHQUFHLFVBQUMsYUFBcUI7WUFDN0MsSUFBSSxDQUFDLEtBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxFQUFFO2dCQUN0QyxLQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxzRUFBb0UsYUFBZSxDQUFDLENBQUM7Z0JBQ3BHLE9BQU87YUFDUjtZQUNELElBQU0sT0FBTyxHQUFHLEtBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQ2xELEtBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxDQUFDO1lBQ3JDLEtBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBQ3BDLENBQUMsQ0FBQTtRQUVEOzs7V0FHRztRQUNLLGdCQUFVLEdBQUcsVUFBQyxPQUE0QjtZQUNoRCxLQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBRTFCLHlGQUF5RjtZQUN6RixJQUFJLEtBQUksQ0FBQyxPQUFPLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVLElBQUksS0FBSSxDQUFDLE9BQU8sS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRTtnQkFDakYsT0FBTzthQUNSO1lBRUQsSUFBTSxhQUFhLEdBQUcsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxHQUFHLENBQUM7WUFDcEMsS0FBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sQ0FBQztZQUNsQyxLQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsa0JBQWtCLEVBQUUsRUFBRSxhQUFhLGVBQUEsRUFBRSxFQUFFLEtBQUksQ0FBQyxDQUFDO1lBQ2hGLEtBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQ3RDLENBQUMsQ0FBQTtRQUVEOzs7O1dBSUc7UUFDSyxrQkFBWSxHQUFHLFVBQUMsTUFBaUI7WUFDdkMsSUFBTSxXQUFXLHlCQUNaLE1BQU0sS0FDVCxXQUFXLEVBQUUsS0FBSSxDQUFDLGtCQUFrQixFQUNwQyxZQUFZLEVBQUUsS0FBSSxDQUFDLG1CQUFtQixHQUN2QyxDQUFDO1lBRUYsS0FBSSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUMsU0FBUyxDQUFDO1lBRXBDLEtBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDO1lBQ3ZDLElBQUksS0FBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLElBQUksa0JBQWtCLEVBQUU7Z0JBQ3JELEtBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQzthQUN4QjtZQUVELEtBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLE1BQU0sQ0FBQyxDQUFDO1FBQzlCLENBQUMsQ0FBQTtRQUVEOztXQUVHO1FBQ0ssdUJBQWlCLEdBQUcsVUFBQyxPQUE0QjtZQUMvQyxJQUFBLE9BQU8sR0FBb0IsT0FBTyxRQUEzQixFQUFFLGFBQWEsR0FBSyxPQUFPLGNBQVosQ0FBYTtZQUMzQyxJQUFJLEtBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxLQUFLLE9BQU8sRUFBRTtnQkFDdkMsS0FBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsaURBQStDLE9BQVMsQ0FBQyxDQUFDO2dCQUN6RSxPQUFPO2FBQ1I7WUFDRCxJQUFJLGFBQWEsSUFBSSxLQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsRUFBRTtnQkFDdEQsOEVBQThFO2dCQUM5RSxLQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUMsQ0FBQztnQkFDckMsS0FBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsNENBQTRDLEVBQUUsT0FBTyxDQUFDLENBQUM7YUFDdkU7UUFDRixDQUFDLENBQUE7UUFFRjs7V0FFRztRQUNLLDZCQUF1QixHQUFHO1lBQ2hDLElBQUksS0FBSSxDQUFDLGdCQUFnQixLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxFQUFFO2dCQUNyRCxPQUFPO2FBQ1I7WUFDRCxLQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxxQ0FBcUMsQ0FBQyxDQUFDO1lBRXRELEtBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztZQUV4QyxJQUFJLEtBQUksQ0FBQyxZQUFZLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUU7Z0JBQ3pDLEtBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxhQUFhLEVBQUUsSUFBSSxFQUFFLEtBQUksQ0FBQyxDQUFDO2dCQUM5RCxLQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDO2dCQUN6QixLQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO2FBQ2hDO1FBQ0gsQ0FBQyxDQUFBO1FBRUQ7OztXQUdHO1FBQ0ssdUJBQWlCLEdBQUc7WUFDMUIsS0FBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsc0NBQXNDLENBQUMsQ0FBQztZQUN4RCxLQUFJLENBQUMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7WUFDNUIsSUFBSSxLQUFJLENBQUMsd0JBQXdCLEVBQUU7Z0JBQ2pDLEtBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLENBQUM7Z0JBQ3ZDLEtBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLFlBQVksQ0FBQztnQkFDaEQsS0FBSSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsSUFBSSx3QkFBZSxDQUFDLHNCQUFzQixFQUFFLENBQUMsQ0FBQzthQUN6RTtpQkFBTTtnQkFDTCxLQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDO2dCQUNqQyxLQUFJLENBQUMsZ0JBQWdCLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUM7YUFDM0M7UUFDSCxDQUFDLENBQUE7UUF5QkQ7Ozs7V0FJRztRQUNLLG9CQUFjLEdBQUcsVUFBQyxXQUFnQyxFQUFFLFVBQW9CO1lBQzlFLElBQU0sV0FBVyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7Z0JBQ25ELGNBQWMsQ0FBQyxDQUFDLENBQUMsa0JBQWtCLENBQUM7WUFFdEMsSUFBTSxhQUFhLEdBQUcsZ0JBQWdCLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsQ0FBQztZQUVuRTs7OztlQUlHO1lBQ0gsSUFBSSxXQUErQixDQUFDO1lBQ3BDLElBQUksV0FBVyxDQUFDLElBQUksSUFBSSxnQ0FBZ0MsRUFBRTtnQkFDeEQsV0FBVyxHQUFHLGdDQUFnQyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsQ0FBQyxXQUFXLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQzlGO2lCQUFNLElBQUksV0FBVyxDQUFDLElBQUksSUFBSSxhQUFhLEVBQUU7Z0JBQzVDLFdBQVcsR0FBRyxhQUFhLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxDQUFDO2FBQy9DO1lBRUQsSUFBTSxPQUFPLEdBQVcsYUFBYSxHQUFHLFdBQVcsQ0FBQztZQUVwRCxLQUFJLENBQUMsWUFBWSxDQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUUsV0FBVyxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQ2pELFdBQVcsQ0FBQyxNQUFNLElBQUksV0FBVyxDQUFDLEtBQUssRUFBRSxVQUFVLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDdEYsQ0FBQyxDQUFBO1FBRUQ7OztXQUdHO1FBQ0ssMkJBQXFCLEdBQUcsVUFBQyxXQUFnQztZQUMvRCxLQUFJLENBQUMsY0FBYyxDQUFDLFdBQVcsRUFBRSxJQUFJLENBQUMsQ0FBQztRQUN6QyxDQUFDLENBQUE7UUE3cENDLEtBQUksQ0FBQyxxQkFBcUIsR0FBRyxNQUFNLENBQUMsb0JBQW9CLENBQUM7UUFDekQsS0FBSSxDQUFDLFdBQVcsR0FBRyxNQUFNLENBQUMsVUFBVSxDQUFDO1FBRXJDLElBQUksT0FBTyxNQUFNLENBQUMsUUFBUSxLQUFLLFVBQVUsRUFBRTtZQUN6QyxLQUFJLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQyxRQUFRLENBQUM7U0FDbEM7UUFFRCxJQUFNLE9BQU8sR0FBRyxPQUFPLElBQUksT0FBTyxDQUFDLFdBQVcsSUFBSSxFQUFHLENBQUM7UUFDdEQsS0FBSSxDQUFDLGdCQUFnQixHQUFHLElBQUksR0FBRyxDQUM3QixNQUFNLENBQUMsT0FBTyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFDLEVBQXlCO2dCQUF4QixHQUFHLFFBQUEsRUFBRSxHQUFHLFFBQUE7WUFBdUMsT0FBQSxDQUFDLEdBQUcsRUFBRSxNQUFNLENBQUMsR0FBRyxDQUFDLENBQUM7UUFBbEIsQ0FBa0IsQ0FBQyxDQUFDLENBQUM7UUFFcEcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFJLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBRXRDLElBQUksS0FBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUU7WUFDaEMsS0FBSSxDQUFDLFVBQVUsR0FBRyxLQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQztTQUNoRDtRQUVELElBQUksS0FBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLEVBQUU7WUFDaEMsS0FBSSxDQUFDLHdCQUF3QixHQUFHLEtBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDO1NBQzlEO1FBRUQsS0FBSSxDQUFDLHVCQUF1QjtZQUMxQixLQUFJLENBQUMsUUFBUSxDQUFDLHNCQUFzQixJQUFJLDRCQUFxQixDQUFDO1FBRWhFLEtBQUksQ0FBQyxVQUFVLEdBQUcsS0FBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQztRQUV0RyxJQUFJLEtBQUksQ0FBQyxVQUFVLEtBQUssSUFBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLElBQUksS0FBSSxDQUFDLFVBQVUsRUFBRTtZQUN0RSxLQUFJLENBQUMsVUFBVSxHQUFHLEtBQUksQ0FBQyxVQUFVLENBQUMsVUFBVTtnQkFDMUMsQ0FBQyxDQUFDLEVBQUUsVUFBVSxFQUFFLEtBQUksQ0FBQyxVQUFVLENBQUMsVUFBVSxLQUFLLHdCQUF3QixFQUFFO2dCQUN6RSxDQUFDLENBQUMsSUFBSSxDQUFDO1NBQ1Y7YUFBTTtZQUNMLEtBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSSxDQUFDO1NBQ3hCO1FBRUQsS0FBSSxDQUFDLHNCQUFzQixHQUFHLElBQUksaUJBQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUMxRCxLQUFJLENBQUMsc0JBQXNCLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRSxjQUFNLE9BQUEsS0FBSSxDQUFDLGFBQWEsQ0FBQyxVQUFVLEVBQUUsRUFBL0IsQ0FBK0IsQ0FBQyxDQUFDO1FBRS9FLG1EQUFtRDtRQUNuRCxLQUFJLENBQUMsb0JBQW9CLEdBQUcsbUJBQW1CLEVBQUUsQ0FBQztRQUVsRCxJQUFNLFNBQVMsR0FBRyxLQUFJLENBQUMsVUFBVSxHQUFHLE1BQU0sQ0FBQyxTQUFTLENBQUM7UUFFckQsSUFBSSxLQUFJLENBQUMsVUFBVSxLQUFLLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFO1lBQ25ELFNBQVMsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLFVBQVUsRUFBRSxJQUFJLEVBQUUsS0FBSSxDQUFDLENBQUM7U0FDdEQ7YUFBTTtZQUNMLFNBQVMsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLFVBQVUsRUFBRSxFQUFFLFNBQVMsRUFBRSxLQUFJLENBQUMsUUFBUSxDQUFDLFNBQVMsRUFBRSxFQUFFLEtBQUksQ0FBQyxDQUFDO1NBQ3hGO1FBRUQsSUFBTSxPQUFPLEdBQUcsS0FBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsS0FBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLElBQUksc0JBQVksQ0FBQyxFQUFFLENBQUM7UUFDbkYsT0FBTyxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsS0FBSSxDQUFDLFlBQVksQ0FBQyxDQUFDO1FBRXhDLDhFQUE4RTtRQUM5RSxPQUFPLENBQUMsZUFBZSxFQUFFLENBQUM7UUFDMUIsVUFBVSxDQUFDLGNBQU0sT0FBQSxPQUFPLENBQUMsY0FBYyxFQUFFLEVBQXhCLENBQXdCLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFFMUQsT0FBTyxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsVUFBQyxJQUFnQixFQUFFLFVBQW9CO1lBQzNELElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxXQUFXLElBQUksSUFBSSxDQUFDLElBQUksS0FBSyxlQUFlLEVBQUU7Z0JBQzlELEtBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQzthQUNsRDtZQUNELEtBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFVBQVUsQ0FBQyxDQUFDO1FBQ3hDLENBQUMsQ0FBQyxDQUFDO1FBQ0gsT0FBTyxDQUFDLEVBQUUsQ0FBQyxpQkFBaUIsRUFBRSxVQUFDLElBQWdCO1lBQzdDLEtBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQztRQUNuQyxDQUFDLENBQUMsQ0FBQztRQUVILEtBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLEtBQUksQ0FBQyxRQUFRLENBQUMsWUFBWSxDQUFDLENBQ2xELE1BQU0sQ0FBQyxXQUFXLEVBQUUsTUFBTSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsWUFBWSxFQUFFO1lBQ3hELGlCQUFpQixFQUFFLEtBQUksQ0FBQyxRQUFRLENBQUMsaUJBQWlCO1lBQ2xELGdCQUFnQixFQUFFLEtBQUksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCO1lBQ2hELElBQUksRUFBRSxLQUFJLENBQUMsUUFBUSxDQUFDLElBQUk7WUFDeEIsNEJBQTRCLEVBQUUsS0FBSSxDQUFDLFFBQVEsQ0FBQyw0QkFBNEI7WUFDeEUsYUFBYSxFQUFFLEtBQUksQ0FBQyxxQkFBcUI7WUFDekMsaUJBQWlCLEVBQUUsS0FBSSxDQUFDLFFBQVEsQ0FBQyxpQkFBaUI7WUFDbEQsU0FBUyxFQUFFLEtBQUksQ0FBQyxRQUFRLENBQUMsU0FBUztTQUNuQyxDQUFDLENBQUM7UUFFTCxLQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxVQUFDLFdBQW1CLEVBQUUsWUFBb0I7WUFDMUQsS0FBSSxDQUFDLGtCQUFrQixHQUFHLEtBQUksQ0FBQyxZQUFZLENBQ3pDLFdBQVcsRUFBRSxLQUFJLENBQUMsa0JBQWtCLEVBQUUsS0FBSSxDQUFDLGtCQUFrQixFQUFFLE9BQU8sQ0FBQyxDQUFDO1lBQzFFLEtBQUksQ0FBQyxtQkFBbUIsR0FBRyxLQUFJLENBQUMsWUFBWSxDQUMxQyxZQUFZLEVBQUUsS0FBSSxDQUFDLG1CQUFtQixFQUFFLEtBQUksQ0FBQyxtQkFBbUIsRUFBRSxRQUFRLENBQUMsQ0FBQztZQUM5RSxLQUFJLENBQUMsa0JBQWtCLEdBQUcsV0FBVyxDQUFDO1lBQ3RDLEtBQUksQ0FBQyxtQkFBbUIsR0FBRyxZQUFZLENBQUM7UUFDMUMsQ0FBQyxDQUFDLENBQUM7UUFFSCxLQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sR0FBRyxVQUFDLFdBQXlCO1lBQ3JELEtBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLENBQUM7WUFDdkMsS0FBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsV0FBVyxDQUFDLENBQUM7UUFDbEMsQ0FBQyxDQUFDO1FBRUYsS0FBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLEdBQUcsVUFBQyxXQUFtQixFQUFFLFlBQW9CLEVBQ3pDLG1CQUEyQixFQUFFLG9CQUE0QjtZQUN0RixrR0FBa0c7WUFDbEcsNkZBQTZGO1lBQzdGLGdCQUFnQjtZQUNoQixPQUFPLENBQUMsVUFBVSxDQUFDLENBQUMsbUJBQW1CLEdBQUcsR0FBRyxDQUFDLEdBQUcsS0FBSyxFQUFFLENBQUMsb0JBQW9CLEdBQUcsR0FBRyxDQUFDLEdBQUcsS0FBSyxDQUFDLENBQUM7WUFFOUYsK0JBQStCO1lBQy9CLEtBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLFdBQVcsRUFBRSxZQUFZLENBQUMsQ0FBQztRQUNqRCxDQUFDLENBQUM7UUFFRixLQUFJLENBQUMsYUFBYSxDQUFDLDBCQUEwQixHQUFHLFVBQUMsS0FBYTtZQUM1RCxJQUFNLEtBQUssR0FBRyxLQUFLLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQztZQUNyRCxLQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsc0JBQXNCLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFJLENBQUMsQ0FBQztRQUN6RSxDQUFDLENBQUM7UUFFRixLQUFJLENBQUMsYUFBYSxDQUFDLHlCQUF5QixHQUFHLFVBQUMsS0FBYTtZQUMzRCxJQUFJLEtBQUssR0FBRyxPQUFPLENBQUM7WUFDcEIsSUFBTSxhQUFhLEdBQUcsS0FBSSxDQUFDLGFBQWEsQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO1lBRS9ELElBQUksS0FBSyxLQUFLLFFBQVEsRUFBRTtnQkFDdEIsS0FBSyxHQUFHLGFBQWEsSUFBSSxhQUFhLENBQUMsS0FBSyxLQUFLLFFBQVEsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUM7YUFDakY7WUFDRCxLQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUscUJBQXFCLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFJLENBQUMsQ0FBQztRQUN4RSxDQUFDLENBQUM7UUFFRixLQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsR0FBRyxVQUFDLFNBQTBCO1lBQzdELElBQU0sT0FBTyxHQUFHLElBQUksMkJBQVksQ0FBQyxTQUFTLENBQUMsQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUN4RCxLQUFJLENBQUMsVUFBVSxDQUFDLEtBQUssQ0FBQyxlQUFlLEVBQUUsZUFBZSxFQUFFLE9BQU8sRUFBRSxLQUFJLENBQUMsQ0FBQztRQUN6RSxDQUFDLENBQUM7UUFFRixLQUFJLENBQUMsYUFBYSxDQUFDLDZCQUE2QixHQUFHLFVBQUMsSUFBeUI7WUFDM0UsSUFBTSxxQkFBcUIsR0FBRyxJQUFJLDJCQUFZLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3ZFLElBQU0sc0JBQXNCLEdBQUcsSUFBSSwyQkFBWSxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLENBQUMsU0FBUyxFQUFFLENBQUM7WUFFL0UsS0FBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsZUFBZSxFQUFFLDZCQUE2QixFQUFFO2dCQUNwRSxlQUFlLEVBQUUscUJBQXFCO2dCQUN0QyxnQkFBZ0IsRUFBRSxzQkFBc0I7YUFDekMsRUFBRSxLQUFJLENBQUMsQ0FBQztRQUNYLENBQUMsQ0FBQztRQUVGLEtBQUksQ0FBQyxhQUFhLENBQUMsMEJBQTBCLEdBQUcsVUFBQyxLQUFhO1lBQzVELElBQU0sS0FBSyxHQUFHLEtBQUssS0FBSyxRQUFRLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDO1lBQ3JELEtBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxzQkFBc0IsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLEtBQUksQ0FBQyxDQUFDO1FBQ3pFLENBQUMsQ0FBQztRQUVGLEtBQUksQ0FBQyxhQUFhLENBQUMscUJBQXFCLEdBQUcsVUFBQyxJQUFvQztZQUM5RSxLQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLEtBQUksQ0FBQyxDQUFDO1lBQzlELEtBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQzdELENBQUMsQ0FBQztRQUVGLEtBQUksQ0FBQyxhQUFhLENBQUMseUJBQXlCLEdBQUcsVUFBQyxLQUFhO1lBQzNELEtBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLHFCQUFxQixFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsS0FBSSxDQUFDLENBQUM7UUFDbEUsQ0FBQyxDQUFDO1FBRUYsS0FBSSxDQUFDLGFBQWEsQ0FBQyxzQkFBc0IsR0FBRyxVQUFDLEtBQWE7WUFDeEQsS0FBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsaUJBQWlCLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxLQUFJLENBQUMsQ0FBQztRQUM5RCxDQUFDLENBQUM7UUFFRixLQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsR0FBRyxVQUFDLEdBQVc7WUFDOUMsS0FBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7WUFDcEIsS0FBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsZ0NBQWdDLEVBQUUsdUJBQXVCLEVBQUU7Z0JBQzlFLE9BQU8sRUFBRSxHQUFHO2FBQ2IsRUFBRSxLQUFJLENBQUMsQ0FBQztZQUNULEtBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLHVCQUF1QixDQUFDLENBQUM7WUFFOUMsS0FBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLHNCQUFzQixDQUFDLENBQUM7UUFDakUsQ0FBQyxDQUFDO1FBRUYsS0FBSSxDQUFDLGFBQWEsQ0FBQyxRQUFRLEdBQUcsVUFBQyxHQUFXO1lBQ3hDLEtBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxnQkFBZ0IsQ0FBQyxDQUFDO1FBQzNELENBQUMsQ0FBQztRQUVGLEtBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxHQUFHO1lBQy9CLGdHQUFnRztZQUNoRyxJQUFJLEtBQUksQ0FBQyxPQUFPLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLEVBQUU7Z0JBQzVDLEtBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO2FBQzVCO1FBQ0gsQ0FBQyxDQUFDO1FBRUYsS0FBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLEdBQUcsVUFBQyxHQUFXO1lBQzdDLEtBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO1lBQ3BCLEtBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLGlDQUFpQyxFQUFFLHVCQUF1QixFQUFFO2dCQUMvRSxPQUFPLEVBQUUsR0FBRzthQUNiLEVBQUUsS0FBSSxDQUFDLENBQUM7WUFDVCxLQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFLHVCQUF1QixDQUFDLENBQUM7WUFDdEQsS0FBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7UUFDN0IsQ0FBQyxDQUFDO1FBRUYsS0FBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLEdBQUcsVUFBQyxDQUFNO1lBQ2xDLElBQUksQ0FBQyxDQUFDLFVBQVUsS0FBSyxJQUFJLEVBQUU7Z0JBQ3pCLEtBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLElBQUksSUFBSSxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO2FBQzVDO1lBRUQsSUFBTSxLQUFLLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLElBQUksSUFBSSxzQkFBYSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDO1lBQ25GLEtBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLHFDQUFxQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1lBQzFELEtBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzVCLENBQUMsQ0FBQztRQUVGLEtBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxHQUFHO1lBQzFCLGlFQUFpRTtZQUNqRSx1REFBdUQ7WUFDdkQsbUVBQW1FO1lBQ25FLG1FQUFtRTtZQUNuRSxzRUFBc0U7WUFDdEUsa0VBQWtFO1lBQ2xFLEVBQUU7WUFDRixnRUFBZ0U7WUFDaEUsSUFBSSxLQUFJLENBQUMsT0FBTyxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxJQUFJLEtBQUksQ0FBQyxPQUFPLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZLEVBQUU7Z0JBQ2hGLE9BQU87YUFDUjtpQkFBTSxJQUFJLEtBQUksQ0FBQyxPQUFPLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLElBQUksS0FBSSxDQUFDLE9BQU8sS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLFVBQVUsRUFBRTtnQkFDeEYsS0FBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztnQkFDakIsS0FBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztnQkFDcEMsS0FBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7YUFDL0I7aUJBQU07Z0JBQ0wsa0RBQWtEO2dCQUNsRCxLQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxDQUFDO2FBQzVCO1FBQ0gsQ0FBQyxDQUFDO1FBRUYsS0FBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLEdBQUc7WUFDM0IsS0FBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztZQUNqQyxJQUFJLEtBQUksQ0FBQyxRQUFRLENBQUMsb0JBQW9CLElBQUksS0FBSSxDQUFDLFFBQVEsQ0FBQyxvQkFBb0IsRUFBRTtnQkFDNUUsNkVBQTZFO2dCQUM3RSxzREFBc0Q7Z0JBQ3RELG1FQUFtRTttQkFDaEUsQ0FBQyxLQUFJLENBQUMsWUFBWSxJQUFJLENBQUMsS0FBSSxDQUFDLFdBQVcsRUFBRTtnQkFFNUMsS0FBSSxDQUFDLFdBQVcsQ0FBQyxHQUFHLENBQUMsZ0JBQU0sQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7YUFDMUQ7WUFFRCxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbEIsS0FBSSxDQUFDLGVBQWUsRUFBRSxDQUFDO1lBRXZCLElBQUksQ0FBQyxLQUFJLENBQUMsWUFBWSxJQUFJLENBQUMsS0FBSSxDQUFDLFdBQVcsRUFBRTtnQkFDM0MsNEJBQTRCO2dCQUM1QixLQUFJLENBQUMsSUFBSSxDQUFDLFlBQVksRUFBRSxLQUFJLENBQUMsQ0FBQzthQUMvQjtRQUNILENBQUMsQ0FBQztRQUVGLEtBQUksQ0FBQyxRQUFRLEdBQUcsTUFBTSxDQUFDLE9BQU8sQ0FBQztRQUMvQixLQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsS0FBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1FBQ3JDLEtBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxLQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDM0MsS0FBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLEtBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1FBQ2xELEtBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxLQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDN0MsS0FBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLEVBQUUsS0FBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFDM0QsS0FBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsV0FBVyxFQUFFLEtBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztRQUNqRCxLQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsS0FBSSxDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFFckQsS0FBSSxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsVUFBQSxLQUFLO1lBQ3BCLEtBQUksQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLFlBQVksRUFBRSxPQUFPLEVBQUU7Z0JBQzNDLElBQUksRUFBRSxLQUFLLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxLQUFLLENBQUMsT0FBTzthQUN6QyxFQUFFLEtBQUksQ0FBQyxDQUFDO1lBRVQsSUFBSSxLQUFJLENBQUMsUUFBUSxJQUFJLEtBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxLQUFLLGNBQWMsRUFBRTtnQkFDNUQsS0FBSSxDQUFDLHNCQUFzQixFQUFFLENBQUM7YUFDL0I7UUFDSCxDQUFDLENBQUMsQ0FBQztRQUVILEtBQUksQ0FBQyxFQUFFLENBQUMsWUFBWSxFQUFFO1lBQ3BCLEtBQUksQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO1FBQ2hDLENBQUMsQ0FBQyxDQUFDOztJQUNMLENBQUM7SUFyYkQsc0JBQUksMkJBQVM7UUFIYjs7V0FFRzthQUNIO1lBQ0UsT0FBTyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQ3pCLENBQUM7OztPQUFBO0lBTUQsc0JBQUksdUJBQUs7UUFKVDs7O1dBR0c7YUFDSDtZQUNFLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztRQUNyQixDQUFDOzs7T0FBQTtJQTZhRDs7OztPQUlHO0lBQ0gsd0NBQXlCLEdBQXpCLFVBQTBCLE1BQTBCO1FBQ2xELE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUM3RCxDQUFDO0lBRUQ7Ozs7T0FJRztJQUNILDBCQUFXLEdBQVgsVUFBWSxPQUFpQjtRQUMzQixPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ2pELENBQUM7SUFFRDs7O09BR0c7SUFDSCxxQkFBTSxHQUFOLFVBQU8sT0FBNEI7UUFBbkMsaUJBNkdDO1FBNUdDLElBQUksSUFBSSxDQUFDLE9BQU8sS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRTtZQUN2QyxPQUFPO1NBQ1I7UUFFRCxPQUFPLEdBQUcsT0FBTyxJQUFJLEVBQUcsQ0FBQztRQUN6QixJQUFNLGdCQUFnQixHQUFHLE9BQU8sQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLGdCQUFnQixDQUFDO1FBQ3BGLElBQU0sY0FBYyxHQUFHLE9BQU8sQ0FBQyxjQUFjLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLElBQUksRUFBRyxDQUFDO1FBQ3JGLElBQU0sZ0JBQWdCLEdBQUcsY0FBYyxDQUFDLEtBQUssSUFBSSxFQUFFLEtBQUssRUFBRSxJQUFJLEVBQUUsQ0FBQztRQUVqRSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxDQUFDO1FBRXJDLElBQU0sT0FBTyxHQUFHO1lBQ2QsSUFBSSxLQUFJLENBQUMsT0FBTyxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsVUFBVSxFQUFFO2dCQUMxQywrQkFBK0I7Z0JBQy9CLEtBQUksQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO2dCQUM5QixLQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxDQUFDO2dCQUMzQixPQUFPO2FBQ1I7WUFFRCxJQUFNLFFBQVEsR0FBRyxVQUFDLEVBQXFCLEVBQUUsY0FBdUI7Z0JBQzlELHdEQUF3RDtnQkFDeEQsSUFBTSxTQUFTLEdBQUcsS0FBSSxDQUFDLFVBQVUsS0FBSyxJQUFJLENBQUMsYUFBYSxDQUFDLFFBQVE7b0JBQy9ELENBQUMsQ0FBQyxtQkFBbUI7b0JBQ3JCLENBQUMsQ0FBQyxvQkFBb0IsQ0FBQztnQkFDekIsS0FBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsS0FBSSxDQUFDLENBQUM7Z0JBRTFELElBQUksT0FBTyxjQUFjLEtBQUssUUFBUSxFQUFFO29CQUN0QyxLQUFJLENBQUMsd0JBQXdCLEdBQUcsY0FBYyxDQUFDO2lCQUNoRDtnQkFFRCxrRUFBa0U7Z0JBQzVELElBQUEsS0FBNkIsMkJBQXFCLENBQUMsS0FBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsTUFBTSxFQUFFLENBQUMsRUFBckYsU0FBUyxlQUFBLEVBQUUsV0FBVyxpQkFBK0QsQ0FBQztnQkFDOUYsS0FBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLE9BQU8sRUFBRTtvQkFDeEMsWUFBWSxFQUFFLFdBQVc7b0JBQ3pCLGNBQWMsRUFBRSxTQUFTO2lCQUMxQixFQUFFLEtBQUksQ0FBQyxDQUFDO2dCQUVULHdCQUF3QjtnQkFDeEIsS0FBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDM0IsQ0FBQyxDQUFDO1lBRUYsSUFBTSxPQUFPLEdBQUcsT0FBTyxLQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsS0FBSyxVQUFVLElBQUksS0FBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUM3RixJQUFJLEtBQUssQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDLEVBQUU7Z0JBQzFCLEtBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLE9BQU8sQ0FBQyxDQUFDLEtBQUssQ0FBQztvQkFDNUMsdUVBQXVFO29CQUN2RSxzRUFBc0U7b0JBQ3RFLHVDQUF1QztnQkFDekMsQ0FBQyxDQUFDLENBQUM7YUFDSjtZQUVELEtBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxLQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFcEQsSUFBSSxLQUFJLENBQUMsVUFBVSxLQUFLLElBQUksQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFO2dCQUNuRCxLQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztnQkFDeEIsS0FBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLEtBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztnQkFDM0MsS0FBSSxDQUFDLGFBQWEsQ0FBQyxrQkFBa0IsQ0FBQyxLQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxLQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFDbkYsY0FBYyxFQUFFLGdCQUFnQixFQUFFLFFBQVEsQ0FBQyxDQUFDO2FBQy9DO2lCQUFNO2dCQUNMLElBQU0sTUFBTSxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsS0FBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQUEsSUFBSTtvQkFDbEUsT0FBRyxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsU0FBSSxrQkFBa0IsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUc7Z0JBQS9ELENBQStELENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLENBQUM7Z0JBQzVFLEtBQUksQ0FBQyxRQUFRLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxLQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7Z0JBQzNDLEtBQUksQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsS0FBSSxDQUFDLFFBQVEsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLEtBQUksQ0FBQyxvQkFBb0IsRUFDeEYsY0FBYyxFQUFFLGdCQUFnQixFQUFFLFFBQVEsQ0FBQyxDQUFDO2FBQy9DO1FBQ0gsQ0FBQyxDQUFDO1FBRUYsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksRUFBRTtZQUM5QixJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUNsQztRQUVELElBQU0sV0FBVyxHQUFHLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLEtBQUssVUFBVSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxFQUFFLENBQUM7UUFFekcsSUFBTSxPQUFPLEdBQUcsV0FBVztZQUN6QixDQUFDLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyx3QkFBd0IsQ0FBQyxXQUFXLENBQUM7WUFDMUQsQ0FBQyxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsbUJBQW1CLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztRQUU3RCxPQUFPLENBQUMsSUFBSSxDQUFDO1lBQ1gsS0FBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLEVBQUUsV0FBVyxFQUFFO2dCQUNsRCxJQUFJLEVBQUUsRUFBRSxnQkFBZ0Isa0JBQUEsRUFBRTthQUMzQixFQUFFLEtBQUksQ0FBQyxDQUFDO1lBRVQsT0FBTyxFQUFFLENBQUM7UUFDWixDQUFDLEVBQUUsVUFBQyxLQUEwQjtZQUM1QixJQUFJLFdBQVcsQ0FBQztZQUVoQixJQUFJLEtBQUssQ0FBQyxJQUFJLEtBQUssS0FBSzttQkFDbkIsQ0FBQyx1QkFBdUIsRUFBRSxpQkFBaUIsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLEVBQUU7Z0JBQzVFLFdBQVcsR0FBRyxJQUFJLHdCQUFlLENBQUMscUJBQXFCLEVBQUUsQ0FBQztnQkFDMUQsS0FBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsUUFBUSxFQUFFO29CQUNoRCxJQUFJLEVBQUU7d0JBQ0osZ0JBQWdCLGtCQUFBO3dCQUNoQixLQUFLLE9BQUE7cUJBQ047aUJBQ0YsRUFBRSxLQUFJLENBQUMsQ0FBQzthQUNWO2lCQUFNO2dCQUNMLFdBQVcsR0FBRyxJQUFJLHdCQUFlLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztnQkFFM0QsS0FBSSxDQUFDLFVBQVUsQ0FBQyxLQUFLLENBQUMsZ0JBQWdCLEVBQUUsUUFBUSxFQUFFO29CQUNoRCxJQUFJLEVBQUU7d0JBQ0osZ0JBQWdCLGtCQUFBO3dCQUNoQixLQUFLLE9BQUE7cUJBQ047aUJBQ0YsRUFBRSxLQUFJLENBQUMsQ0FBQzthQUNWO1lBRUQsS0FBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ25CLEtBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLFdBQVcsQ0FBQyxDQUFDO1FBQ2xDLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOztPQUVHO0lBQ0gseUJBQVUsR0FBVjtRQUNFLElBQUksQ0FBQyxXQUFXLEVBQUUsQ0FBQztJQUNyQixDQUFDO0lBRUQ7O09BRUc7SUFDSCw2QkFBYyxHQUFkO1FBQ0UsT0FBTyxJQUFJLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDO0lBQ3pELENBQUM7SUFFRDs7T0FFRztJQUNILDhCQUFlLEdBQWY7UUFDRSxPQUFPLElBQUksQ0FBQyxhQUFhLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxhQUFhLENBQUM7SUFDaEUsQ0FBQztJQUVEOztPQUVHO0lBQ0gscUJBQU0sR0FBTjtRQUNFLElBQUksSUFBSSxDQUFDLE9BQU8sS0FBSyxJQUFJLENBQUMsS0FBSyxDQUFDLE9BQU8sRUFBRTtZQUN2QyxPQUFPO1NBQ1I7UUFFRCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDO1FBQ2pDLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDbkQsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLGtCQUFrQixFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztRQUVuRSxJQUFJLElBQUksQ0FBQyxTQUFTLEVBQUU7WUFDbEIsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1NBQ2xCO0lBQ0gsQ0FBQztJQUVEOztPQUVHO0lBQ0gsc0JBQU8sR0FBUDtRQUNFLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUM7SUFDcEMsQ0FBQztJQUVEOzs7T0FHRztJQUNILG1CQUFJLEdBQUosVUFBSyxVQUEwQjtRQUExQiwyQkFBQSxFQUFBLGlCQUEwQjtRQUM3QixJQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQztRQUM1QyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztRQUVwQyxJQUFNLE9BQU8sR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQztRQUMzQyxJQUFJLFFBQVEsS0FBSyxPQUFPLEVBQUU7WUFDeEIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLE9BQU8sQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxTQUFTLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQzlFLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztTQUNsQztJQUNILENBQUM7SUFFRDs7Ozs7Ozs7OztPQVVHO0lBQ0gsMkJBQVksR0FBWixVQUFhLEtBQTBCLEVBQUUsS0FBMEI7UUFDakUsSUFBSSxPQUFPLEtBQUssS0FBSyxXQUFXLElBQUksS0FBSyxLQUFLLElBQUksRUFBRTtZQUNsRCxPQUFPLElBQUksQ0FBQyxxQkFBcUIsRUFBRSxDQUFDO1NBQ3JDO1FBRUQsSUFBSSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxLQUFLLENBQUMsRUFBRTtZQUN0RCxNQUFNLElBQUksNkJBQW9CLENBQUMsb0NBQWtDLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBRyxDQUFDLENBQUM7U0FDdkc7UUFFRCxJQUFJLE9BQU8sS0FBSyxLQUFLLFdBQVcsSUFBSSxLQUFLLEtBQUssSUFBSSxJQUFJLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxFQUFFO1lBQ3hHLE1BQU0sSUFBSSw2QkFBb0IsQ0FBQyxvQ0FBa0MsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFHLENBQUMsQ0FBQztTQUN2RztRQUVELE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLFVBQVUsRUFBRTtZQUNsRCxVQUFVLEVBQUUsS0FBSztZQUNqQixhQUFhLEVBQUUsS0FBSztTQUNyQixFQUFFLElBQUksRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNqQixDQUFDO0lBRUQ7O09BRUc7SUFDSCxxQkFBTSxHQUFOO1FBQ0UsSUFBSSxJQUFJLENBQUMsT0FBTyxLQUFLLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxFQUFFO1lBQ3ZDLE9BQU87U0FDUjtRQUVELElBQUksQ0FBQyxXQUFXLEdBQUcsSUFBSSxDQUFDO1FBQ3hCLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDOUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUNuRCxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsbUJBQW1CLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQ3BFLElBQUksQ0FBQyxzQkFBc0IsRUFBRSxDQUFDO1FBQzlCLElBQUksQ0FBQyxhQUFhLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDM0IsSUFBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQztRQUNqQyxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQ3RCLENBQUM7SUFFRDs7O09BR0c7SUFDSCx5QkFBVSxHQUFWLFVBQVcsTUFBYztRQUN2QixJQUFJLE1BQU0sQ0FBQyxLQUFLLENBQUMsV0FBVyxDQUFDLEVBQUU7WUFDN0IsTUFBTSxJQUFJLDZCQUFvQixDQUFDLDBDQUEwQyxDQUFDLENBQUM7U0FDNUU7UUFFRCxJQUFNLFFBQVEsR0FBYSxFQUFFLENBQUM7UUFDOUIsTUFBTSxDQUFDLEtBQUssQ0FBQyxFQUFFLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQyxLQUFhO1lBQ3JDLElBQUksSUFBSSxHQUFHLENBQUMsS0FBSyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxTQUFPLEtBQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDO1lBQ2pELElBQUksSUFBSSxLQUFLLE9BQU8sRUFBRTtnQkFBRSxJQUFJLEdBQUcsT0FBTyxDQUFDO2FBQUU7WUFDekMsSUFBSSxJQUFJLEtBQUssT0FBTyxFQUFFO2dCQUFFLElBQUksR0FBRyxPQUFPLENBQUM7YUFBRTtZQUN6QyxRQUFRLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFDO1FBQ3RCLENBQUMsQ0FBQyxDQUFDO1FBRUgsOEVBQThFO1FBQzlFLENBQUMsU0FBUyxhQUFhLENBQUMsVUFBVSxFQUFFLGNBQWM7WUFDaEQsSUFBTSxLQUFLLEdBQXVCLFFBQVEsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUVuRCxJQUFJLEtBQUssRUFBRTtnQkFDVCxJQUFJLGNBQWMsRUFBRTtvQkFDbEIsY0FBYyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztpQkFDNUI7cUJBQU07b0JBQ0wsVUFBVSxDQUFDLEdBQUcsQ0FBQyxLQUF5QixDQUFDLENBQUMsSUFBSSxFQUFFLENBQUM7aUJBQ2xEO2FBQ0Y7WUFFRCxJQUFJLFFBQVEsQ0FBQyxNQUFNLEVBQUU7Z0JBQ25CLFVBQVUsQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxVQUFVLENBQUMsRUFBRSxHQUFHLENBQUMsQ0FBQzthQUN2RDtRQUNILENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsSUFBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUVuRCxJQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLHFCQUFxQixFQUFFLENBQUM7UUFFOUQsU0FBUyxVQUFVLENBQUMsS0FBZTtZQUNqQyxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sRUFBRTtnQkFBRSxPQUFPO2FBQUU7WUFDOUIsSUFBTSxJQUFJLEdBQXVCLEtBQUssQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUUvQyxJQUFJLElBQUksSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFO2dCQUN2QixVQUFVLENBQUMsVUFBVSxDQUFDLElBQUksRUFBRSxrQkFBa0IsRUFBRSxtQkFBbUIsQ0FBQyxDQUFDO2FBQ3RFO1lBRUQsVUFBVSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxFQUFFLG1CQUFtQixDQUFDLENBQUM7UUFDaEUsQ0FBQztRQUVELElBQUksVUFBVSxFQUFFO1lBQ2QsSUFBSSxDQUFDLENBQUMsZUFBZSxJQUFJLFVBQVUsQ0FBQyxJQUFJLFVBQVUsQ0FBQyxhQUFhLEVBQUU7Z0JBQ2hFLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLG9DQUFvQyxDQUFDLENBQUM7Z0JBQ3JELHFEQUFxRDtnQkFDckQsNkRBQTZEO2dCQUM3RCwwREFBMEQ7Z0JBQzFELFVBQVUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUM7Z0JBQzlCLE9BQU87YUFDUjtZQUVELElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGtDQUFrQyxDQUFDLENBQUM7U0FDcEQ7UUFFRCxvQ0FBb0M7UUFDcEMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsNkJBQTZCLENBQUMsQ0FBQztRQUU5QyxJQUFJLElBQUksQ0FBQyxRQUFRLEtBQUssSUFBSSxJQUFJLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxLQUFLLGNBQWMsRUFBRTtZQUNyRSxJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztTQUNyRDthQUFNO1lBQ0wsSUFBTSxLQUFLLEdBQUcsSUFBSSxzQkFBYSxDQUFDLGVBQWUsQ0FBQyx3REFBd0QsQ0FBQyxDQUFDO1lBQzFHLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQzNCO0lBQ0gsQ0FBQztJQUVEOzs7Ozs7T0FNRztJQUNILDBCQUFXLEdBQVgsVUFBWSxPQUFxQjtRQUN2QixJQUFBLE9BQU8sR0FBK0IsT0FBTyxRQUF0QyxFQUFFLFdBQVcsR0FBa0IsT0FBTyxZQUF6QixFQUFFLFdBQVcsR0FBSyxPQUFPLFlBQVosQ0FBYTtRQUV0RCxJQUFJLE9BQU8sT0FBTyxLQUFLLFdBQVcsSUFBSSxPQUFPLEtBQUssSUFBSSxFQUFFO1lBQ3RELE1BQU0sSUFBSSw2QkFBb0IsQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO1NBQ3REO1FBRUQsSUFBSSxPQUFPLFdBQVcsS0FBSyxRQUFRLEVBQUU7WUFDbkMsTUFBTSxJQUFJLDZCQUFvQixDQUM1QixzRUFBc0U7Z0JBQ3RFLFdBQVcsQ0FDWixDQUFDO1NBQ0g7UUFFRCxJQUFJLFdBQVcsQ0FBQyxNQUFNLEtBQUssQ0FBQyxFQUFFO1lBQzVCLE1BQU0sSUFBSSw2QkFBb0IsQ0FDNUIsMkNBQTJDLENBQzVDLENBQUM7U0FDSDtRQUVELElBQUksSUFBSSxDQUFDLFFBQVEsS0FBSyxJQUFJLEVBQUU7WUFDMUIsTUFBTSxJQUFJLDBCQUFpQixDQUN6QiwrREFBK0QsQ0FDaEUsQ0FBQztTQUNIO1FBRUQsSUFBTSxPQUFPLEdBQUcsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUM7UUFDeEMsSUFBSSxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxLQUFLLFdBQVcsRUFBRTtZQUNsRCxNQUFNLElBQUksMEJBQWlCLENBQ3pCLGlEQUFpRCxDQUNsRCxDQUFDO1NBQ0g7UUFFRCxJQUFNLGFBQWEsR0FBRyxJQUFJLENBQUMsdUJBQXVCLEVBQUUsQ0FBQztRQUNyRCxJQUFJLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxhQUFhLEVBQUUsRUFBRSxPQUFPLFNBQUEsRUFBRSxXQUFXLGFBQUEsRUFBRSxXQUFXLGFBQUEsRUFBRSxhQUFhLGVBQUEsRUFBRSxDQUFDLENBQUM7UUFDeEYsSUFBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxXQUFXLEVBQUUsV0FBVyxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQ3JGLE9BQU8sYUFBYSxDQUFDO0lBQ3ZCLENBQUM7SUFFRDs7T0FFRztJQUNILHFCQUFNLEdBQU47UUFDRSxPQUFPLElBQUksQ0FBQyxPQUFPLENBQUM7SUFDdEIsQ0FBQztJQVFEOzs7Ozs7Ozs7T0FTRztJQUNLLDJCQUFZLEdBQXBCLFVBQXFCLGFBQXFCLEVBQUUsYUFBcUIsRUFDNUMsU0FBaUIsRUFBRSxTQUEyQjtRQUNqRSxJQUFNLGdCQUFnQixHQUFZLGFBQWEsSUFBSSxFQUFFLENBQUM7UUFDdEQsSUFBSSxTQUFTLEdBQVcsQ0FBQyxDQUFDO1FBRTFCLElBQUksU0FBUyxLQUFLLGFBQWEsRUFBRTtZQUMvQixTQUFTLEdBQUcsYUFBYSxDQUFDO1NBQzNCO1FBRUQsSUFBSSxTQUFTLElBQUksRUFBRSxFQUFFO1lBQ25CLElBQUksQ0FBQyxZQUFZLENBQUMsY0FBYyxFQUFFLG9CQUFrQixTQUFTLFdBQVEsRUFBRSxFQUFFLEVBQUUsU0FBUyxFQUFFLEtBQUssQ0FBQyxDQUFDO1NBQzlGO2FBQU0sSUFBSSxnQkFBZ0IsRUFBRTtZQUMzQixJQUFJLENBQUMsWUFBWSxDQUFDLGNBQWMsRUFBRSxvQkFBa0IsU0FBUyxXQUFRLEVBQUUsRUFBRSxFQUFFLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztTQUM3RjtRQUVELE9BQU8sU0FBUyxDQUFDO0lBQ25CLENBQUM7SUFFRDs7T0FFRztJQUNLLHFDQUFzQixHQUE5QjtRQUFBLGlCQTZCQztRQTVCQyxJQUFNLE9BQU8sR0FBRztZQUNkLElBQUksQ0FBQyxLQUFJLENBQUMsUUFBUSxFQUFFO2dCQUFFLE9BQU87YUFBRTtZQUUvQixLQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsS0FBSSxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQ2pELEtBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLFFBQVEsRUFBRSxLQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7WUFDdkQsS0FBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsUUFBUSxFQUFFLEtBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUN2RCxLQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxPQUFPLEVBQUUsS0FBSSxDQUFDLGlCQUFpQixDQUFDLENBQUM7WUFDOUQsS0FBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsUUFBUSxFQUFFLEtBQUksQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUN2RCxLQUFJLENBQUMsUUFBUSxDQUFDLGNBQWMsQ0FBQyxTQUFTLEVBQUUsS0FBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDO1lBQ3pELEtBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLGdCQUFnQixFQUFFLEtBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO1lBQ3ZFLEtBQUksQ0FBQyxRQUFRLENBQUMsY0FBYyxDQUFDLFdBQVcsRUFBRSxLQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDN0QsS0FBSSxDQUFDLFFBQVEsQ0FBQyxjQUFjLENBQUMsU0FBUyxFQUFFLEtBQUksQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO1FBQ25FLENBQUMsQ0FBQztRQUVGLG9FQUFvRTtRQUNwRSw2RUFBNkU7UUFDN0UsTUFBTTtRQUNOLEVBQUU7UUFDRiwrQ0FBK0M7UUFDL0MsRUFBRTtRQUNGLHFFQUFxRTtRQUNyRSwrREFBK0Q7UUFDL0QsdUVBQXVFO1FBQ3ZFLDRFQUE0RTtRQUM1RSxvRUFBb0U7UUFDcEUsdUJBQXVCO1FBQ3ZCLE9BQU8sRUFBRSxDQUFDO1FBQ1YsVUFBVSxDQUFDLE9BQU8sRUFBRSxDQUFDLENBQUMsQ0FBQztJQUN6QixDQUFDO0lBRUQ7O09BRUc7SUFDSyxtQ0FBb0IsR0FBNUI7UUFDRSxJQUFNLE9BQU8sR0FBNEM7WUFDdkQsUUFBUSxFQUFFLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTztZQUNqQyxJQUFJLEVBQUUsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSTtZQUMxQixXQUFXLEVBQUUsZUFBZTtTQUM3QixDQUFDO1FBRUYsSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE9BQU8sRUFBRTtZQUN6QixPQUFPLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUMsT0FBTyxDQUFDO1NBQ3pDO1FBRUQsT0FBTyxDQUFDLFNBQVMsR0FBRyxJQUFJLENBQUMsVUFBVSxDQUFDO1FBQ3BDLE9BQU8sT0FBTyxDQUFDO0lBQ2pCLENBQUM7SUFFRDs7OztPQUlHO0lBQ0ssMEJBQVcsR0FBbkIsVUFBb0IsT0FBdUIsRUFBRSxTQUFtQjtRQUM5RCxPQUFPLEdBQUcsT0FBTyxPQUFPLEtBQUssUUFBUSxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztRQUV2RCxJQUFJLElBQUksQ0FBQyxPQUFPLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJO2VBQzdCLElBQUksQ0FBQyxPQUFPLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxVQUFVO2VBQ3RDLElBQUksQ0FBQyxPQUFPLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxZQUFZO2VBQ3hDLElBQUksQ0FBQyxPQUFPLEtBQUssSUFBSSxDQUFDLEtBQUssQ0FBQyxPQUFPLEVBQUU7WUFDMUMsT0FBTztTQUNSO1FBRUQsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUVuQyw4QkFBOEI7UUFDOUIsSUFBSSxJQUFJLENBQUMsUUFBUSxLQUFLLElBQUksSUFBSSxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sS0FBSyxjQUFjLElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFO1lBQy9GLElBQU0sT0FBTyxHQUF1QixJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sSUFBSSxJQUFJLENBQUMsb0JBQW9CLENBQUM7WUFDekYsSUFBSSxPQUFPLEVBQUU7Z0JBQ1gsSUFBSSxDQUFDLFFBQVEsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLE9BQU8sQ0FBQyxDQUFDO2FBQ3hDO1NBQ0Y7UUFFRCxJQUFJLENBQUMsc0JBQXNCLEVBQUUsQ0FBQztRQUM5QixJQUFJLENBQUMsYUFBYSxDQUFDLEtBQUssRUFBRSxDQUFDO1FBRTNCLElBQUksQ0FBQyxTQUFTLEVBQUU7WUFDZCxJQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsdUJBQXVCLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO1NBQ3pFO0lBQ0gsQ0FBQztJQTJDRDs7T0FFRztJQUNLLHFDQUFzQixHQUE5QjtRQUNFLElBQU0sWUFBWSxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUM7UUFDeEMsSUFBSSxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQ3BCLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDO1lBQy9CLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztZQUN4QyxJQUFJLElBQUksQ0FBQyxhQUFhLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLEtBQUssTUFBTSxFQUFFO2dCQUM5RCxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO2dCQUMvQixJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRTtvQkFDdkIsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUM7b0JBQzFCLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQyxDQUFDO2lCQUMzQjthQUNGO1NBQ0Y7SUFDSCxDQUFDO0lBd1VEOzs7T0FHRztJQUNLLG9DQUFxQixHQUE3QjtRQUNFLE9BQU8sSUFBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsVUFBVSxFQUFFLGVBQWUsRUFBRSxJQUFJLEVBQUUsSUFBSSxFQUFFLElBQUksQ0FBQyxDQUFDO0lBQzdFLENBQUM7SUFFRDs7T0FFRztJQUNLLDhCQUFlLEdBQXZCO1FBQUEsaUJBVUM7UUFUQyxJQUFJLElBQUksQ0FBQyxlQUFlLENBQUMsTUFBTSxLQUFLLENBQUMsRUFBRTtZQUNyQyxPQUFPO1NBQ1I7UUFFRCxJQUFJLENBQUMsVUFBVSxDQUFDLFdBQVcsQ0FDekIseUJBQXlCLEVBQUUsZ0JBQWdCLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixFQUFFLEVBQUUsSUFBSSxDQUMvRyxDQUFDLEtBQUssQ0FBQyxVQUFDLENBQU07WUFDYixLQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxxREFBcUQsRUFBRSxDQUFDLENBQUMsQ0FBQztRQUMzRSxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUF1Q0Q7OztPQUdHO0lBQ0ssMEJBQVcsR0FBbkIsVUFBb0IsT0FBK0I7UUFDakQsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLE9BQU8sQ0FBQztRQUNoQyxJQUFJLENBQUMsT0FBTyxFQUFFO1lBQUUsT0FBTztTQUFFO1FBRXpCLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUNsQyxJQUFJLENBQUMsYUFBYSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7SUFDdkMsQ0FBQztJQXQzQ0Q7OztPQUdHO0lBQ0ksYUFBUSxHQUFHLGNBQU0sT0FBQSxxQkFBcUIsRUFBckIsQ0FBcUIsQ0FBQztJQW0zQ2hELFdBQUM7Q0FBQSxBQXgzQ0QsQ0FBbUIscUJBQVksR0F3M0M5QjtBQUVELFdBQVUsSUFBSTtJQTRHWjs7T0FFRztJQUNILElBQVksS0FPWDtJQVBELFdBQVksS0FBSztRQUNmLDBCQUFpQixDQUFBO1FBQ2pCLGtDQUF5QixDQUFBO1FBQ3pCLHNCQUFhLENBQUE7UUFDYiw0QkFBbUIsQ0FBQTtRQUNuQixzQ0FBNkIsQ0FBQTtRQUM3Qiw0QkFBbUIsQ0FBQTtJQUNyQixDQUFDLEVBUFcsS0FBSyxHQUFMLFVBQUssS0FBTCxVQUFLLFFBT2hCO0lBRUQ7OztPQUdHO0lBQ0gsSUFBWSxhQU9YO0lBUEQsV0FBWSxhQUFhO1FBQ3ZCLCtDQUE4QixDQUFBO1FBQzlCLDZDQUE0QixDQUFBO1FBQzVCLDZDQUE0QixDQUFBO1FBQzVCLDhCQUFhLENBQUE7UUFDYix5Q0FBd0IsQ0FBQTtRQUN4Qiw4Q0FBNkIsQ0FBQTtJQUMvQixDQUFDLEVBUFcsYUFBYSxHQUFiLGtCQUFhLEtBQWIsa0JBQWEsUUFPeEI7SUFFRDs7O09BR0c7SUFDSCxJQUFZLGFBTVg7SUFORCxXQUFZLGFBQWE7UUFDdkIsK0NBQU8sQ0FBQTtRQUNQLCtDQUFHLENBQUE7UUFDSCxtREFBSyxDQUFBO1FBQ0wsaURBQUksQ0FBQTtRQUNKLGlEQUFJLENBQUE7SUFDTixDQUFDLEVBTlcsYUFBYSxHQUFiLGtCQUFhLEtBQWIsa0JBQWEsUUFNeEI7SUFFRDs7T0FFRztJQUNILElBQVksYUFHWDtJQUhELFdBQVksYUFBYTtRQUN2QixzQ0FBcUIsQ0FBQTtRQUNyQixzQ0FBcUIsQ0FBQTtJQUN2QixDQUFDLEVBSFcsYUFBYSxHQUFiLGtCQUFhLEtBQWIsa0JBQWEsUUFHeEI7SUFFRDs7T0FFRztJQUNILElBQVksS0FHWDtJQUhELFdBQVksS0FBSztRQUNmLHNCQUFhLENBQUE7UUFDYixzQkFBYSxDQUFBO0lBQ2YsQ0FBQyxFQUhXLEtBQUssR0FBTCxVQUFLLEtBQUwsVUFBSyxRQUdoQjtJQUVEOztPQUVHO0lBQ0gsSUFBWSx5QkFHWDtJQUhELFdBQVkseUJBQXlCO1FBQ25DLDBDQUFhLENBQUE7UUFDYixnREFBbUIsQ0FBQTtJQUNyQixDQUFDLEVBSFcseUJBQXlCLEdBQXpCLDhCQUF5QixLQUF6Qiw4QkFBeUIsUUFHcEM7SUFFRDs7T0FFRztJQUNILElBQVksWUFLWDtJQUxELFdBQVksWUFBWTtRQUN0QixpRUFBaUQsQ0FBQTtRQUNqRCxxREFBcUMsQ0FBQTtRQUNyQyx5REFBeUMsQ0FBQTtRQUN6QyxxQ0FBcUIsQ0FBQTtJQUN2QixDQUFDLEVBTFcsWUFBWSxHQUFaLGlCQUFZLEtBQVosaUJBQVksUUFLdkI7SUFFRDs7T0FFRztJQUNILElBQVksV0FRWDtJQVJELFdBQVksV0FBVztRQUNyQjs7Ozs7V0FLRztRQUNILDBEQUEyQyxDQUFBO0lBQzdDLENBQUMsRUFSVyxXQUFXLEdBQVgsZ0JBQVcsS0FBWCxnQkFBVyxRQVF0QjtBQTBPSCxDQUFDLEVBeGFTLElBQUksS0FBSixJQUFJLFFBd2FiO0FBRUQsU0FBUyxtQkFBbUI7SUFDMUIsT0FBTyx5Q0FBeUMsQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLFVBQUEsQ0FBQztRQUNqRSwrQkFBK0I7UUFDL0IsSUFBTSxDQUFDLEdBQUcsSUFBSSxDQUFDLE1BQU0sRUFBRSxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUM7UUFDakMsSUFBTSxDQUFDLEdBQUcsQ0FBQyxLQUFLLEdBQUcsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUMsR0FBRyxHQUFHLEdBQUcsR0FBRyxDQUFDLENBQUM7UUFDMUMsOEJBQThCO1FBQzlCLE9BQU8sQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQztJQUN4QixDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxrQkFBZSxJQUFJLENBQUMifQ==