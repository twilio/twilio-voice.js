var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
                chunderw: options.chunderw,
                codecPreferences: options.codecPreferences,
                edge: options.edge,
                eventgw: options.eventgw,
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
/**
 * @mergeModuleWith PreflightTest
 */
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmxpZ2h0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9wcmVmbGlnaHQvcHJlZmxpZ2h0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDdEMsT0FBTyxJQUFJLE1BQU0sU0FBUyxDQUFDO0FBQzNCLE9BQU8sTUFBa0MsTUFBTSxXQUFXLENBQUM7QUFDM0QsT0FBTyxFQUNMLGFBQWEsRUFDYixpQkFBaUIsRUFDakIsZUFBZSxHQUVoQixNQUFNLFdBQVcsQ0FBQztBQUNuQixPQUFPLEdBQUcsTUFBTSxRQUFRLENBQUM7QUFHekIsT0FBTyxFQUFFLDZCQUE2QixFQUFFLE1BQU0sY0FBYyxDQUFDO0FBSzdELE9BQU8sRUFBRSxpQkFBaUIsRUFBRSxrQkFBa0IsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQThEckU7O0dBRUc7QUFDSCxNQUFNLE9BQU8sYUFBYyxTQUFRLFlBQVk7SUFrRzdDOzs7O09BSUc7SUFDSCxZQUFZLEtBQWEsRUFBRSxPQUFzQztRQUMvRCxLQUFLLEVBQUUsQ0FBQztRQXhFVjs7V0FFRztRQUNLLHdCQUFtQixHQUFZLEtBQUssQ0FBQztRQU83Qzs7V0FFRztRQUNLLFNBQUksR0FBUSxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUU3Qzs7V0FFRztRQUNLLG1CQUFjLEdBQWtCLEVBQUUsQ0FBQztRQUUzQzs7V0FFRztRQUNLLGFBQVEsR0FBa0M7WUFDaEQsZ0JBQWdCLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztZQUNwRCxJQUFJLEVBQUUsU0FBUztZQUNmLFlBQVksRUFBRSxLQUFLO1lBQ25CLFFBQVEsRUFBRSxPQUFPO1lBQ2pCLGtCQUFrQixFQUFFLEtBQUs7U0FDMUIsQ0FBQztRQTJCRjs7V0FFRztRQUNL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