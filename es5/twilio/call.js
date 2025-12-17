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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsbC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9jYWxsLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIk1lZGlhRXJyb3JzIiwiQ2FsbCIsIl9fZXh0ZW5kcyIsIkxvZyIsIlBlZXJDb25uZWN0aW9uIiwiZ2VuZXJhdGVWb2ljZUV2ZW50U2lkIiwiZ2V0UHJlY2lzZVNpZ25hbGluZ0Vycm9yQnlDb2RlIiwiR2VuZXJhbEVycm9ycyIsImlzQ2hyb21lIiwiX19hc3NpZ24iLCJTaWduYWxpbmdFcnJvcnMiLCJCYWNrb2ZmIiwiU3RhdHNNb25pdG9yIiwiSWNlQ2FuZGlkYXRlIiwiRGV2aWNlIiwiZ2V0UHJlZmVycmVkQ29kZWNJbmZvIiwiVXNlck1lZGlhRXJyb3JzIiwiSW52YWxpZEFyZ3VtZW50RXJyb3IiLCJJbnZhbGlkU3RhdGVFcnJvciIsIlJFTEVBU0VfVkVSU0lPTiIsIkV2ZW50RW1pdHRlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFpQ0EsSUFBTSxjQUFjLEdBQUc7QUFDckIsSUFBQSxNQUFNLEVBQUUsR0FBRztBQUNYLElBQUEsTUFBTSxFQUFFLEdBQUc7QUFDWCxJQUFBLEdBQUcsRUFBRSxLQUFLO0FBQ1YsSUFBQSxHQUFHLEVBQUUsQ0FBQztDQUNQO0FBRUQsSUFBTSxtQkFBbUIsR0FBVyxFQUFFO0FBQ3RDLElBQU0sbUJBQW1CLEdBQVcsR0FBRztBQUN2QyxJQUFNLGtCQUFrQixHQUFXLEdBQUc7QUFFdEMsSUFBTSxrQkFBa0IsR0FBVyxFQUFFO0FBQ3JDLElBQU0sYUFBYSxHQUFXLElBQUk7QUFFbEMsSUFBTSxzQkFBc0IsR0FBRztBQUM3QixJQUFBLFVBQVUsRUFBRSxJQUFJO0FBQ2hCLElBQUEsSUFBSSxFQUFFO0FBQ0osUUFBQSxJQUFJLEVBQUUsS0FBSztBQUNYLFFBQUEsT0FBTyxFQUFFLHlDQUF5QztBQUNsRCxRQUFBLFdBQVcsRUFBRSxJQUFJQSxxQkFBVyxDQUFDLGVBQWUs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
