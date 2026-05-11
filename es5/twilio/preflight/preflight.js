'use strict';

var tslib = require('tslib');
var events = require('events');
var call = require('../call.js');
var device = require('../device.js');
var index = require('../errors/index.js');
var log = require('../log.js');
var stats = require('../rtc/stats.js');
var constants = require('../constants.js');
var generated = require('../errors/generated.js');

/**
 * Runs some tests to identify issues, if any, prohibiting successful calling.
 */
exports.PreflightTest = /** @class */ (function (_super) {
    tslib.__extends(PreflightTest, _super);
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
        _this._log = new log.default('PreflightTest');
        /**
         * Network related timing measurements for this test
         */
        _this._networkTiming = {};
        /**
         * The options passed to {@link PreflightTest} constructor
         */
        _this._options = {
            codecPreferences: [call.default.Codec.PCMU, call.default.Codec.Opus],
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
        _this._initDevice(token, tslib.__assign(tslib.__assign({}, _this._options), { fileInputStream: _this._options.fakeMicInput ?
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
            var toLog_1 = tslib.__assign({}, options);
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
        var error = new generated.GeneralErrors.CallCancelledError();
        if (this._device) {
            this._device.once(device.default.EventName.Unregistered, function () { return _this._onFailed(error); });
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
        return tslib.__assign({}, this._latestSample.totals);
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
            return tslib.__assign(tslib.__assign({}, statObj), (_a = {}, _a[stat] = {
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
            throw new index.NotSupportedError('Cannot fake input audio stream: AudioContext is not supported by this browser.');
        }
        var audioEl = new Audio(constants.COWBELL_AUDIO_URL);
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
            this._device = new (options.deviceFactory || device.default)(token, {
                chunderw: options.chunderw,
                codecPreferences: options.codecPreferences,
                edge: options.edge,
                eventgw: options.eventgw,
                fileInputStream: options.fileInputStream,
                logLevel: options.logLevel,
                preflight: true,
            });
            this._device.once(device.default.EventName.Registered, function () {
                _this._onDeviceRegistered();
            });
            this._device.once(device.default.EventName.Error, function (error) {
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
            _this._onDeviceError(new generated.SignalingErrors.ConnectionError('WebSocket Connection Timeout'));
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
        return tslib.__awaiter(this, void 0, void 0, function () {
            var _a, audio, publisher;
            var _this = this;
            return tslib.__generator(this, function (_b) {
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
                            this._echoTimer = setTimeout(function () { return _this._device.disconnectAll(); }, constants.ECHO_TEST_DURATION);
                            audio = this._device.audio;
                            if (audio) {
                                audio.disconnect(false);
                                audio.outgoing(false);
                            }
                        }
                        this._call.once('disconnect', function () {
                            _this._device.once(device.default.EventName.Unregistered, function () { return _this._onUnregistered(); });
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
        call.on('sample', function (sample) { return tslib.__awaiter(_this, void 0, void 0, function () {
            var _a;
            return tslib.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!!this._latestSample) return [3 /*break*/, 2];
                        _a = this;
                        return [4 /*yield*/, (this._options.getRTCIceCandidateStatsReport || stats.getRTCIceCandidateStatsReport)(call['_mediaHandler'].version.pc)];
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
}(events.EventEmitter));
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
})(exports.PreflightTest || (exports.PreflightTest = {}));
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHJlZmxpZ2h0LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3ByZWZsaWdodC9wcmVmbGlnaHQudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOlsiUHJlZmxpZ2h0VGVzdCIsIl9fZXh0ZW5kcyIsIkxvZyIsIkNhbGwiLCJfX2Fzc2lnbiIsIkdlbmVyYWxFcnJvcnMiLCJEZXZpY2UiLCJOb3RTdXBwb3J0ZWRFcnJvciIsIkNPV0JFTExfQVVESU9fVVJMIiwiU2lnbmFsaW5nRXJyb3JzIiwiRUNIT19URVNUX0RVUkFUSU9OIiwiX19hd2FpdGVyIiwiZ2V0UlRDSWNlQ2FuZGlkYXRlU3RhdHNSZXBvcnQiLCJFdmVudEVtaXR0ZXIiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7OztBQStFQTs7QUFFRztBQUNIQSxxQkFBQSxrQkFBQSxVQUFBLE1BQUEsRUFBQTtJQUFtQ0MsZUFBQSxDQUFBLGFBQUEsRUFBQSxNQUFBLENBQUE7QUFrR2pDOzs7O0FBSUc7SUFDSCxTQUFBLGFBQUEsQ0FBWSxLQUFhLEVBQUUsT0FBc0MsRUFBQTtRQUMvRCxJQUFBLEtBQUEsR0FBQSxNQUFLLFdBQUUsSUFBQSxJQUFBO0FBeEVUOztBQUVHO1FBQ0ssS0FBQSxDQUFBLG1CQUFtQixHQUFZLEtBQUs7QUFPNUM7O0FBRUc7QUFDSyxRQUFBLEtBQUEsQ0FBQSxJQUFJLEdBQVEsSUFBSUMsV0FBRyxDQUFDLGVBQWUsQ0FBQztBQUU1Qzs7QUFFRztRQUNLLEtBQUEsQ0FBQSxjQUFjLEdBQWtCLEVBQUU7QUFFMUM7O0FBRUc7QUFDSyxRQUFBLEtBQUEsQ0FBQSxRQUFRLEdBQWtDO0FBQ2hELFlBQUEsZ0JBQWdCLEVBQUUsQ0FBQ0MsWUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUVBLFlBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDO0FBQ3BELFlBQUEsSUFBSSxFQUFFLFNBQVM7QUFDZixZQUFBLFlBQVksRUFBRSxLQUFLO0FBQ25CLFlBQUEsUUFBUSxF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
