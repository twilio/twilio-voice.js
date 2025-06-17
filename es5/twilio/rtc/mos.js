"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.calculate = calculate;
exports.isNonNegativeNumber = isNonNegativeNumber;
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
/**
 * Returns true if and only if the parameter passed is a number, is not `NaN`,
 * is finite, and is greater than or equal to `0`.
 * @param n
 */
function isNonNegativeNumber(n) {
    return typeof n === 'number' && !isNaN(n) && isFinite(n) && n >= 0;
}
exports.default = {
    calculate: calculate,
    isNonNegativeNumber: isNonNegativeNumber,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9ydGMvbW9zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBWUEsOEJBZ0RDO0FBT0Qsa0RBRUM7QUFyRUQsSUFBTSxFQUFFLEdBQUcsTUFBTSxDQUFDLENBQUMsd0NBQXdDO0FBRTNEOzs7Ozs7Ozs7R0FTRztBQUNILFNBQWdCLFNBQVMsQ0FDdkIsR0FBUSxFQUNSLE1BQVcsRUFDWCxZQUFpQjtJQUVqQixJQUNFLE9BQU8sR0FBRyxLQUFLLFFBQVE7UUFDdkIsT0FBTyxNQUFNLEtBQUssUUFBUTtRQUMxQixPQUFPLFlBQVksS0FBSyxRQUFRO1FBQ2hDLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDO1FBQ3pCLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDO1FBQzVCLENBQUMsbUJBQW1CLENBQUMsWUFBWSxDQUFDLEVBQ2xDLENBQUM7UUFDRCxPQUFPLElBQUksQ0FBQztJQUNkLENBQUM7SUFFRCxpQ0FBaUM7SUFDakMsSUFBTSxnQkFBZ0IsR0FBVyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBRXpELHdEQUF3RDtJQUN4RCxJQUFJLE9BQU8sR0FBVyxDQUFDLENBQUM7SUFDeEIsUUFBUSxJQUFJLEVBQUUsQ0FBQztRQUNiLEtBQUssZ0JBQWdCLEdBQUcsR0FBRztZQUN6QixPQUFPLEdBQUcsRUFBRSxHQUFHLENBQUMsZ0JBQWdCLEdBQUcsRUFBRSxDQUFDLENBQUM7WUFDdkMsTUFBTTtRQUNSLEtBQUssZ0JBQWdCLEdBQUcsSUFBSTtZQUMxQixPQUFPLEdBQUcsRUFBRSxHQUFHLENBQUMsQ0FBQyxnQkFBZ0IsR0FBRyxHQUFHLENBQUMsR0FBRyxFQUFFLENBQUMsQ0FBQztZQUMvQyxNQUFNO0lBQ1YsQ0FBQztJQUVELHNEQUFzRDtJQUN0RCxRQUFRLElBQUksRUFBRSxDQUFDO1FBQ2IsS0FBSyxZQUFZLElBQUksQ0FBQyxPQUFPLEdBQUcsR0FBRyxDQUFDO1lBQ2xDLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sR0FBRyxZQUFZLEdBQUcsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3ZELE1BQU07UUFDUjtZQUNFLE9BQU8sR0FBRyxDQUFDLENBQUM7WUFDWixNQUFNO0lBQ1YsQ0FBQztJQUVELDhCQUE4QjtJQUM5QixJQUFNLEdBQUcsR0FBVyxDQUFDO1FBQ25CLENBQUMsS0FBSyxHQUFHLE9BQU8sQ0FBQztRQUNqQixDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUM7WUFDcEIsQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDO1lBQ2QsQ0FBQyxHQUFHLEdBQUcsT0FBTyxDQUFDLENBQUM7SUFFbEIsT0FBTyxHQUFHLENBQUM7QUFDYixDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQWdCLG1CQUFtQixDQUFDLENBQU07SUFDeEMsT0FBTyxPQUFPLENBQUMsS0FBSyxRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDckUsQ0FBQztBQUVELGtCQUFlO0lBQ2IsU0FBUyxXQUFBO0lBQ1QsbUJBQW1CLHFCQUFBO0NBQ3BCLENBQUMifQ==