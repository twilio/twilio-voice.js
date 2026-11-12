import { EventEmitter } from 'events';
import Call from '../call';
import Device from '../device';
import { TwilioError } from '../errors';
import { RTCSampleTotals } from '../rtc/sample';
import RTCSample from '../rtc/sample';
import RTCWarning from '../rtc/warning';
import { NetworkTiming, TimeMeasurement } from './timing';
/**
 * Placeholder until we convert peerconnection.js to TypeScript.
 * Represents the audio output object coming from Client SDK's PeerConnection object.
 */
export interface AudioOutput {
    /**
     * The audio element used to play out the sound.
     */
    audio: HTMLAudioElement;
}
/**
 * @mergeModuleWith PreflightTest
 */
export declare interface PreflightTest {
    /**
     * Raised when [[PreflightTest.status]] has transitioned to [[PreflightTest.Status.Completed]].
     * During this time, [[PreflightTest.report]] is available and ready to be inspected.
     * In some cases, this will not trigger if the test encounters a fatal error prior connecting to Twilio.
     * See [[PreflightTest.failedEvent]].
     * @param report
     * @example `preflight.on('completed', report => console.log(report))`
     * @event
     */
    completedEvent(report: PreflightTest.Report): void;
    /**
     * Raised when [[PreflightTest.status]] has transitioned to [[PreflightTest.Status.Connected]].
     * @example `preflight.on('connected', () => console.log('Test connected'))`
     * @event
     */
    connectedEvent(): void;
    /**
     * Raised when [[PreflightTest.status]] has transitioned to [[PreflightTest.Status.Failed]].
     * This happens when establishing a connection to Twilio has failed or when a test call has encountered a fatal error.
     * This is also raised if [[PreflightTest.stop]] is called while the test is in progress.
     * @param error
     * @example `preflight.on('failed', error => console.log(error))`
     * @event
     */
    failedEvent(error: TwilioError | DOMException): void;
    /**
     * Raised when the [[Call]] gets a webrtc sample object. This event is published every second.
     * @param sample
     * @example `preflight.on('sample', sample => console.log(sample))`
     * @event
     */
    sampleEvent(sample: RTCSample): void;
    /**
     * Raised whenever the [[Call]] encounters a warning.
     * @param name - The name of the warning.
     * @example `preflight.on('warning', (name, data) => console.log({ name, data }))`
     * @event
     */
    warningEvent(name: string, data: PreflightTest.Warning): void;
}
/**
 * Runs some tests to identify issues, if any, prohibiting successful calling.
 */
export declare class PreflightTest extends EventEmitter {
    /**
     * The {@link Call} for this test call
     */
    private _call;
    /**
     * Callsid generated for this test call
     */
    private _callSid;
    /**
     * The {@link Device} for this test call
     */
    private _device;
    /**
     * The timer when doing an echo test
     * The echo test is used when fakeMicInput is set to true
     */
    private _echoTimer;
    /**
     * The edge that the `Twilio.Device` connected to.
     */
    private _edge;
    /**
     * End of test timestamp
     */
    private _endTime;
    /**
     * Whether this test has already logged an insights-connection-warning.
     */
    private _hasInsightsErrored;
    /**
     * Latest WebRTC sample collected for this test
     */
    private _latestSample;
    /**
     * An instance of Logger to use.
     */
    private _log;
    /**
     * Network related timing measurements for this test
     */
    private _networkTiming;
    /**
     * The options passed to {@link PreflightTest} constructor
     */
    private _options;
    /**
     * The report for this test.
     */
    private _report;
    /**
     * The WebRTC ICE candidates stats information collected during the test
     */
    private _rtcIceCandidateStatsReport;
    /**
     * WebRTC samples collected during this test
     */
    private _samples;
    /**
     * Timer for setting up signaling connection
     */
    private _signalingTimeoutTimer;
    /**
     * Start of test timestamp
     */
    private _startTime;
    /**
     * Current status of this test
     */
    private _status;
    /**
     * List of warning names and warning data detected during this test
     */
    private _warnings;
    /**
     * Construct a {@link PreflightTest} instance.
     * @param token - A Twilio JWT token string.
     * @param options
     */
    constructor(token: string, options: PreflightTest.ExtendedOptions);
    /**
     * Stops the current test and raises a failed event.
     */
    stop(): void;
    /**
     * Emit a {PreflightTest.Warning}
     */
    private _emitWarning;
    /**
     * Returns call quality base on the RTC Stats
     */
    private _getCallQuality;
    /**
     * Returns the report for this test.
     */
    private _getReport;
    /**
     * Returns RTC stats totals for this test
     */
    private _getRTCSampleTotals;
    /**
     * Returns RTC related stats captured during the test call
     */
    private _getRTCStats;
    /**
     * Returns a MediaStream from a media file
     */
    private _getStreamFromFile;
    /**
     * Initialize the device
     */
    private _initDevice;
    /**
     * Called on {@link Device} error event
     * @param error
     */
    private _onDeviceError;
    /**
     * Called on {@link Device} ready event
     */
    private _onDeviceRegistered;
    /**
     * Called when there is a fatal error
     * @param error
     */
    private _onFailed;
    /**
     * Called when the device goes offline.
     * This indicates that the test has been completed, but we won't know if it failed or not.
     * The onError event will be the indicator whether the test failed.
     */
    private _onUnregistered;
    /**
     * Clean up all handlers for device and call
     */
    private _releaseHandlers;
    /**
     * Setup the event handlers for the {@link Call} of the test call
     * @param call
     */
    private _setupCallHandlers;
    /**
     * The callsid generated for the test call.
     */
    get callSid(): string | undefined;
    /**
     * A timestamp in milliseconds of when the test ended.
     */
    get endTime(): number | undefined;
    /**
     * The latest WebRTC sample collected.
     */
    get latestSample(): RTCSample | undefined;
    /**
     * The report for this test.
     */
    get report(): PreflightTest.Report | undefined;
    /**
     * A timestamp in milliseconds of when the test started.
     */
    get startTime(): number;
    /**
     * The status of the test.
     */
    get status(): PreflightTest.Status;
}
/**
 * @mergeModuleWith PreflightTest
 */
