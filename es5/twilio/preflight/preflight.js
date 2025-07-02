"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PreflightTest = void 0;
var events_1 = require("events");
var call_1 = require("../call");
var device_1 = require("../device");
var errors_1 = require("../errors");
var log_1 = require("../log");
var stats_1 = require("../rtc/stats");
var constants_1 = require("../constants");
/**
 * Runs some tests to identify issues, if any, prohibiting successful calling.
 */
var PreflightTest = /** @class */ (function (_super) {
    __extends(PreflightTest, _super);
    /**
     * Construct a {@link PreflightTest} instance.
     * @param token - A Twilio JWT token string.
     * @param options
     */
    function PreflightTest(token, options) {
        var _this = _super.call(this) || this;
        /**
         * Whether this test has already logged an insights-connection-warning.
         */
        _this._hasInsightsErrored = false;
        /**
         * An instance of Logger to use.
         */
        _this._log = new log_1.default('PreflightTest');
        /**
         * Network related timing measurements for this test
         */
        _this._networkTiming = {};
        /**
         * The options passed to {@link PreflightTest} constructor
         */
        _this._options = {
            codecPreferences: [call_1.default.Codec.PCMU, call_1.default.Codec.Opus],
            edge: 'roaming',
            fakeMicInput: false,
            logLevel: 'error',
            signalingTimeoutMs: 10000,
        };
        /**
         * Current status of this test
         */
        _this._status = PreflightTest.Status.Connecting;
        Object.assign(_this._options, options);
        _this._samples = [];
        _this._warnings = [];
        _this._startTime = Date.now();
        _this._initDevice(token, __assign(__assign({}, _this._options), { fileInputStream: _this._options.fakeMicInput ?
                _this._getStreamFromFile() : undefined }));
        // Device sets the loglevel so start logging after initializing the device.
        // Then selectively log options that users can modify.
        var userOptions = [
            'codecPreferences',
            'edge',
            'fakeMicInput',
            'logLevel',
            'signalingTimeoutMs',
        ];
        var userOptionOverrides = [
            'audioContext',
            'deviceFactory',
            'fileInputStream',
            'getRTCIceCandidateStatsReport',
            'iceServers',
            'rtcConfiguration',
        ];
        if (typeof options === 'object') {
            var toLog_1 = __assign({}, options);
            Object.keys(toLog_1).forEach(function (key) {
                if (!userOptions.includes(key) && !userOptionOverrides.includes(key)) {
                    delete toLog_1[key];
                }
                if (userOptionOverrides.includes(key)) {
                    toLog_1[key] = true;
                }
            });
            _this._log.debug('.constructor', JSON.stringify(toLog_1));
        }
        return _this;
    }
    /**
     * Stops the current test and raises a failed event.
     */
    PreflightTest.prototype.stop = function () {
        var _this = this;
        this._log.debug('.stop');
        var error = new errors_1.GeneralErrors.CallCancelledError();
        if (this._device) {
            this._device.once(device_1.default.EventName.Unregistered, function () { return _this._onFailed(error); });
            this._device.destroy();
        }
        else {
            this._onFailed(error);
        }
    };
    /**
     * Emit a {PreflightTest.Warning}
     */
    PreflightTest.prototype._emitWarning = function (name, description, rtcWarning) {
        var warning = { name: name, description: description };
        if (rtcWarning) {
            warning.rtcWarning = rtcWarning;
        }
        this._warnings.push(warning);
        this._log.debug("#".concat(PreflightTest.Events.Warning), JSON.stringify(warning));
        this.emit(PreflightTest.Events.Warning, warning);
    };
    /**
     * Returns call quality base on the RTC Stats
     */
    PreflightTest.prototype._getCallQuality = function (mos) {
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
    };
    /**
     * Returns the report for this test.
     */
    PreflightTest.prototype._getReport = function () {
        var _a, _b, _c;
        var stats = this._getRTCStats();
        var testTiming = { start: this._startTime };
        if (this._endTime) {
            testTiming.end = this._endTime;
            testTiming.duration = this._endTime - this._startTime;
        }
        var report = {
            callSid: this._callSid,
            edge: this._edge,
            iceCandidateStats: (_b = (_a = this._rtcIceCandidateStatsReport) === null || _a === void 0 ? void 0 : _a.iceCandidateStats) !== null && _b !== void 0 ? _b : [],
            networkTiming: this._networkTiming,
            samples: this._samples,
            selectedEdge: this._options.edge,
            stats: stats,
            testTiming: testTiming,
            totals: this._getRTCSampleTotals(),
            warnings: this._warnings,
        };
        var selectedIceCandidatePairStats = (_c = this._rtcIceCandidateStatsReport) === null || _c === void 0 ? void 0 : _c.selectedIceCandidatePairStats;
        if (selectedIceCandidatePairStats) {
            report.selectedIceCandidatePairStats = selectedIceCandidatePairStats;
            report.isTurnRequired = selectedIceCandidatePairStats.localCandidate.candidateType === 'relay'
                || selectedIceCandidatePairStats.remoteCandidate.candidateType === 'relay';
        }
        if (stats) {
            report.callQuality = this._getCallQuality(stats.mos.average);
        }
        return report;
    };
    /**
     * Returns RTC stats totals for this test
     */
    PreflightTest.prototype._getRTCSampleTotals = function () {
        if (!this._latestSample) {
            return;
        }
        return __assign({}, this._latestSample.totals);
    };
    /**
     * Returns RTC related stats captured during the test call
     */
    PreflightTest.prototype._getRTCStats = function () {
        var firstMosSampleIdx = this._samples.findIndex(function (sample) { return typeof sample.mos === 'number' && sample.mos > 0; });
        var samples = firstMosSampleIdx >= 0
            ? this._samples.slice(firstMosSampleIdx)
            : [];
        if (!samples || !samples.length) {
            return;
        }
        return ['jitter', 'mos', 'rtt'].reduce(function (statObj, stat) {
            var _a;
            var values = samples.map(function (s) { return s[stat]; });
            return __assign(__assign({}, statObj), (_a = {}, _a[stat] = {
                average: Number((values.reduce(function (total, value) { return total + value; }) / values.length).toPrecision(5)),
                max: Math.max.apply(Math, values),
                min: Math.min.apply(Math, values),
            }, _a));
        }, {});
    };
    /**
     * Returns a MediaStream from a media file
     */
    PreflightTest.prototype._getStreamFromFile = function () {
        var audioContext = this._options.audioContext;
        if (!audioContext) {
            throw new errors_1.NotSupportedError('Cannot fake input audio stream: AudioContext is not supported by this browser.');
        }
        var audioEl = new Audio(constants_1.COWBELL_AUDIO_URL);
        audioEl.addEventListener('canplaythrough', function () { return audioEl.play(); });
        if (typeof audioEl.setAttribute === 'function') {
            audioEl.setAttribute('crossorigin', 'anonymous');
        }
        var src = audioContext.createMediaElementSource(audioEl);
        var dest = audioContext.createMediaStreamDestination();
        src.connect(dest);
        return dest.stream;
    };
    /**
     * Initialize the device
     */
    PreflightTest.prototype._initDevice = function (token, options) {
        var _this = this;
        try {
            this._device = new (options.deviceFactory || device_1.default)(token, {
                chunderw: options.chunderw,
                codecPreferences: options.codecPreferences,
                edge: options.edge,
                eventgw: options.eventgw,
                fileInputStream: options.fileInputStream,
                logLevel: options.logLevel,
                preflight: true,
            });
            this._device.once(device_1.default.EventName.Registered, function () {
                _this._onDeviceRegistered();
            });
            this._device.once(device_1.default.EventName.Error, function (error) {
                _this._onDeviceError(error);
            });
            this._device.register();
        }
        catch (error) {
            // We want to return before failing so the consumer can capture the event
            setTimeout(function () {
                _this._onFailed(error);
            });
            return;
        }
        this._signalingTimeoutTimer = setTimeout(function () {
            _this._onDeviceError(new errors_1.SignalingErrors.ConnectionError('WebSocket Connection Timeout'));
        }, options.signalingTimeoutMs);
    };
    /**
     * Called on {@link Device} error event
     * @param error
     */
    PreflightTest.prototype._onDeviceError = function (error) {
        this._device.destroy();
        this._onFailed(error);
    };
    /**
     * Called on {@link Device} ready event
     */
    PreflightTest.prototype._onDeviceRegistered = function () {
        return __awaiter(this, void 0, void 0, function () {
            var _a, audio, publisher;
            var _this = this;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        clearTimeout(this._echoTimer);
                        clearTimeout(this._signalingTimeoutTimer);
                        _a = this;
                        return [4 /*yield*/, this._device.connect({
                                rtcConfiguration: this._options.rtcConfiguration,
                            })];
                    case 1:
                        _a._call = _b.sent();
                        this._networkTiming.signaling = { start: Date.now() };
                        this._setupCallHandlers(this._call);
                        this._edge = this._device.edge || undefined;
                        if (this._options.fakeMicInput) {
                            this._echoTimer = setTimeout(function () { return _this._device.disconnectAll(); }, constants_1.ECHO_TEST_DURATION);
                            audio = this._device.audio;
                            if (audio) {
                                audio.disconnect(false);
                                audio.outgoing(false);
                            }
                        }
                        this._call.once('disconnect', function () {
                            _this._device.once(device_1.default.EventName.Unregistered, function () { return _this._onUnregistered(); });
                            _this._device.destroy();
                        });
                        publisher = this._call['_publisher'];
                        publisher.on('error', function () {
                            if (!_this._hasInsightsErrored) {
                                _this._emitWarning('insights-connection-error', 'Received an error when attempting to connect to Insights gateway');
                            }
                            _this._hasInsightsErrored = true;
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Called when there is a fatal error
     * @param error
     */
    PreflightTest.prototype._onFailed = function (error) {
        clearTimeout(this._echoTimer);
        clearTimeout(this._signalingTimeoutTimer);
        this._releaseHandlers();
        this._endTime = Date.now();
        this._status = PreflightTest.Status.Failed;
        this._log.debug("#".concat(PreflightTest.Events.Failed), error);
        this.emit(PreflightTest.Events.Failed, error);
    };
    /**
     * Called when the device goes offline.
     * This indicates that the test has been completed, but we won't know if it failed or not.
     * The onError event will be the indicator whether the test failed.
     */
    PreflightTest.prototype._onUnregistered = function () {
        var _this = this;
        // We need to make sure we always execute preflight.on('completed') last
        // as client SDK sometimes emits 'offline' event before emitting fatal errors.
        setTimeout(function () {
            if (_this._status === PreflightTest.Status.Failed) {
                return;
            }
            clearTimeout(_this._echoTimer);
            clearTimeout(_this._signalingTimeoutTimer);
            _this._releaseHandlers();
            _this._endTime = Date.now();
            _this._status = PreflightTest.Status.Completed;
            _this._report = _this._getReport();
            _this._log.debug("#".concat(PreflightTest.Events.Completed), JSON.stringify(_this._report));
            _this.emit(PreflightTest.Events.Completed, _this._report);
        }, 10);
    };
    /**
     * Clean up all handlers for device and call
     */
    PreflightTest.prototype._releaseHandlers = function () {
        [this._device, this._call].forEach(function (emitter) {
            if (emitter) {
                emitter.eventNames().forEach(function (name) { return emitter.removeAllListeners(name); });
            }
        });
    };
    /**
     * Setup the event handlers for the {@link Call} of the test call
     * @param call
     */
    PreflightTest.prototype._setupCallHandlers = function (call) {
        var _this = this;
        if (this._options.fakeMicInput) {
            // When volume events start emitting, it means all audio outputs have been created.
            // Let's mute them if we're using fake mic input.
            call.once('volume', function () {
                call['_mediaHandler'].outputs
                    .forEach(function (output) { return output.audio.muted = true; });
            });
        }
        call.on('warning', function (name, data) {
            _this._emitWarning(name, 'Received an RTCWarning. See .rtcWarning for the RTCWarning', data);
        });
        call.once('accept', function () {
            _this._callSid = call['_mediaHandler'].callSid;
            _this._status = PreflightTest.Status.Connected;
            _this._log.debug("#".concat(PreflightTest.Events.Connected));
            _this.emit(PreflightTest.Events.Connected);
        });
        call.on('sample', function (sample) { return __awaiter(_this, void 0, void 0, function () {
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!!this._latestSample) return [3 /*break*/, 2];
                        _a = this;
                        return [4 /*yield*/, (this._options.getRTCIceCandidateStatsReport || stats_1.getRTCIceCandidateStatsReport)(call['_mediaHandler'].version.pc)];
                    case 1:
                        _a._rtcIceCandidateStatsReport = _b.sent();
                        _b.label = 2;
                    case 2:
                        this._latestSample = sample;
                        this._samples.push(sample);
                        this._log.debug("#".concat(PreflightTest.Events.Sample), JSON.stringify(sample));
                        this.emit(PreflightTest.Events.Sample, sample);
                        return [2 /*return*/];
                }
            });
        }); });
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
            }].forEach(function (_a) {
            var type = _a.type, reportLabel = _a.reportLabel;
            var handlerName = "on".concat(type, "statechange");
            var originalHandler = call['_mediaHandler'][handlerName];
            call['_mediaHandler'][handlerName] = function (state) {
                var timing = _this._networkTiming[reportLabel]
                    = _this._networkTiming[reportLabel] || { start: 0 };
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
    };
    Object.defineProperty(PreflightTest.prototype, "callSid", {
        /**
         * The callsid generated for the test call.
         */
        get: function () {
            return this._callSid;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PreflightTest.prototype, "endTime", {
        /**
         * A timestamp in milliseconds of when the test ended.
         */
        get: function () {
            return this._endTime;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PreflightTest.prototype, "latestSample", {
        /**
         * The latest WebRTC sample collected.
         */
        get: function () {
            return this._latestSample;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PreflightTest.prototype, "report", {
        /**
         * The report for this test.
         */
        get: function () {
            return this._report;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PreflightTest.prototype, "startTime", {
        /**
         * A timestamp in milliseconds of when the test started.
         */
        get: function () {
            return this._startTime;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PreflightTest.prototype, "status", {
        /**
         * The status of the test.
         */
        get: function () {
            return this._status;
        },
        enumerable: false,
        configurable: true
    });
    return PreflightTest;
}(events_1.EventEmitter));
exports.PreflightTest = PreflightTest;
/**
 * @mergeModuleWith PreflightTest
 */
(function (PreflightTest) {
    /**
     * The quality of the call determined by different mos ranges.
     * Mos is calculated base on the WebRTC stats - rtt, jitter, and packet lost.
     */
    var CallQuality;
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
    var Events;
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
    var Status;
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
})(PreflightTest || (exports.PreflightTest = PreflightTest = {}));
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmxpZ2h0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9wcmVmbGlnaHQvcHJlZmxpZ2h0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaUNBQXNDO0FBQ3RDLGdDQUEyQjtBQUMzQixvQ0FBMkQ7QUFDM0Qsb0NBS21CO0FBQ25CLDhCQUF5QjtBQUd6QixzQ0FBNkQ7QUFLN0QsMENBQXFFO0FBOERyRTs7R0FFRztBQUNIO0lBQW1DLGlDQUFZO0lBa0c3Qzs7OztPQUlHO0lBQ0gsdUJBQVksS0FBYSxFQUFFLE9BQXNDO1FBQy9ELFlBQUEsTUFBSyxXQUFFLFNBQUM7UUF4RVY7O1dBRUc7UUFDSyx5QkFBbUIsR0FBWSxLQUFLLENBQUM7UUFPN0M7O1dBRUc7UUFDSyxVQUFJLEdBQVEsSUFBSSxhQUFHLENBQUMsZUFBZSxDQUFDLENBQUM7UUFFN0M7O1dBRUc7UUFDSyxvQkFBYyxHQUFrQixFQUFFLENBQUM7UUFFM0M7O1dBRUc7UUFDSyxjQUFRLEdBQWtDO1lBQ2hELGdCQUFnQixFQUFFLENBQUMsY0FBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsY0FBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUM7WUFDcEQsSUFBSSxFQUFFLFNBQVM7WUFDZixZQUFZLEVBQUUsS0FBSztZQUNuQixRQUFRLEVBQUUsT0FBTztZQUNqQixrQkFBa0IsRUFBRSxLQUFLO1NBQzFCLENBQUM7UUEyQkY7O1dBRUc7UUFDSyxhQUFPLEdBQXlCLGFBQWEsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDO1FBZXRFLE1BQU0sQ0FBQyxNQUFNLENBQUMsS0FBSSxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztRQUV0QyxLQUFJLENBQUMsUUFBUSxHQUFHLEVBQUUsQ0FBQztRQUNuQixLQUFJLENBQUMsU0FB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