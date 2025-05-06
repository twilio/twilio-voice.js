/// <reference types="node" />
/**
 * @packageDocumentation
 * @module Voice
 * @publicapi
 * @internal
 */
import { EventEmitter } from 'events';
import Device from './device';
import DialtonePlayer from './dialtonePlayer';
import RTCSample from './rtc/sample';
import StatsMonitor from './statsMonitor';
/**
 * @private
 */
export declare type IAudioHelper = any;
/**
 * @private
 */
export declare type IPStream = any;
/**
 * @private
 */
export declare type IPeerConnection = any;
/**
 * @private
 */
export declare type IPublisher = any;
/**
 * @private
 */
export declare type ISound = any;
/**
 * A {@link Call} represents a media and signaling connection to a TwiML application.
 * @publicapi
 */
declare class Call extends EventEmitter {
    /**
     * String representation of the {@link Call} class.
     * @private
     */
    static toString: () => string;
    /**
     * Returns caller verification information about the caller.
     * If no caller verification information is available this will return null.
     */
    readonly callerInfo: Call.CallerInfo | null;
    /**
     * The custom parameters sent to (outgoing) or received by (incoming) the TwiML app.
     */
    readonly customParameters: Map<string, string>;
    /**
     * Whether this {@link Call} is incoming or outgoing.
     */
    get direction(): Call.CallDirection;
    /**
     * Audio codec used for this {@link Call}. Expecting {@link Call.Codec} but
     * will copy whatever we get from RTC stats.
     */
    get codec(): string;
    /**
     * The connect token is available as soon as the call is established
     * and connected to Twilio. Use this token to reconnect to a call via the {@link Device.connect}
     * method.
     *
     * For incoming calls, it is available in the call object after the {@link Device.incomingEvent} is emitted.
     * For outgoing calls, it is available after the {@link Call.acceptEvent} is emitted.
     */
    get connectToken(): string | undefined;
    /**
     * The temporary CallSid for this call, if it's outbound.
     */
    readonly outboundConnectionId?: string;
    /**
     * Call parameters received from Twilio for an incoming call.
     */
    parameters: Record<string, string>;
    /**
     * Audio codec used for this {@link Call}. Expecting {@link Call.Codec} but
     * will copy whatever we get from RTC stats.
     */
    private _codec;
    /**
     * Whether this {@link Call} is incoming or outgoing.
     */
    private readonly _direction;
    /**
     * The number of times input volume has been the same consecutively.
     */
    private _inputVolumeStreak;
    /**
     * Whether the call has been answered.
     */
    private _isAnswered;
    /**
     * Whether the call has been cancelled.
     */
    private _isCancelled;
    /**
     * Whether the call has been rejected
     */
    private _isRejected;
    /**
     * Whether or not the browser uses unified-plan SDP by default.
     */
    private readonly _isUnifiedPlanDefault;
    /**
     * The most recent public input volume value. 0 -> 1 representing -100 to -30 dB.
     */
    private _latestInputVolume;
    /**
     * The most recent public output volume value. 0 -> 1 representing -100 to -30 dB.
     */
    private _latestOutputVolume;
    /**
     * An instance of Logger to use.
     */
    private _log;
    /**
     * The MediaHandler (Twilio PeerConnection) this {@link Call} is using for
     * media signaling.
     */
    private _mediaHandler;
    /**
     * An instance of Backoff for media reconnection
     */
    private _mediaReconnectBackoff;
    /**
     * Timestamp for the initial media reconnection
     */
    private _mediaReconnectStartTime;
    /**
     * State of the {@link Call}'s media.
     */
    private _mediaStatus;
    /**
     * A map of messages sent via sendMessage API using voiceEventSid as the key.
     * The message will be deleted once an 'ack' or an error is received from the server.
     */
    private _messages;
    /**
     * A batch of metrics samples to send to Insights. Gets cleared after
     * each send and appended to on each new sample.
     */
    private readonly _metricsSamples;
    /**
     * An instance of StatsMonitor.
     */
    private readonly _monitor;
    /**
     * Method to be run after {@link Call.ignore} is called.
     */
    private _onIgnore;
    /**
     * Options passed to this {@link Call}.
     */
    private _options;
    /**
     * The number of times output volume has been the same consecutively.
     */
    private _outputVolumeStreak;
    /**
     * The PStream instance to use for Twilio call signaling.
     */
    private readonly _pstream;
    /**
     * An instance of EventPublisher.
     */
    private readonly _publisher;
    /**
     * Whether the {@link Call} should send a hangup on disconnect.
     */
    private _shouldSendHangup;
    /**
     * The signaling reconnection token used to re-establish a lost signaling connection.
     */
    private _signalingReconnectToken;
    /**
     * State of the {@link Call}'s signaling.
     */
    private _signalingStatus;
    /**
     * A Map of Sounds to play.
     */
    private readonly _soundcache;
    /**
     * State of the {@link Call}.
     */
    private _status;
    /**
     * Voice event SID generator, creates a unique voice event SID.
     */
    private _voiceEventSidGenerator;
    /**
     * Whether the {@link Call} has been connected. Used to determine if we are reconnected.
     */
    private _wasConnected;
    /**
     * @constructor
     * @private
     * @param config - Mandatory configuration options
     * @param [options] - Optional settings
     */
    constructor(config: Call.Config, options?: Call.Options);
    /**
     * Set the audio input tracks from a given stream.
     * @param stream
     * @private
     */
    _setInputTracksFromStream(stream: MediaStream | null): Promise<void>;
    /**
     * Set the audio output sink IDs.
     * @param sinkIds
     * @private
     */
    _setSinkIds(sinkIds: string[]): Promise<void>;
    /**
     * Accept the incoming {@link Call}.
     * @param [options]
     */
    accept(options?: Call.AcceptOptions): void;
    /**
     * Disconnect from the {@link Call}.
     */
    disconnect(): void;
    /**
     * Get the local MediaStream, if set.
     */
    getLocalStream(): MediaStream | undefined;
    /**
     * Get the remote MediaStream, if set.
     */
    getRemoteStream(): MediaStream | undefined;
    /**
     * Ignore the incoming {@link Call}.
     */
    ignore(): void;
    /**
     * Check whether call is muted
     */
    isMuted(): boolean;
    /**
     * Mute incoming audio.
     * @param shouldMute - Whether the incoming audio should be muted. Defaults to true.
     */
    mute(shouldMute?: boolean): void;
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
    postFeedback(score?: Call.FeedbackScore, issue?: Call.FeedbackIssue): Promise<void>;
    /**
     * Reject the incoming {@link Call}.
     */
    reject(): void;
    /**
     * Send a string of digits.
     * @param digits
     */
    sendDigits(digits: string): void;
    /**
     * Send a message to Twilio. Your backend application can listen for these
     * messages to allow communication between your frontend and backend applications.
     * <br/><br/>This feature is currently in Beta.
     * @param message - The message object to send.
     * @returns A voice event sid that uniquely identifies the message that was sent.
     */
    sendMessage(message: Call.Message): string;
    /**
     * Get the current {@link Call} status.
     */
    status(): Call.State;
    /**
     * String representation of {@link Call} instance.
     * @private
     */
    toString: () => string;
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
    private _checkVolume;
    /**
     * Clean up event listeners.
     */
    private _cleanupEventListeners;
    /**
     * Create the payload wrapper for a batch of metrics to be sent to Insights.
     */
    private _createMetricPayload;
    /**
     * Disconnect the {@link Call}.
     * @param message - A message explaining why the {@link Call} is being disconnected.
     * @param wasRemote - Whether the disconnect was triggered locally or remotely.
     */
    private _disconnect;
    private _emitWarning;
    /**
     * Transition to {@link CallStatus.Open} if criteria is met.
     */
    private _maybeTransitionToOpen;
    /**
     * Called when the {@link Call} receives an ack from signaling
     * @param payload
     */
    private _onAck;
    /**
     * Called when the {@link Call} is answered.
     * @param payload
     */
    private _onAnswer;
    /**
     * Called when the {@link Call} is cancelled.
     * @param payload
     */
    private _onCancel;
    /**
     * Called when we receive a connected event from pstream.
     * Re-emits the event.
     */
    private _onConnected;
    /**
     * Called when the {@link Call} is hung up.
     * @param payload
     */
    private _onHangup;
    /**
     * Called when there is a media failure.
     * Manages all media-related states and takes action base on the states
     * @param type - Type of media failure
     */
    private _onMediaFailure;
    /**
     * Called when media call is restored
     */
    private _onMediaReconnected;
    /**
     * Raised when a Call receives a message from the backend.
     * @param payload - A record representing the payload of the message from the
     * Twilio backend.
     */
    private _onMessageReceived;
    /**
     * Raised when a Call receives an 'ack' with an 'acktype' of 'message.
     * This means that the message sent via sendMessage API has been received by the signaling server.
     * @param voiceEventSid
     */
    private _onMessageSent;
    /**
     * When we get a RINGING signal from PStream, update the {@link Call} status.
     * @param payload
     */
    private _onRinging;
    /**
     * Called each time StatsMonitor emits a sample.
     * Emits stats event and batches the call stats metrics and sends them to Insights.
     * @param sample
     */
    private _onRTCSample;
    /**
     * Called when an 'error' event is received from the signaling stream.
     */
    private _onSignalingError;
    /**
     * Called when signaling is restored
     */
    private _onSignalingReconnected;
    /**
     * Called when we receive a transportClose event from pstream.
     * Re-emits the event.
     */
    private _onTransportClose;
    /**
     * Post an event to Endpoint Analytics indicating that the end user
     *   has ignored a request for feedback.
     */
    private _postFeedbackDeclined;
    /**
     * Publish the current set of queued metrics samples to Insights.
     */
    private _publishMetrics;
    /**
     * Re-emit an StatsMonitor warning as a {@link Call}.warning or .warning-cleared event.
     * @param warningData
     * @param wasCleared - Whether this is a -cleared or -raised event.
     */
    private _reemitWarning;
    /**
     * Re-emit an StatsMonitor warning-cleared as a .warning-cleared event.
     * @param warningData
     */
    private _reemitWarningCleared;
    /**
     * Set the CallSid
     * @param payload
     */
    private _setCallSid;
}
declare namespace Call {
    /**
     * Possible states of the {@link Call}.
     */
    enum State {
        Closed = "closed",
        Connecting = "connecting",
        Open = "open",
        Pending = "pending",
        Reconnecting = "reconnecting",
        Ringing = "ringing"
    }
    /**
     * Different issues that may have been experienced during a call, that can be
     * reported to Twilio Insights via {@link Call}.postFeedback().
     */
    enum FeedbackIssue {
        AudioLatency = "audio-latency",
        ChoppyAudio = "choppy-audio",
        DroppedCall = "dropped-call",
        Echo = "echo",
        NoisyCall = "noisy-call",
        OneWayAudio = "one-way-audio"
    }
    /**
     * A rating of call quality experienced during a call, to be reported to Twilio Insights
     * via {@link Call}.postFeedback().
     */
    enum FeedbackScore {
        One = 1,
        Two = 2,
        Three = 3,
        Four = 4,
        Five = 5
    }
    /**
     * The directionality of the {@link Call}, whether incoming or outgoing.
     */
    enum CallDirection {
        Incoming = "INCOMING",
        Outgoing = "OUTGOING"
    }
    /**
     * Valid audio codecs to use for the media connection.
     */
    enum Codec {
        Opus = "opus",
        PCMU = "pcmu"
    }
    /**
     * Possible ICE Gathering failures
     */
    enum IceGatheringFailureReason {
        None = "none",
        Timeout = "timeout"
    }
    /**
     * Possible media failures
     */
    enum MediaFailure {
        ConnectionDisconnected = "ConnectionDisconnected",
        ConnectionFailed = "ConnectionFailed",
        IceGatheringFailed = "IceGatheringFailed",
        LowBytes = "LowBytes"
    }
    /**
     * Options to be used to acquire media tracks and connect media.
     */
    interface AcceptOptions {
        /**
         * An RTCConfiguration to pass to the RTCPeerConnection constructor.
         */
        rtcConfiguration?: RTCConfiguration;
        /**
         * MediaStreamConstraints to pass to getUserMedia when making or accepting a Call.
         */
        rtcConstraints?: MediaStreamConstraints;
    }
    /**
     * A CallerInfo provides caller verification information.
     */
    interface CallerInfo {
        /**
         * Whether or not the caller's phone number has been verified by
         * Twilio using SHAKEN/STIR validation. True if the caller has
         * been validated at level 'A', false if the caller has been
         * verified at any lower level or has failed validation.
         */
        isVerified: boolean;
    }
    /**
     * Mandatory config options to be passed to the {@link Call} constructor.
     * @private
     */
    interface Config {
        /**
         * An AudioHelper instance to be used for input/output devices.
         */
        audioHelper: IAudioHelper;
        /**
         * Whether or not the browser uses unified-plan SDP by default.
         */
        isUnifiedPlanDefault: boolean;
        /**
         * A function to be called after {@link Call.ignore} is called.
         */
        onIgnore: () => void;
        /**
         * The PStream instance to use for Twilio call signaling.
         */
        pstream: IPStream;
        /**
         * An EventPublisher instance to use for publishing events
         */
        publisher: IPublisher;
        /**
         * A Map of Sounds to play.
         */
        soundcache: Map<Device.SoundName, ISound>;
    }
    /**
     * A Call Message represents the data that is being transferred between
     * Twilio and the SDK.
     */
    interface Message {
        /**
         * The content of the message which should match the contentType parameter.
         */
        content: any;
        /**
         * The MIME type of the content. The default value is application/json
         * and is the only contentType that is supported at the moment.
         */
        contentType?: string;
        /**
         * The type of message. Currently, only 'user-defined-message' is supported.
         * More message types will be added in the future.
         * See [call resource](https://www.twilio.com/docs/voice/api/call-resource) documentation for more details.
         */
        messageType: string;
        /**
         * An autogenerated id that uniquely identifies the instance of this message.
         * This is not required when sending a message from the SDK as this is autogenerated.
         * But it will be available after the message is sent, or when a message is received.
         */
        voiceEventSid?: string;
    }
    /**
     * Options to be passed to the {@link Call} constructor.
     * @private
     */
    interface Options {
        /**
         * A method to call before Call.accept is processed.
         */
        beforeAccept?: (call: Call) => void;
        /**
         * Custom format context parameters associated with this call.
         */
        callParameters?: Record<string, string>;
        /**
         * An ordered array of codec names, from most to least preferred.
         */
        codecPreferences?: Codec[];
        /**
         * A mapping of custom sound URLs by sound name.
         */
        customSounds?: Partial<Record<Device.SoundName, string>>;
        /**
         * A DialTone player, to play mock DTMF sounds.
         */
        dialtonePlayer?: DialtonePlayer;
        /**
         * Whether or not to enable DSCP.
         */
        dscp?: boolean;
        enableImprovedSignalingErrorPrecision: boolean;
        /**
         * Experimental feature.
         * Force Chrome's ICE agent to use aggressive nomination when selecting a candidate pair.
         */
        forceAggressiveIceNomination?: boolean;
        /**
         * The gateway currently connected to.
         */
        gateway?: string;
        /**
         * A method that returns the current input MediaStream set on {@link Device}.
         */
        getInputStream?: () => MediaStream;
        /**
         * A method that returns the current SinkIDs set on {@link Device}.
         */
        getSinkIds?: () => string[];
        /**
         * The maximum average audio bitrate to use, in bits per second (bps) based on
         * [RFC-7587 7.1](https://tools.ietf.org/html/rfc7587#section-7.1). By default, the setting
         * is not used. If you specify 0, then the setting is not used. Any positive integer is allowed,
         * but values outside the range 6000 to 510000 are ignored and treated as 0. The recommended
         * bitrate for speech is between 8000 and 40000 bps as noted in
         * [RFC-7587 3.1.1](https://tools.ietf.org/html/rfc7587#section-3.1.1).
         */
        maxAverageBitrate?: number;
        /**
         * Custom MediaHandler (PeerConnection) constructor.
         */
        MediaHandler?: IPeerConnection;
        /**
         * Overrides the native MediaStream class.
         */
        MediaStream?: any;
        /**
         * The offer SDP, if this is an incoming call.
         */
        offerSdp?: string | null;
        /**
         * Whether this is a preflight call or not
         */
        preflight?: boolean;
        /**
         * The callSid to reconnect to.
         */
        reconnectCallSid?: string;
        /**
         * A reconnect token for the {@link Call}. Passed in for incoming {@link Calls}.
         */
        reconnectToken?: string;
        /**
         * An RTCConfiguration to pass to the RTCPeerConnection constructor.
         */
        rtcConfiguration?: RTCConfiguration;
        /**
         * RTC Constraints to pass to getUserMedia when making or accepting a Call.
         * The format of this object depends on browser.
         */
        rtcConstraints?: MediaStreamConstraints;
        /**
         * The RTCPeerConnection passed to {@link Device} on setup.
         */
        RTCPeerConnection?: any;
        /**
         * Whether the disconnect sound should be played.
         */
        shouldPlayDisconnect?: () => boolean;
        /**
         * An override for the StatsMonitor dependency.
         */
        StatsMonitor?: new () => StatsMonitor;
        /**
         * TwiML params for the call. May be set for either outgoing or incoming calls.
         */
        twimlParams?: Record<string, any>;
        /**
         * Voice event SID generator.
         */
        voiceEventSidGenerator?: () => string;
    }
    /**
     * Call metrics published to Insight Metrics.
     * This include rtc samples and audio information.
     * @private
     */
    interface CallMetrics extends RTCSample {
        /**
         * Percentage of maximum volume, between 0.0 to 1.0, representing -100 to -30 dB.
         */
        inputVolume: number;
        /**
         * Percentage of maximum volume, between 0.0 to 1.0, representing -100 to -30 dB.
         */
        outputVolume: number;
    }
}
export default Call;
