import { __awaiter } from 'tslib';
import { EventEmitter } from 'events';
import Call from '../call.js';
import Device from '../device.js';
import { NotSupportedError } from '../errors/index.js';
import Log from '../log.js';
import { getRTCIceCandidateStatsReport } from '../rtc/stats.js';
import { COWBELL_AUDIO_URL, ECHO_TEST_DURATION } from '../constants.js';
import { GeneralErrors, SignalingErrors } from '../errors/generated.js';

/**
 * Runs some tests to identify issues, if any, prohibiting successful calling.
 */
class PreflightTest extends EventEmitter {
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
    })(PreflightTest.CallQuality || (PreflightTest.CallQuality = {}));
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
    })(PreflightTest.Events || (PreflightTest.Events = {}));
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
    })(PreflightTest.Status || (PreflightTest.Status = {}));
})(PreflightTest || (PreflightTest = {}));

export { PreflightTest };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmxpZ2h0LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3ByZWZsaWdodC9wcmVmbGlnaHQudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7OztBQStFQTs7QUFFRztBQUNHLE1BQU8sYUFBYyxTQUFRLFlBQVksQ0FBQTtBQWtHN0M7Ozs7QUFJRztJQUNILFdBQUEsQ0FBWSxLQUFhLEVBQUUsT0FBc0MsRUFBQTtBQUMvRCxRQUFBLEtBQUssRUFBRTtBQXhFVDs7QUFFRztRQUNLLElBQUEsQ0FBQSxtQkFBbUIsR0FBWSxLQUFLO0FBTzVDOztBQUVHO0FBQ0ssUUFBQSxJQUFBLENBQUEsSUFBSSxHQUFRLElBQUksR0FBRyxDQUFDLGVBQWUsQ0FBQztBQUU1Qzs7QUFFRztRQUNLLElBQUEsQ0FBQSxjQUFjLEdBQWtCLEVBQUU7QUFFMUM7O0FBRUc7QUFDSyxRQUFBLElBQUEsQ0FBQSxRQUFRLEdBQWtDO0FBQ2hELFlBQUEsZ0JBQWdCLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztBQUNwRCxZQUFBLElBQUksRUFBRSxTQUFTO0FBQ2YsWUFBQSxZQUFZLEVBQUUsS0FBSztBQUNuQixZQUFBLFFBQVEsRUFBRSxPQUFPO0FBQ2pCLFlBQUEsa0JBQWtCLEVBQUUsS0FBSztTQUMxQjtBQTJCRDs7QUFFRztBQUNLLFFBQUEsSUFBQSxDQUFBLE9BQU8sR0FBeUIsYUFBYSxDQUFDLE1BQU0sQ0FBQyxVQUFVO1FBZXJFLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUM7QUFFckMsUUFBQSxJQUFJLENBQUMsUUFBUSxHQUFHLEVBQUU7QUFDbEIsUUFBQSxJQUFJLENBQUMsU0FBUyxHQUFHLEVBQUU7QUFDbkIsUUFBQSxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxHQUFH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LEtBQUk7WUFDcEQsSUFBSSxDQUFDLFlBQVksQ0FBQyxJQUFJLEVBQUUsNERBQTRELEVBQUUsSUFBSSxDQUFDO0FBQzdGLFFBQUEsQ0FBQyxDQUFDO0FBRUYsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxNQUFLO1lBQ3ZCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLE9BQU87WUFDN0MsSUFBSSxDQUFDLE9BQU8sR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDLFNBQVM7QUFDN0MsWUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFBLENBQUEsRUFBSSxhQUFhLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQSxDQUFFLENBQUM7WUFDckQsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQztBQUMzQyxRQUFBLENBQUMsQ0FBQztRQUVGLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLENBQU8sTUFBTSxLQUFJLFNBQUEsQ0FBQSxJQUFBLEVBQUEsTUFBQSxFQUFBLE1BQUEsRUFBQSxhQUFBOztBQUVqQyxZQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFO2dCQUN2QixJQUFJLENBQUMsMkJBQTJCLEdBQUcsTUFBTSxDQUN2QyxJQUFJLENBQUMsUUFBUSxDQUFDLDZCQUE2QixJQUFJLDZCQUE2QixFQUM1RSxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsT0FBTyxDQUFDLEVBQUUsQ0FBQztZQUNyQztBQUVBLFlBQUEsSUFBSSxDQUFDLGFBQWEsR0FBRyxNQUFNO0FBQzNCLFlBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO1lBQzFCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUEsQ0FBQSxFQUFJLGFBQWEsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFBLENBQUUsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxDQUFDO1lBQzFF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
