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
export function calculate(
  rtt: any,
  jitter: any,
  fractionLost: any,
): number | null {
  if (
    typeof rtt !== 'number' ||
    typeof jitter !== 'number' ||
    typeof fractionLost !== 'number' ||
    !isNonNegativeNumber(rtt) ||
    !isNonNegativeNumber(jitter) ||
    !isNonNegativeNumber(fractionLost)
  ) {
    return null;
  }

  // Compute the effective latency.
  const effectiveLatency: number = rtt + (jitter * 2) + 10;

  // Compute the initial "rFactor" from effective latency.
  let rFactor: number = 0;
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
  const mos: number = 1 +
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
export function isNonNegativeNumber(n: any): boolean {
  return typeof n === 'number' && !isNaN(n) && isFinite(n) && n >= 0;
}

export default {
  calculate,
  isNonNegativeNumber,
};
