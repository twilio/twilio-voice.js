"use strict";
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isNonNegativeNumber = exports.calculate = void 0;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9ydGMvbW9zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHOzs7QUFFSCxJQUFNLEVBQUUsR0FBRyxNQUFNLENBQUMsQ0FBQyx3Q0FBd0M7QUFFM0Q7Ozs7Ozs7OztHQVNHO0FBQ0gsU0FBZ0IsU0FBUyxDQUN2QixHQUFRLEVBQ1IsTUFBVyxFQUNYLFlBQWlCO0lBRWpCLElBQ0UsT0FBTyxHQUFHLEtBQUssUUFBUTtRQUN2QixPQUFPLE1BQU0sS0FBSyxRQUFRO1FBQzFCLE9BQU8sWUFBWSxLQUFLLFFBQVE7UUFDaEMsQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUM7UUFDekIsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUM7UUFDNUIsQ0FBQyxtQkFBbUIsQ0FBQyxZQUFZLENBQUMsRUFDbEM7UUFDQSxPQUFPLElBQUksQ0FBQztLQUNiO0lBRUQsaUNBQWlDO0lBQ2pDLElBQU0sZ0JBQWdCLEdBQVcsR0FBRyxHQUFHLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUUsQ0FBQztJQUV6RCx3REFBd0Q7SUFDeEQsSUFBSSxPQUFPLEdBQVcsQ0FBQyxDQUFDO0lBQ3hCLFFBQVEsSUFBSSxFQUFFO1FBQ1osS0FBSyxnQkFBZ0IsR0FBRyxHQUFHO1lBQ3pCLE9BQU8sR0FBRyxFQUFFLEdBQUcsQ0FBQyxnQkFBZ0IsR0FBRyxFQUFFLENBQUMsQ0FBQztZQUN2QyxNQUFNO1FBQ1IsS0FBSyxnQkFBZ0IsR0FBRyxJQUFJO1lBQzFCLE9BQU8sR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLGdCQUFnQixHQUFHLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1lBQy9DLE1BQU07S0FDVDtJQUVELHNEQUFzRDtJQUN0RCxRQUFRLElBQUksRUFBRTtRQUNaLEtBQUssWUFBWSxJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsQ0FBQztZQUNsQyxPQUFPLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEdBQUcsWUFBWSxHQUFHLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQztZQUN2RCxNQUFNO1FBQ1I7WUFDRSxPQUFPLEdBQUcsQ0FBQyxDQUFDO1lBQ1osTUFBTTtLQUNUO0lBRUQsOEJBQThCO0lBQzlCLElBQU0sR0FBRyxHQUFXLENBQUM7UUFDbkIsQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDO1FBQ2pCLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQztZQUNwQixDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7WUFDZCxDQUFDLEdBQUcsR0FBRyxPQUFPLENBQUMsQ0FBQztJQUVsQixPQUFPLEdBQUcsQ0FBQztBQUNiLENBQUM7QUFoREQsOEJBZ0RDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQWdCLG1CQUFtQixDQUFDLENBQU07SUFDeEMsT0FBTyxPQUFPLENBQUMsS0FBSyxRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDckUsQ0FBQztBQUZELGtEQUVDO0FBRUQsa0JBQWU7SUFDYixTQUFTLFdBQUE7SUFDVCxtQkFBbUIscUJBQUE7Q0FDcEIsQ0FBQyJ9