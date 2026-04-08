import { EventEmitter } from 'events';
import Call from '../call';
import Device, { IExtendedDeviceOptions } from '../device';
import {
  GeneralErrors,
  NotSupportedError,
  SignalingErrors,
  TwilioError,
} from '../errors';
import Log from '../log';
import { RTCSampleTotals } from '../rtc/sample';
import RTCSample from '../rtc/sample';
import { getRTCIceCandidateStatsReport } from '../rtc/stats';
import RTCWarning from '../rtc/warning';
import StatsMonitor from '../statsMonitor';
import { NetworkTiming, TimeMeasurement } from './timing';

import { COWBELL_AUDIO_URL, ECHO_TEST_DURATION } from '../constants';

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
export class PreflightTest extends EventEmitter {
  /**
   * The {@link Call} for this test call
   */
  private _call: Call;

  /**
   * Callsid generated for this test call
   */
  private _callSid: string | undefined;

  /**
   * The {@link Device} for this test call
   */
  private _device: Device;

  /**
   * The timer when doing an echo test
   * The echo test is used when fakeMicInput is set to true
   */
  private _echoTimer: NodeJS.Timeout;

  /**
   * The edge that the `Twilio.Device` connected to.
   */
  private _edge: string | undefined;

  /**
   * End of test timestamp
   */
  private _endTime: number | undefined;

  /**
   * Whether this test has already logged an insights-connection-warning.
   */
  private _hasInsightsErrored: boolean = false;

  /**
   * Latest WebRTC sample collected for this test
   */
  private _latestSample: RTCSample | undefined;

  /**
   * An instance of Logger to use.
   */
  private _log: Log = new Log('PreflightTest');

  /**
   * Network related timing measurements for this test
   */
  private _networkTiming: NetworkTiming = {};

  /**
   * The options passed to {@link PreflightTest} constructor
   */
  private _options: PreflightTest.ExtendedOptions = {
    codecPreferences: [Call.Codec.PCMU, Call.Codec.Opus],
    edge: 'roaming',
    fakeMicInput: false,
    logLevel: 'error',
    signalingTimeoutMs: 10000,
  };

  /**
   * The report for this test.
   */
  private _report: PreflightTest.Report | undefined;

  /**
   * The WebRTC ICE candidates stats information collected during the test
   */
  private _rtcIceCandidateStatsReport: PreflightTest.RTCIceCandidateStatsReport;

  /**
   * WebRTC samples collected during this test
   */
  private _samples: RTCSample[];

  /**
   * Timer for setting up signaling connection
   */
  private _signalingTimeoutTimer: NodeJS.Timeout;

  /**
   * Start of test timestamp
   */
  private _startTime: number;

  /**
   * Current status of this test
   */
  private _status: PreflightTest.Status = PreflightTest.Status.Connecting;

  /**
   * List of warning names and warning data detected during this test
   */
  private _warnings: PreflightTest.Warning[];

  /**
   * Construct a {@link PreflightTest} instance.
   * @param token - A Twilio JWT token string.
   * @param options
   */
  constructor(token: string, options: PreflightTest.ExtendedOptions) {
    super();

    Object.assign(this._options, options);

    this._samples = [];
    this._warnings = [];
    this._startTime = Date.now();

    this._initDevice(token, {
      ...this._options,
      fileInputStream: this._options.fakeMicInput ?
        this._getStreamFromFile() : undefined,
    });

    // Device sets the loglevel so start logging after initializing the device.
    // Then selectively log options that users can modify.
    const userOptions = [
      'codecPreferences',
      'edge',
      'fakeMicInput',
      'logLevel',
      'signalingTimeoutMs',
    ];
    const userOptionOverrides = [
      'audioContext',
      'deviceFactory',
      'fileInputStream',
      'getRTCIceCandidateStatsReport',
      'iceServers',
      'rtcConfiguration',
    ];
    if (typeof options === 'object') {
      const toLog: any = { ...options };
      Object.keys(toLog).forEach((key: string) => {
        if (!userOptions.includes(key) && !userOptionOverrides.includes(key)) {
          delete toLog[key];
        }
        if (userOptionOverrides.includes(key)) {
          toLog[key] = true;
        }
      });
      this._log.debug('.constructor', JSON.stringify(toLog));
    }
  }

  /**
   * Stops the current test and raises a failed event.
   */
  stop(): void {
    this._log.debug('.stop');
    const error = new GeneralErrors.CallCancelledError();
    if (this._device) {
      this._device.once(Device.EventName.Unregistered, () => this._onFailed(error));
      this._device.destroy();
    } else {
      this._onFailed(error);
    }
  }

