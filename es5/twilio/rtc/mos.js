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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9ydGMvbW9zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHOztBQUVILElBQU0sRUFBRSxHQUFHLE1BQU0sQ0FBQyxDQUFDLHdDQUF3QztBQUUzRDs7Ozs7Ozs7O0dBU0c7QUFDSCxTQUFnQixTQUFTLENBQ3ZCLEdBQVEsRUFDUixNQUFXLEVBQ1gsWUFBaUI7SUFFakIsSUFDRSxPQUFPLEdBQUcsS0FBSyxRQUFRO1FBQ3ZCLE9BQU8sTUFBTSxLQUFLLFFBQVE7UUFDMUIsT0FBTyxZQUFZLEtBQUssUUFBUTtRQUNoQyxDQUFDLG1CQUFtQixDQUFDLEdBQUcsQ0FBQztRQUN6QixDQUFDLG1CQUFtQixDQUFDLE1BQU0sQ0FBQztRQUM1QixDQUFDLG1CQUFtQixDQUFDLFlBQVksQ0FBQyxFQUNsQztRQUNBLE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFFRCxpQ0FBaUM7SUFDakMsSUFBTSxnQkFBZ0IsR0FBVyxHQUFHLEdBQUcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxDQUFDLEdBQUcsRUFBRSxDQUFDO0lBRXpELHdEQUF3RDtJQUN4RCxJQUFJLE9BQU8sR0FBVyxDQUFDLENBQUM7SUFDeEIsUUFBUSxJQUFJLEVBQUU7UUFDWixLQUFLLGdCQUFnQixHQUFHLEdBQUc7WUFDekIsT0FBTyxHQUFHLEVBQUUsR0FBRyxDQUFDLGdCQUFnQixHQUFHLEVBQUUsQ0FBQyxDQUFDO1lBQ3ZDLE1BQU07UUFDUixLQUFLLGdCQUFnQixHQUFHLElBQUk7WUFDMUIsT0FBTyxHQUFHLEVBQUUsR0FBRyxDQUFDLENBQUMsZ0JBQWdCLEdBQUcsR0FBRyxDQUFDLEdBQUcsRUFBRSxDQUFDLENBQUM7WUFDL0MsTUFBTTtLQUNUO0lBRUQsc0RBQXNEO0lBQ3RELFFBQVEsSUFBSSxFQUFFO1FBQ1osS0FBSyxZQUFZLElBQUksQ0FBQyxPQUFPLEdBQUcsR0FBRyxDQUFDO1lBQ2xDLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sR0FBRyxZQUFZLEdBQUcsR0FBRyxFQUFFLElBQUksQ0FBQyxDQUFDO1lBQ3ZELE1BQU07UUFDUjtZQUNFLE9BQU8sR0FBRyxDQUFDLENBQUM7WUFDWixNQUFNO0tBQ1Q7SUFFRCw4QkFBOEI7SUFDOUIsSUFBTSxHQUFHLEdBQVcsQ0FBQztRQUNuQixDQUFDLEtBQUssR0FBRyxPQUFPLENBQUM7UUFDakIsQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDO1lBQ3BCLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQztZQUNkLENBQUMsR0FBRyxHQUFHLE9BQU8sQ0FBQyxDQUFDO0lBRWxCLE9BQU8sR0FBRyxDQUFDO0FBQ2IsQ0FBQztBQWhERCw4QkFnREM7QUFFRDs7OztHQUlHO0FBQ0gsU0FBZ0IsbUJBQW1CLENBQUMsQ0FBTTtJQUN4QyxPQUFPLE9BQU8sQ0FBQyxLQUFLLFFBQVEsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNyRSxDQUFDO0FBRkQsa0RBRUM7QUFFRCxrQkFBZTtJQUNiLFNBQVMsV0FBQTtJQUNULG1CQUFtQixxQkFBQTtDQUNwQixDQUFDIn0=