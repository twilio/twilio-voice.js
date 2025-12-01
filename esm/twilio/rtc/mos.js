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
function isNonNegativeNumber(n) {
    return typeof n === 'number' && !isNaN(n) && isFinite(n) && n >= 0;
}
var Mos = {
    calculate,
    isNonNegativeNumber,
};

export { calculate, Mos as default, isNonNegativeNumber };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9zLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9tb3MudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsTUFBTSxFQUFFLEdBQUcsTUFBTSxDQUFDO0FBRWxCOzs7Ozs7Ozs7QUFTRztTQUNhLFNBQVMsQ0FDdkIsR0FBUSxFQUNSLE1BQVcsRUFDWCxZQUFpQixFQUFBO0lBRWpCLElBQ0UsT0FBTyxHQUFHLEtBQUssUUFBUTtRQUN2QixPQUFPLE1BQU0sS0FBSyxRQUFRO1FBQzFCLE9BQU8sWUFBWSxLQUFLLFFBQVE7UUFDaEMsQ0FBQyxtQkFBbUIsQ0FBQyxHQUFHLENBQUM7UUFDekIsQ0FBQyxtQkFBbUIsQ0FBQyxNQUFNLENBQUM7QUFDNUIsUUFBQSxDQUFDLG1CQUFtQixDQUFDLFlBQVksQ0FBQyxFQUNsQztBQUNBLFFBQUEsT0FBTyxJQUFJO0lBQ2I7O0lBR0EsTUFBTSxnQkFBZ0IsR0FBVyxHQUFHLElBQUksTUFBTSxHQUFHLENBQUMsQ0FBQyxHQUFHLEVBQUU7O0lBR3hELElBQUksT0FBTyxHQUFXLENBQUM7SUFDdkIsUUFBUSxJQUFJO1FBQ1YsS0FBSyxnQkFBZ0IsR0FBRyxHQUFHO1lBQ3pCLE9BQU8sR0FBRyxFQUFFLElBQUksZ0JBQWdCLEdBQUcsRUFBRSxDQUFDO1lBQ3RDO1FBQ0YsS0FBSyxnQkFBZ0IsR0FBRyxJQUFJO0FBQzFCLFlBQUEsT0FBTyxHQUFHLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixHQUFHLEdBQUcsSUFBSSxFQUFFLENBQUM7WUFDOUM7OztJQUlKLFFBQVEsSUFBSTtBQUNWLFFBQUEsS0FBSyxZQUFZLEtBQUssT0FBTyxHQUFHLEdBQUcsQ0FBQztBQUNsQyxZQUFBLE9BQU8sR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLE9BQU8sR0FBRyxZQUFZLEdBQUcsR0FBRyxFQUFFLElBQUksQ0FBQztZQUN0RDtBQUNGLFFBQUE7WUFDRSxPQUFPLEdBQUcsQ0FBQztZQUNYOzs7SUFJSixNQUFNLEdBQUcsR0FBVyxDQUFDO1NBQ2xCLEtBQUssR0FBRyxPQUFPLENBQUM7UUFDakIsQ0FBQyxRQUFRLEdBQUcsT0FBTzthQUNsQixPQUFPLEdBQUcsRUFBRSxDQUFDO0FBQ2QsYUFBQyxHQUFHLEdBQUcsT0FBTyxDQUFDO0FBRWpCLElBQUEsT0FBTyxHQUFHO0FBQ1o7QUFFQTs7OztBQUlHO0FBQ0csU0FBVSxtQkFBbUIsQ0FBQyxDQUFNLEVBQUE7QUFDeEMsSUFBQSxPQUFPLE9BQU8sQ0FBQyxLQUFLLFFBQVEsSUFBSSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSSxRQUFRLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUM7QUFDcEU7QUFFQSxVQUFlO0lBQ2IsU0FBUztJQUNULG1CQUFtQjtDQUNwQjs7OzsifQ==
