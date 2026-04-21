'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

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
var Mos = {
    calculate: calculate,
    isNonNegativeNumber: isNonNegativeNumber,
};

exports.calculate = calculate;
exports.default = Mos;
exports.isNonNegativeNumber = isNonNegativeNumber;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9zLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9tb3MudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7OztBQUFBLElBQU0sRUFBRSxHQUFHLE1BQU0sQ0FBQztBQUVsQjs7Ozs7Ozs7O0FBU0c7U0FDYSxTQUFTLENBQ3ZCLEdBQVEsRUFDUixNQUFXLEVBQ1gsWUFBaUIsRUFBQTtJQUVqQixJQUNFLE9BQU8sR0FBRyxLQUFLLFFBQVE7UUFDdkIsT0FBTyxNQUFNLEtBQUssUUFBUTtRQUMxQixPQUFPLFlBQVksS0FBSyxRQUFRO1FBQ2hDLENBQUMsbUJBQW1CLENBQUMsR0FBRyxDQUFDO1FBQ3pCLENBQUMsbUJBQW1CLENBQUMsTUFBTSxDQUFDO0FBQzVCLFFBQUEsQ0FBQyxtQkFBbUIsQ0FBQyxZQUFZLENBQUMsRUFDbEM7QUFDQSxRQUFBLE9BQU8sSUFBSTtJQUNiOztJQUdBLElBQU0sZ0JBQWdCLEdBQVcsR0FBRyxJQUFJLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFOztJQUd4RCxJQUFJLE9BQU8sR0FBVyxDQUFDO0lBQ3ZCLFFBQVEsSUFBSTtRQUNWLEtBQUssZ0JBQWdCLEdBQUcsR0FBRztZQUN6QixPQUFPLEdBQUcsRUFBRSxJQUFJLGdCQUFnQixHQUFHLEVBQUUsQ0FBQztZQUN0QztRQUNGLEtBQUssZ0JBQWdCLEdBQUcsSUFBSTtBQUMxQixZQUFBLE9BQU8sR0FBRyxFQUFFLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxHQUFHLElBQUksRUFBRSxDQUFDO1lBQzlDOzs7SUFJSixRQUFRLElBQUk7QUFDVixRQUFBLEtBQUssWUFBWSxLQUFLLE9BQU8sR0FBRyxHQUFHLENBQUM7QUFDbEMsWUFBQSxPQUFPLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxPQUFPLEdBQUcsWUFBWSxHQUFHLEdBQUcsRUFBRSxJQUFJLENBQUM7WUFDdEQ7QUFDRixRQUFBO1lBQ0UsT0FBTyxHQUFHLENBQUM7WUFDWDs7O0lBSUosSUFBTSxHQUFHLEdBQVcsQ0FBQztTQUNsQixLQUFLLEdBQUcsT0FBTyxDQUFDO1FBQ2pCLENBQUMsUUFBUSxHQUFHLE9BQU87YUFDbEIsT0FBTyxHQUFHLEVBQUUsQ0FBQztBQUNkLGFBQUMsR0FBRyxHQUFHLE9BQU8sQ0FBQztBQUVqQixJQUFBLE9BQU8sR0FBRztBQUNaO0FBRUE7Ozs7QUFJRztBQUNHLFNBQVUsbUJBQW1CLENBQUMsQ0FBTSxFQUFBO0FBQ3hDLElBQUEsT0FBTyxPQUFPLENBQUMsS0FBSyxRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO0FBQ3BFO0FBRUEsVUFBZTtBQUNiLElBQUEsU0FBUyxFQUFBLFNBQUE7QUFDVCxJQUFBLG1CQUFtQixFQUFBLG1CQUFBO0NBQ3BCOzs7Ozs7In0=
