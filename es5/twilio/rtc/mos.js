"use strict";
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
Object.defineProperty(exports, "__esModule", { value: true });
var r0 = 94.768; // Constant used in computing "rFactor".
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
function calculate(rtt, jitter, fractionLost) {
    if (typeof rtt !== 'number' ||
        typeof jitter !== 'number' ||
        typeof fractionLost !== 'number' ||
        !isNonNegativeNumber(rtt) ||
        !isNonNegativeNumber(jitter) ||
        !isNonNegativeNumber(fractionLost)) {
        return null;
    }
    // Compute the effective latency.
    var effectiveLatency = rtt + (jitter * 2) + 10;
    // Compute the initial "rFactor" from effective latency.
    var rFactor = 0;
    switch (true) {
        case effectiveLatency < 160:
            rFactor = r0 - (effectiveLatency / 40);
            break;
        case effectiveLatency < 1000:
            rFactor = r0 - ((effectiveLatency - 120) / 10);
            break;
    }
    // Adjust "rFactor" with the fraction of packets lost.
    switch (true) {
        case fractionLost <= (rFactor / 2.5):
            rFactor = Math.max(rFactor - fractionLost * 2.5, 6.52);
            break;
        default:
            rFactor = 0;
            break;
    }
    // Compute MOS from "rFactor".
    var mos = 1 +
        (0.035 * rFactor) +
        (0.000007 * rFactor) *
            (rFactor - 60) *
            (100 - rFactor);
    return mos;
}
exports.calculate = calculate;
/**
 * Returns true if and only if the parameter passed is a number, is not `NaN`,
 * is finite, and is greater than or equal to `0`.
 * @param n
 */
function isNonNegativeNumber(n) {
    return typeof n === 'number' && !isNaN(n) && isFinite(n) && n >= 0;
}
exports.isNonNegativeNumber = isNonNegativeNumber;
exports.default = {
    calculate: calculate,
    isNonNegativeNumber: isNonNegativeNumber,
};
//# sourceMappingURL=mos.js.map