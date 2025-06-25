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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = require("events");
var errors_1 = require("./errors");
var mos_1 = require("./rtc/mos");
var stats_1 = require("./rtc/stats");
var util_1 = require("./util");
// How many samples we use when testing metric thresholds
var SAMPLE_COUNT_METRICS = 5;
// How many samples that need to cross the threshold to
// raise or clear a warning.
var SAMPLE_COUNT_CLEAR = 0;
var SAMPLE_COUNT_RAISE = 3;
var SAMPLE_INTERVAL = 1000;
var WARNING_TIMEOUT = 5 * 1000;
var DEFAULT_THRESHOLDS = {
    audioInputLevel: { minStandardDeviation: 327.67, sampleCount: 10 },
    audioOutputLevel: { minStandardDeviation: 327.67, sampleCount: 10 },
    bytesReceived: { clearCount: 2, min: 1, raiseCount: 3, sampleCount: 3 },
    bytesSent: { clearCount: 2, min: 1, raiseCount: 3, sampleCount: 3 },
    jitter: { max: 30 },
    mos: { min: 3 },
    packetsLostFraction: [{
            max: 1,
        }, {
            clearValue: 1,
            maxAverage: 3,
            sampleCount: 7,
        }],
    rtt: { max: 400 },
};
/**
 * Count the number of values that cross the max threshold.
 * @private
 * @param max - The max allowable value.
 * @param values - The values to iterate over.
 * @returns The amount of values in which the stat crossed the threshold.
 */
function countHigh(max, values) {
    return values.reduce(function (highCount, value) { return highCount += (value > max) ? 1 : 0; }, 0);
}
/**
 * Count the number of values that cross the min threshold.
 * @private
 * @param min - The minimum allowable value.
 * @param values - The values to iterate over.
 * @returns The amount of values in which the stat crossed the threshold.
 */
function countLow(min, values) {
    return values.reduce(function (lowCount, value) { return lowCount += (value < min) ? 1 : 0; }, 0);
}
/**
 * Calculate the standard deviation from a list of numbers.
 * @private
 * @param values The list of numbers to calculate the standard deviation from.
 * @returns The standard deviation of a list of numbers.
 */
function calculateStandardDeviation(values) {
    if (values.length <= 0) {
        return null;
    }
    var valueAverage = values.reduce(function (partialSum, value) { return partialSum + value; }, 0) / values.length;
    var diffSquared = values.map(function (value) { return Math.pow(value - valueAverage, 2); });
    var stdDev = Math.sqrt(diffSquared.reduce(function (partialSum, value) { return partialSum + value; }, 0) / diffSquared.length);
    return stdDev;
}
/**
 * Flatten a set of numerical sample sets into a single array of samples.
 * @param sampleSets
 */
function flattenSamples(sampleSets) {
    return sampleSets.reduce(function (flat, current) { return __spreadArray(__spreadArray([], flat, true), current, true); }, []);
}
/**
 * {@link StatsMonitor} polls a peerConnection via PeerConnection.getStats
 * and emits warnings when stats cross the specified threshold values.
 */
