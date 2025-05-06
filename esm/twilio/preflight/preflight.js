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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmxpZ2h0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9wcmVmbGlnaHQvcHJlZmxpZ2h0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBOzs7OztHQUtHO0FBQ0gsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUN0QyxPQUFPLElBQUksTUFBTSxTQUFTLENBQUM7QUFDM0IsT0FBTyxNQUFrQyxNQUFNLFdBQVcsQ0FBQztBQUMzRCxPQUFPLEVBQ0wsYUFBYSxFQUNiLGlCQUFpQixFQUNqQixlQUFlLEdBRWhCLE1BQU0sV0FBVyxDQUFDO0FBQ25CLE9BQU8sR0FBRyxNQUFNLFFBQVEsQ0FBQztBQUd6QixPQUFPLEVBQUUsNkJBQTZCLEVBQUUsTUFBTSxjQUFjLENBQUM7QUFLN0QsT0FBTyxFQUFFLGlCQUFpQixFQUFFLGtCQUFrQixFQUFFLE1BQU0sY0FBYyxDQUFDO0FBNERyRTs7R0FFRztBQUNILE1BQU0sT0FBTyxhQUFjLFNBQVEsWUFBWTtJQWtHN0M7Ozs7O09BS0c7SUFDSCxZQUFZLEtBQWEsRUFBRSxPQUFzQztRQUMvRCxLQUFLLEVBQUUsQ0FBQztRQXpFVjs7V0FFRztRQUNLLHdCQUFtQixHQUFZLEtBQUssQ0FBQztRQU83Qzs7V0FFRztRQUNLLFNBQUksR0FBUSxJQUFJLEdBQUcsQ0FBQyxlQUFlLENBQUMsQ0FBQztRQUU3Qzs7V0FFRztRQUNLLG1CQUFjLEdBQWtCLEVBQUUsQ0FBQztRQUUzQzs7V0FFRztRQUNLLGFBQVEsR0FBa0M7WUFDaEQsZ0JBQWdCLEVBQUUsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQztZQUNwRCxJQUFJLEVBQUUsU0FBUztZQUNmLFlBQVksRUFBRSxLQUFLO1lBQ25CLFFBQVEsRUFBRSxPQUFPO1lBQ2pCLGtCQUFrQixFQUFFLEtBQUs7U0FDMUIsQ0FBQztRQTJCRjs7V0FFRztRQUNLLFlBQU8sR0FBeUIsYUFBYSxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUM7UUFnQnRFLE1BQU0sQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUV0QyxJQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQztRQUNuQixJQUFJLENBQUMsU0FBUyxHQUFHLEVBQUUsQ0FBQztRQUNwQixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUU3QixJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssa0NBQ2pCLElBQUksQ0FBQyxRQUFRLEtBQ2hCLGVBQWUsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLFlBQVksQ0FBQyxDQUFDO2dCQUMzQyxJQUFJLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDLENBQUMsU0FBUyxJQUN2QyxDQUFDO1FBRUgsMkVBQTJFO1FBQzNFLHNEQUFzRDtRQUN0RCxNQUFNLFdBQVcsR0FBRztZQUNsQixrQkFBa0I7WUFDbEIsTUFBTTtZQUNOLGNBQWM7WUFDZCxVQUFVO1lBQ1Ysb0JBQW9CO1NBQ3JCLENBQUM7UUFDRixNQUFNLG1CQUFtQixHQUFHO1lBQzFCLGNBQWM7WUFDZCxlQUFlO1lBQ2YsaUJBQWlCO1lBQ2pCLCtCQUErQjtZQUMvQixZQUFZO1lBQ1osa0JBQWtCO1NBQ25CLENBQUM7UUFDRixJQUFJLE9BQU8sT0FBTyxLQUFLLFFBQVEsRUFBRTtZQUMvQixNQUFNLEtBQUsscUJBQWEsT0FBTyxDQUFFLENBQUM7WUFDbEMsTUFBTSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxHQUFXLEVBQUUsRUFBRTtnQkFDekMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxRQUFRLENBQUMsR0FBRyxDQUFDLEVBQUU7b0JBQ3BFLE9BQU8sS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDO2lCQUNuQjtnQkFDRCxJQUFJLG1CQUFtQixDQUFDLFFBQVEsQ0FBQyxHQUFHLENBQUMsRUFBRTtvQkFDckMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQztpQkFDbkI7WUFDSCxDQUFDLENBQUMsQ0FBQztZQUNILElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7U0FDeEQ7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSCxJQUFJO1FBQ0YsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDekIsTUFBTSxLQUFLLEdBQUcsSUFBSSxhQUFhLENBQUMsa0JBQWtCLEVBQUUsQ0FBQztRQUNyRCxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7WUFDaEIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxZQUFZLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDO1lBQzlFLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7U0FDeEI7YUFBTTtZQUNMLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDdkI7SUFDSCxDQUFDO0lBRUQ7O09BRUc7SUFDSyxZQUFZLENBQUMsSUFBWSxFQUFFLFdBQW1CLEVBQUUsVUFBdUI7UUFDN0UsTUFBTSxPQUFPLEdBQTBCLEVBQUUsSUFBSSxFQUFFLFdBQVcsRUFBRSxDQUFDO1FBQzdELElBQUksVUFBVSxFQUFFO1lBQ2QsT0FBTyxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUM7U0FDakM7UUFDRCxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUM3QixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLGFBQWEsQ0FBQyxNQUFNLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDO1FBQzdFLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxPQUFPLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDbkQsQ0FBQztJQUVEOztPQUVHO0lBQ0ssZUFBZSxDQUFDLEdBQVc7UUFDakMsSUFBSSxHQUFHLEdBQUcsR0FBRyxFQUFFO1lBQ2IsT0FBTyxhQUFhLENBQUMsV0FBVyxDQUFDLFNBQVMsQ0FBQztTQUM1QzthQUFNLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUksR0FBRyxFQUFFO1lBQ25DLE9BQU8sYUFBYSxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUM7U0FDeEM7YUFBTSxJQUFJLEdBQUcsSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLENBQUMsRUFBRTtZQUNqQyxPQUFPLGFBQWEsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDO1NBQ3ZDO2FBQU0sSUFBSSxHQUFHLElBQUksR0FBRyxJQUFJLEdBQUcsSUFBSSxHQUFHLEVBQUU7WUFDbkMsT0FBTyxhQUFhLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQztTQUN2QzthQUFNO1lBQ0wsT0FBTyxhQUFhLENBQUMsV0FBVyxDQUFDLFFBQVEsQ0FBQztTQUMzQztJQUNILENBQUM7SUFFRDs7T0FFRztJQUNLLFVBQVU7O1FBQ2hCLE1BQU0sS0FBSyxHQUFHLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztRQUNsQyxNQUFNLFVBQVUsR0FBb0IsRUFBRSxLQUFLLEVBQUUsSUFBSSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQy9ELElBQUksSUFBSSxDQUFDLFFBQVEsRUFBRTtZQUNqQixVQUFVLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxRQUFRLENBQUM7WUFDL0IsVUFBVSxDQUFDLFFBQVEsR0FBSSxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksQ0FBQyxVQUFVLENBQUM7U0FDeEQ7UUFFRCxNQUFNLE1BQU0sR0FBeUI7WUFDbkMsT0FBTyxFQUFFLElBQUksQ0FBQyxRQUFRO1lBQ3RCLElBQUksRUFBRSxJQUFJLENBQUMsS0FBSztZQUNoQixpQkFBaUIsY0FBRSxJQUFJLENBQUMsMkJBQTJCLDBDQUFFLGlCQUFpQixtQ0FBSSxFQUFFO1lBQzVFLGFBQWEsRUFBRSxJQUFJLENBQUMsY0FBYztZQUNsQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFFBQVE7WUFDdEIsWUFBWSxFQUFFLElBQUksQ0FBQyxRQUFRLENBQUMsSUFBSTtZQUNoQyxLQUFLO1lBQ0wsVUFBVTtZQUNWLE1BQU0sRUFBRSxJQUFJLENBQUMsbUJBQW1CLEVBQUU7WUFDbEMsUUFBUSxFQUFFLElBQUksQ0FBQyxTQUFTO1NBQ3pCLENBQUM7UUFFRixNQUFNLDZCQUE2QixTQUFHLElBQUksQ0FBQywyQkFBMkIsMENBQUUsNkJBQTZCLENBQUM7UUFFdEcsSUFBSSw2QkFBNkIsRUFBRTtZQUNqQyxNQUFNLENBQUMsNkJBQTZCLEdBQUcsNkJBQTZCLENBQUM7WUFDckUsTUFBTSxDQUFDLGNBQWMsR0FBRyw2QkFBNkIsQ0FBQyxjQUFjLENBQUMsYUFBYSxLQUFLLE9BQU87bUJBQzNGLDZCQUE2QixDQUFDLGVBQWUsQ0FBQyxhQUFhLEtBQUssT0FBTyxDQUFDO1NBQzVFO1FBRUQsSUFBSSxLQUFLLEVBQUU7WUFDVCxNQUFNLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxPQUFPLENBQUMsQ0FBQztTQUM5RDtRQUVELE9BQU8sTUFBTSxDQUFDO0lBQ2hCLENBQUM7SUFFRDs7T0FFRztJQUNLLG1CQUFtQjtRQUN6QixJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsRUFBRTtZQUN2QixPQUFPO1NBQ1I7UUFFRCx5QkFBWSxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sRUFBRztJQUMxQyxDQUFDO0lBRUQ7O09BRUc7SUFDSyxZQUFZO1FBQ2xCLE1BQU0saUJBQWlCLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLENBQy9DLE1BQU0sQ0FBQyxFQUFFLENBQUMsT0FBTyxNQUFNLENBQUMsR0FBRyxLQUFLLFFBQVEsSUFBSSxNQUFNLENBQUMsR0FBRyxHQUFHLENBQUMsQ0FDM0QsQ0FBQztRQUVGLE1BQU0sT0FBTyxHQUFHLGlCQUFpQixJQUFJLENBQUM7WUFDcEMsQ0FBQyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLGlCQUFpQixDQUFDO1lBQ3hDLENBQUMsQ0FBQyxFQUFFLENBQUM7UUFFUCxJQUFJLENBQUMsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sRUFBRTtZQUMvQixPQUFPO1NBQ1I7UUFFRCxPQUFPLENBQUMsUUFBUSxFQUFFLEtBQUssRUFBRSxLQUFLLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxFQUFFLEVBQUU7WUFDdkQsTUFBTSxNQUFNLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1lBQ3pDLHVDQUNLLE9BQU8sS0FDVixDQUFDLElBQUksQ0FBQyxFQUFFO29CQUNOLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsS0FBSyxFQUFFLEtBQUssRUFBRSxFQUFFLENBQUMsS0FBSyxHQUFHLEtBQUssQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7b0JBQ2hHLEdBQUcsRUFBRSxJQUFJLENBQUMsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDO29CQUN4QixHQUFHLEVBQUUsSUFBSSxDQUFDLEdBQUcsQ0FBQyxHQUFHLE1BQU0sQ0FBQztpQkFDekIsSUFDRDtRQUNKLENBQUMsRUFBRSxFQUFTLENBQUMsQ0FBQztJQUNoQixDQUFDO0lBRUQ7O09BRUc7SUFDSyxrQkFBa0I7UUFDeEIsTUFBTSxZQUFZLEdBQUcsSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLENBQUM7UUFDaEQsSUFBSSxDQUFDLFlBQVksRUFBRTtZQUNqQixNQUFNLElBQUksaUJBQWlCLENBQUMsZ0ZBQWdGLENBQUMsQ0FBQztTQUMvRztRQUVELE1BQU0sT0FBTyxHQUFRLElBQUksS0FBSyxDQUFDLGlCQUFpQixDQUFDLENBQUM7UUFFbEQsT0FBTyxDQUFDLGdCQUFnQixDQUFDLGdCQUFnQixFQUFFLEdBQUcsRUFBRSxDQUFDLE9BQU8sQ0FBQyxJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ2pFLElBQUksT0FBTyxPQUFPLENBQUMsWUFBWSxLQUFLLFVBQVUsRUFBRTtZQUM5QyxPQUFPLENBQUMsWUFBWSxDQUFDLGFBQWEsRUFBRSxXQUFXLENBQUMsQ0FBQztTQUNsRDtRQUVELE1BQU0sR0FBRyxHQUFHLFlBQVksQ0FBQyx3QkFBd0IsQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUMzRCxNQUFNLElBQUksR0FBRyxZQUFZLENBQUMsNEJBQTRCLEVBQUUsQ0FBQztRQUN6RCxHQUFHLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxDQUFDO1FBRWxCLE9BQU8sSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUNyQixDQUFDO0lBRUQ7O09BRUc7SUFDSyxXQUFXLENBQUMsS0FBYSxFQUFFLE9BQXNDO1FBQ3ZFLElBQUk7WUFDRixJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxJQUFJLE1BQU0sQ0FBQyxDQUFDLEtBQUssRUFBRTtnQkFDMUQsUUFBUSxFQUFFLE9BQU8sQ0FBQyxRQUFRO2dCQUMxQixnQkFBZ0IsRUFBRSxPQUFPLENBQUMsZ0JBQWdCO2dCQUMxQyxJQUFJLEVBQUUsT0FBTyxDQUFDLElBQUk7Z0JBQ2xCLE9BQU8sRUFBRSxPQUFPLENBQUMsT0FBTztnQkFDeEIsZUFBZSxFQUFFLE9BQU8sQ0FBQyxlQUFlO2dCQUN4QyxRQUFRLEVBQUUsT0FBTyxDQUFDLFFBQVE7Z0JBQzFCLFNBQVMsRUFBRSxJQUFJO2FBQ1UsQ0FBQyxDQUFDO1lBRTdCLElBQUksQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsVUFBVSxFQUFFLEdBQUcsRUFBRTtnQkFDbEQsSUFBSSxDQUFDLG1CQUFtQixFQUFFLENBQUM7WUFDN0IsQ0FBQyxDQUFDLENBQUM7WUFFSCxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLEtBQUssRUFBRSxDQUFDLEtBQWtCLEVBQUUsRUFBRTtnQkFDL0QsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUM3QixDQUFDLENBQUMsQ0FBQztZQUVILElBQUksQ0FBQyxPQUFPLENBQUMsUUFBUSxFQUFFLENBQUM7U0FDekI7UUFBQyxPQUFPLEtBQUssRUFBRTtZQUNkLHlFQUF5RTtZQUN6RSxVQUFVLENBQUMsR0FBRyxFQUFFO2dCQUNkLElBQUksQ0FBQyxTQUFTLENBQUMsS0FBSyxDQUFDLENBQUM7WUFDeEIsQ0FBQyxDQUFDLENBQUM7WUFDSCxPQUFPO1NBQ1I7UUFFRCxJQUFJLENBQUMsc0JBQXNCLEdBQUcsVUFBVSxDQUFDLEdBQUcsRUFBRTtZQUM1QyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksZUFBZSxDQUFDLGVBQWUsQ0FBQyw4QkFBOEIsQ0FBQyxDQUFDLENBQUM7UUFDM0YsQ0FBQyxFQUFFLE9BQU8sQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDO0lBQ2pDLENBQUM7SUFFRDs7O09BR0c7SUFDSyxjQUFjLENBQUMsS0FBa0I7UUFDdkMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztRQUN2QixJQUFJLENBQUMsU0FBUyxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3hCLENBQUM7SUFFRDs7T0FFRztJQUNXLG1CQUFtQjs7WUFDL0IsWUFBWSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUM5QixZQUFZLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLENBQUM7WUFFMUMsSUFBSSxDQUFDLEtBQUssR0FBRyxNQUFNLElBQUksQ0FBQyxPQUFPLENBQUMsT0FBTyxDQUFDO2dCQUN0QyxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsUUFBUSxDQUFDLGdCQUFnQjthQUNqRCxDQUFDLENBQUM7WUFDSCxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsR0FBRyxFQUFFLEtBQUssRUFBRSxJQUFJLENBQUMsR0FBRyxFQUFFLEVBQUUsQ0FBQztZQUN0RCxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDO1lBRXBDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxJQUFJLElBQUksU0FBUyxDQUFDO1lBQzVDLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLEVBQUU7Z0JBQzlCLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxPQUFPLENBQUMsYUFBYSxFQUFFLEVBQUUsa0JBQWtCLENBQUMsQ0FBQztnQkFFckYsTUFBTSxLQUFLLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFZLENBQUM7Z0JBQ3hDLElBQUksS0FBSyxFQUFFO29CQUNULEtBQUssQ0FBQyxVQUFVLENBQUMsS0FBSyxDQUFDLENBQUM7b0JBQ3hCLEtBQUssQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7aUJBQ3ZCO2FBQ0Y7WUFFRCxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsR0FBRyxFQUFFO2dCQUNqQyxJQUFJLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLFlBQVksRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQztnQkFDL0UsSUFBSSxDQUFDLE9BQU8sQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUN6QixDQUFDLENBQUMsQ0FBQztZQUVILE1BQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsWUFBWSxDQUFRLENBQUM7WUFDbEQsU0FBUyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFO2dCQUN6QixJQUFJLENBQUMsSUFBSSxDQUFDLG1CQUFtQixFQUFFO29CQUM3QixJQUFJLENBQUMsWUFBWSxDQUFDLDJCQUEyQixFQUMzQyxrRUFBa0UsQ0FBQyxDQUFDO2lCQUN2RTtnQkFDRCxJQUFJLENBQUMsbUJBQW1CLEdBQUcsSUFBSSxDQUFDO1lBQ2xDLENBQUMsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztLQUFBO0lBRUQ7OztPQUdHO0lBQ0ssU0FBUyxDQUFDLEtBQWlDO1FBQ2pELFlBQVksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7UUFDOUIsWUFBWSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxDQUFDO1FBQzFDLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDO1FBQ3hCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO1FBQzNCLElBQUksQ0FBQyxPQUFPLEdBQUcsYUFBYSxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDM0MsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxhQUFhLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxFQUFFLEtBQUssQ0FBQyxDQUFDO1FBQzFELElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsS0FBSyxDQUFDLENBQUM7SUFDaEQsQ0FBQztJQUVEOzs7O09BSUc7SUFDSyxlQUFlO1FBQ3JCLHdFQUF3RTtRQUN4RSw4RUFBOEU7UUFDOUUsVUFBVSxDQUFDLEdBQUcsRUFBRTtZQUNkLElBQUksSUFBSSxDQUFDLE9BQU8sS0FBSyxhQUFhLENBQUMsTUFBTSxDQUFDLE1BQU0sRUFBRTtnQkFDaEQsT0FBTzthQUNSO1lBRUQsWUFBWSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUM5QixZQUFZLENBQUMsSUFBSSxDQUFDLHNCQUFzQixDQUFDLENBQUM7WUFFMUMsSUFBSSxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDeEIsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUM7WUFDM0IsSUFBSSxDQUFDLE9BQU8sR0FBRyxhQUFhLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQztZQUM5QyxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQyxVQUFVLEVBQUUsQ0FBQztZQUNqQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLGFBQWEsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQztZQUNwRixJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxPQUFPLENBQUMsQ0FBQztRQUMxRCxDQUFDLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDVCxDQUFDO0lBRUQ7O09BRUc7SUFDSyxnQkFBZ0I7UUFDdEIsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFxQixFQUFFLEVBQUU7WUFDM0QsSUFBSSxPQUFPLEVBQUU7Z0JBQ1gsT0FBTyxDQUFDLFVBQVUsRUFBRSxDQUFDLE9BQU8sQ0FBQyxDQUFDLElBQVksRUFBRSxFQUFFLENBQUMsT0FBTyxDQUFDLGtCQUFrQixDQUFDLElBQUksQ0FBQyxDQUFDLENBQUM7YUFDbEY7UUFDSCxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7O09BR0c7SUFDSyxrQkFBa0IsQ0FBQyxJQUFVO1FBQ25DLElBQUksSUFBSSxDQUFDLFFBQVEsQ0FBQyxZQUFZLEVBQUU7WUFDOUIsbUZBQW1GO1lBQ25GLGlEQUFpRDtZQUNqRCxJQUFJLENBQUMsSUFBSSxDQUFDLFFBQVEsRUFBRSxHQUFHLEVBQUU7Z0JBQ3ZCLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxPQUFPO3FCQUMxQixPQUFPLENBQUMsQ0FBQyxNQUFtQixFQUFFLEVBQUUsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLEtBQUssR0FBRyxJQUFJLENBQUMsQ0FBQztZQUNqRSxDQUFDLENBQUMsQ0FBQztTQUNKO1FBRUQsSUFBSSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxJQUFZLEVBQUUsSUFBZ0IsRUFBRSxFQUFFO1lBQ3BELElBQUksQ0FBQyxZQUFZLENBQUMsSUFBSSxFQUFFLDREQUE0RCxFQUFFLElBQUksQ0FBQyxDQUFDO1FBQzlGLENBQUMsQ0FBQyxDQUFDO1FBRUgsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsR0FBRyxFQUFFO1lBQ3ZCLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLE9BQU8sQ0FBQztZQUM5QyxJQUFJLENBQUMsT0FBTyxHQUFHLGFBQWEsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDO1lBQzlDLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksYUFBYSxDQUFDLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQyxDQUFDO1lBQ3RELElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUM1QyxDQUFDLENBQUMsQ0FBQztRQUVILElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLENBQU8sTUFBTSxFQUFFLEVBQUU7WUFDakMsNEVBQTRFO1lBQzVFLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFO2dCQUN2QixJQUFJLENBQUMsMkJBQTJCLEdBQUcsTUFBTSxDQUN2QyxJQUFJLENBQUMsUUFBUSxDQUFDLDZCQUE2QixJQUFJLDZCQUE2QixDQUM3RSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxPQUFPLENBQUMsRUFBRSxDQUFDLENBQUM7YUFDckM7WUFFRCxJQUFJLENBQUMsYUFBYSxHQUFHLE1BQU0sQ0FBQztZQUM1QixJQUFJLENBQUMsUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsQ0FBQztZQUMzQixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLGFBQWEsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1lBQzNFLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDakQsQ0FBQyxDQUFBLENBQUMsQ0FBQztRQUVILHlFQUF5RTtRQUN6RSxxQkFBcUI7UUFDckIsQ0FBQztnQkFDQyxXQUFXLEVBQUUsZ0JBQWdCO2dCQUM3QixJQUFJLEVBQUUsY0FBYzthQUNwQixFQUFFO2dCQUNGLFdBQVcsRUFBRSxLQUFLO2dCQUNsQixJQUFJLEVBQUUsZUFBZTthQUNyQixFQUFFO2dCQUNGLFdBQVcsRUFBRSxNQUFNO2dCQUNuQixJQUFJLEVBQUUsZUFBZTthQUNyQixFQUFFO2dCQUNGLFdBQVcsRUFBRSxXQUFXO2dCQUN4QixJQUFJLEVBQUUsV0FBVzthQUNqQixDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsRUFBQyxJQUFJLEVBQUUsV0FBVyxFQUFDLEVBQUUsRUFBRTtZQUVsQyxNQUFNLFdBQVcsR0FBRyxLQUFLLElBQUksYUFBYSxDQUFDO1lBQzNDLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUUzRCxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsV0FBVyxDQUFDLEdBQUcsQ0FBQyxLQUFhLEVBQUUsRUFBRTtnQkFDckQsTUFBTSxNQUFNLEdBQUksSUFBSSxDQUFDLGNBQXNCLENBQUMsV0FBVyxDQUFDO3NCQUNuRCxJQUFJLENBQUMsY0FBc0IsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLEtBQUssRUFBRSxDQUFDLEVBQUUsQ0FBQztnQkFFOUQsSUFBSSxLQUFLLEtBQUssWUFBWSxJQUFJLEtBQUssS0FBSyxVQUFVLEVBQUU7b0JBQ2xELE1BQU0sQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDLEdBQUcsRUFBRSxDQUFDO2lCQUMzQjtxQkFBTSxJQUFJLENBQUMsS0FBSyxLQUFLLFdBQVcsSUFBSSxLQUFLLEtBQUssUUFBUSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxFQUFFO29CQUM1RSxNQUFNLENBQUMsR0FBRyxHQUFHLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztvQkFDeEIsTUFBTSxDQUFDLFFBQVEsR0FBRyxNQUFNLENBQUMsR0FBRyxHQUFHLE1BQU0sQ0FBQyxLQUFLLENBQUM7aUJBQzdDO2dCQUVELGVBQWUsQ0FBQyxLQUFLLENBQUMsQ0FBQztZQUN6QixDQUFDLENBQUM7UUFDSixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksT0FBTztRQUNULE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQztJQUN2QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxJQUFJLE9BQU87UUFDVCxPQUFPLElBQUksQ0FBQyxRQUFRLENBQUM7SUFDdkIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxZQUFZO1FBQ2QsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDO0lBQzVCLENBQUM7SUFFRDs7T0FFRztJQUNILElBQUksTUFBTTtRQUNSLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQztJQUN0QixDQUFDO0lBRUQ7O09BRUc7SUFDSCxJQUFJLFNBQVM7UUFDWCxPQUFPLElBQUksQ0FBQyxVQUFVLENBQUM7SUFDekIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxNQUFNO1FBQ1IsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDO0lBQ3RCLENBQUM7Q0FDRjtBQUVELFdBQWlCLGFBQWE7SUFDNUI7OztPQUdHO0lBQ0gsSUFBWSxXQXlCWDtJQXpCRCxXQUFZLFdBQVc7UUFDckI7O1dBRUc7UUFDSCxzQ0FBdUIsQ0FBQTtRQUV2Qjs7V0FFRztRQUNILDhCQUFlLENBQUE7UUFFZjs7V0FFRztRQUNILDRCQUFhLENBQUE7UUFFYjs7V0FFRztRQUNILDRCQUFhLENBQUE7UUFFYjs7V0FFRztRQUNILG9DQUFxQixDQUFBO0lBQ3ZCLENBQUMsRUF6QlcsV0FBVyxHQUFYLHlCQUFXLEtBQVgseUJBQVcsUUF5QnRCO0lBRUQ7O09BRUc7SUFDSCxJQUFZLE1BeUJYO0lBekJELFdBQVksTUFBTTtRQUNoQjs7V0FFRztRQUNILGlDQUF1QixDQUFBO1FBRXZCOztXQUVHO1FBQ0gsaUNBQXVCLENBQUE7UUFFdkI7O1dBRUc7UUFDSCwyQkFBaUIsQ0FBQTtRQUVqQjs7V0FFRztRQUNILDJCQUFpQixDQUFBO1FBRWpCOztXQUVHO1FBQ0gsNkJBQW1CLENBQUE7SUFDckIsQ0FBQyxFQXpCVyxNQUFNLEdBQU4sb0JBQU0sS0FBTixvQkFBTSxRQXlCakI7SUFFRDs7T0FFRztJQUNILElBQVksTUFvQlg7SUFwQkQsV0FBWSxNQUFNO1FBQ2hCOztXQUVHO1FBQ0gsbUNBQXlCLENBQUE7UUFFekI7O1dBRUc7UUFDSCxpQ0FBdUIsQ0FBQTtRQUV2Qjs7V0FFRztRQUNILGlDQUF1QixDQUFBO1FBRXZCOztXQUVHO1FBQ0gsMkJBQWlCLENBQUE7SUFDbkIsQ0FBQyxFQXBCVyxNQUFNLEdBQU4sb0JBQU0sS0FBTixvQkFBTSxRQW9CakI7QUF1U0YsQ0FBQyxFQTVYZSxhQUFhLEtBQWIsYUFBYSxRQTRYNUIifQ==