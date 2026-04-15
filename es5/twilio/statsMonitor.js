'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var events = require('events');
var index = require('./errors/index.js');
var mos = require('./rtc/mos.js');
var stats = require('./rtc/stats.js');
var util = require('./util.js');

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
    return sampleSets.reduce(function (flat, current) { return tslib.__spreadArray(tslib.__spreadArray([], flat, true), current, true); }, []);
}
/**
 * {@link StatsMonitor} polls a peerConnection via PeerConnection.getStats
 * and emits warnings when stats cross the specified threshold values.
 */
var StatsMonitor = /** @class */ (function (_super) {
    tslib.__extends(StatsMonitor, _super);
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
        _this._getRTCStats = options.getRTCStats || stats.getRTCStats;
        _this._mos = options.Mos || mos.default;
        _this._peerConnection = options.peerConnection;
        _this._thresholds = tslib.__assign(tslib.__assign({}, DEFAULT_THRESHOLDS), options.thresholds);
        var thresholdSampleCounts = Object.values(_this._thresholds)
            .map(function (threshold) { return threshold.sampleCount; })
            .filter(function (sampleCount) { return !!sampleCount; });
        _this._maxSampleCount = Math.max.apply(Math, tslib.__spreadArray([SAMPLE_COUNT_METRICS], thresholdSampleCounts, false));
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
                throw new index.InvalidArgumentError('Attempted to replace an existing PeerConnection in StatsMonitor.enable');
            }
            this._peerConnection = peerConnection;
        }
        if (!this._peerConnection) {
            throw new index.InvalidArgumentError('Can not enable StatsMonitor without a PeerConnection');
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
        this.emit('warning-cleared', tslib.__assign(tslib.__assign({}, data), { name: statName, threshold: {
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
            audioInputLevel: Math.round(util.average(audioInputLevelValues)),
            audioOutputLevel: Math.round(util.average(audioOutputLevelValues)),
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
        this.emit('warning', tslib.__assign(tslib.__assign({}, data), { name: statName, threshold: {
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
                    var avg = util.average(values);
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
}(events.EventEmitter));

exports.default = StatsMonitor;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHNNb25pdG9yLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL3N0YXRzTW9uaXRvci50cyJdLCJzb3VyY2VzQ29udGVudCI6W251bGxdLCJuYW1lcyI6WyJfX3NwcmVhZEFycmF5IiwiX19leHRlbmRzIiwiZ2V0UlRDU3RhdHMiLCJNb3MiLCJfX2Fzc2lnbiIsIkludmFsaWRBcmd1bWVudEVycm9yIiwiYXZlcmFnZSIsIkV2ZW50RW1pdHRlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFRQTtBQUNBLElBQU0sb0JBQW9CLEdBQUcsQ0FBQztBQUU5QjtBQUNBO0FBQ0EsSUFBTSxrQkFBa0IsR0FBRyxDQUFDO0FBQzVCLElBQU0sa0JBQWtCLEdBQUcsQ0FBQztBQUU1QixJQUFNLGVBQWUsR0FBRyxJQUFJO0FBQzVCLElBQU0sZUFBZSxHQUFHLENBQUMsR0FBRyxJQUFJO0FBRWhDLElBQU0sa0JBQWtCLEdBQWtDO0lBQ3hELGVBQWUsRUFBRSxFQUFFLG9CQUFvQixFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsRUFBRSxFQUFFO0lBQ2xFLGdCQUFnQixFQUFFLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUU7QUFDbkUsSUFBQSxhQUFhLEVBQUUsRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxFQUFFO0FBQ3ZFLElBQUEsU0FBUyxFQUFFLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsV0FBVyxFQUFFLENBQUMsRUFBRTtBQUNuRSxJQUFBLE1BQU0sRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUU7QUFDbkIsSUFBQSxHQUFHLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO0FBQ2YsSUFBQSxtQkFBbUIsRUFBRSxDQUFDO0FBQ3BCLFlB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
