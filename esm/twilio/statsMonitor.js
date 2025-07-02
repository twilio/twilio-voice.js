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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHNNb25pdG9yLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9zdGF0c01vbml0b3IudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUN0QyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFDaEQsT0FBTyxHQUFHLE1BQU0sV0FBVyxDQUFDO0FBRTVCLE9BQU8sRUFBRSxXQUFXLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFFMUMsT0FBTyxFQUFFLE9BQU8sRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUVqQyx5REFBeUQ7QUFDekQsTUFBTSxvQkFBb0IsR0FBRyxDQUFDLENBQUM7QUFFL0IsdURBQXVEO0FBQ3ZELDRCQUE0QjtBQUM1QixNQUFNLGtCQUFrQixHQUFHLENBQUMsQ0FBQztBQUM3QixNQUFNLGtCQUFrQixHQUFHLENBQUMsQ0FBQztBQUU3QixNQUFNLGVBQWUsR0FBRyxJQUFJLENBQUM7QUFDN0IsTUFBTSxlQUFlLEdBQUcsQ0FBQyxHQUFHLElBQUksQ0FBQztBQUVqQyxNQUFNLGtCQUFrQixHQUFrQztJQUN4RCxlQUFlLEVBQUUsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLEVBQUUsV0FBVyxFQUFFLEVBQUUsRUFBRTtJQUNsRSxnQkFBZ0IsRUFBRSxFQUFFLG9CQUFvQixFQUFFLE1BQU0sRUFBRSxXQUFXLEVBQUUsRUFBRSxFQUFFO0lBQ25FLGFBQWEsRUFBRSxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsR0FBRyxFQUFFLENBQUMsRUFBRSxVQUFVLEVBQUUsQ0FBQyxFQUFFLFdBQVcsRUFBRSxDQUFDLEVBQUU7SUFDdkUsU0FBUyxFQUFFLEVBQUUsVUFBVSxFQUFFLENBQUMsRUFBRSxHQUFHLEVBQUUsQ0FBQyxFQUFFLFVBQVUsRUFBRSxDQUFDLEVBQUUsV0FBVyxFQUFFLENBQUMsRUFBRTtJQUNuRSxNQUFNLEVBQUUs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