  /**
   * Emit a {PreflightTest.Warning}
   */
  private _emitWarning(name: string, description: string, rtcWarning?: RTCWarning): void {
    const warning: PreflightTest.Warning = { name, description };
    if (rtcWarning) {
      warning.rtcWarning = rtcWarning;
    }
    this._warnings.push(warning);
    this._log.debug(`#${PreflightTest.Events.Warning}`, JSON.stringify(warning));
    this.emit(PreflightTest.Events.Warning, warning);
  }

  /**
   * Returns call quality base on the RTC Stats
   */
  private _getCallQuality(mos: number): PreflightTest.CallQuality {
    if (mos > 4.2) {
      return PreflightTest.CallQuality.Excellent;
    } else if (mos >= 4.1 && mos <= 4.2) {
      return PreflightTest.CallQuality.Great;
    } else if (mos >= 3.7 && mos <= 4) {
      return PreflightTest.CallQuality.Good;
    } else if (mos >= 3.1 && mos <= 3.6) {
      return PreflightTest.CallQuality.Fair;
    } else {
      return PreflightTest.CallQuality.Degraded;
    }
  }

  /**
   * Returns the report for this test.
   */
  private _getReport(): PreflightTest.Report {
    const stats = this._getRTCStats();
    const testTiming: TimeMeasurement = { start: this._startTime };
    if (this._endTime) {
      testTiming.end = this._endTime;
      testTiming.duration  = this._endTime - this._startTime;
    }

    const report: PreflightTest.Report = {
      callSid: this._callSid,
      edge: this._edge,
      iceCandidateStats: this._rtcIceCandidateStatsReport?.iceCandidateStats ?? [],
      networkTiming: this._networkTiming,
      samples: this._samples,
      selectedEdge: this._options.edge,
      stats,
      testTiming,
      totals: this._getRTCSampleTotals(),
      warnings: this._warnings,
    };

    const selectedIceCandidatePairStats = this._rtcIceCandidateStatsReport?.selectedIceCandidatePairStats;

    if (selectedIceCandidatePairStats) {
      report.selectedIceCandidatePairStats = selectedIceCandidatePairStats;
      report.isTurnRequired = selectedIceCandidatePairStats.localCandidate.candidateType === 'relay'
      || selectedIceCandidatePairStats.remoteCandidate.candidateType === 'relay';
    }

    if (stats) {
      report.callQuality = this._getCallQuality(stats.mos.average);
    }

    return report;
  }

  /**
   * Returns RTC stats totals for this test
   */
  private _getRTCSampleTotals(): RTCSampleTotals | undefined {
    if (!this._latestSample) {
      return;
    }

    return { ...this._latestSample.totals };
  }

  /**
   * Returns RTC related stats captured during the test call
   */
  private _getRTCStats(): PreflightTest.RTCStats | undefined {
    const firstMosSampleIdx = this._samples.findIndex(
      sample => typeof sample.mos === 'number' && sample.mos > 0,
    );

    const samples = firstMosSampleIdx >= 0
      ? this._samples.slice(firstMosSampleIdx)
      : [];

    if (!samples || !samples.length) {
      return;
    }

    return ['jitter', 'mos', 'rtt'].reduce((statObj, stat) => {
      const values = samples.map(s => s[stat]);
      return {
        ...statObj,
        [stat]: {
          average: Number((values.reduce((total, value) => total + value) / values.length).toPrecision(5)),
          max: Math.max(...values),
          min: Math.min(...values),
        },
      };
    }, {} as any);
  }

  /**
   * Returns a MediaStream from a media file
   */
  private _getStreamFromFile(): MediaStream {
    const audioContext = this._options.audioContext;
    if (!audioContext) {
      throw new NotSupportedError('Cannot fake input audio stream: AudioContext is not supported by this browser.');
    }

    const audioEl: any = new Audio(COWBELL_AUDIO_URL);

    audioEl.addEventListener('canplaythrough', () => audioEl.play());
    if (typeof audioEl.setAttribute === 'function') {
      audioEl.setAttribute('crossorigin', 'anonymous');
    }

    const src = audioContext.createMediaElementSource(audioEl);
    const dest = audioContext.createMediaStreamDestination();
    src.connect(dest);

    return dest.stream;
  }

