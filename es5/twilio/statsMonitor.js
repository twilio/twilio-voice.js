"use strict";
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
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
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
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
    return sampleSets.reduce(function (flat, current) { return __spreadArrays(flat, current); }, []);
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
        _this._maxSampleCount = Math.max.apply(Math, __spreadArrays([SAMPLE_COUNT_METRICS], thresholdSampleCounts));
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
        var warningId = statName + ":" + thresholdName;
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
        var warningId = statName + ":" + thresholdName;
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
            audioInputLevel: Math.round(util_1.average(audioInputLevelValues)),
            audioOutputLevel: Math.round(util_1.average(audioOutputLevelValues)),
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
        var warningId = statName + ":" + thresholdName;
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
                    var avg = util_1.average(values);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHNNb25pdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9zdGF0c01vbml0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlDQUFzQztBQUN0QyxtQ0FBZ0Q7QUFDaEQsaUNBQTRCO0FBRTVCLHFDQUEwQztBQUUxQywrQkFBaUM7QUFFakMseURBQXlEO0FBQ3pELElBQU0sb0JBQW9CLEdBQUcsQ0FBQyxDQUFDO0FBRS9CLHVEQUF1RDtBQUN2RCw0QkFBNEI7QUFDNUIsSUFBTSxrQkFBa0IsR0FBRyxDQUFDLENBQUM7QUFDN0IsSUFBTSxrQkFBa0IsR0FBRyxDQUFDLENBQUM7QUFFN0IsSUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDO0FBQzdCLElBQU0sZUFBZSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUM7QUFFakMsSUFBTSxrQkFBa0IsR0FBa0M7SUFDeEQsZUFBZSxFQUFFLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUU7SUFDbEUsZ0JBQWdCLEVBQUUsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLEVBQUUsRUFBRTtJQUNuRSxhQUFhLEVBQUUsRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxFQUFFO0lBQ3ZFLFNBQVMsRUFBRSxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLEVBQUU7SUFDbkUsTUFBTSxFQUFFLEVBQUUsR0FBRyxFQUFFLEVBQUUsRUFBRTtJQUNuQixHQUFHLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO0lBQ2YsbUJBQW1CLEVBQUUsQ0FB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