var StatsMonitor = /** @class */ (function (_super) {
    __extends(StatsMonitor, _super);
    /**
     * @constructor
     * @param [options] - Optional settings
     */
    function StatsMonitor(options) {
        var _this = _super.call(this) || this;
        /**
         * A map of warnings with their raised time
         */
        _this._activeWarnings = new Map();
        /**
         * A map of stats with the number of exceeded thresholds
         */
        _this._currentStreaks = new Map();
        /**
         * Keeps track of input volumes in the last second
         */
        _this._inputVolumes = [];
        /**
         * Keeps track of output volumes in the last second
         */
        _this._outputVolumes = [];
        /**
         * Sample buffer. Saves most recent samples
         */
        _this._sampleBuffer = [];
        /**
         * Keeps track of supplemental sample values.
         *
         * Currently used for constant audio detection. Contains an array of volume
         * samples for each sample interval.
         */
        _this._supplementalSampleBuffers = {
            audioInputLevel: [],
            audioOutputLevel: [],
        };
        /**
         * Whether warnings should be enabled
         */
        _this._warningsEnabled = true;
        options = options || {};
        _this._getRTCStats = options.getRTCStats || stats_1.getRTCStats;
        _this._mos = options.Mos || mos_1.default;
        _this._peerConnection = options.peerConnection;
        _this._thresholds = __assign(__assign({}, DEFAULT_THRESHOLDS), options.thresholds);
        var thresholdSampleCounts = Object.values(_this._thresholds)
            .map(function (threshold) { return threshold.sampleCount; })
            .filter(function (sampleCount) { return !!sampleCount; });
        _this._maxSampleCount = Math.max.apply(Math, __spreadArray([SAMPLE_COUNT_METRICS], thresholdSampleCounts, false));
        if (_this._peerConnection) {
            _this.enable(_this._peerConnection);
        }
        return _this;
    }
    /**
     * Called when a volume sample is available
     * @param inputVolume - Input volume level from 0 to 32767
     * @param outputVolume - Output volume level from 0 to 32767
     */
    StatsMonitor.prototype.addVolumes = function (inputVolume, outputVolume) {
        this._inputVolumes.push(inputVolume);
        this._outputVolumes.push(outputVolume);
    };
    /**
     * Stop sampling RTC statistics for this {@link StatsMonitor}.
     * @returns The current {@link StatsMonitor}.
     */
    StatsMonitor.prototype.disable = function () {
        if (this._sampleInterval) {
            clearInterval(this._sampleInterval);
            delete this._sampleInterval;
        }
        return this;
    };
    /**
     * Disable warnings for this {@link StatsMonitor}.
     * @returns The current {@link StatsMonitor}.
     */
    StatsMonitor.prototype.disableWarnings = function () {
        if (this._warningsEnabled) {
            this._activeWarnings.clear();
        }
        this._warningsEnabled = false;
        return this;
    };
    /**
     * Start sampling RTC statistics for this {@link StatsMonitor}.
     * @param peerConnection - A PeerConnection to monitor.
     * @returns The current {@link StatsMonitor}.
     */
    StatsMonitor.prototype.enable = function (peerConnection) {
        if (peerConnection) {
            if (this._peerConnection && peerConnection !== this._peerConnection) {
                throw new errors_1.InvalidArgumentError('Attempted to replace an existing PeerConnection in StatsMonitor.enable');
            }
            this._peerConnection = peerConnection;
        }
        if (!this._peerConnection) {
            throw new errors_1.InvalidArgumentError('Can not enable StatsMonitor without a PeerConnection');
        }
        this._sampleInterval = this._sampleInterval ||
            setInterval(this._fetchSample.bind(this), SAMPLE_INTERVAL);
        return this;
    };
    /**
     * Enable warnings for this {@link StatsMonitor}.
     * @returns The current {@link StatsMonitor}.
     */
    StatsMonitor.prototype.enableWarnings = function () {
        this._warningsEnabled = true;
        return this;
    };
    /**
     * Check if there is an active warning for a specific stat and threshold
     * @param statName - The name of the stat to check
     * @param thresholdName - The name of the threshold to check
     * @returns Whether there is an active warning for a specific stat and threshold
     */
    StatsMonitor.prototype.hasActiveWarning = function (statName, thresholdName) {
        var warningId = "".concat(statName, ":").concat(thresholdName);
        return !!this._activeWarnings.get(warningId);
    };
    /**
     * Add a sample to our sample buffer and remove the oldest if we are over the limit.
     * @param sample - Sample to add
     */
    StatsMonitor.prototype._addSample = function (sample) {
        var samples = this._sampleBuffer;
        samples.push(sample);
        // We store 1 extra sample so that we always have (current, previous)
        // available for all {sampleBufferSize} threshold validations.
        if (samples.length > this._maxSampleCount) {
            samples.splice(0, samples.length - this._maxSampleCount);
        }
    };
    /**
     * Clear an active warning.
     * @param statName - The name of the stat to clear.
     * @param thresholdName - The name of the threshold to clear
     * @param [data] - Any relevant sample data.
     */
    StatsMonitor.prototype._clearWarning = function (statName, thresholdName, data) {
        var warningId = "".concat(statName, ":").concat(thresholdName);
        var activeWarning = this._activeWarnings.get(warningId);
        if (!activeWarning || Date.now() - activeWarning.timeRaised < WARNING_TIMEOUT) {
            return;
        }
        this._activeWarnings.delete(warningId);
        this.emit('warning-cleared', __assign(__assign({}, data), { name: statName, threshold: {
                name: thresholdName,
                value: this._thresholds[statName][thresholdName],
            } }));
    };
    /**
     * Create a sample object from a stats object using the previous sample, if available.
     * @param stats - Stats retrieved from getStatistics
     * @param [previousSample=null] - The previous sample to use to calculate deltas.
     * @returns A universally-formatted version of RTC stats.
     */
    StatsMonitor.prototype._createSample = function (stats, previousSample) {
        var previousBytesSent = previousSample && previousSample.totals.bytesSent || 0;
        var previousBytesReceived = previousSample && previousSample.totals.bytesReceived || 0;
        var previousPacketsSent = previousSample && previousSample.totals.packetsSent || 0;
        var previousPacketsReceived = previousSample && previousSample.totals.packetsReceived || 0;
        var previousPacketsLost = previousSample && previousSample.totals.packetsLost || 0;
        var currentBytesSent = stats.bytesSent - previousBytesSent;
        var currentBytesReceived = stats.bytesReceived - previousBytesReceived;
        var currentPacketsSent = stats.packetsSent - previousPacketsSent;
        var currentPacketsReceived = stats.packetsReceived - previousPacketsReceived;
        var currentPacketsLost = stats.packetsLost - previousPacketsLost;
        var currentInboundPackets = currentPacketsReceived + currentPacketsLost;
        var currentPacketsLostFraction = (currentInboundPackets > 0) ?
            (currentPacketsLost / currentInboundPackets) * 100 : 0;
        var totalInboundPackets = stats.packetsReceived + stats.packetsLost;
        var totalPacketsLostFraction = (totalInboundPackets > 0) ?
            (stats.packetsLost / totalInboundPackets) * 100 : 100;
        var rttValue = (typeof stats.rtt === 'number' || !previousSample) ? stats.rtt : previousSample.rtt;
        var audioInputLevelValues = this._inputVolumes.splice(0);
        this._supplementalSampleBuffers.audioInputLevel.push(audioInputLevelValues);
        var audioOutputLevelValues = this._outputVolumes.splice(0);
        this._supplementalSampleBuffers.audioOutputLevel.push(audioOutputLevelValues);
        return {
            audioInputLevel: Math.round((0, util_1.average)(audioInputLevelValues)),
            audioOutputLevel: Math.round((0, util_1.average)(audioOutputLevelValues)),
            bytesReceived: currentBytesReceived,
            bytesSent: currentBytesSent,
            codecName: stats.codecName,
            jitter: stats.jitter,
            mos: this._mos.calculate(rttValue, stats.jitter, previousSample && currentPacketsLostFraction),
            packetsLost: currentPacketsLost,
            packetsLostFraction: currentPacketsLostFraction,
            packetsReceived: currentPacketsReceived,
            packetsSent: currentPacketsSent,
            rtt: rttValue,
            timestamp: stats.timestamp,
            totals: {
                bytesReceived: stats.bytesReceived,
                bytesSent: stats.bytesSent,
                packetsLost: stats.packetsLost,
                packetsLostFraction: totalPacketsLostFraction,
                packetsReceived: stats.packetsReceived,
                packetsSent: stats.packetsSent,
            },
        };
    };
    /**
     * Get stats from the PeerConnection and add it to our list of samples.
     */
    StatsMonitor.prototype._fetchSample = function () {
        var _this = this;
        this._getSample().then(function (sample) {
            _this._addSample(sample);
            _this._raiseWarnings();
            _this.emit('sample', sample);
        }).catch(function (error) {
            _this.disable();
            // We only bubble up any errors coming from pc.getStats()
            // No need to attach a twilioError
            _this.emit('error', error);
        });
    };
    /**
     * Get stats from the PeerConnection.
     * @returns A universally-formatted version of RTC stats.
     */
    StatsMonitor.prototype._getSample = function () {
        var _this = this;
        return this._getRTCStats(this._peerConnection).then(function (stats) {
            var previousSample = null;
            if (_this._sampleBuffer.length) {
                previousSample = _this._sampleBuffer[_this._sampleBuffer.length - 1];
            }
            return _this._createSample(stats, previousSample);
        });
    };
    /**
     * Raise a warning and log its raised time.
     * @param statName - The name of the stat to raise.
     * @param thresholdName - The name of the threshold to raise
     * @param [data] - Any relevant sample data.
     */
    StatsMonitor.prototype._raiseWarning = function (statName, thresholdName, data) {
        var warningId = "".concat(statName, ":").concat(thresholdName);
        if (this._activeWarnings.has(warningId)) {
            return;
        }
        this._activeWarnings.set(warningId, { timeRaised: Date.now() });
        var thresholds = this._thresholds[statName];
        var thresholdValue;
        if (Array.isArray(thresholds)) {
            var foundThreshold = thresholds.find(function (threshold) { return thresholdName in threshold; });
            if (foundThreshold) {
                thresholdValue = foundThreshold[thresholdName];
            }
        }
        else {
            thresholdValue = this._thresholds[statName][thresholdName];
        }
        this.emit('warning', __assign(__assign({}, data), { name: statName, threshold: {
                name: thresholdName,
                value: thresholdValue,
            } }));
    };
    /**
     * Apply our thresholds to our array of RTCStat samples.
     */
    StatsMonitor.prototype._raiseWarnings = function () {
        var _this = this;
        if (!this._warningsEnabled) {
            return;
        }
        Object.keys(this._thresholds).forEach(function (name) { return _this._raiseWarningsForStat(name); });
    };
    /**
     * Apply thresholds for a given stat name to our array of
     * RTCStat samples and raise or clear any associated warnings.
     * @param statName - Name of the stat to compare.
     */
    StatsMonitor.prototype._raiseWarningsForStat = function (statName) {
        var _this = this;
        var limits = Array.isArray(this._thresholds[statName])
            ? this._thresholds[statName]
            : [this._thresholds[statName]];
        limits.forEach(function (limit) {
            var samples = _this._sampleBuffer;
            var clearCount = limit.clearCount || SAMPLE_COUNT_CLEAR;
            var raiseCount = limit.raiseCount || SAMPLE_COUNT_RAISE;
            var sampleCount = limit.sampleCount || _this._maxSampleCount;
            var relevantSamples = samples.slice(-sampleCount);
            var values = relevantSamples.map(function (sample) { return sample[statName]; });
            // (rrowland) If we have a bad or missing value in the set, we don't
            // have enough information to throw or clear a warning. Bail out.
            var containsNull = values.some(function (value) { return typeof value === 'undefined' || value === null; });
            if (containsNull) {
                return;
            }
            var count;
            if (typeof limit.max === 'number') {
                count = countHigh(limit.max, values);
                if (count >= raiseCount) {
                    _this._raiseWarning(statName, 'max', { values: values, samples: relevantSamples });
                }
                else if (count <= clearCount) {
                    _this._clearWarning(statName, 'max', { values: values, samples: relevantSamples });
                }
            }
            if (typeof limit.min === 'number') {
                count = countLow(limit.min, values);
                if (count >= raiseCount) {
                    _this._raiseWarning(statName, 'min', { values: values, samples: relevantSamples });
                }
                else if (count <= clearCount) {
                    _this._clearWarning(statName, 'min', { values: values, samples: relevantSamples });
                }
            }
            if (typeof limit.maxDuration === 'number' && samples.length > 1) {
                relevantSamples = samples.slice(-2);
                var prevValue = relevantSamples[0][statName];
                var curValue = relevantSamples[1][statName];
                var prevStreak = _this._currentStreaks.get(statName) || 0;
                var streak = (prevValue === curValue) ? prevStreak + 1 : 0;
                _this._currentStreaks.set(statName, streak);
                if (streak >= limit.maxDuration) {
                    _this._raiseWarning(statName, 'maxDuration', { value: streak });
                }
                else if (streak === 0) {
                    _this._clearWarning(statName, 'maxDuration', { value: prevStreak });
                }
            }
            if (typeof limit.minStandardDeviation === 'number') {
                var sampleSets = _this._supplementalSampleBuffers[statName];
                if (!sampleSets || sampleSets.length < limit.sampleCount) {
                    return;
                }
                if (sampleSets.length > limit.sampleCount) {
                    sampleSets.splice(0, sampleSets.length - limit.sampleCount);
                }
                var flatSamples = flattenSamples(sampleSets.slice(-sampleCount));
                var stdDev = calculateStandardDeviation(flatSamples);
                if (typeof stdDev !== 'number') {
                    return;
                }
                if (stdDev < limit.minStandardDeviation) {
                    _this._raiseWarning(statName, 'minStandardDeviation', { value: stdDev });
                }
                else {
                    _this._clearWarning(statName, 'minStandardDeviation', { value: stdDev });
                }
            }
            [
                ['maxAverage', function (x, y) { return x > y; }],
                ['minAverage', function (x, y) { return x < y; }],
            ].forEach(function (_a) {
                var thresholdName = _a[0], comparator = _a[1];
                if (typeof limit[thresholdName] === 'number' && values.length >= sampleCount) {
                    var avg = (0, util_1.average)(values);
                    if (comparator(avg, limit[thresholdName])) {
                        _this._raiseWarning(statName, thresholdName, { values: values, samples: relevantSamples });
                    }
                    else if (!comparator(avg, limit.clearValue || limit[thresholdName])) {
                        _this._clearWarning(statName, thresholdName, { values: values, samples: relevantSamples });
                    }
                }
            });
        });
    };
    return StatsMonitor;
}(events_1.EventEmitter));
exports.default = StatsMonitor;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHNNb25pdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9zdGF0c01vbml0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLGlDQUFzQztBQUN0QyxtQ0FBZ0Q7QUFDaEQsaUNBQTRCO0FBRTVCLHFDQUEwQztBQUUxQywrQkFBaUM7QUFFakMseURBQXlEO0FBQ3pELElBQU0sb0JBQW9CLEdBQUcsQ0FBQyxDQUFDO0FBRS9CLHVEQUF1RDtBQUN2RCw0QkFBNEI7QUFDNUIsSUFBTSxrQkFBa0IsR0FBRyxDQUFDLENBQUM7QUFDN0IsSUFBTSxrQkFBa0IsR0FBRyxDQUFDLENBQUM7QUFFN0IsSUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDO0FBQzdCLElBQU0sZUFBZSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUM7QUFFakMsSUFBTSxrQkFBa0IsR0FBa0M7SUFDeEQsZUFBZSxFQUFFLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUU7SUFDbEUsZ0JBQWdCLEVBQUUsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLEVBQUUsRUFBRTtJQUNuRSxhQUFhLEVBQUUsRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxFQUFFO0lBQ3ZFLFNBQVMsRUFBRSxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLEVBQUU7SUFDbkUsTUFBTSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRTtJQUNuQixHQUFHLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO0lBQ2YsbUJBQW1CLEVBQUUsQ0FBQztZQUNwQixH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