  /**
   * Initialize the device
   */
  private _initDevice(token: string, options: PreflightTest.ExtendedOptions): void {
    try {
      this._device = new (options.deviceFactory || Device)(token, {
        chunderw: options.chunderw,
        codecPreferences: options.codecPreferences,
        edge: options.edge,
        eventgw: options.eventgw,
        fileInputStream: options.fileInputStream,
        logLevel: options.logLevel,
        preflight: true,
      } as IExtendedDeviceOptions);

      this._device.once(Device.EventName.Registered, () => {
        this._onDeviceRegistered();
      });

      this._device.once(Device.EventName.Error, (error: TwilioError) => {
        this._onDeviceError(error);
      });

      this._device.register();
    } catch (error) {
      // We want to return before failing so the consumer can capture the event
      setTimeout(() => {
        this._onFailed(error);
      });
      return;
    }

    this._signalingTimeoutTimer = setTimeout(() => {
      this._onDeviceError(new SignalingErrors.ConnectionError('WebSocket Connection Timeout'));
    }, options.signalingTimeoutMs);
  }

  /**
   * Called on {@link Device} error event
   * @param error
   */
  private _onDeviceError(error: TwilioError): void {
    this._device.destroy();
    this._onFailed(error);
  }

  /**
   * Called on {@link Device} ready event
   */
  private async _onDeviceRegistered(): Promise<void> {
    clearTimeout(this._echoTimer);
    clearTimeout(this._signalingTimeoutTimer);

    this._call = await this._device.connect({
      rtcConfiguration: this._options.rtcConfiguration,
    });
    this._networkTiming.signaling = { start: Date.now() };
    this._setupCallHandlers(this._call);

    this._edge = this._device.edge || undefined;
    if (this._options.fakeMicInput) {
      this._echoTimer = setTimeout(() => this._device.disconnectAll(), ECHO_TEST_DURATION);

      const audio = this._device.audio as any;
      if (audio) {
        audio.disconnect(false);
        audio.outgoing(false);
      }
    }

    this._call.once('disconnect', () => {
      this._device.once(Device.EventName.Unregistered, () => this._onUnregistered());
      this._device.destroy();
    });

    const publisher = this._call['_publisher'] as any;
    publisher.on('error', () => {
      if (!this._hasInsightsErrored) {
        this._emitWarning('insights-connection-error',
          'Received an error when attempting to connect to Insights gateway');
      }
      this._hasInsightsErrored = true;
    });
  }

  /**
   * Called when there is a fatal error
   * @param error
   */
  private _onFailed(error: TwilioError | DOMException): void {
    clearTimeout(this._echoTimer);
    clearTimeout(this._signalingTimeoutTimer);
    this._releaseHandlers();
    this._endTime = Date.now();
    this._status = PreflightTest.Status.Failed;
    this._log.debug(`#${PreflightTest.Events.Failed}`, error);
    this.emit(PreflightTest.Events.Failed, error);
  }

  /**
   * Called when the device goes offline.
   * This indicates that the test has been completed, but we won't know if it failed or not.
   * The onError event will be the indicator whether the test failed.
   */
  private _onUnregistered(): void {
    // We need to make sure we always execute preflight.on('completed') last
    // as client SDK sometimes emits 'offline' event before emitting fatal errors.
    setTimeout(() => {
      if (this._status === PreflightTest.Status.Failed) {
        return;
      }

      clearTimeout(this._echoTimer);
      clearTimeout(this._signalingTimeoutTimer);

      this._releaseHandlers();
      this._endTime = Date.now();
      this._status = PreflightTest.Status.Completed;
      this._report = this._getReport();
      this._log.debug(`#${PreflightTest.Events.Completed}`, JSON.stringify(this._report));
      this.emit(PreflightTest.Events.Completed, this._report);
    }, 10);
  }

  /**
   * Clean up all handlers for device and call
   */
  private _releaseHandlers(): void {
    [this._device, this._call].forEach((emitter: EventEmitter) => {
      if (emitter) {
        emitter.eventNames().forEach((name: string) => emitter.removeAllListeners(name));
      }
    });
  }

