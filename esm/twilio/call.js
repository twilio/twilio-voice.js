import { EventEmitter } from 'events';
import Backoff from './backoff.js';
import Device from './device.js';
import { getPreciseSignalingErrorByCode, InvalidArgumentError, InvalidStateError } from './errors/index.js';
import Log from './log.js';
import PeerConnection from './rtc/peerconnection.js';
import './rtc/rtcpc.js';
import { IceCandidate } from './rtc/icecandidate.js';
import { getPreferredCodecInfo } from './rtc/sdp.js';
import { generateVoiceEventSid } from './sid.js';
import StatsMonitor from './statsMonitor.js';
import { isChrome } from './util.js';
import { RELEASE_VERSION } from './constants.js';
import { GeneralErrors, MediaErrors, SignalingErrors, UserMediaErrors } from './errors/generated.js';

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
 */
class Call extends EventEmitter {
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
     * @internal
     * @param config - Mandatory configuration options
     * @param options - Optional settings
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
            MediaStream: null,
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
         * @internal
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
                this._publisher.info('connection', 'reconnecting', null, this);
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
            MediaStream: this._options.MediaStream,
            RTCPeerConnection: this._options.RTCPeerConnection,
            codecPreferences: this._options.codecPreferences,
            dscp: this._options.dscp,
            forceAggressiveIceNomination: this._options.forceAggressiveIceNomination,
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
     * Set the audio input tracks from a given stream.
     * @internal
     * @param stream
     */
    _setInputTracksFromStream(stream) {
        return this._mediaHandler.setInputTracksFromStream(stream);
    }
    /**
     * Set the audio output sink IDs.
     * @internal
     * @param sinkIds
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
 */
Call.toString = () => '[Twilio.Call class]';
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

export { Call as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsbC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9jYWxsLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQWlDQSxNQUFNLGNBQWMsR0FBRztBQUNyQixJQUFBLE1BQU0sRUFBRSxHQUFHO0FBQ1gsSUFBQSxNQUFNLEVBQUUsR0FBRztBQUNYLElBQUEsR0FBRyxFQUFFLEtBQUs7QUFDVixJQUFBLEdBQUcsRUFBRSxDQUFDO0NBQ1A7QUFFRCxNQUFNLG1CQUFtQixHQUFXLEVBQUU7QUFDdEMsTUFBTSxtQkFBbUIsR0FBVyxHQUFHO0FBQ3ZDLE1BQU0sa0JBQWtCLEdBQVcsR0FBRztBQUV0QyxNQUFNLGtCQUFrQixHQUFXLEVBQUU7QUFDckMsTUFBTSxhQUFhLEdBQVcsSUFBSTtBQUVsQyxNQUFNLHNCQUFzQixHQUFHO0FBQzdCLElBQUEsVUFBVSxFQUFFLElBQUk7QUFDaEIsSUFBQSxJQUFJLEVBQUU7QUFDSixRQUFBLElBQUksRUFBRSxLQUFLO0FBQ1gsUUFBQSxPQUFPLEVBQUUseUNBQXlDO0FBQ2xELFFBQUEsV0FBVyxFQUFFLElBQUksV0FBVyxDQUFDLGVBQWUsRUFBRTtBQUMvQyxLQUFBO0NBQ0Y7QUFFRCxNQUFNLGdDQUFnQyxHQUEyQzs7O0FBRy9FLElBQUEsbUJBQW1CLEVBQUU7QUFDbkIsUUFBQSxHQUFHLEVBQUUsYUFBYTtBQUNsQixRQUFBLFVBQVUsRUFBRSx1QkFBdUI7QUFDcEMsS0FBQTtDQUNGO0FBRUQsTUFBTSxhQUFhLEdBQTJCO0FBQzVDLElBQUEsZUFBZSxFQUFFLG1CQUFtQjtBQUNwQyxJQUFBLGdCQUFnQixFQUFFLG9CQUFvQjtBQUN0QyxJQUFBLGFBQWEsRUFBRSxnQkFBZ0I7QUFDL0IsSUFBQSxTQUFTLEVBQUUsWUFBWTtBQUN2QixJQUFBLE1BQU0sRUFBRSxRQUFRO0FBQ2hCLElBQUEsR0FBRyxFQUFFLEtBQUs7QUFDVixJQUFBLEdBQUcsRUFB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