export declare namespace PreflightTest {
    /**
     * The quality of the call determined by different mos ranges.
     * Mos is calculated base on the WebRTC stats - rtt, jitter, and packet lost.
     */
    enum CallQuality {
        /**
         * If the average mos is over 4.2.
         */
        Excellent = "excellent",
        /**
         * If the average mos is between 4.1 and 4.2 both inclusive.
         */
        Great = "great",
        /**
         * If the average mos is between 3.7 and 4.0 both inclusive.
         */
        Good = "good",
        /**
         * If the average mos is between 3.1 and 3.6 both inclusive.
         */
        Fair = "fair",
        /**
         * If the average mos is 3.0 or below.
         */
        Degraded = "degraded"
    }
    /**
     * Possible events that a [[PreflightTest]] might emit.
     */
    enum Events {
        /**
         * See [[PreflightTest.completedEvent]]
         */
        Completed = "completed",
        /**
         * See [[PreflightTest.connectedEvent]]
         */
        Connected = "connected",
        /**
         * See [[PreflightTest.failedEvent]]
         */
        Failed = "failed",
        /**
         * See [[PreflightTest.sampleEvent]]
         */
        Sample = "sample",
        /**
         * See [[PreflightTest.warningEvent]]
         */
        Warning = "warning"
    }
    /**
     * Possible status of the test.
     */
    enum Status {
        /**
         * Call to Twilio has initiated.
         */
        Connecting = "connecting",
        /**
         * Call to Twilio has been established.
         */
        Connected = "connected",
        /**
         * The connection to Twilio has been disconnected and the test call has completed.
         */
        Completed = "completed",
        /**
         * The test has stopped and failed.
         */
        Failed = "failed"
    }
    /**
     * The WebRTC API's [RTCIceCandidateStats](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidateStats)
     * dictionary which provides information related to an ICE candidate.
     */
    type RTCIceCandidateStats = any;
    /**
     * Options that may be passed to {@link PreflightTest} constructor for internal testing.
     * @internal
     */
    interface ExtendedOptions extends Options {
        /**
         * The AudioContext instance to use
         */
        audioContext?: AudioContext;
        /**
         * A string or array of strings representing the URI of the signaling
         * gateway to connect to.
         */
        chunderw?: string | string[];
        /**
         * Device class to use.
         */
        deviceFactory?: typeof Device;
        /**
         * A string representing the URI of the insights gateway to connect to.
         */
        eventgw?: string;
        /**
         * File input stream to use instead of reading from mic
         */
        fileInputStream?: MediaStream;
        /**
         * The getRTCIceCandidateStatsReport to use for testing.
         */
        getRTCIceCandidateStatsReport?: Function;
        /**
         * An RTCConfiguration to pass to the RTCPeerConnection constructor.
         */
        rtcConfiguration?: RTCConfiguration;
    }
    /**
     * A WebRTC stats report containing relevant information about selected and gathered ICE candidates
     */
    interface RTCIceCandidateStatsReport {
        /**
         * An array of WebRTC stats for the ICE candidates gathered when connecting to media.
         */
        iceCandidateStats: RTCIceCandidateStats[];
        /**
         * A WebRTC stats for the ICE candidate pair used to connect to media, if candidates were selected.
         */
        selectedIceCandidatePairStats?: RTCSelectedIceCandidatePairStats;
    }
    /**
     * Options passed to {@link PreflightTest} constructor.
     */
    interface Options {
        /**
         * An ordered array of codec names that will be used during the test call,
         * from most to least preferred.
         * @default ['pcmu','opus']
         */
        codecPreferences?: Call.Codec[];
        /**
         * Specifies which Twilio Data Center to use when initiating the test call.
         * Please see this
         * [page](https://www.twilio.com/docs/voice/client/edges)
         * for the list of available edges.
         * @default roaming
         */
        edge?: string;
        /**
         * If set to `true`, the test call will ignore microphone input and will use a default audio file.
         * If set to `false`, the test call will capture the audio from the microphone.
         * Setting this to `true` is only supported on Chrome and will throw a fatal error on other browsers
         * @default false
         */
        fakeMicInput?: boolean;
        /**
         * An array of custom ICE servers to use to connect media. If you provide both STUN and TURN server configurations,
         * the test will detect whether a TURN server is required to establish a connection.
         *
         * The following example demonstrates how to use [Twilio's Network Traversal Service](https://www.twilio.com/stun-turn)
         * to generate STUN/TURN credentials and how to specify a specific [edge location](https://www.twilio.com/docs/global-infrastructure/edge-locations).
         *
         * ```ts
         * import Client from 'twilio';
         * import { Device } from '@twilio/voice-sdk';
         *
         * // Generate the STUN and TURN server credentials with a ttl of 120 seconds
         * const client = Client(twilioAccountSid, authToken);
         * const token = await client.tokens.create({ ttl: 120 });
         *
         * let iceServers = token.iceServers;
         *
         * // By default, global will be used as the default edge location.
         * // You can replace global with a specific edge name for each of the iceServer configuration.
         * iceServers = iceServers.map(config => {
         *   let { url, urls, ...rest } = config;
         *   url = url.replace('global', 'ashburn');
         *   urls = urls.replace('global', 'ashburn');
         *
         *   return { url, urls, ...rest };
         * });
         *
         * // Use the TURN credentials using the iceServers parameter
         * const preflightTest = Device.runPreflight(token, { iceServers });
         *
         * // Read from the report object to determine whether TURN is required to connect to media
         * preflightTest.on('completed', (report) => {
         *   console.log(report.isTurnRequired);
         * });
         * ```
         *
         * @default null
         */
        iceServers?: RTCIceServer[];
        /**
         * Log level to use in the Device.
         * @default 'error'
         */
        logLevel?: string;
        /**
         * Amount of time to wait for setting up signaling connection.
         * @default 10000
         */
        signalingTimeoutMs?: number;
    }
    /**
     * Represents the WebRTC stats for the ICE candidate pair used to connect to media, if candidates were selected.
     */
    interface RTCSelectedIceCandidatePairStats {
        /**
         * An [RTCIceCandidateStats](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidateStats)
         * object which provides information related to the selected local ICE candidate.
         */
        localCandidate: RTCIceCandidateStats;
        /**
         * An [RTCIceCandidateStats](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidateStats)
         * object which provides information related to the selected remote ICE candidate.
         */
        remoteCandidate: RTCIceCandidateStats;
    }
    /**
     * Represents RTC related stats that are extracted from RTC samples.
     */
    interface RTCStats {
        /**
         * Packets delay variation.
         */
        jitter: Stats;
        /**
         * Mean opinion score, 1.0 through roughly 4.5.
         */
        mos: Stats;
        /**
         * Round trip time, to the server back to the client.
         */
        rtt: Stats;
    }
    /**
     * Represents general stats for a specific metric.
     */
    interface Stats {
        /**
         * The average value for this metric.
         */
        average: number;
        /**
         * The maximum value for this metric.
         */
        max: number;
        /**
         * The minimum value for this metric.
         */
        min: number;
    }
    /**
     * Represents the report generated from a {@link PreflightTest}.
     */
    interface Report {
        /**
         * The quality of the call determined by different mos ranges.
         */
        callQuality?: CallQuality;
        /**
         * CallSid generated during the test.
         */
        callSid: string | undefined;
        /**
         * The edge that the test call was connected to.
         */
        edge?: string;
        /**
         * An array of WebRTC stats for the ICE candidates gathered when connecting to media.
         */
        iceCandidateStats: RTCIceCandidateStats[];
        /**
         * Whether a TURN server is required to connect to media.
         * This is dependent on the selected ICE candidates, and will be true if either is of type "relay",
         * false if both are of another type, or undefined if there are no selected ICE candidates.
         * See `PreflightTest.Options.iceServers` for more details.
         */
        isTurnRequired?: boolean;
        /**
         * Network related time measurements.
         */
        networkTiming: NetworkTiming;
        /**
         * WebRTC samples collected during the test.
         */
        samples: RTCSample[];
        /**
         * The edge passed to `Device.runPreflight`.
         */
        selectedEdge?: string;
        /**
         * A WebRTC stats for the ICE candidate pair used to connect to media, if candidates were selected.
         */
        selectedIceCandidatePairStats?: RTCSelectedIceCandidatePairStats;
        /**
         * RTC related stats captured during the test.
         */
        stats?: RTCStats;
        /**
         * Time measurements of test run time.
         */
        testTiming: TimeMeasurement;
        /**
         * Calculated totals in RTC statistics samples.
         */
        totals?: RTCSampleTotals;
        /**
         * List of warning names and warning data detected during this test.
         */
        warnings: PreflightTest.Warning[];
    }
    /**
     * A warning that can be raised by Preflight, and returned in the Report.warnings field.
     */
    interface Warning {
        /**
         * Description of the Warning
         */
        description: string;
        /**
         * Name of the Warning
         */
        name: string;
        /**
         * If applicable, the RTCWarning that triggered this warning.
         */
        rtcWarning?: RTCWarning;
    }
}
