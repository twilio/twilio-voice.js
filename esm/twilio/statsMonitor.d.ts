import { EventEmitter } from 'events';
import Mos from './rtc/mos';
/**
 * @private
 */
export type IPeerConnection = any;
/**
 * @private
 */
export type IRTCStats = any;
/**
 * @private
 */
export type IMos = typeof Mos;
/**
 * {@link StatsMonitor} polls a peerConnection via PeerConnection.getStats
 * and emits warnings when stats cross the specified threshold values.
 */
declare class StatsMonitor extends EventEmitter {
    /**
     * A map of warnings with their raised time
     */
    private _activeWarnings;
    /**
     * A map of stats with the number of exceeded thresholds
     */
    private _currentStreaks;
    /**
     * Method to get stats from a PeerConnection object. Overrides getRTCStats library
     */
    private _getRTCStats;
    /**
     * Keeps track of input volumes in the last second
     */
    private _inputVolumes;
    /**
     * How many samples we use when testing metric thresholds.
     */
    private _maxSampleCount;
    /**
     * For calculating Mos. Overrides Mos library
     */
    private _mos;
    /**
     * Keeps track of output volumes in the last second
     */
    private _outputVolumes;
    /**
     * The PeerConnection to monitor.
     */
    private _peerConnection;
    /**
     * Sample buffer. Saves most recent samples
     */
    private _sampleBuffer;
    /**
     * The setInterval id for fetching samples.
     */
    private _sampleInterval?;
    /**
     * Keeps track of supplemental sample values.
     *
     * Currently used for constant audio detection. Contains an array of volume
     * samples for each sample interval.
     */
    private _supplementalSampleBuffers;
    /**
     * Threshold values for {@link StatsMonitor}
     */
    private _thresholds;
    /**
     * Whether warnings should be enabled
     */
    private _warningsEnabled;
    /**
     * @constructor
     * @param [options] - Optional settings
     */
    constructor(options?: StatsMonitor.Options);
    /**
     * Called when a volume sample is available
     * @param inputVolume - Input volume level from 0 to 32767
     * @param outputVolume - Output volume level from 0 to 32767
     */
    addVolumes(inputVolume: number, outputVolume: number): void;
    /**
     * Stop sampling RTC statistics for this {@link StatsMonitor}.
     * @returns The current {@link StatsMonitor}.
     */
    disable(): this;
    /**
     * Disable warnings for this {@link StatsMonitor}.
     * @returns The current {@link StatsMonitor}.
     */
    disableWarnings(): this;
    /**
     * Start sampling RTC statistics for this {@link StatsMonitor}.
     * @param peerConnection - A PeerConnection to monitor.
     * @returns The current {@link StatsMonitor}.
     */
    enable(peerConnection: IPeerConnection): this;
    /**
     * Enable warnings for this {@link StatsMonitor}.
     * @returns The current {@link StatsMonitor}.
     */
    enableWarnings(): this;
    /**
     * Check if there is an active warning for a specific stat and threshold
     * @param statName - The name of the stat to check
     * @param thresholdName - The name of the threshold to check
     * @returns Whether there is an active warning for a specific stat and threshold
     */
    hasActiveWarning(statName: string, thresholdName: string): boolean;
    /**
     * Add a sample to our sample buffer and remove the oldest if we are over the limit.
     * @param sample - Sample to add
     */
    private _addSample;
    /**
     * Clear an active warning.
     * @param statName - The name of the stat to clear.
     * @param thresholdName - The name of the threshold to clear
     * @param [data] - Any relevant sample data.
     */
    private _clearWarning;
    /**
     * Create a sample object from a stats object using the previous sample, if available.
     * @param stats - Stats retrieved from getStatistics
     * @param [previousSample=null] - The previous sample to use to calculate deltas.
     * @returns A universally-formatted version of RTC stats.
     */
    private _createSample;
    /**
     * Get stats from the PeerConnection and add it to our list of samples.
     */
    private _fetchSample;
    /**
     * Get stats from the PeerConnection.
     * @returns A universally-formatted version of RTC stats.
     */
    private _getSample;
    /**
     * Raise a warning and log its raised time.
     * @param statName - The name of the stat to raise.
     * @param thresholdName - The name of the threshold to raise
     * @param [data] - Any relevant sample data.
     */
    private _raiseWarning;
    /**
     * Apply our thresholds to our array of RTCStat samples.
     */
    private _raiseWarnings;
    /**
     * Apply thresholds for a given stat name to our array of
     * RTCStat samples and raise or clear any associated warnings.
     * @param statName - Name of the stat to compare.
     */
    private _raiseWarningsForStat;
}
declare namespace StatsMonitor {
    /**
     * Config options to be passed to the {@link StatsMonitor} constructor.
     * @private
     */
    interface Options {
        /**
         * Method to get stats from a PeerConnection object
         */
        getRTCStats?: (peerConnection: IPeerConnection) => IRTCStats;
        /**
         * For calculating Mos. Overrides Mos library
         */
        Mos?: IMos;
        /**
         * The PeerConnection to monitor.
         */
        peerConnection?: IPeerConnection;
        /**
         * Optional custom threshold values.
         */
        thresholds?: ThresholdOptions;
    }
    /**
     * Speficic threshold value for {@link ThresholdOptions}
     * @private
     */
    interface ThresholdOption {
        /**
         * How many samples that need to cross the threshold to clear a warning.
         * Overrides SAMPLE_COUNT_CLEAR
         */
        clearCount?: number;
        /**
         * Used with the `minAverage` and `maxAverage` options. If `maxAverage` is
         * used, then the warning will be cleared when at or below this value. If
         * `minAverage` is used, then the warning will be cleared at or above this
         * value.
         */
        clearValue?: number;
        /**
         * Warning will be raised if tracked metric rises above this value.
         */
        max?: number;
        /**
         * Warning will be raised based on the average over `sampleCount` samples.
         * The warning is raised if the average is above the `raiseValue` amount and
         * is cleared when below the `clearValue` amount.
         */
        maxAverage?: number;
        /**
         * Warning will be raised if tracked metric stays constant for
         * the specified number of consequent samples.
         */
        maxDuration?: number;
        /**
         * Warning will be raised if tracked metric falls below this value.
         */
        min?: number;
        /**
         * Warning will be raised based on the average over `sampleCount` samples.
         * The warning is raised if the average is below the `raiseValue` amount and
         * is cleared when above the `clearValue` amount.
         */
        minAverage?: number;
        /**
         * Warning will be raised if the standard deviation of the tracked metric
         * does not exceed this value.
         */
        minStandardDeviation?: number;
        /**
         * How many samples that need to cross the threshold to raise a warning.
         * Overrides SAMPLE_COUNT_RAISE
         */
        raiseCount?: number;
        /**
         * How many samples we use when testing metric thresholds.
         * Overrides _maxSampleCount
         */
        sampleCount?: number;
    }
    /**
     * Threshold values for {@link StatsMonitor}
     * @private
     */
    interface ThresholdOptions {
        [key: string]: any;
        /**
         * Audio input level between 0 and 32767, representing -100 to -30 dB.
         */
        audioInputLevel?: ThresholdOption;
        /**
         * Audio output level between 0 and 32767, representing -100 to -30 dB.
         */
        audioOutputLevel?: ThresholdOption;
        /**
         * Rules to apply to sample.jitter
         */
        jitter?: ThresholdOption;
        /**
         * Rules to apply to sample.mos
         */
        mos?: ThresholdOption;
        /**
         * Rules to apply to sample.packetsLostFraction
         */
        packetsLostFraction?: ThresholdOption[];
        /**
         * Rules to apply to sample.rtt
         */
        rtt?: ThresholdOption;
    }
    /**
     * Timestamp for raised warnings
     * @private
     */
    interface WarningTimestamp {
        /**
         * Timestamp in milliseconds
         */
        timeRaised: number;
    }
}
export default StatsMonitor;
