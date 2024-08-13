/**
 * @packageDocumentation
 * @module Voice
 * @publicapi
 */
import RTCSample from './sample';
/**
 * Warning data for a stat
 */
export default interface RTCWarning {
    /**
     * Name of the stat for this {@link RTCWarning}.
     */
    name?: string;
    /**
     * List of samples for this {@link RTCWarning}.
     */
    samples?: RTCSample[];
    /**
     * Threshold data for this {@link RTCWarning}.
     */
    threshold?: ThresholdWarningData;
    /**
     * Value for the stat in this {@link RTCWarning}.
     */
    value?: number;
    /**
     * A list of values for the stat in this {@link RTCWarning}.
     */
    values?: number[];
}
/**
 * Threshold data for a {@link RTCWarning}.
 */
export interface ThresholdWarningData {
    /**
     * Name of this threshold
     */
    name: string;
    /**
     * Value for this threshold
     */
    value: number;
}
