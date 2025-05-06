"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
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
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
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
/**
 * @packageDocumentation
 * @module Voice
 * @preferred
 * @publicapi
 */
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
     * @constructor
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
        this._log.debug("#" + PreflightTest.Events.Warning, JSON.stringify(warning));
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
        this._log.debug("#" + PreflightTest.Events.Failed, error);
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
            _this._log.debug("#" + PreflightTest.Events.Completed, JSON.stringify(_this._report));
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
            _this._log.debug("#" + PreflightTest.Events.Connected);
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
                        this._log.debug("#" + PreflightTest.Events.Sample, JSON.stringify(sample));
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
            var handlerName = "on" + type + "statechange";
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
})(PreflightTest = exports.PreflightTest || (exports.PreflightTest = {}));
exports.PreflightTest = PreflightTest;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmxpZ2h0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9wcmVmbGlnaHQvcHJlZmxpZ2h0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBOzs7OztHQUtHO0FBQ0gsaUNBQXNDO0FBQ3RDLGdDQUEyQjtBQUMzQixvQ0FBMkQ7QUFDM0Qsb0NBS21CO0FBQ25CLDhCQUF5QjtBQUd6QixzQ0FBNkQ7QUFLN0QsMENBQXFFO0FBNERyRTs7R0FFRztBQUNIO0lBQW1DLGlDQUFZO0lBa0c3Qzs7Ozs7T0FLRztJQUNILHVCQUFZLEtBQWEsRUFBRSxPQUFzQztRQUFqRSxZQUNFLGlCQUFPLFNBMkNSO1FBcEhEOztXQUVHO1FBQ0sseUJBQW1CLEdBQVksS0FBSyxDQUFDO1FBTzdDOztXQUVHO1FBQ0ssVUFBSSxHQUFRLElBQUksYUFBRyxDQUFDLGVBQWUsQ0FBQyxDQUFDO1FBRTdDOztXQUVHO1FBQ0ssb0JBQWMsR0FBa0IsRUFBRSxDQUFDO1FBRTNDOztXQUVHO1FBQ0ssY0FBUSxHQUFrQztZQUNoRCxnQkFBZ0IsRUFBRSxDQUFDLGNBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLGNBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO1lBQ3BELElBQUksRUFBRSxTQUFTO1lBQ2YsWUFBWSxFQUFFLEtBQUs7WUFDbkIsUUFBUSxFQUFFLE9BQU87WUFDakIsa0JBQWtCLEVBQUUsS0FBSztTQUMxQixDQUFDO1FBMkJGOztXQUVHO1FBQ0ssYUFBTyxHQUF5QixhQUFhLENBQUMsTUFBTSxDQUFDLFVBQVUsQ0FBQztRQWdCdEUsTUFBTSxDQUFDLE1BQU0sQ0FBQyxLQUFJLENBQUMsUUFBUSxFQUFFLE9BQU8sQ0FBQyxDQUFDO1FBRXRDLEtBQUksQ0FBQyxRQUFRLEdBQUcsRUFBRSxDQUFDO1FBQ25CLEtB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