  /**
   * Setup the event handlers for the {@link Call} of the test call
   * @param call
   */
  private _setupCallHandlers(call: Call): void {
    if (this._options.fakeMicInput) {
      // When volume events start emitting, it means all audio outputs have been created.
      // Let's mute them if we're using fake mic input.
      call.once('volume', () => {
        call['_mediaHandler'].outputs
          .forEach((output: AudioOutput) => output.audio.muted = true);
      });
    }

    call.on('warning', (name: string, data: RTCWarning) => {
      this._emitWarning(name, 'Received an RTCWarning. See .rtcWarning for the RTCWarning', data);
    });

    call.once('accept', () => {
      this._callSid = call['_mediaHandler'].callSid;
      this._status = PreflightTest.Status.Connected;
      this._log.debug(`#${PreflightTest.Events.Connected}`);
      this.emit(PreflightTest.Events.Connected);
    });

    call.on('sample', async (sample) => {
      // RTC Stats are ready. We only need to get ICE candidate stats report once.
      if (!this._latestSample) {
        this._rtcIceCandidateStatsReport = await (
          this._options.getRTCIceCandidateStatsReport || getRTCIceCandidateStatsReport
        )(call['_mediaHandler'].version.pc);
      }

      this._latestSample = sample;
      this._samples.push(sample);
      this._log.debug(`#${PreflightTest.Events.Sample}`, JSON.stringify(sample));
      this.emit(PreflightTest.Events.Sample, sample);
    });

    // TODO: Update the following once the SDK supports emitting these events
    // Let's shim for now
    [{
      reportLabel: 'peerConnection',
      type: 'pcconnection',
     }, {
      reportLabel: 'ice',
      type: 'iceconnection',
     }, {
      reportLabel: 'dtls',
      type: 'dtlstransport',
     }, {
      reportLabel: 'signaling',
      type: 'signaling',
     }].forEach(({type, reportLabel}) => {

      const handlerName = `on${type}statechange`;
      const originalHandler = call['_mediaHandler'][handlerName];

      call['_mediaHandler'][handlerName] = (state: string) => {
        const timing = (this._networkTiming as any)[reportLabel]
          = (this._networkTiming as any)[reportLabel] || { start: 0 };

        if (state === 'connecting' || state === 'checking') {
          timing.start = Date.now();
        } else if ((state === 'connected' || state === 'stable') && !timing.duration) {
          timing.end = Date.now();
          timing.duration = timing.end - timing.start;
        }

        originalHandler(state);
      };
    });
  }

  /**
   * The callsid generated for the test call.
   */
  get callSid(): string | undefined {
    return this._callSid;
  }

  /**
   * A timestamp in milliseconds of when the test ended.
   */
  get endTime(): number | undefined {
    return this._endTime;
  }

  /**
   * The latest WebRTC sample collected.
   */
  get latestSample(): RTCSample | undefined {
    return this._latestSample;
  }

  /**
   * The report for this test.
   */
  get report(): PreflightTest.Report | undefined {
    return this._report;
  }

  /**
   * A timestamp in milliseconds of when the test started.
   */
  get startTime(): number {
    return this._startTime;
  }

  /**
   * The status of the test.
   */
  get status(): PreflightTest.Status {
    return this._status;
  }
}

/**
 * @mergeModuleWith PreflightTest
 */
export namespace PreflightTest {
  /**
   * The quality of the call determined by different mos ranges.
   * Mos is calculated base on the WebRTC stats - rtt, jitter, and packet lost.
   */
  export enum CallQuality {
    /**
     * If the average mos is over 4.2.
     */
    Excellent = 'excellent',

    /**
     * If the average mos is between 4.1 and 4.2 both inclusive.
     */
    Great = 'great',

    /**
     * If the average mos is between 3.7 and 4.0 both inclusive.
     */
    Good = 'good',

    /**
     * If the average mos is between 3.1 and 3.6 both inclusive.
     */
    Fair = 'fair',

    /**
     * If the average mos is 3.0 or below.
     */
    Degraded = 'degraded',
  }

  /**
   * Possible events that a [[PreflightTest]] might emit.
   */
  export enum Events {
    /**
     * See [[PreflightTest.completedEvent]]
     */
    Completed = 'completed',

    /**
     * See [[PreflightTest.connectedEvent]]
     */
    Connected = 'connected',

    /**
     * See [[PreflightTest.failedEvent]]
     */
    Failed = 'failed',

    /**
     * See [[PreflightTest.sampleEvent]]
     */
    Sample = 'sample',

    /**
     * See [[PreflightTest.warningEvent]]
     */
    Warning = 'warning',
  }

  /**
   * Possible status of the test.
   */
  export enum Status {
    /**
     * Call to Twilio has initiated.
     */
    Connecting = 'connecting',

    /**
     * Call to Twilio has been established.
     */
    Connected = 'connected',

    /**
     * The connection to Twilio has been disconnected and the test call has completed.
     */
    Completed = 'completed',

    /**
     * The test has stopped and failed.
     */
    Failed = 'failed',
  }

  /**
   * The WebRTC API's [RTCIceCandidateStats](https://developer.mozilla.org/en-US/docs/Web/API/RTCIceCandidateStats)
   * dictionary which provides information related to an ICE candidate.
   */
  export type RTCIceCandidateStats = any;

  /**
   * Options that may be passed to {@link PreflightTest} constructor for internal testing.
   * @internal
   */
  export interface ExtendedOptions extends Options {
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
  export interface RTCIceCandidateStatsReport {
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
  export interface Options {
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
  export interface RTCSelectedIceCandidatePairStats {
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
  export interface RTCStats {
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
  export interface Stats {
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
  export interface Report {
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
  export interface Warning {
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
