import { EventEmitter } from 'events';
import { InvalidArgumentError } from './errors/index.js';
import Mos from './rtc/mos.js';
import { getRTCStats } from './rtc/stats.js';
import { average } from './util.js';

// How many samples we use when testing metric thresholds
const SAMPLE_COUNT_METRICS = 5;
// How many samples that need to cross the threshold to
// raise or clear a warning.
const SAMPLE_COUNT_CLEAR = 0;
const SAMPLE_COUNT_RAISE = 3;
const SAMPLE_INTERVAL = 1000;
const WARNING_TIMEOUT = 5 * 1000;
const DEFAULT_THRESHOLDS = {
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
    return values.reduce((highCount, value) => highCount += (value > max) ? 1 : 0, 0);
}
/**
 * Count the number of values that cross the min threshold.
 * @private
 * @param min - The minimum allowable value.
 * @param values - The values to iterate over.
 * @returns The amount of values in which the stat crossed the threshold.
 */
function countLow(min, values) {
    return values.reduce((lowCount, value) => lowCount += (value < min) ? 1 : 0, 0);
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
    const valueAverage = values.reduce((partialSum, value) => partialSum + value, 0) / values.length;
    const diffSquared = values.map((value) => Math.pow(value - valueAverage, 2));
    const stdDev = Math.sqrt(diffSquared.reduce((partialSum, value) => partialSum + value, 0) / diffSquared.length);
    return stdDev;
}
/**
 * Flatten a set of numerical sample sets into a single array of samples.
 * @param sampleSets
 */
function flattenSamples(sampleSets) {
    return sampleSets.reduce((flat, current) => [...flat, ...current], []);
}
/**
 * {@link StatsMonitor} polls a peerConnection via PeerConnection.getStats
 * and emits warnings when stats cross the specified threshold values.
 */
