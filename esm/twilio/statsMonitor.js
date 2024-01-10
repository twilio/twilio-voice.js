/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
import { EventEmitter } from 'events';
import { InvalidArgumentError } from './errors';
import Mos from './rtc/mos';
import { getRTCStats } from './rtc/stats';
import { average } from './util';
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
export default StatsMonitor;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHNNb25pdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9zdGF0c01vbml0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7R0FJRztBQUVILE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDdEMsT0FBTyxFQUFFLG9CQUFvQixFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQ2hELE9BQU8sR0FBRyxNQUFNLFdBQVcsQ0FBQztBQUU1QixPQUFPLEVBQUUsV0FBVyxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBRTFDLE9BQU8sRUFBRSxPQUFPLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFFakMseURBQXlEO0FBQ3pELE1BQU0sb0JBQW9CLEdBQUcsQ0FBQyxDQUFDO0FBRS9CLHVEQUF1RDtBQUN2RCw0QkFBNEI7QUFDNUIsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLENBQUM7QUFDN0IsTUFBTSxrQkFBa0IsR0FBRyxDQUFDLENBQUM7QUFFN0IsTUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDO0FBQzdCLE1BQU0sZUFBZSxHQUFHLENBQUMsR0FBRyxJQUFJLENBQUM7QUFFakMsTUFBTSxrQkFBa0IsR0FBa0M7SUFDeEQsZUFBZSxFQUFFLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxFQUFFLFdBQVcsRUFBRSxFQUFFLEVBQUU7SUFDbEUsZ0JBQWdCLEVBQUUsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLEVBQUUsRUFBRTtJQUNuRSxhQUFhLEVBQUUsRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLEdBQUcsRUFBRSxDQUFDLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxXQUFXLEVBQUUsQ0FBQyxFQUFFO0lBQ3ZFLFNBQVMsRUFBRSxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLEVBQUU7SUFD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