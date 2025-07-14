const r0 = 94.768; // Constant used in computing "rFactor".
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
export function calculate(rtt, jitter, fractionLost) {
    if (typeof rtt !== 'number' ||
        typeof jitter !== 'number' ||
        typeof fractionLost !== 'number' ||
        !isNonNegativeNumber(rtt) ||
        !isNonNegativeNumber(jitter) ||
        !isNonNegativeNumber(fractionLost)) {
        return null;
    }
    // Compute the effective latency.
    const effectiveLatency = rtt + (jitter * 2) + 10;
    // Compute the initial "rFactor" from effective latency.
    let rFactor = 0;
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
    const mos = 1 +
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
export function isNonNegativeNumber(n) {
    return typeof n === 'number' && !isNaN(n) && isFinite(n) && n >= 0;
}
export default {
    calculate,
    isNonNegativeNumber,
};
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9zLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9ydGMvbW9zLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLE1BQU0sRUFBRSxHQUFHLE1BQU0sQ0FBQyxDQUFDLHdDQUF3QztBQUUzRDs7Ozs7Ozs7O0dBU0c7QUFDSCxNQUFNLFVBQVUsU0FBUyxDQUN2QixHQUFRLEVBQ1IsTUFBVyxFQUNYLFlBQWlCO0lBRWpCLElBQ0UsT0FBTyxHQUFHLEtBQUssUUFBUTtRQUN2QixPQUFPLE1BQU0sS0FBSyxRQUFRO1FBQzFCLE9BQU8sWUFBWSxLQUFLLFFBQVE7UUFDaEMsQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUM7UUFDekIsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUM7UUFDNUIsQ0FBQyxtQkFBbUIsQ0FBQyxZQUFZLENBQUMsRUFDbEMsQ0FBQztRQUNELE9BQU8sSUFBSSxDQUFDO0lBQ2QsQ0FBQztJQUVELGlDQUFpQztJQUNqQyxNQUFNLGdCQUFnQixHQUFXLEdBQUcsR0FBRyxDQUFDLE1BQU0sR0FBRyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUM7SUFFekQsd0RBQXdEO0lBQ3hELElBQUksT0FBTyxHQUFXLENBQUMsQ0FBQztJQUN4QixRQUFRLElBQUksRUFBRSxDQUFDO1FBQ2IsS0FBSyxnQkFBZ0IsR0FBRyxHQUFHO1lBQ3pCLE9BQU8sR0FBRyxFQUFFLEdBQUcsQ0FBQyxnQkFBZ0IsR0FBRyxFQUFFLENBQUMsQ0FBQztZQUN2QyxNQUFNO1FBQ1IsS0FBSyxnQkFBZ0IsR0FBRyxJQUFJO1lBQzFCLE9BQU8sR0FBRyxFQUFFLEdBQUcsQ0FBQyxDQUFDLGdCQUFnQixHQUFHLEdBQUcsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxDQUFDO1lBQy9DLE1BQU07SUFDVixDQUFDO0lBRUQsc0RBQXNEO0lBQ3RELFFBQVEsSUFBSSxFQUFFLENBQUM7UUFDYixLQUFLLFlBQVksSUFBSSxDQUFDLE9BQU8sR0FBRyxHQUFHLENBQUM7WUFDbEMsT0FBTyxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsT0FBTyxHQUFHLFlBQVksR0FBRyxHQUFHLEVBQUUsSUFBSSxDQUFDLENBQUM7WUFDdkQsTUFBTTtRQUNSO1lBQ0UsT0FBTyxHQUFHLENBQUMsQ0FBQztZQUNaLE1BQU07SUFDVixDQUFDO0lBRUQsOEJBQThCO0lBQzlCLE1BQU0sR0FBRyxHQUFXLENBQUM7UUFDbkIsQ0FBQyxLQUFLLEdBQUcsT0FBTyxDQUFDO1FBQ2pCLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQztZQUNwQixDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7WUFDZCxDQUFDLEdBQUcsR0FBRyxPQUFPLENBQUMsQ0FBQztJQUVsQixPQUFPLEdBQUcsQ0FBQztBQUNiLENBQUM7QUFFRDs7OztHQUlHO0FBQ0gsTUFBTSxVQUFVLG1CQUFtQixDQUFDLENBQU07SUFDeEMsT0FBTyxPQUFPLENBQUMsS0FBSyxRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUksUUFBUSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDckUsQ0FBQztBQUVELGVBQWU7SUFDYixTQUFTO0lBQ1QsbUJBQW1CO0NBQ3BCLENBQUMifQ==