class StatsMonitor extends EventEmitter {
    /**
     * @constructor
     * @param [options] - Optional settings
     */
    constructor(options) {
        super();
        /**
         * A map of warnings with their raised time
         */
        this._activeWarnings = new Map();
        /**
         * A map of stats with the number of exceeded thresholds
         */
        this._currentStreaks = new Map();
        /**
         * Keeps track of input volumes in the last second
         */
        this._inputVolumes = [];
        /**
         * Keeps track of output volumes in the last second
         */
        this._outputVolumes = [];
        /**
         * Sample buffer. Saves most recent samples
         */
        this._sampleBuffer = [];
        /**
         * Keeps track of supplemental sample values.
         *
         * Currently used for constant audio detection. Contains an array of volume
         * samples for each sample interval.
         */
        this._supplementalSampleBuffers = {
            audioInputLevel: [],
            audioOutputLevel: [],
        };
        /**
         * Whether warnings should be enabled
         */
        this._warningsEnabled = true;
        options = options || {};
        this._getRTCStats = options.getRTCStats || getRTCStats;
        this._mos = options.Mos || Mos;
        this._peerConnection = options.peerConnection;
        this._thresholds = Object.assign(Object.assign({}, DEFAULT_THRESHOLDS), options.thresholds);
        const thresholdSampleCounts = Object.values(this._thresholds)
            .map((threshold) => threshold.sampleCount)
            .filter((sampleCount) => !!sampleCount);
        this._maxSampleCount = Math.max(SAMPLE_COUNT_METRICS, ...thresholdSampleCounts);
        if (this._peerConnection) {
            this.enable(this._peerConnection);
        }
    }
    /**
     * Called when a volume sample is available
     * @param inputVolume - Input volume level from 0 to 32767
     * @param outputVolume - Output volume level from 0 to 32767
     */
    addVolumes(inputVolume, outputVolume) {
        this._inputVolumes.push(inputVolume);
        this._outputVolumes.push(outputVolume);
    }
    /**
     * Stop sampling RTC statistics for this {@link StatsMonitor}.
     * @returns The current {@link StatsMonitor}.
     */
    disable() {
        if (this._sampleInterval) {
            clearInterval(this._sampleInterval);
            delete this._sampleInterval;
        }
        return this;
    }
    /**
     * Disable warnings for this {@link StatsMonitor}.
     * @returns The current {@link StatsMonitor}.
     */
    disableWarnings() {
        if (this._warningsEnabled) {
            this._activeWarnings.clear();
        }
        this._warningsEnabled = false;
        return this;
    }
    /**
     * Start sampling RTC statistics for this {@link StatsMonitor}.
     * @param peerConnection - A PeerConnection to monitor.
     * @returns The current {@link StatsMonitor}.
     */
    enable(peerConnection) {
        if (peerConnection) {
            if (this._peerConnection && peerConnection !== this._peerConnection) {
                throw new InvalidArgumentError('Attempted to replace an existing PeerConnection in StatsMonitor.enable');
            }
            this._peerConnection = peerConnection;
        }
        if (!this._peerConnection) {
            throw new InvalidArgumentError('Can not enable StatsMonitor without a PeerConnection');
        }
        this._sampleInterval = this._sampleInterval ||
            setInterval(this._fetchSample.bind(this), SAMPLE_INTERVAL);
        return this;
    }
    /**
     * Enable warnings for this {@link StatsMonitor}.
     * @returns The current {@link StatsMonitor}.
     */
    enableWarnings() {
        this._warningsEnabled = true;
        return this;
    }
    /**
     * Check if there is an active warning for a specific stat and threshold
     * @param statName - The name of the stat to check
     * @param thresholdName - The name of the threshold to check
     * @returns Whether there is an active warning for a specific stat and threshold
     */
    hasActiveWarning(statName, thresholdName) {
        const warningId = `${statName}:${thresholdName}`;
        return !!this._activeWarnings.get(warningId);
    }
    /**
     * Add a sample to our sample buffer and remove the oldest if we are over the limit.
     * @param sample - Sample to add
     */
    _addSample(sample) {
        const samples = this._sampleBuffer;
        samples.push(sample);
        // We store 1 extra sample so that we always have (current, previous)
        // available for all {sampleBufferSize} threshold validations.
        if (samples.length > this._maxSampleCount) {
            samples.splice(0, samples.length - this._maxSampleCount);
        }
    }
    /**
     * Clear an active warning.
     * @param statName - The name of the stat to clear.
     * @param thresholdName - The name of the threshold to clear
     * @param [data] - Any relevant sample data.
     */
    _clearWarning(statName, thresholdName, data) {
        const warningId = `${statName}:${thresholdName}`;
        const activeWarning = this._activeWarnings.get(warningId);
        if (!activeWarning || Date.now() - activeWarning.timeRaised < WARNING_TIMEOUT) {
            return;
        }
        this._activeWarnings.delete(warningId);
        this.emit('warning-cleared', Object.assign(Object.assign({}, data), { name: statName, threshold: {
                name: thresholdName,
                value: this._thresholds[statName][thresholdName],
            } }));
    }
    /**
     * Create a sample object from a stats object using the previous sample, if available.
     * @param stats - Stats retrieved from getStatistics
     * @param [previousSample=null] - The previous sample to use to calculate deltas.
     * @returns A universally-formatted version of RTC stats.
     */
    _createSample(stats, previousSample) {
        const previousBytesSent = previousSample && previousSample.totals.bytesSent || 0;
        const previousBytesReceived = previousSample && previousSample.totals.bytesReceived || 0;
        const previousPacketsSent = previousSample && previousSample.totals.packetsSent || 0;
        const previousPacketsReceived = previousSample && previousSample.totals.packetsReceived || 0;
        const previousPacketsLost = previousSample && previousSample.totals.packetsLost || 0;
        const currentBytesSent = stats.bytesSent - previousBytesSent;
        const currentBytesReceived = stats.bytesReceived - previousBytesReceived;
        const currentPacketsSent = stats.packetsSent - previousPacketsSent;
        const currentPacketsReceived = stats.packetsReceived - previousPacketsReceived;
        const currentPacketsLost = stats.packetsLost - previousPacketsLost;
        const currentInboundPackets = currentPacketsReceived + currentPacketsLost;
        const currentPacketsLostFraction = (currentInboundPackets > 0) ?
            (currentPacketsLost / currentInboundPackets) * 100 : 0;
        const totalInboundPackets = stats.packetsReceived + stats.packetsLost;
        const totalPacketsLostFraction = (totalInboundPackets > 0) ?
            (stats.packetsLost / totalInboundPackets) * 100 : 100;
        const rttValue = (typeof stats.rtt === 'number' || !previousSample) ? stats.rtt : previousSample.rtt;
        const audioInputLevelValues = this._inputVolumes.splice(0);
        this._supplementalSampleBuffers.audioInputLevel.push(audioInputLevelValues);
        const audioOutputLevelValues = this._outputVolumes.splice(0);
        this._supplementalSampleBuffers.audioOutputLevel.push(audioOutputLevelValues);
        return {
            audioInputLevel: Math.round(average(audioInputLevelValues)),
            audioOutputLevel: Math.round(average(audioOutputLevelValues)),
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
    }
    /**
     * Get stats from the PeerConnection and add it to our list of samples.
     */
    _fetchSample() {
        this._getSample().then(sample => {
            this._addSample(sample);
            this._raiseWarnings();
            this.emit('sample', sample);
        }).catch(error => {
            this.disable();
            // We only bubble up any errors coming from pc.getStats()
            // No need to attach a twilioError
            this.emit('error', error);
        });
    }
    /**
     * Get stats from the PeerConnection.
     * @returns A universally-formatted version of RTC stats.
     */
    _getSample() {
        return this._getRTCStats(this._peerConnection).then((stats) => {
            let previousSample = null;
            if (this._sampleBuffer.length) {
                previousSample = this._sampleBuffer[this._sampleBuffer.length - 1];
            }
            return this._createSample(stats, previousSample);
        });
    }
    /**
     * Raise a warning and log its raised time.
     * @param statName - The name of the stat to raise.
     * @param thresholdName - The name of the threshold to raise
     * @param [data] - Any relevant sample data.
     */
    _raiseWarning(statName, thresholdName, data) {
        const warningId = `${statName}:${thresholdName}`;
        if (this._activeWarnings.has(warningId)) {
            return;
        }
        this._activeWarnings.set(warningId, { timeRaised: Date.now() });
        const thresholds = this._thresholds[statName];
        let thresholdValue;
        if (Array.isArray(thresholds)) {
            const foundThreshold = thresholds.find(threshold => thresholdName in threshold);
            if (foundThreshold) {
                thresholdValue = foundThreshold[thresholdName];
            }
        }
        else {
            thresholdValue = this._thresholds[statName][thresholdName];
        }
        this.emit('warning', Object.assign(Object.assign({}, data), { name: statName, threshold: {
                name: thresholdName,
                value: thresholdValue,
            } }));
    }
    /**
     * Apply our thresholds to our array of RTCStat samples.
     */
    _raiseWarnings() {
        if (!this._warningsEnabled) {
            return;
        }
        Object.keys(this._thresholds).forEach(name => this._raiseWarningsForStat(name));
    }
    /**
     * Apply thresholds for a given stat name to our array of
     * RTCStat samples and raise or clear any associated warnings.
     * @param statName - Name of the stat to compare.
     */
    _raiseWarningsForStat(statName) {
        const limits = Array.isArray(this._thresholds[statName])
            ? this._thresholds[statName]
            : [this._thresholds[statName]];
        limits.forEach((limit) => {
            const samples = this._sampleBuffer;
            const clearCount = limit.clearCount || SAMPLE_COUNT_CLEAR;
            const raiseCount = limit.raiseCount || SAMPLE_COUNT_RAISE;
            const sampleCount = limit.sampleCount || this._maxSampleCount;
            let relevantSamples = samples.slice(-sampleCount);
            const values = relevantSamples.map(sample => sample[statName]);
            // (rrowland) If we have a bad or missing value in the set, we don't
            // have enough information to throw or clear a warning. Bail out.
            const containsNull = values.some(value => typeof value === 'undefined' || value === null);
            if (containsNull) {
                return;
            }
            let count;
            if (typeof limit.max === 'number') {
                count = countHigh(limit.max, values);
                if (count >= raiseCount) {
                    this._raiseWarning(statName, 'max', { values, samples: relevantSamples });
                }
                else if (count <= clearCount) {
                    this._clearWarning(statName, 'max', { values, samples: relevantSamples });
                }
            }
            if (typeof limit.min === 'number') {
                count = countLow(limit.min, values);
                if (count >= raiseCount) {
                    this._raiseWarning(statName, 'min', { values, samples: relevantSamples });
                }
                else if (count <= clearCount) {
                    this._clearWarning(statName, 'min', { values, samples: relevantSamples });
                }
            }
            if (typeof limit.maxDuration === 'number' && samples.length > 1) {
                relevantSamples = samples.slice(-2);
                const prevValue = relevantSamples[0][statName];
                const curValue = relevantSamples[1][statName];
                const prevStreak = this._currentStreaks.get(statName) || 0;
                const streak = (prevValue === curValue) ? prevStreak + 1 : 0;
                this._currentStreaks.set(statName, streak);
                if (streak >= limit.maxDuration) {
                    this._raiseWarning(statName, 'maxDuration', { value: streak });
                }
                else if (streak === 0) {
                    this._clearWarning(statName, 'maxDuration', { value: prevStreak });
                }
            }
            if (typeof limit.minStandardDeviation === 'number') {
                const sampleSets = this._supplementalSampleBuffers[statName];
                if (!sampleSets || sampleSets.length < limit.sampleCount) {
                    return;
                }
                if (sampleSets.length > limit.sampleCount) {
                    sampleSets.splice(0, sampleSets.length - limit.sampleCount);
                }
                const flatSamples = flattenSamples(sampleSets.slice(-sampleCount));
                const stdDev = calculateStandardDeviation(flatSamples);
                if (typeof stdDev !== 'number') {
                    return;
                }
                if (stdDev < limit.minStandardDeviation) {
                    this._raiseWarning(statName, 'minStandardDeviation', { value: stdDev });
                }
                else {
                    this._clearWarning(statName, 'minStandardDeviation', { value: stdDev });
                }
            }
            [
                ['maxAverage', (x, y) => x > y],
                ['minAverage', (x, y) => x < y],
            ].forEach(([thresholdName, comparator]) => {
                if (typeof limit[thresholdName] === 'number' && values.length >= sampleCount) {
                    const avg = average(values);
                    if (comparator(avg, limit[thresholdName])) {
                        this._raiseWarning(statName, thresholdName, { values, samples: relevantSamples });
                    }
                    else if (!comparator(avg, limit.clearValue || limit[thresholdName])) {
                        this._clearWarning(statName, thresholdName, { values, samples: relevantSamples });
                    }
                }
            });
        });
    }
}

export { StatsMonitor as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHNNb25pdG9yLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL3N0YXRzTW9uaXRvci50cyJdLCJzb3VyY2VzQ29udGVudCI6W251bGxdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7QUFRQTtBQUNBLE1BQU0sb0JBQW9CLEdBQUcsQ0FBQztBQUU5QjtBQUNBO0FBQ0EsTUFBTSxrQkFBa0IsR0FBRyxDQUFDO0FBQzVCLE1BQU0sa0JBQWtCLEdBQUcsQ0FBQztBQUU1QixNQUFNLGVBQWUsR0FBRyxJQUFJO0FBQzVCLE1BQU0sZUFBZSxHQUFHLENBQUMsR0FBRyxJQUFJO0FBRWhDLE1BQU0sa0JBQWtCLEdBQWtDO0lBQ3hELGVBQWUsRUFBRSxFQUFFLG9CQUFvQixFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsRUFBRSxFQUFFO0lBQ2xFLGdCQUFnQixFQUFFLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUU7QUFDbkUsSUFBQSxhQUFhLEVBQUUsRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxFQUFFO0FBQ3ZFLElBQUEsU0FBUyxFQUFFLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsV0FBVyxFQUFFLENBQUMsRUFBRTtBQUNuRSxJQUFBLE1BQU0sRUFBRSxFQUFFLEdBQUcsRUFBRSxFQUFFLEVBQUU7QUFDbkIsSUFBQSxHQUFHLEVBQUUsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFO0FBQ2YsSUFBQSxtQkFBbUIsRUFBRSxDQUFDO0FBQ3BCLFlBQUEsR0FBRyxFQUFFLENBQUM7U0FDUCxFQUFFO0FBQ0QsWUFBQSxVQUFVLEVBQUUsQ0FBQztBQUNiLFlBQUEsVUFBVSxFQUFFLENBQUM7QUFDYixZQUFBLFdBQVcsRUFBRSxDQUFDO1NBQ2YsQ0FB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
