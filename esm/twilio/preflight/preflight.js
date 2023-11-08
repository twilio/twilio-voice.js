var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/**
 * @packageDocumentation
 * @module Voice
 * @preferred
 * @publicapi
 */
import { EventEmitter } from 'events';
import Call from '../call';
import Device from '../device';
import { GeneralErrors, NotSupportedError, SignalingErrors, } from '../errors';
import { getRTCIceCandidateStatsReport } from '../rtc/stats';
import { COWBELL_AUDIO_URL, ECHO_TEST_DURATION } from '../constants';
/**
 * Runs some tests to identify issues, if any, prohibiting successful calling.
 */
export class PreflightTest extends EventEmitter {
    /**
     * Construct a {@link PreflightTest} instance.
     * @constructor
     * @param token - A Twilio JWT token string.
     * @param options
     */
    constructor(token, options) {
        super();
        /**
         * Whether this test has already logged an insights-connection-warning.
         */
        this._hasInsightsErrored = false;
        /**
         * Network related timing measurements for this test
         */
        this._networkTiming = {};
        /**
         * The options passed to {@link PreflightTest} constructor
         */
        this._options = {
            codecPreferences: [Call.Codec.PCMU, Call.Codec.Opus],
            edge: 'roaming',
            fakeMicInput: false,
            logLevel: 'error',
            signalingTimeoutMs: 10000,
        };
        /**
         * Current status of this test
         */
        this._status = PreflightTest.Status.Connecting;
        Object.assign(this._options, options);
        this._samples = [];
        this._warnings = [];
        this._startTime = Date.now();
        this._initDevice(token, Object.assign(Object.assign({}, this._options), { fileInputStream: this._options.fakeMicInput ?
                this._getStreamFromFile() : undefined }));
    }
    /**
     * Stops the current test and raises a failed event.
     */
    stop() {
        const error = new GeneralErrors.CallCancelledError();
        if (this._device) {
            this._device.once(Device.EventName.Unregistered, () => this._onFailed(error));
            this._device.destroy();
        }
        else {
            this._onFailed(error);
        }
    }
    /**
     * Emit a {PreflightTest.Warning}
     */
    _emitWarning(name, description, rtcWarning) {
        const warning = { name, description };
        if (rtcWarning) {
            warning.rtcWarning = rtcWarning;
        }
        this._warnings.push(warning);
        this.emit(PreflightTest.Events.Warning, warning);
    }
    /**
     * Returns call quality base on the RTC Stats
     */
    _getCallQuality(mos) {
        if (mos > 4.2) {
            return PreflightTest.CallQuality.Excellent;
        }
        else if (mos >= 4.1 && mos <= 4.2) {
            return PreflightTest.CallQuality.Great;
        }
        else if (mos >= 3.7 && mos <= 4) {
            return PreflightTest.CallQuality.Good;
        }
        else if (mos >= 3.1 && mos <= 3.6) {
            return PreflightTest.CallQuality.Fair;
        }
        else {
            return PreflightTest.CallQuality.Degraded;
        }
    }
    /**
     * Returns the report for this test.
     */
    _getReport() {
        const stats = this._getRTCStats();
        const testTiming = { start: this._startTime };
        if (this._endTime) {
            testTiming.end = this._endTime;
            testTiming.duration = this._endTime - this._startTime;
        }
        const report = {
            callSid: this._callSid,
            edge: this._edge,
            iceCandidateStats: this._rtcIceCandidateStatsReport.iceCandidateStats,
            networkTiming: this._networkTiming,
            samples: this._samples,
            selectedEdge: this._options.edge,
            stats,
            testTiming,
            totals: this._getRTCSampleTotals(),
            warnings: this._warnings,
        };
        const selectedIceCandidatePairStats = this._rtcIceCandidateStatsReport.selectedIceCandidatePairStats;
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
    _getRTCSampleTotals() {
        if (!this._latestSample) {
            return;
        }
        return Object.assign({}, this._latestSample.totals);
    }
    /**
     * Returns RTC related stats captured during the test call
     */
    _getRTCStats() {
        const firstMosSampleIdx = this._samples.findIndex(sample => typeof sample.mos === 'number' && sample.mos > 0);
        const samples = firstMosSampleIdx >= 0
            ? this._samples.slice(firstMosSampleIdx)
            : [];
        if (!samples || !samples.length) {
            return;
        }
        return ['jitter', 'mos', 'rtt'].reduce((statObj, stat) => {
            const values = samples.map(s => s[stat]);
            return Object.assign(Object.assign({}, statObj), { [stat]: {
                    average: Number((values.reduce((total, value) => total + value) / values.length).toPrecision(5)),
                    max: Math.max(...values),
                    min: Math.min(...values),
                } });
        }, {});
    }
    /**
     * Returns a MediaStream from a media file
     */
    _getStreamFromFile() {
        const audioContext = this._options.audioContext;
        if (!audioContext) {
            throw new NotSupportedError('Cannot fake input audio stream: AudioContext is not supported by this browser.');
        }
        const audioEl = new Audio(COWBELL_AUDIO_URL);
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
    _initDevice(token, options) {
        try {
            this._device = new (options.deviceFactory || Device)(token, {
                codecPreferences: options.codecPreferences,
                edge: options.edge,
                fileInputStream: options.fileInputStream,
                logLevel: options.logLevel,
                preflight: true,
            });
            this._device.once(Device.EventName.Registered, () => {
                this._onDeviceRegistered();
            });
            this._device.once(Device.EventName.Error, (error) => {
                this._onDeviceError(error);
            });
            this._device.register();
        }
        catch (error) {
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
    _onDeviceError(error) {
        this._device.destroy();
        this._onFailed(error);
    }
    /**
     * Called on {@link Device} ready event
     */
    _onDeviceRegistered() {
        return __awaiter(this, void 0, void 0, function* () {
            clearTimeout(this._echoTimer);
            clearTimeout(this._signalingTimeoutTimer);
            this._call = yield this._device.connect({
                rtcConfiguration: this._options.rtcConfiguration,
            });
            this._networkTiming.signaling = { start: Date.now() };
            this._setupCallHandlers(this._call);
            this._edge = this._device.edge || undefined;
            if (this._options.fakeMicInput) {
                this._echoTimer = setTimeout(() => this._device.disconnectAll(), ECHO_TEST_DURATION);
                const audio = this._device.audio;
                if (audio) {
                    audio.disconnect(false);
                    audio.outgoing(false);
                }
            }
            this._call.once('disconnect', () => {
                this._device.once(Device.EventName.Unregistered, () => this._onUnregistered());
                this._device.destroy();
            });
            const publisher = this._call['_publisher'];
            publisher.on('error', () => {
                if (!this._hasInsightsErrored) {
                    this._emitWarning('insights-connection-error', 'Received an error when attempting to connect to Insights gateway');
                }
                this._hasInsightsErrored = true;
            });
        });
    }
    /**
     * Called when there is a fatal error
     * @param error
     */
    _onFailed(error) {
        clearTimeout(this._echoTimer);
        clearTimeout(this._signalingTimeoutTimer);
        this._releaseHandlers();
        this._endTime = Date.now();
        this._status = PreflightTest.Status.Failed;
        this.emit(PreflightTest.Events.Failed, error);
    }
    /**
     * Called when the device goes offline.
     * This indicates that the test has been completed, but we won't know if it failed or not.
     * The onError event will be the indicator whether the test failed.
     */
    _onUnregistered() {
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
            this.emit(PreflightTest.Events.Completed, this._report);
        }, 10);
    }
    /**
     * Clean up all handlers for device and call
     */
    _releaseHandlers() {
        [this._device, this._call].forEach((emitter) => {
            if (emitter) {
                emitter.eventNames().forEach((name) => emitter.removeAllListeners(name));
            }
        });
    }
    /**
     * Setup the event handlers for the {@link Call} of the test call
     * @param call
     */
    _setupCallHandlers(call) {
        if (this._options.fakeMicInput) {
            // When volume events start emitting, it means all audio outputs have been created.
            // Let's mute them if we're using fake mic input.
            call.once('volume', () => {
                call['_mediaHandler'].outputs
                    .forEach((output) => output.audio.muted = true);
            });
        }
        call.on('warning', (name, data) => {
            this._emitWarning(name, 'Received an RTCWarning. See .rtcWarning for the RTCWarning', data);
        });
        call.once('accept', () => {
            this._callSid = call['_mediaHandler'].callSid;
            this._status = PreflightTest.Status.Connected;
            this.emit(PreflightTest.Events.Connected);
        });
        call.on('sample', (sample) => __awaiter(this, void 0, void 0, function* () {
            // RTC Stats are ready. We only need to get ICE candidate stats report once.
            if (!this._latestSample) {
                this._rtcIceCandidateStatsReport = yield (this._options.getRTCIceCandidateStatsReport || getRTCIceCandidateStatsReport)(call['_mediaHandler'].version.pc);
            }
            this._latestSample = sample;
            this._samples.push(sample);
            this.emit(PreflightTest.Events.Sample, sample);
        }));
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
            }].forEach(({ type, reportLabel }) => {
            const handlerName = `on${type}statechange`;
            const originalHandler = call['_mediaHandler'][handlerName];
            call['_mediaHandler'][handlerName] = (state) => {
                const timing = this._networkTiming[reportLabel]
                    = this._networkTiming[reportLabel] || { start: 0 };
                if (state === 'connecting' || state === 'checking') {
                    timing.start = Date.now();
                }
                else if ((state === 'connected' || state === 'stable') && !timing.duration) {
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
    get callSid() {
        return this._callSid;
    }
    /**
     * A timestamp in milliseconds of when the test ended.
     */
    get endTime() {
        return this._endTime;
    }
    /**
     * The latest WebRTC sample collected.
     */
    get latestSample() {
        return this._latestSample;
    }
    /**
     * The report for this test.
     */
    get report() {
        return this._report;
    }
    /**
     * A timestamp in milliseconds of when the test started.
     */
    get startTime() {
        return this._startTime;
    }
    /**
     * The status of the test.
     */
    get status() {
        return this._status;
    }
}
(function (PreflightTest) {
    /**
     * The quality of the call determined by different mos ranges.
     * Mos is calculated base on the WebRTC stats - rtt, jitter, and packet lost.
     */
    let CallQuality;
    (function (CallQuality) {
        /**
         * If the average mos is over 4.2.
         */
        CallQuality["Excellent"] = "excellent";
        /**
         * If the average mos is between 4.1 and 4.2 both inclusive.
         */
        CallQuality["Great"] = "great";
        /**
         * If the average mos is between 3.7 and 4.0 both inclusive.
         */
        CallQuality["Good"] = "good";
        /**
         * If the average mos is between 3.1 and 3.6 both inclusive.
         */
        CallQuality["Fair"] = "fair";
        /**
         * If the average mos is 3.0 or below.
         */
        CallQuality["Degraded"] = "degraded";
    })(CallQuality = PreflightTest.CallQuality || (PreflightTest.CallQuality = {}));
    /**
     * Possible events that a [[PreflightTest]] might emit.
     */
    let Events;
    (function (Events) {
        /**
         * See [[PreflightTest.completedEvent]]
         */
        Events["Completed"] = "completed";
        /**
         * See [[PreflightTest.connectedEvent]]
         */
        Events["Connected"] = "connected";
        /**
         * See [[PreflightTest.failedEvent]]
         */
        Events["Failed"] = "failed";
        /**
         * See [[PreflightTest.sampleEvent]]
         */
        Events["Sample"] = "sample";
        /**
         * See [[PreflightTest.warningEvent]]
         */
        Events["Warning"] = "warning";
    })(Events = PreflightTest.Events || (PreflightTest.Events = {}));
    /**
     * Possible status of the test.
     */
    let Status;
    (function (Status) {
        /**
         * Call to Twilio has initiated.
         */
        Status["Connecting"] = "connecting";
        /**
         * Call to Twilio has been established.
         */
        Status["Connected"] = "connected";
        /**
         * The connection to Twilio has been disconnected and the test call has completed.
         */
        Status["Completed"] = "completed";
        /**
         * The test has stopped and failed.
         */
        Status["Failed"] = "failed";
    })(Status = PreflightTest.Status || (PreflightTest.Status = {}));
})(PreflightTest || (PreflightTest = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmxpZ2h0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9wcmVmbGlnaHQvcHJlZmxpZ2h0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBOzs7OztHQUtHO0FBQ0gsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUN0QyxPQUFPLElBQUksTUFBTSxTQUFTLENBQUM7QUFDM0IsT0FBTyxNQUFrQyxNQUFNLFdBQVcsQ0FBQztBQUMzRCxPQUFPLEVBQ0wsYUFBYSxFQUNiLGlCQUFpQixFQUNqQixlQUFlLEdBRWhCLE1BQU0sV0FBVyxDQUFDO0FBR25CLE9BQU8sRUFBRSw2QkFBNkIsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUs3RCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsa0JBQWtCLEVBQUUsTUFBTSxjQUFjLENBQUM7QUE0RHJFOztHQUVHO0FBQ0gsTUFBTSxPQUFPLGFBQWMsU0FBUSxZQUFZO0lBNkY3Qzs7Ozs7T0FLRztJQUNILFlBQVksS0FBYSxFQUFFLE9BQXNDO1FBQy9ELEtBQUssRUFBRSxDQUFDO1FBcEVWOztXQUVHO1FBQ0ssd0JBQW1CLEdBQVksS0FBSyxDQUFDO1FBTzdDOztXQUVHO1FBQ0ssbUJBQWMsR0FBa0IsRUFBRSxDQUFDO1FBRTNDOztXQUVHO1FBQ0ssYUFBUSxHQUFrQztZQUNoRCxnQkFBZ0IsRUFBRSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBQ3BELElBQUksRUFBRSxTQUFTO1lBQ2YsWUFBWSxFQUFFLEtBQUs7WUFDbkIsUUFBUSxFQUFFLE9BQU87WUFDakIsa0JBQWtCLEVBQUUsS0FBSztTQUMxQixDQUFDO1FBMkJGOztXQUVHO1FBQ0ssWUFBTyxHQUF5QixhQUFhLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQztRQWdCdEUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxJQUFJ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