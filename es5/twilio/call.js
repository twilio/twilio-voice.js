'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var events = require('events');
var backoff = require('./backoff.js');
var device = require('./device.js');
var index = require('./errors/index.js');
var log = require('./log.js');
var peerconnection = require('./rtc/peerconnection.js');
require('./rtc/rtcpc.js');
var icecandidate = require('./rtc/icecandidate.js');
var sdp = require('./rtc/sdp.js');
var sid = require('./sid.js');
var statsMonitor = require('./statsMonitor.js');
var util = require('./util.js');
var constants = require('./constants.js');
var generated = require('./errors/generated.js');

var BACKOFF_CONFIG = {
    factor: 1.1,
    jitter: 0.5,
    max: 30000,
    min: 1,
};
var DTMF_INTER_TONE_GAP = 70;
// Cadence of the feedback tones the caller hears. Intentionally independent of
// the wire's tone timing: this is audible feedback, not a mirror of what the
// recipient receives.
var DTMF_LOCAL_TONE_GAP = 200;
var DTMF_PAUSE_DURATION = 500;
var DTMF_TONE_DURATION = 160;
var METRICS_BATCH_SIZE = 10;
var METRICS_DELAY = 5000;
var MEDIA_DISCONNECT_ERROR = {
    disconnect: true,
    info: {
        code: 31003,
        message: 'Connection with Twilio was interrupted.',
        twilioError: new generated.MediaErrors.ConnectionError(),
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
 */
exports.default = /** @class */ (function (_super) {
    tslib.__extends(Call, _super);
    /**
     * @internal
     * @param config - Mandatory configuration options
     * @param options - Optional settings
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
        _this._log = new log.default('Call');
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
            MediaHandler: peerconnection.default,
            MediaStream: null,
            enableImprovedSignalingErrorPrecision: false,
            offerSdp: null,
            shouldPlayDisconnect: function () { return true; },
            voiceEventSidGenerator: sid.generateVoiceEventSid,
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
         * @internal
         */
        _this.toString = function () { return '[Twilio.Call instance]'; };
        _this._emitWarning = function (groupPrefix, warningName, threshold, value, wasCleared, warningData) {
            var groupSuffix = wasCleared ? '-cleared' : '-raised';
            var groupName = "".concat(groupPrefix, "warning").concat(groupSuffix);
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
                _this._log.debug("#".concat(emitName), warningName);
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
                _this._log.warn("Received ack from a different callsid: ".concat(callsid));
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
                var errorConstructor = index.getPreciseSignalingErrorByCode(_this._options.enableImprovedSignalingErrorPrecision, code);
                var error = typeof errorConstructor !== 'undefined'
                    ? new errorConstructor(payload.error.message)
                    : new generated.GeneralErrors.ConnectionError('Error sent from gateway in HANGUP', payload.error);
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
            if (!util.isChrome(window, window.navigator) && type === ConnectionFailed) {
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
                var mediaReconnectionError = new generated.MediaErrors.ConnectionError('Media connection failed.');
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
                _this._log.warn("Received a message from a different callsid: ".concat(callsid));
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
                _this._log.warn("Received a messageSent with a voiceEventSid that doesn't exists: ".concat(voiceEventSid));
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
            var callMetrics = tslib.__assign(tslib.__assign({}, sample), { inputVolume: _this._latestInputVolume, outputVolume: _this._latestOutputVolume });
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
                _this._log.warn("Received an error from a different callsid: ".concat(callsid));
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
                var errorConstructor = index.getPreciseSignalingErrorByCode(!!_this._options.enableImprovedSignalingErrorPrecision, error.code);
                if (typeof errorConstructor !== 'undefined') {
                    twilioError = new errorConstructor(error);
                }
                if (!twilioError) {
                    _this._log.error('Unknown Call Message Error: ', error);
                    twilioError = new generated.GeneralErrors.UnknownError(error.message, error);
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
                _this._publisher.info('connection', 'reconnecting', null, _this);
                _this._log.debug('#reconnecting');
                _this.emit('reconnecting', new generated.SignalingErrors.ConnectionDisconnected());
            }
            else {
                // The transport is closed; do not queue a hangup for replay.
                _this._shouldSendHangup = false;
                _this._disconnect(null, true);
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
            _this._options.voiceEventSidGenerator || sid.generateVoiceEventSid;
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
        _this._mediaReconnectBackoff = new backoff.default(BACKOFF_CONFIG);
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
        var monitor = _this._monitor = new (_this._options.StatsMonitor || statsMonitor.default)();
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
            MediaStream: _this._options.MediaStream,
            RTCPeerConnection: _this._options.RTCPeerConnection,
            codecPreferences: _this._options.codecPreferences,
            dscp: _this._options.dscp,
            forceAggressiveIceNomination: _this._options.forceAggressiveIceNomination,
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
            var payload = new icecandidate.IceCandidate(candidate).toPayload();
            _this._publisher.debug('ice-candidate', 'ice-candidate', payload, _this);
        };
        _this._mediaHandler.onselectedcandidatepairchange = function (pair) {
            var localCandidatePayload = new icecandidate.IceCandidate(pair.local).toPayload();
            var remoteCandidatePayload = new icecandidate.IceCandidate(pair.remote, true).toPayload();
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
            var error = e.info.twilioError || new generated.GeneralErrors.UnknownError(e.info.message);
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
                _this._soundcache.get(device.default.SoundName.Disconnect).play();
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
     * @internal
     * @param stream
     */
    Call.prototype._setInputTracksFromStream = function (stream) {
        return this._mediaHandler.setInputTracksFromStream(stream);
    };
    /**
     * Set the audio output sink IDs.
     * @internal
     * @param sinkIds
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
            this._log.debug(".accept noop. status is '".concat(this._status, "'"));
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
                var _a = sdp.getPreferredCodecInfo(_this._mediaHandler.version.getSDP()), codecName = _a.codecName, codecParams = _a.codecParams;
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
                    return "".concat(encodeURIComponent(pair[0]), "=").concat(encodeURIComponent(pair[1]));
                }).join('&');
                _this._pstream.on('answer', _this._onAnswer);
                _this._mediaHandler.makeOutgoingCall(params, _this._signalingReconnectToken, _this._options.reconnectCallSid || _this.outboundConnectionId, rtcConfiguration, onAnswer);
            }
        };
        if (this._options.beforeAccept) {
            this._options.beforeAccept(this);
        }
        // beforeAccept can disconnect this call, e.g. when another call's disconnect handler
        // accepts a different call.
        if (this._status !== Call.State.Connecting) {
            this._log.info('Accept stopped; the call was disconnected while accepting');
            return;
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
                twilioError = new generated.UserMediaErrors.PermissionDeniedError();
                _this._publisher.error('get-user-media', 'denied', {
                    data: {
                        audioConstraints: audioConstraints,
                        error: error,
                    },
                }, _this);
            }
            else {
                twilioError = new generated.UserMediaErrors.AcquisitionFailedError(error);
                _this._publisher.error('get-user-media', 'failed', {
                    data: {
                        audioConstraints: audioConstraints,
                        error: error,
                    },
                }, _this);
            }
            // The call was disconnected while its microphone was being acquired.
            if (_this._status === Call.State.Closed) {
                _this._log.warn('Ignoring a getUserMedia failure for a closed call', error);
                return;
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
            this._log.debug(".ignore noop. status is '".concat(this._status, "'"));
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
            throw new index.InvalidArgumentError("Feedback score must be one of: ".concat(Object.values(Call.FeedbackScore)));
        }
        if (typeof issue !== 'undefined' && issue !== null && !Object.values(Call.FeedbackIssue).includes(issue)) {
            throw new index.InvalidArgumentError("Feedback issue must be one of: ".concat(Object.values(Call.FeedbackIssue)));
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
            this._log.debug(".reject noop. status is '".concat(this._status, "'"));
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
            throw new index.InvalidArgumentError('Illegal character passed into sendDigits');
        }
        var customSounds = this._options.customSounds || {};
        var sequence = [];
        digits.split('').forEach(function (digit) {
            var dtmf = (digit !== 'w') ? "dtmf".concat(digit) : '';
            if (dtmf === 'dtmf*') {
                dtmf = 'dtmfs';
            }
            if (dtmf === 'dtmf#') {
                dtmf = 'dtmfh';
            }
            sequence.push(dtmf);
        });
        var tonesInRun = 0;
        var playNextDigit = function () {
            var digit = sequence.shift();
            if (digit) {
                tonesInRun++;
                if (_this._options.dialtonePlayer && !customSounds[digit]) {
                    _this._options.dialtonePlayer.play(digit);
                }
                else {
                    _this._soundcache.get(digit).play();
                }
            }
            if (sequence.length) {
                var delay = void 0;
                if (digit) {
                    delay = DTMF_LOCAL_TONE_GAP;
                }
                else {
                    // A pause ('w') is an empty string here and plays no sound. The wire
                    // starts its pause timer at the start of a run, so the pause overlaps
                    // that run's tones. Subtract the tones already played to match it.
                    delay = Math.max(0, DTMF_PAUSE_DURATION - tonesInRun * DTMF_LOCAL_TONE_GAP);
                    tonesInRun = 0;
                }
                setTimeout(function () { return playNextDigit(); }, delay);
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
            var error = new generated.GeneralErrors.ConnectionError('Could not send DTMF: Signaling channel is disconnected');
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
            throw new index.InvalidArgumentError('`content` is empty');
        }
        if (typeof messageType !== 'string') {
            throw new index.InvalidArgumentError('`messageType` must be a string.');
        }
        if (messageType.length === 0) {
            throw new index.InvalidArgumentError('`messageType` must be a non-empty string.');
        }
        if (this._pstream === null) {
            throw new index.InvalidStateError('Could not send CallMessage; Signaling channel is disconnected');
        }
        var callSid = this.parameters.CallSid;
        if (typeof this.parameters.CallSid === 'undefined') {
            throw new index.InvalidStateError('Could not send CallMessage; Call has no CallSid');
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
            this._emitWarning('audio-level-', "constant-audio-".concat(direction, "-level"), 10, newStreak, false);
        }
        else if (wasWarningRaised) {
            this._emitWarning('audio-level-', "constant-audio-".concat(direction, "-level"), 10, newStreak, true);
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
            sdk_version: constants.RELEASE_VERSION,
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
        this._wasConnected;
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
     */
    Call.toString = function () { return '[Twilio.Call class]'; };
    return Call;
}(events.EventEmitter));
/**
 * @mergeModuleWith Call
 */
(function (Call) {
    (function (State) {
        State["Closed"] = "closed";
        State["Connecting"] = "connecting";
        State["Open"] = "open";
        State["Pending"] = "pending";
        State["Reconnecting"] = "reconnecting";
        State["Ringing"] = "ringing";
    })(Call.State || (Call.State = {}));
    (function (FeedbackIssue) {
        FeedbackIssue["AudioLatency"] = "audio-latency";
        FeedbackIssue["ChoppyAudio"] = "choppy-audio";
        FeedbackIssue["DroppedCall"] = "dropped-call";
        FeedbackIssue["Echo"] = "echo";
        FeedbackIssue["NoisyCall"] = "noisy-call";
        FeedbackIssue["OneWayAudio"] = "one-way-audio";
    })(Call.FeedbackIssue || (Call.FeedbackIssue = {}));
    (function (FeedbackScore) {
        FeedbackScore[FeedbackScore["One"] = 1] = "One";
        FeedbackScore[FeedbackScore["Two"] = 2] = "Two";
        FeedbackScore[FeedbackScore["Three"] = 3] = "Three";
        FeedbackScore[FeedbackScore["Four"] = 4] = "Four";
        FeedbackScore[FeedbackScore["Five"] = 5] = "Five";
    })(Call.FeedbackScore || (Call.FeedbackScore = {}));
    (function (CallDirection) {
        CallDirection["Incoming"] = "INCOMING";
        CallDirection["Outgoing"] = "OUTGOING";
    })(Call.CallDirection || (Call.CallDirection = {}));
    (function (Codec) {
        Codec["Opus"] = "opus";
        Codec["PCMU"] = "pcmu";
    })(Call.Codec || (Call.Codec = {}));
    (function (IceGatheringFailureReason) {
        IceGatheringFailureReason["None"] = "none";
        IceGatheringFailureReason["Timeout"] = "timeout";
    })(Call.IceGatheringFailureReason || (Call.IceGatheringFailureReason = {}));
    (function (MediaFailure) {
        MediaFailure["ConnectionDisconnected"] = "ConnectionDisconnected";
        MediaFailure["ConnectionFailed"] = "ConnectionFailed";
        MediaFailure["IceGatheringFailed"] = "IceGatheringFailed";
        MediaFailure["LowBytes"] = "LowBytes";
    })(Call.MediaFailure || (Call.MediaFailure = {}));
})(exports.default || (exports.default = {}));
function generateTempCallSid() {
    return 'TJSxxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        /* tslint:disable:no-bitwise */
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        /* tslint:enable:no-bitwise */
        return v.toString(16);
    });
}
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsbC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9jYWxsLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIk1lZGlhRXJyb3JzIiwiQ2FsbCIsIl9fZXh0ZW5kcyIsIkxvZyIsIlBlZXJDb25uZWN0aW9uIiwiZ2VuZXJhdGVWb2ljZUV2ZW50U2lkIiwiZ2V0UHJlY2lzZVNpZ25hbGluZ0Vycm9yQnlDb2RlIiwiR2VuZXJhbEVycm9ycyIsImlzQ2hyb21lIiwiX19hc3NpZ24iLCJTaWduYWxpbmdFcnJvcnMiLCJCYWNrb2ZmIiwiU3RhdHNNb25pdG9yIiwiSWNlQ2FuZGlkYXRlIiwiRGV2aWNlIiwiZ2V0UHJlZmVycmVkQ29kZWNJbmZvIiwiVXNlck1lZGlhRXJyb3JzIiwiSW52YWxpZEFyZ3VtZW50RXJyb3IiLCJJbnZhbGlkU3RhdGVFcnJvciIsIlJFTEVBU0VfVkVSU0lPTiIsIkV2ZW50RW1pdHRlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFpQ0EsSUFBTSxjQUFjLEdBQUc7QUFDckIsSUFBQSxNQUFNLEVBQUUsR0FBRztBQUNYLElBQUEsTUFBTSxFQUFFLEdBQUc7QUFDWCxJQUFBLEdBQUcsRUFBRSxLQUFLO0FBQ1YsSUFBQSxHQUFHLEVBQUUsQ0FBQztDQUNQO0FBRUQsSUFBTSxtQkFBbUIsR0FBVyxFQUFFO0FBQ3RDO0FBQ0E7QUFDQTtBQUNBLElBQU0sbUJBQW1CLEdBQVcsR0FBRztBQUN2QyxJQUFNLG1CQUFtQixHQUFXLEdBQUc7QUFDdkMsSUFBTSxrQkFBa0IsR0FBVyxHQUFHO0FBRXRDLElBQU0sa0JBQWtCLEdBQVcsRUFBRTtBQUNyQyxJQUFNLGFBQWEsR0FBVyxJQUFJO0FBRWxDLElBQU0sc0JBQXNCLEdBQUc7QUFDN0IsSUFBQSxVQUFVLEVBQUUsSUFBSTtBQUNoQixJQUFBLElBQUksRUFBRTtBQUNKLFFBQUEsSUFBSSxFQUFFLEtBQUs7QUFDWCxRQUFBLE9BQU8sRUFBRSx5Q0FBeUM7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
