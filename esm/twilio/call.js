/**
 * @packageDocumentation
 * @module Voice
 * @publicapi
 * @internal
 */
import { EventEmitter } from 'events';
import Backoff from './backoff';
import Device from './device';
import { GeneralErrors, getPreciseSignalingErrorByCode, InvalidArgumentError, InvalidStateError, MediaErrors, SignalingErrors, UserMediaErrors, } from './errors';
import Log from './log';
import { PeerConnection } from './rtc';
import { IceCandidate } from './rtc/icecandidate';
import { getPreferredCodecInfo } from './rtc/sdp';
import StatsMonitor from './statsMonitor';
import { isChrome } from './util';
import { generateVoiceEventSid } from './uuid';
import { RELEASE_VERSION } from './constants';
const BACKOFF_CONFIG = {
    factor: 1.1,
    jitter: 0.5,
    max: 30000,
    min: 1,
};
const DTMF_INTER_TONE_GAP = 70;
const DTMF_PAUSE_DURATION = 500;
const DTMF_TONE_DURATION = 160;
const METRICS_BATCH_SIZE = 10;
const METRICS_DELAY = 5000;
const MEDIA_DISCONNECT_ERROR = {
    disconnect: true,
    info: {
        code: 31003,
        message: 'Connection with Twilio was interrupted.',
        twilioError: new MediaErrors.ConnectionError(),
    },
};
const MULTIPLE_THRESHOLD_WARNING_NAMES = {
    // The stat `packetsLostFraction` is monitored by two separate thresholds,
    // `maxAverage` and `max`. Each threshold emits a different warning name.
    packetsLostFraction: {
        max: 'packet-loss',
        maxAverage: 'packets-lost-fraction',
    },
};
const WARNING_NAMES = {
    audioInputLevel: 'audio-input-level',
    audioOutputLevel: 'audio-output-level',
    bytesReceived: 'bytes-received',
    bytesSent: 'bytes-sent',
    jitter: 'jitter',
    mos: 'mos',
    rtt: 'rtt',
};
const WARNING_PREFIXES = {
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
class Call extends EventEmitter {
    /**
     * @constructor
     * @private
     * @param config - Mandatory configuration options
     * @param [options] - Optional settings
     */
    constructor(config, options) {
        super();
        /**
         * Call parameters received from Twilio for an incoming call.
         */
        this.parameters = {};
        /**
         * The number of times input volume has been the same consecutively.
         */
        this._inputVolumeStreak = 0;
        /**
         * Whether the call has been answered.
         */
        this._isAnswered = false;
        /**
         * Whether the call has been cancelled.
         */
        this._isCancelled = false;
        /**
         * Whether the call has been rejected
         */
        this._isRejected = false;
        /**
         * The most recent public input volume value. 0 -> 1 representing -100 to -30 dB.
         */
        this._latestInputVolume = 0;
        /**
         * The most recent public output volume value. 0 -> 1 representing -100 to -30 dB.
         */
        this._latestOutputVolume = 0;
        /**
         * An instance of Logger to use.
         */
        this._log = new Log('Call');
        /**
         * State of the {@link Call}'s media.
         */
        this._mediaStatus = Call.State.Pending;
        /**
         * A map of messages sent via sendMessage API using voiceEventSid as the key.
         * The message will be deleted once an 'ack' or an error is received from the server.
         */
        this._messages = new Map();
        /**
         * A batch of metrics samples to send to Insights. Gets cleared after
         * each send and appended to on each new sample.
         */
        this._metricsSamples = [];
        /**
         * Options passed to this {@link Call}.
         */
        this._options = {
            MediaHandler: PeerConnection,
            enableImprovedSignalingErrorPrecision: false,
            offerSdp: null,
            shouldPlayDisconnect: () => true,
            voiceEventSidGenerator: generateVoiceEventSid,
        };
        /**
         * The number of times output volume has been the same consecutively.
         */
        this._outputVolumeStreak = 0;
        /**
         * Whether the {@link Call} should send a hangup on disconnect.
         */
        this._shouldSendHangup = true;
        /**
         * State of the {@link Call}'s signaling.
         */
        this._signalingStatus = Call.State.Pending;
        /**
         * A Map of Sounds to play.
         */
        this._soundcache = new Map();
        /**
         * State of the {@link Call}.
         */
        this._status = Call.State.Pending;
        /**
         * Whether the {@link Call} has been connected. Used to determine if we are reconnected.
         */
        this._wasConnected = false;
        /**
         * String representation of {@link Call} instance.
         * @private
         */
        this.toString = () => '[Twilio.Call instance]';
        this._emitWarning = (groupPrefix, warningName, threshold, value, wasCleared, warningData) => {
            const groupSuffix = wasCleared ? '-cleared' : '-raised';
            const groupName = `${groupPrefix}warning${groupSuffix}`;
            // Ignore constant input if the Call is muted (Expected)
            if (warningName === 'constant-audio-input-level' && this.isMuted()) {
                return;
            }
            let level = wasCleared ? 'info' : 'warning';
            // Avoid throwing false positives as warnings until we refactor volume metrics
            if (warningName === 'constant-audio-output-level') {
                level = 'info';
            }
            const payloadData = { threshold };
            if (value) {
                if (value instanceof Array) {
                    payloadData.values = value.map((val) => {
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
            this._publisher.post(level, groupName, warningName, { data: payloadData }, this);
            if (warningName !== 'constant-audio-output-level') {
                const emitName = wasCleared ? 'warning-cleared' : 'warning';
                this._log.debug(`#${emitName}`, warningName);
                this.emit(emitName, warningName, warningData && !wasCleared ? warningData : null);
            }
        };
        /**
         * Called when the {@link Call} receives an ack from signaling
         * @param payload
         */
        this._onAck = (payload) => {
            const { acktype, callsid, voiceeventsid } = payload;
            if (this.parameters.CallSid !== callsid) {
                this._log.warn(`Received ack from a different callsid: ${callsid}`);
                return;
            }
            if (acktype === 'message') {
                this._onMessageSent(voiceeventsid);
            }
        };
        /**
         * Called when the {@link Call} is answered.
         * @param payload
         */
        this._onAnswer = (payload) => {
            if (typeof payload.reconnect === 'string') {
                this._signalingReconnectToken = payload.reconnect;
            }
            // answerOnBridge=false will send a 183 which we need to catch in _onRinging when
            // the enableRingingState flag is disabled. In that case, we will receive a 200 after
            // the callee accepts the call firing a second `accept` event if we don't
            // short circuit here.
            if (this._isAnswered && this._status !== Call.State.Reconnecting) {
                return;
            }
            this._setCallSid(payload);
            this._isAnswered = true;
            this._maybeTransitionToOpen();
        };
        /**
         * Called when the {@link Call} is cancelled.
         * @param payload
         */
        this._onCancel = (payload) => {
            // (rrowland) Is this check necessary? Verify, and if so move to pstream / VSP module.
            const callsid = payload.callsid;
            if (this.parameters.CallSid === callsid) {
                this._isCancelled = true;
                this._publisher.info('connection', 'cancel', null, this);
                this._cleanupEventListeners();
                this._mediaHandler.close();
                this._status = Call.State.Closed;
                this._log.debug('#cancel');
                this.emit('cancel');
                this._pstream.removeListener('cancel', this._onCancel);
            }
        };
        /**
         * Called when we receive a connected event from pstream.
         * Re-emits the event.
         */
        this._onConnected = () => {
            this._log.info('Received connected from pstream');
            if (this._signalingReconnectToken && this._mediaHandler.version) {
                this._pstream.reconnect(this._mediaHandler.version.getSDP(), this.parameters.CallSid, this._signalingReconnectToken);
            }
        };
        /**
         * Called when the {@link Call} is hung up.
         * @param payload
         */
        this._onHangup = (payload) => {
            if (this.status() === Call.State.Closed) {
                return;
            }
            /**
             *  see if callsid passed in message matches either callsid or outbound id
             *  call should always have either callsid or outbound id
             *  if no callsid passed hangup anyways
             */
            if (payload.callsid && (this.parameters.CallSid || this.outboundConnectionId)) {
                if (payload.callsid !== this.parameters.CallSid
                    && payload.callsid !== this.outboundConnectionId) {
                    return;
                }
            }
            else if (payload.callsid) {
                // hangup is for another call
                return;
            }
            this._log.info('Received HANGUP from gateway');
            if (payload.error) {
                const code = payload.error.code;
                const errorConstructor = getPreciseSignalingErrorByCode(this._options.enableImprovedSignalingErrorPrecision, code);
                const error = typeof errorConstructor !== 'undefined'
                    ? new errorConstructor(payload.error.message)
                    : new GeneralErrors.ConnectionError('Error sent from gateway in HANGUP', payload.error);
                this._log.error('Received an error from the gateway:', error);
                this._log.debug('#error', error);
                this.emit('error', error);
            }
            this._shouldSendHangup = false;
            this._publisher.info('connection', 'disconnected-by-remote', null, this);
            this._disconnect(null, true);
            this._cleanupEventListeners();
        };
        /**
         * Called when there is a media failure.
         * Manages all media-related states and takes action base on the states
         * @param type - Type of media failure
         */
        this._onMediaFailure = (type) => {
            const { ConnectionDisconnected, ConnectionFailed, IceGatheringFailed, LowBytes, } = Call.MediaFailure;
            // These types signifies the end of a single ICE cycle
            const isEndOfIceCycle = type === ConnectionFailed || type === IceGatheringFailed;
            // All browsers except chrome doesn't update pc.iceConnectionState and pc.connectionState
            // after issuing an ICE Restart, which we use to determine if ICE Restart is complete.
            // Since we cannot detect if ICE Restart is complete, we will not retry.
            if (!isChrome(window, window.navigator) && type === ConnectionFailed) {
                return this._mediaHandler.onerror(MEDIA_DISCONNECT_ERROR);
            }
            // Ignore subsequent requests if ice restart is in progress
            if (this._mediaStatus === Call.State.Reconnecting) {
                // This is a retry. Previous ICE Restart failed
                if (isEndOfIceCycle) {
                    // We already exceeded max retry time.
                    if (Date.now() - this._mediaReconnectStartTime > BACKOFF_CONFIG.max) {
                        this._log.warn('Exceeded max ICE retries');
                        return this._mediaHandler.onerror(MEDIA_DISCONNECT_ERROR);
                    }
                    // Issue ICE restart with backoff
                    try {
                        this._mediaReconnectBackoff.backoff();
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
            const pc = this._mediaHandler.version.pc;
            const isIceDisconnected = pc && pc.iceConnectionState === 'disconnected';
            const hasLowBytesWarning = this._monitor.hasActiveWarning('bytesSent', 'min')
                || this._monitor.hasActiveWarning('bytesReceived', 'min');
            // Only certain conditions can trigger media reconnection
            if ((type === LowBytes && isIceDisconnected)
                || (type === ConnectionDisconnected && hasLowBytesWarning)
                || isEndOfIceCycle) {
                const mediaReconnectionError = new MediaErrors.ConnectionError('Media connection failed.');
                this._log.warn('ICE Connection disconnected.');
                this._publisher.warn('connection', 'error', mediaReconnectionError, this);
                this._publisher.info('connection', 'reconnecting', null, this);
                this._mediaReconnectStartTime = Date.now();
                this._status = Call.State.Reconnecting;
                this._mediaStatus = Call.State.Reconnecting;
                this._mediaReconnectBackoff.reset();
                this._mediaReconnectBackoff.backoff();
                this._log.debug('#reconnecting');
                this.emit('reconnecting', mediaReconnectionError);
            }
        };
        /**
         * Called when media call is restored
         */
        this._onMediaReconnected = () => {
            // Only trigger once.
            // This can trigger on pc.onIceConnectionChange and pc.onConnectionChange.
            if (this._mediaStatus !== Call.State.Reconnecting) {
                return;
            }
            this._log.info('ICE Connection reestablished.');
            this._mediaStatus = Call.State.Open;
            if (this._signalingStatus === Call.State.Open) {
                this._publisher.info('connection', 'reconnected', null, this);
                this._log.debug('#reconnected');
                this.emit('reconnected');
                this._status = Call.State.Open;
            }
        };
        /**
         * Raised when a Call receives a message from the backend.
         * @param payload - A record representing the payload of the message from the
         * Twilio backend.
         */
        this._onMessageReceived = (payload) => {
            const { callsid, content, contenttype, messagetype, voiceeventsid } = payload;
            if (this.parameters.CallSid !== callsid) {
                this._log.warn(`Received a message from a different callsid: ${callsid}`);
                return;
            }
            const data = {
                content,
                contentType: contenttype,
                messageType: messagetype,
                voiceEventSid: voiceeventsid,
            };
            this._publisher.info('call-message', messagetype, {
                content_type: contenttype,
                event_type: 'received',
                voice_event_sid: voiceeventsid,
            }, this);
            this._log.debug('#messageReceived', JSON.stringify(data));
            this.emit('messageReceived', data);
        };
        /**
         * Raised when a Call receives an 'ack' with an 'acktype' of 'message.
         * This means that the message sent via sendMessage API has been received by the signaling server.
         * @param voiceEventSid
         */
        this._onMessageSent = (voiceEventSid) => {
            if (!this._messages.has(voiceEventSid)) {
                this._log.warn(`Received a messageSent with a voiceEventSid that doesn't exists: ${voiceEventSid}`);
                return;
            }
            const message = this._messages.get(voiceEventSid);
            this._messages.delete(voiceEventSid);
            this._publisher.info('call-message', message === null || message === void 0 ? void 0 : message.messageType, {
                content_type: message === null || message === void 0 ? void 0 : message.contentType,
                event_type: 'sent',
                voice_event_sid: voiceEventSid,
            }, this);
            this._log.debug('#messageSent', JSON.stringify(message));
            this.emit('messageSent', message);
        };
        /**
         * When we get a RINGING signal from PStream, update the {@link Call} status.
         * @param payload
         */
        this._onRinging = (payload) => {
            this._setCallSid(payload);
            // If we're not in 'connecting' or 'ringing' state, this event was received out of order.
            if (this._status !== Call.State.Connecting && this._status !== Call.State.Ringing) {
                return;
            }
            const hasEarlyMedia = !!payload.sdp;
            this._status = Call.State.Ringing;
            this._publisher.info('connection', 'outgoing-ringing', { hasEarlyMedia }, this);
            this._log.debug('#ringing');
            this.emit('ringing', hasEarlyMedia);
        };
        /**
         * Called each time StatsMonitor emits a sample.
         * Emits stats event and batches the call stats metrics and sends them to Insights.
         * @param sample
         */
        this._onRTCSample = (sample) => {
            const callMetrics = Object.assign(Object.assign({}, sample), { inputVolume: this._latestInputVolume, outputVolume: this._latestOutputVolume });
            this._codec = callMetrics.codecName;
            this._metricsSamples.push(callMetrics);
            if (this._metricsSamples.length >= METRICS_BATCH_SIZE) {
                this._publishMetrics();
            }
            this.emit('sample', sample);
        };
        /**
         * Called when an 'error' event is received from the signaling stream.
         */
        this._onSignalingError = (payload) => {
            const { callsid, voiceeventsid, error } = payload;
            if (this.parameters.CallSid !== callsid) {
                this._log.warn(`Received an error from a different callsid: ${callsid}`);
                return;
            }
            if (voiceeventsid && this._messages.has(voiceeventsid)) {
                // Do not emit an error here. Device is handling all signaling related errors.
                this._messages.delete(voiceeventsid);
                this._log.warn(`Received an error while sending a message.`, payload);
                this._publisher.error('call-message', 'error', {
                    code: error.code,
                    message: error.message,
                    voice_event_sid: voiceeventsid,
                }, this);
                let twilioError;
                const errorConstructor = getPreciseSignalingErrorByCode(!!this._options.enableImprovedSignalingErrorPrecision, error.code);
                if (typeof errorConstructor !== 'undefined') {
                    twilioError = new errorConstructor(error);
                }
                if (!twilioError) {
                    this._log.error('Unknown Call Message Error: ', error);
                    twilioError = new GeneralErrors.UnknownError(error.message, error);
                }
                this._log.debug('#error', error, twilioError);
                this.emit('error', twilioError);
            }
        };
        /**
         * Called when signaling is restored
         */
        this._onSignalingReconnected = () => {
            if (this._signalingStatus !== Call.State.Reconnecting) {
                return;
            }
            this._log.info('Signaling Connection reestablished.');
            this._signalingStatus = Call.State.Open;
            if (this._mediaStatus === Call.State.Open) {
                this._publisher.info('connection', 'reconnected', null, this);
                this._log.debug('#reconnected');
                this.emit('reconnected');
                this._status = Call.State.Open;
            }
        };
        /**
         * Called when we receive a transportClose event from pstream.
         * Re-emits the event.
         */
        this._onTransportClose = () => {
            this._log.error('Received transportClose from pstream');
            this._log.debug('#transportClose');
            this.emit('transportClose');
            if (this._signalingReconnectToken) {
                this._status = Call.State.Reconnecting;
                this._signalingStatus = Call.State.Reconnecting;
                this._log.debug('#reconnecting');
                this.emit('reconnecting', new SignalingErrors.ConnectionDisconnected());
            }
            else {
                this._status = Call.State.Closed;
                this._signalingStatus = Call.State.Closed;
            }
        };
        /**
         * Re-emit an StatsMonitor warning as a {@link Call}.warning or .warning-cleared event.
         * @param warningData
         * @param wasCleared - Whether this is a -cleared or -raised event.
         */
        this._reemitWarning = (warningData, wasCleared) => {
            const groupPrefix = /^audio/.test(warningData.name) ?
                'audio-level-' : 'network-quality-';
            const warningPrefix = WARNING_PREFIXES[warningData.threshold.name];
            /**
             * NOTE: There are two "packet-loss" warnings: `high-packet-loss` and
             * `high-packets-lost-fraction`, so in this case we need to use a different
             * `WARNING_NAME` mapping.
             */
            let warningName;
            if (warningData.name in MULTIPLE_THRESHOLD_WARNING_NAMES) {
                warningName = MULTIPLE_THRESHOLD_WARNING_NAMES[warningData.name][warningData.threshold.name];
            }
            else if (warningData.name in WARNING_NAMES) {
                warningName = WARNING_NAMES[warningData.name];
            }
            const warning = warningPrefix + warningName;
            this._emitWarning(groupPrefix, warning, warningData.threshold.value, warningData.values || warningData.value, wasCleared, warningData);
        };
        /**
         * Re-emit an StatsMonitor warning-cleared as a .warning-cleared event.
         * @param warningData
         */
        this._reemitWarningCleared = (warningData) => {
            this._reemitWarning(warningData, true);
        };
        this._isUnifiedPlanDefault = config.isUnifiedPlanDefault;
        this._soundcache = config.soundcache;
        if (typeof config.onIgnore === 'function') {
            this._onIgnore = config.onIgnore;
        }
        const message = options && options.twimlParams || {};
        this.customParameters = new Map(Object.entries(message).map(([key, val]) => [key, String(val)]));
        Object.assign(this._options, options);
        if (this._options.callParameters) {
            this.parameters = this._options.callParameters;
        }
        if (this._options.reconnectToken) {
            this._signalingReconnectToken = this._options.reconnectToken;
        }
        this._voiceEventSidGenerator =
            this._options.voiceEventSidGenerator || generateVoiceEventSid;
        this._direction = this.parameters.CallSid && !this._options.reconnectCallSid ?
            Call.CallDirection.Incoming : Call.CallDirection.Outgoing;
        if (this.parameters) {
            this.callerInfo = this.parameters.StirStatus
                ? { isVerified: this.parameters.StirStatus === 'TN-Validation-Passed-A' }
                : null;
        }
        else {
            this.callerInfo = null;
        }
        this._mediaReconnectBackoff = new Backoff(BACKOFF_CONFIG);
        this._mediaReconnectBackoff.on('ready', () => this._mediaHandler.iceRestart());
        // temporary call sid to be used for outgoing calls
        this.outboundConnectionId = generateTempCallSid();
        const publisher = this._publisher = config.publisher;
        if (this._direction === Call.CallDirection.Incoming) {
            publisher.info('connection', 'incoming', null, this);
        }
        else {
            publisher.info('connection', 'outgoing', {
                preflight: this._options.preflight,
                reconnect: !!this._options.reconnectCallSid,
            }, this);
        }
        const monitor = this._monitor = new (this._options.StatsMonitor || StatsMonitor)();
        monitor.on('sample', this._onRTCSample);
        // First 20 seconds or so are choppy, so let's not bother with these warnings.
        monitor.disableWarnings();
        setTimeout(() => monitor.enableWarnings(), METRICS_DELAY);
        monitor.on('warning', (data, wasCleared) => {
            if (data.name === 'bytesSent' || data.name === 'bytesReceived') {
                this._onMediaFailure(Call.MediaFailure.LowBytes);
            }
            this._reemitWarning(data, wasCleared);
        });
        monitor.on('warning-cleared', (data) => {
            this._reemitWarningCleared(data);
        });
        this._mediaHandler = new (this._options.MediaHandler)(config.audioHelper, config.pstream, {
            RTCPeerConnection: this._options.RTCPeerConnection,
            codecPreferences: this._options.codecPreferences,
            dscp: this._options.dscp,
            forceAggressiveIceNomination: this._options.forceAggressiveIceNomination,
            isUnifiedPlan: this._isUnifiedPlanDefault,
            maxAverageBitrate: this._options.maxAverageBitrate,
        });
        this.on('volume', (inputVolume, outputVolume) => {
            this._inputVolumeStreak = this._checkVolume(inputVolume, this._inputVolumeStreak, this._latestInputVolume, 'input');
            this._outputVolumeStreak = this._checkVolume(outputVolume, this._outputVolumeStreak, this._latestOutputVolume, 'output');
            this._latestInputVolume = inputVolume;
            this._latestOutputVolume = outputVolume;
        });
        this._mediaHandler.onaudio = (remoteAudio) => {
            this._log.debug('#audio');
            this.emit('audio', remoteAudio);
        };
        this._mediaHandler.onvolume = (inputVolume, outputVolume, internalInputVolume, internalOutputVolume) => {
            // (rrowland) These values mock the 0 -> 32767 format used by legacy getStats. We should look into
            // migrating to a newer standard, either 0.0 -> linear or -127 to 0 in dB, matching the range
            // chosen below.
            monitor.addVolumes((internalInputVolume / 255) * 32767, (internalOutputVolume / 255) * 32767);
            // (rrowland) 0.0 -> 1.0 linear
            this.emit('volume', inputVolume, outputVolume);
        };
        this._mediaHandler.ondtlstransportstatechange = (state) => {
            const level = state === 'failed' ? 'error' : 'debug';
            this._publisher.post(level, 'dtls-transport-state', state, null, this);
        };
        this._mediaHandler.onpcconnectionstatechange = (state) => {
            let level = 'debug';
            const dtlsTransport = this._mediaHandler.getRTCDtlsTransport();
            if (state === 'failed') {
                level = dtlsTransport && dtlsTransport.state === 'failed' ? 'error' : 'warning';
            }
            this._publisher.post(level, 'pc-connection-state', state, null, this);
        };
        this._mediaHandler.onicecandidate = (candidate) => {
            const payload = new IceCandidate(candidate).toPayload();
            this._publisher.debug('ice-candidate', 'ice-candidate', payload, this);
        };
        this._mediaHandler.onselectedcandidatepairchange = (pair) => {
            const localCandidatePayload = new IceCandidate(pair.local).toPayload();
            const remoteCandidatePayload = new IceCandidate(pair.remote, true).toPayload();
            this._publisher.debug('ice-candidate', 'selected-ice-candidate-pair', {
                local_candidate: localCandidatePayload,
                remote_candidate: remoteCandidatePayload,
            }, this);
        };
        this._mediaHandler.oniceconnectionstatechange = (state) => {
            const level = state === 'failed' ? 'error' : 'debug';
            this._publisher.post(level, 'ice-connection-state', state, null, this);
        };
        this._mediaHandler.onicegatheringfailure = (type) => {
            this._publisher.warn('ice-gathering-state', type, null, this);
            this._onMediaFailure(Call.MediaFailure.IceGatheringFailed);
        };
        this._mediaHandler.onicegatheringstatechange = (state) => {
            this._publisher.debug('ice-gathering-state', state, null, this);
        };
        this._mediaHandler.onsignalingstatechange = (state) => {
            this._publisher.debug('signaling-state', state, null, this);
        };
        this._mediaHandler.ondisconnected = (msg) => {
            this._log.warn(msg);
            this._publisher.warn('network-quality-warning-raised', 'ice-connectivity-lost', {
                message: msg,
            }, this);
            this._log.debug('#warning', 'ice-connectivity-lost');
            this.emit('warning', 'ice-connectivity-lost');
            this._onMediaFailure(Call.MediaFailure.ConnectionDisconnected);
        };
        this._mediaHandler.onfailed = (msg) => {
            this._onMediaFailure(Call.MediaFailure.ConnectionFailed);
        };
        this._mediaHandler.onconnected = () => {
            // First time _mediaHandler is connected, but ICE Gathering issued an ICE restart and succeeded.
            if (this._status === Call.State.Reconnecting) {
                this._onMediaReconnected();
            }
        };
        this._mediaHandler.onreconnected = (msg) => {
            this._log.info(msg);
            this._publisher.info('network-quality-warning-cleared', 'ice-connectivity-lost', {
                message: msg,
            }, this);
            this._log.debug('#warning-cleared', 'ice-connectivity-lost');
            this.emit('warning-cleared', 'ice-connectivity-lost');
            this._onMediaReconnected();
        };
        this._mediaHandler.onerror = (e) => {
            if (e.disconnect === true) {
                this._disconnect(e.info && e.info.message);
            }
            const error = e.info.twilioError || new GeneralErrors.UnknownError(e.info.message);
            this._log.error('Received an error from MediaStream:', e);
            this._log.debug('#error', error);
            this.emit('error', error);
        };
        this._mediaHandler.onopen = () => {
            // NOTE(mroberts): While this may have been happening in previous
            // versions of Chrome, since Chrome 45 we have seen the
            // PeerConnection's onsignalingstatechange handler invoked multiple
            // times in the same signalingState 'stable'. When this happens, we
            // invoke this onopen function. If we invoke it twice without checking
            // for _status 'open', we'd accidentally close the PeerConnection.
            //
            // See <https://code.google.com/p/webrtc/issues/detail?id=4996>.
            if (this._status === Call.State.Open || this._status === Call.State.Reconnecting) {
                return;
            }
            else if (this._status === Call.State.Ringing || this._status === Call.State.Connecting) {
                this.mute(this._mediaHandler.isMuted);
                this._mediaStatus = Call.State.Open;
                this._maybeTransitionToOpen();
            }
            else {
                // call was probably canceled sometime before this
                this._mediaHandler.close();
            }
        };
        this._mediaHandler.onclose = () => {
            this._status = Call.State.Closed;
            if (this._options.shouldPlayDisconnect && this._options.shouldPlayDisconnect()
                // Don't play disconnect sound if this was from a cancel event. i.e. the call
                // was ignored or hung up even before it was answered.
                // Similarly, don't play disconnect sound if the call was rejected.
                && !this._isCancelled && !this._isRejected) {
                this._soundcache.get(Device.SoundName.Disconnect).play();
            }
            monitor.disable();
            this._publishMetrics();
            if (!this._isCancelled && !this._isRejected) {
                // tslint:disable no-console
                this._log.debug('#disconnect');
                this.emit('disconnect', this);
            }
        };
        this._pstream = config.pstream;
        this._pstream.on('ack', this._onAck);
        this._pstream.on('cancel', this._onCancel);
        this._pstream.on('error', this._onSignalingError);
        this._pstream.on('ringing', this._onRinging);
        this._pstream.on('transportClose', this._onTransportClose);
        this._pstream.on('connected', this._onConnected);
        this._pstream.on('message', this._onMessageReceived);
        this.on('error', error => {
            this._publisher.error('connection', 'error', {
                code: error.code, message: error.message,
            }, this);
            if (this._pstream && this._pstream.status === 'disconnected') {
                this._cleanupEventListeners();
            }
        });
        this.on('disconnect', () => {
            this._cleanupEventListeners();
        });
    }
    /**
     * Whether this {@link Call} is incoming or outgoing.
     */
    get direction() {
        return this._direction;
    }
    /**
     * Audio codec used for this {@link Call}. Expecting {@link Call.Codec} but
     * will copy whatever we get from RTC stats.
     */
    get codec() {
        return this._codec;
    }
    /**
     * The connect token is available as soon as the call is established
     * and connected to Twilio. Use this token to reconnect to a call via the {@link Device.connect}
     * method.
     *
     * For incoming calls, it is available in the call object after the {@link Device.incomingEvent} is emitted.
     * For outgoing calls, it is available after the {@link Call.acceptEvent} is emitted.
     */
    get connectToken() {
        const signalingReconnectToken = this._signalingReconnectToken;
        const callSid = this.parameters && this.parameters.CallSid ? this.parameters.CallSid : undefined;
        if (!signalingReconnectToken || !callSid) {
            return;
        }
        const customParameters = this.customParameters && typeof this.customParameters.keys === 'function' ?
            Array.from(this.customParameters.keys()).reduce((result, key) => {
                result[key] = this.customParameters.get(key);
                return result;
            }, {}) : {};
        const parameters = this.parameters || {};
        return btoa(encodeURIComponent(JSON.stringify({
            customParameters,
            parameters,
            signalingReconnectToken,
        })));
    }
    /**
     * Set the audio input tracks from a given stream.
     * @param stream
     * @private
     */
    _setInputTracksFromStream(stream) {
        return this._mediaHandler.setInputTracksFromStream(stream);
    }
    /**
     * Set the audio output sink IDs.
     * @param sinkIds
     * @private
     */
    _setSinkIds(sinkIds) {
        return this._mediaHandler._setSinkIds(sinkIds);
    }
    /**
     * Accept the incoming {@link Call}.
     * @param [options]
     */
    accept(options) {
        this._log.debug('.accept', options);
        if (this._status !== Call.State.Pending) {
            this._log.debug(`.accept noop. status is '${this._status}'`);
            return;
        }
        options = options || {};
        const rtcConfiguration = options.rtcConfiguration || this._options.rtcConfiguration;
        const rtcConstraints = options.rtcConstraints || this._options.rtcConstraints || {};
        const audioConstraints = {
            audio: typeof rtcConstraints.audio !== 'undefined' ? rtcConstraints.audio : true,
        };
        this._status = Call.State.Connecting;
        const connect = () => {
            if (this._status !== Call.State.Connecting) {
                // call must have been canceled
                this._cleanupEventListeners();
                this._mediaHandler.close();
                return;
            }
            const onAnswer = (pc) => {
                // Report that the call was answered, and directionality
                const eventName = this._direction === Call.CallDirection.Incoming
                    ? 'accepted-by-local'
                    : 'accepted-by-remote';
                this._publisher.info('connection', eventName, null, this);
                // Report the preferred codec and params as they appear in the SDP
                const { codecName, codecParams } = getPreferredCodecInfo(this._mediaHandler.version.getSDP());
                this._publisher.info('settings', 'codec', {
                    codec_params: codecParams,
                    selected_codec: codecName,
                }, this);
                // Enable RTC monitoring
                this._monitor.enable(pc);
            };
            const sinkIds = typeof this._options.getSinkIds === 'function' && this._options.getSinkIds();
            if (Array.isArray(sinkIds)) {
                this._mediaHandler._setSinkIds(sinkIds).catch(() => {
                    // (rrowland) We don't want this to throw to console since the customer
                    // can't control this. This will most commonly be rejected on browsers
                    // that don't support setting sink IDs.
                });
            }
            this._pstream.addListener('hangup', this._onHangup);
            if (this._direction === Call.CallDirection.Incoming) {
                this._isAnswered = true;
                this._pstream.on('answer', this._onAnswer);
                this._mediaHandler.answerIncomingCall(this.parameters.CallSid, this._options.offerSdp, rtcConfiguration, onAnswer);
            }
            else {
                const params = Array.from(this.customParameters.entries()).map(pair => `${encodeURIComponent(pair[0])}=${encodeURIComponent(pair[1])}`).join('&');
                this._pstream.on('answer', this._onAnswer);
                this._mediaHandler.makeOutgoingCall(params, this._signalingReconnectToken, this._options.reconnectCallSid || this.outboundConnectionId, rtcConfiguration, onAnswer);
            }
        };
        if (this._options.beforeAccept) {
            this._options.beforeAccept(this);
        }
        const inputStream = typeof this._options.getInputStream === 'function' && this._options.getInputStream();
        const promise = inputStream
            ? this._mediaHandler.setInputTracksFromStream(inputStream)
            : this._mediaHandler.openDefaultDeviceWithConstraints(audioConstraints);
        promise.then(() => {
            this._publisher.info('get-user-media', 'succeeded', {
                data: { audioConstraints },
            }, this);
            connect();
        }, (error) => {
            let twilioError;
            if (error.code === 31208
                || ['PermissionDeniedError', 'NotAllowedError'].indexOf(error.name) !== -1) {
                twilioError = new UserMediaErrors.PermissionDeniedError();
                this._publisher.error('get-user-media', 'denied', {
                    data: {
                        audioConstraints,
                        error,
                    },
                }, this);
            }
            else {
                twilioError = new UserMediaErrors.AcquisitionFailedError();
                this._publisher.error('get-user-media', 'failed', {
                    data: {
                        audioConstraints,
                        error,
                    },
                }, this);
            }
            this._disconnect();
            this._log.debug('#error', error);
            this.emit('error', twilioError);
        });
    }
    /**
     * Disconnect from the {@link Call}.
     */
    disconnect() {
        this._log.debug('.disconnect');
        this._disconnect();
    }
    /**
     * Get the local MediaStream, if set.
     */
    getLocalStream() {
        return this._mediaHandler && this._mediaHandler.stream;
    }
    /**
     * Get the remote MediaStream, if set.
     */
    getRemoteStream() {
        return this._mediaHandler && this._mediaHandler._remoteStream;
    }
    /**
     * Ignore the incoming {@link Call}.
     */
    ignore() {
        this._log.debug('.ignore');
        if (this._status !== Call.State.Pending) {
            this._log.debug(`.ignore noop. status is '${this._status}'`);
            return;
        }
        this._status = Call.State.Closed;
        this._mediaHandler.ignore(this.parameters.CallSid);
        this._publisher.info('connection', 'ignored-by-local', null, this);
        if (this._onIgnore) {
            this._onIgnore();
        }
    }
    /**
     * Check whether call is muted
     */
    isMuted() {
        return this._mediaHandler.isMuted;
    }
    /**
     * Mute incoming audio.
     * @param shouldMute - Whether the incoming audio should be muted. Defaults to true.
     */
    mute(shouldMute = true) {
        this._log.debug('.mute', shouldMute);
        const wasMuted = this._mediaHandler.isMuted;
        this._mediaHandler.mute(shouldMute);
        const isMuted = this._mediaHandler.isMuted;
        if (wasMuted !== isMuted) {
            this._publisher.info('connection', isMuted ? 'muted' : 'unmuted', null, this);
            this._log.debug('#mute', isMuted);
            this.emit('mute', isMuted, this);
        }
    }
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
    postFeedback(score, issue) {
        if (typeof score === 'undefined' || score === null) {
            return this._postFeedbackDeclined();
        }
        if (!Object.values(Call.FeedbackScore).includes(score)) {
            throw new InvalidArgumentError(`Feedback score must be one of: ${Object.values(Call.FeedbackScore)}`);
        }
        if (typeof issue !== 'undefined' && issue !== null && !Object.values(Call.FeedbackIssue).includes(issue)) {
            throw new InvalidArgumentError(`Feedback issue must be one of: ${Object.values(Call.FeedbackIssue)}`);
        }
        return this._publisher.info('feedback', 'received', {
            issue_name: issue,
            quality_score: score,
        }, this, true);
    }
    /**
     * Reject the incoming {@link Call}.
     */
    reject() {
        this._log.debug('.reject');
        if (this._status !== Call.State.Pending) {
            this._log.debug(`.reject noop. status is '${this._status}'`);
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
    }
    /**
     * Send a string of digits.
     * @param digits
     */
    sendDigits(digits) {
        this._log.debug('.sendDigits', digits);
        if (digits.match(/[^0-9*#w]/)) {
            throw new InvalidArgumentError('Illegal character passed into sendDigits');
        }
        const customSounds = this._options.customSounds || {};
        const sequence = [];
        digits.split('').forEach((digit) => {
            let dtmf = (digit !== 'w') ? `dtmf${digit}` : '';
            if (dtmf === 'dtmf*') {
                dtmf = 'dtmfs';
            }
            if (dtmf === 'dtmf#') {
                dtmf = 'dtmfh';
            }
            sequence.push(dtmf);
        });
        const playNextDigit = () => {
            const digit = sequence.shift();
            if (digit) {
                if (this._options.dialtonePlayer && !customSounds[digit]) {
                    this._options.dialtonePlayer.play(digit);
                }
                else {
                    this._soundcache.get(digit).play();
                }
            }
            if (sequence.length) {
                setTimeout(() => playNextDigit(), 200);
            }
        };
        playNextDigit();
        const dtmfSender = this._mediaHandler.getOrCreateDTMFSender();
        function insertDTMF(dtmfs) {
            if (!dtmfs.length) {
                return;
            }
            const dtmf = dtmfs.shift();
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
            const error = new GeneralErrors.ConnectionError('Could not send DTMF: Signaling channel is disconnected');
            this._log.debug('#error', error);
            this.emit('error', error);
        }
    }
    /**
     * Send a message to Twilio. Your backend application can listen for these
     * messages to allow communication between your frontend and backend applications.
     * <br/><br/>This feature is currently in Beta.
     * @param message - The message object to send.
     * @returns A voice event sid that uniquely identifies the message that was sent.
     */
    sendMessage(message) {
        this._log.debug('.sendMessage', JSON.stringify(message));
        const { content, contentType, messageType } = message;
        if (typeof content === 'undefined' || content === null) {
            throw new InvalidArgumentError('`content` is empty');
        }
        if (typeof messageType !== 'string') {
            throw new InvalidArgumentError('`messageType` must be a string.');
        }
        if (messageType.length === 0) {
            throw new InvalidArgumentError('`messageType` must be a non-empty string.');
        }
        if (this._pstream === null) {
            throw new InvalidStateError('Could not send CallMessage; Signaling channel is disconnected');
        }
        const callSid = this.parameters.CallSid;
        if (typeof this.parameters.CallSid === 'undefined') {
            throw new InvalidStateError('Could not send CallMessage; Call has no CallSid');
        }
        const voiceEventSid = this._voiceEventSidGenerator();
        this._messages.set(voiceEventSid, { content, contentType, messageType, voiceEventSid });
        this._pstream.sendMessage(callSid, content, contentType, messageType, voiceEventSid);
        return voiceEventSid;
    }
    /**
     * Get the current {@link Call} status.
     */
    status() {
        return this._status;
    }
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
    _checkVolume(currentVolume, currentStreak, lastValue, direction) {
        const wasWarningRaised = currentStreak >= 10;
        let newStreak = 0;
        if (lastValue === currentVolume) {
            newStreak = currentStreak;
        }
        if (newStreak >= 10) {
            this._emitWarning('audio-level-', `constant-audio-${direction}-level`, 10, newStreak, false);
        }
        else if (wasWarningRaised) {
            this._emitWarning('audio-level-', `constant-audio-${direction}-level`, 10, newStreak, true);
        }
        return newStreak;
    }
    /**
     * Clean up event listeners.
     */
    _cleanupEventListeners() {
        const cleanup = () => {
            if (!this._pstream) {
                return;
            }
            this._pstream.removeListener('ack', this._onAck);
            this._pstream.removeListener('answer', this._onAnswer);
            this._pstream.removeListener('cancel', this._onCancel);
            this._pstream.removeListener('error', this._onSignalingError);
            this._pstream.removeListener('hangup', this._onHangup);
            this._pstream.removeListener('ringing', this._onRinging);
            this._pstream.removeListener('transportClose', this._onTransportClose);
            this._pstream.removeListener('connected', this._onConnected);
            this._pstream.removeListener('message', this._onMessageReceived);
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
    }
    /**
     * Create the payload wrapper for a batch of metrics to be sent to Insights.
     */
    _createMetricPayload() {
        const payload = {
            call_sid: this.parameters.CallSid,
            dscp: !!this._options.dscp,
            sdk_version: RELEASE_VERSION,
        };
        if (this._options.gateway) {
            payload.gateway = this._options.gateway;
        }
        payload.direction = this._direction;
        return payload;
    }
    /**
     * Disconnect the {@link Call}.
     * @param message - A message explaining why the {@link Call} is being disconnected.
     * @param wasRemote - Whether the disconnect was triggered locally or remotely.
     */
    _disconnect(message, wasRemote) {
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
            const callsid = this.parameters.CallSid || this.outboundConnectionId;
            if (callsid) {
                this._pstream.hangup(callsid, message);
            }
        }
        this._cleanupEventListeners();
        this._mediaHandler.close();
        if (!wasRemote) {
            this._publisher.info('connection', 'disconnected-by-local', null, this);
        }
    }
    /**
     * Transition to {@link CallStatus.Open} if criteria is met.
     */
    _maybeTransitionToOpen() {
        const wasConnected = this._wasConnected;
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
    }
    /**
     * Post an event to Endpoint Analytics indicating that the end user
     *   has ignored a request for feedback.
     */
    _postFeedbackDeclined() {
        return this._publisher.info('feedback', 'received-none', null, this, true);
    }
    /**
     * Publish the current set of queued metrics samples to Insights.
     */
    _publishMetrics() {
        if (this._metricsSamples.length === 0) {
            return;
        }
        this._publisher.postMetrics('quality-metrics-samples', 'metrics-sample', this._metricsSamples.splice(0), this._createMetricPayload(), this).catch((e) => {
            this._log.warn('Unable to post metrics to Insights. Received error:', e);
        });
    }
    /**
     * Set the CallSid
     * @param payload
     */
    _setCallSid(payload) {
        const callSid = payload.callsid;
        if (!callSid) {
            return;
        }
        this.parameters.CallSid = callSid;
        this._mediaHandler.callSid = callSid;
    }
}
/**
 * String representation of the {@link Call} class.
 * @private
 */
Call.toString = () => '[Twilio.Call class]';
(function (Call) {
    /**
     * Possible states of the {@link Call}.
     */
    let State;
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
    let FeedbackIssue;
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
    let FeedbackScore;
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
    let CallDirection;
    (function (CallDirection) {
        CallDirection["Incoming"] = "INCOMING";
        CallDirection["Outgoing"] = "OUTGOING";
    })(CallDirection = Call.CallDirection || (Call.CallDirection = {}));
    /**
     * Valid audio codecs to use for the media connection.
     */
    let Codec;
    (function (Codec) {
        Codec["Opus"] = "opus";
        Codec["PCMU"] = "pcmu";
    })(Codec = Call.Codec || (Call.Codec = {}));
    /**
     * Possible ICE Gathering failures
     */
    let IceGatheringFailureReason;
    (function (IceGatheringFailureReason) {
        IceGatheringFailureReason["None"] = "none";
        IceGatheringFailureReason["Timeout"] = "timeout";
    })(IceGatheringFailureReason = Call.IceGatheringFailureReason || (Call.IceGatheringFailureReason = {}));
    /**
     * Possible media failures
     */
    let MediaFailure;
    (function (MediaFailure) {
        MediaFailure["ConnectionDisconnected"] = "ConnectionDisconnected";
        MediaFailure["ConnectionFailed"] = "ConnectionFailed";
        MediaFailure["IceGatheringFailed"] = "IceGatheringFailed";
        MediaFailure["LowBytes"] = "LowBytes";
    })(MediaFailure = Call.MediaFailure || (Call.MediaFailure = {}));
})(Call || (Call = {}));
function generateTempCallSid() {
    return 'TJSxxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
        /* tslint:disable:no-bitwise */
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        /* tslint:enable:no-bitwise */
        return v.toString(16);
    });
}
export default Call;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vY2FsbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7Ozs7R0FLRztBQUNILE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDdEMsT0FBTyxPQUFPLE1BQU0sV0FBVyxDQUFDO0FBQ2hDLE9BQU8sTUFBTSxNQUFNLFVBQVUsQ0FBQztBQUU5QixPQUFPLEVBQ0wsYUFBYSxFQUNiLDhCQUE4QixFQUM5QixvQkFBb0IsRUFDcEIsaUJBQWlCLEVBQ2pCLFdBQVcsRUFDWCxlQUFlLEVBRWYsZUFBZSxHQUNoQixNQUFNLFVBQVUsQ0FBQztBQUNsQixPQUFPLEdBQUcsTUFBTSxPQUFPLENBQUM7QUFDeEIsT0FBTyxFQUFFLGNBQWMsRUFBRSxNQUFNLE9BQU8sQ0FBQztBQUN2QyxPQUFPLEVBQUUsWUFBWSxFQUFtQixNQUFNLG9CQUFvQixDQUFDO0FBRW5FLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLFdBQVcsQ0FBQztBQUVsRCxPQUFPLFlBQVksTUFBTSxnQkFBZ0IsQ0FBQztBQUMxQyxPQUFPLEVBQUUsUUFBUSxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQ2xDLE9BQU8sRUFBRSxxQkFBcUIsRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUUvQyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBd0I5QyxNQUFNLGNBQWMsR0FBRztJQUNyQixNQUFNLEVBQUUsR0FBRztJQUNYLE1BQU0sRUFBRSxHQUFHO0lBQ1gsR0FBRyxFQUFFLEtBQUs7SUFDVixHQUFHLEVBQUUsQ0FBQztDQUNQLENBQUM7QUFFRixNQUFNLG1CQUFtQixHQUFXLEVBQUUsQ0FBQztBQUN2QyxNQUFNLG1CQUFtQixHQUFXLEdBQUcsQ0FBQztBQUN4QyxNQUFNLGtCQUFrQixHQUFXLEdBQUcsQ0FBQztBQUV2QyxNQUFNLGtCQUFrQixHQUFXLEVBQUUsQ0FBQztBQUN0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