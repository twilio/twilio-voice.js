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
import Log from '../log';
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
         * An instance of Logger to use.
         */
        this._log = new Log('PreflightTest');
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
            const toLog = Object.assign({}, options);
            Object.keys(toLog).forEach((key) => {
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
    stop() {
        this._log.debug('.stop');
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
        this._log.debug(`#${PreflightTest.Events.Warning}`, JSON.stringify(warning));
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
        var _a, _b, _c;
        const stats = this._getRTCStats();
        const testTiming = { start: this._startTime };
        if (this._endTime) {
            testTiming.end = this._endTime;
            testTiming.duration = this._endTime - this._startTime;
        }
        const report = {
            callSid: this._callSid,
            edge: this._edge,
            iceCandidateStats: (_b = (_a = this._rtcIceCandidateStatsReport) === null || _a === void 0 ? void 0 : _a.iceCandidateStats) !== null && _b !== void 0 ? _b : [],
            networkTiming: this._networkTiming,
            samples: this._samples,
            selectedEdge: this._options.edge,
            stats,
            testTiming,
            totals: this._getRTCSampleTotals(),
            warnings: this._warnings,
        };
        const selectedIceCandidatePairStats = (_c = this._rtcIceCandidateStatsReport) === null || _c === void 0 ? void 0 : _c.selectedIceCandidatePairStats;
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
        this._log.debug(`#${PreflightTest.Events.Failed}`, error);
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
            this._log.debug(`#${PreflightTest.Events.Completed}`, JSON.stringify(this._report));
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
            this._log.debug(`#${PreflightTest.Events.Connected}`);
            this.emit(PreflightTest.Events.Connected);
        });
        call.on('sample', (sample) => __awaiter(this, void 0, void 0, function* () {
            // RTC Stats are ready. We only need to get ICE candidate stats report once.
            if (!this._latestSample) {
                this._rtcIceCandidateStatsReport = yield (this._options.getRTCIceCandidateStatsReport || getRTCIceCandidateStatsReport)(call['_mediaHandler'].version.pc);
            }
            this._latestSample = sample;
            this._samples.push(sample);
            this._log.debug(`#${PreflightTest.Events.Sample}`, JSON.stringify(sample));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmxpZ2h0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9wcmVmbGlnaHQvcHJlZmxpZ2h0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBOzs7OztHQUtHO0FBQ0gsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUN0QyxPQUFPLElBQUksTUFBTSxTQUFTLENBQUM7QUFDM0IsT0FBTyxNQUFrQyxNQUFNLFdBQVcsQ0FBQztBQUMzRCxPQUFPLEVBQ0wsYUFBYSxFQUNiLGlCQUFpQixFQUNqQixlQUFlLEdBRWhCLE1BQU0sV0FBVyxDQUFDO0FBQ25CLE9BQU8sR0FBRyxNQUFNLFFBQVEsQ0FBQztBQUd6QixPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFLN0QsT0FBTyxFQUFFLGlCQUFpQixFQUFFLGtCQUFrQixFQUFFLE1BQU0sY0FBYyxDQUFDO0FBNERyRTs7R0FFRztBQUNILE1BQU0sT0FBTyxhQUFjLFNBQVEsWUFBWTtJQWtHN0M7Ozs7O09BS0c7SUFDSCxZQUFZLEtBQWEsRUFBRSxPQUFzQztRQUMvRCxLQUFLLEVBQUUsQ0FBQztRQXpFVjs7V0FFRztRQUNLLHdCQUFtQixHQUFZLEtBQUssQ0FBQztRQU83Qzs7V0FFRztRQUNLLFNBQUksR0FBUSxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUU3Qzs7V0FFRztRQUNLLG1CQUFjLEdBQWtCLEVBQUUsQ0FBQztRQUUzQzs7V0FFRztRQUNLLGFBQVEsR0FBa0M7WUFDaEQsZ0JBQWdCLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztZQUNwRCxJQUFJLEVBQUUsU0FBUztZQUNmLFlBQVksRUFBRSxLQUFLO1lBQ25CLFFBQVEsRUFBRSxPQUFPO1lBQ2pCLGtCQUFrQixFQUFFLEtBQUs7U0FDMUIsQ0FBQztR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