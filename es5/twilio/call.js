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
                twilioError = new generated.UserMediaErrors.AcquisitionFailedError();
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
