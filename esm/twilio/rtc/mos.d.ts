/**
 * Calculate the mos score of a stats object
 * @param {number} rtt
 * @param {number} jitter
 * @param {number} fractionLost - The fraction of packets that have been lost.
 * Calculated by packetsLost / totalPackets
 * @return {number | null} mos - Calculated MOS, `1.0` through roughly `4.5`.
 * Returns `null` when any of the input parameters are not a `non-negative`
 * number.
 */
export declare function calculate(rtt: any, jitter: any, fractionLost: any): number | null;
/**
 * Returns true if and only if the parameter passed is a number, is not `NaN`,
 * is finite, and is greater than or equal to `0`.
 * @param n
 */
export declare function isNonNegativeNumber(n: any): boolean;
declare const _default: {
    calculate: typeof calculate;
    isNonNegativeNumber: typeof isNonNegativeNumber;
};
export default _default;
