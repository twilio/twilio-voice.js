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
// Cadence of the feedback tones the caller hears. Intentionally independent of
// the wire's tone timing: this is audible feedback, not a mirror of what the
// recipient receives.
const DTMF_LOCAL_TONE_GAP = 200;
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
        let tonesInRun = 0;
        const playNextDigit = () => {
            const digit = sequence.shift();
            if (digit) {
                tonesInRun++;
                if (this._options.dialtonePlayer && !customSounds[digit]) {
                    this._options.dialtonePlayer.play(digit);
                }
                else {
                    this._soundcache.get(digit).play();
                }
            }
            if (sequence.length) {
                let delay;
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
                setTimeout(() => playNextDigit(), delay);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiY2FsbC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9jYWxsLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQWlDQSxNQUFNLGNBQWMsR0FBRztBQUNyQixJQUFBLE1BQU0sRUFBRSxHQUFHO0FBQ1gsSUFBQSxNQUFNLEVBQUUsR0FBRztBQUNYLElBQUEsR0FBRyxFQUFFLEtBQUs7QUFDVixJQUFBLEdBQUcsRUFBRSxDQUFDO0NBQ1A7QUFFRCxNQUFNLG1CQUFtQixHQUFXLEVBQUU7QUFDdEM7QUFDQTtBQUNBO0FBQ0EsTUFBTSxtQkFBbUIsR0FBVyxHQUFHO0FBQ3ZDLE1BQU0sbUJBQW1CLEdBQVcsR0FBRztBQUN2QyxNQUFNLGtCQUFrQixHQUFXLEdBQUc7QUFFdEMsTUFBTSxrQkFBa0IsR0FBVyxFQUFFO0FBQ3JDLE1BQU0sYUFBYSxHQUFXLElBQUk7QUFFbEMsTUFBTSxzQkFBc0IsR0FBRztBQUM3QixJQUFBLFVBQVUsRUFBRSxJQUFJO0FBQ2hCLElBQUEsSUFBSSxFQUFFO0FBQ0osUUFBQSxJQUFJLEVBQUUsS0FBSztBQUNYLFFBQUEsT0FBTyxFQUFFLHlDQUF5QztBQUNsRCxRQUFBLFdBQVcsRUFBRSxJQUFJLFdBQVcsQ0FBQyxlQUFlLEVBQUU7QUFDL0MsS0FBQTtDQUNGO0FBRUQsTUFBTSxnQ0FBZ0MsR0FBMkM7OztBQUcvRSxJQUFBLG1CQUFtQixFQUFFO0FBQ25CLFFBQUEsR0FBRyxFQUFFLGFBQWE7QUFDbEIsUUFBQSxVQUFVLEVBQUUsdUJBQXVCO0FBQ3BDLEtBQUE7Q0FDRjtBQUVELE1BQU0sYUFBYSxHQUEyQjtBQUM1QyxJQUFBLGVBQWUsRUFBRSxtQkFBbUI7QUFDcEMsSUFBQSxnQkFBZ0IsRUFBRSxvQkFBb0I7QUFDdEMsSUFBQSxhQUFhLEVBQUUsZ0JBQWdCO0FBQy9CLElBQUEsU0FBUyxFQUFFLFlBQVk7QUFDdkIsSUFBQSxNQUFNLEVBQUUsUUFBUTtB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
