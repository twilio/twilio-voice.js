/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */

// tslint:disable no-bitwise

/**
 * Constants
 */
const INITIAL_A = 1732584193;
const INITIAL_B = -271733879;
const INITIAL_C = -1732584194;
const INITIAL_D = 271733878;

const SHIFT_A = [
  0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15,
  1, 6, 11, 0, 5, 10, 15, 4, 9, 14, 3, 8, 13, 2, 7, 12,
  5, 8, 11, 14, 1, 4, 7, 10, 13, 0, 3, 6, 9, 12, 15, 2,
  0, 7, 14, 5, 12, 3, 10, 1, 8, 15, 6, 13, 4, 11, 2, 9,
];

const SHIFT_B = [
  7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22,
  5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20,
  4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23,
  6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21,
];

const SINE_TABLE: number[] = [];
for (let i = 0; i < 64; i++) {
  SINE_TABLE.push(Math.floor(Math.pow(2, 32) * Math.abs(Math.sin(i + 1))));
}

/**
 * Helper functions.
 */

/**
 * Bitwise rotate a number left by b bits.
 *
 * @param n - The number to bitwise rotate left.
 * @param b - The number of bits to rotate the number `n` by.
 * @returns the number `n` bitwise rotated left by `b` bits.
 */
const rotl = (n: number, b: number): number => {
  return (n << b) | (n >>> (32 - b));
};

/**
 * Flips a number from big endian to little endian and vice-versa.
 *
 * @param n - A number to flip the endian property of.
 * @returns the number `n` flipped.
 */
const flipEndian = (n: number): number => {
  return rotl(n, 8) & 0x00ff00ff | rotl(n, 24) & 0xff00ff00;
};

/**
 * Intermediate md5 digest functions.
 */

type IntermediateFunction = (a: number, b: number, c: number, d: number, x: number, s: number, t: number) => number;

const FF: IntermediateFunction = (a, b, c, d, x, s, t) => {
  const n = a + (b & c | ~b & d) + (x >>> 0) + t;
  return rotl(n, s) + b;
};

const GG: IntermediateFunction = (a, b, c, d, x, s, t) => {
  const n = a + (b & d | c & ~d) + (x >>> 0) + t;
  return rotl(n, s) + b;
};

const HH: IntermediateFunction = (a, b, c, d, x, s, t) => {
  const n = a + (b ^ c ^ d) + (x >>> 0) + t;
  return rotl(n, s) + b;
};

const II: IntermediateFunction = (a, b, c, d, x, s, t) => {
  const n = a + (c ^ (b | ~d)) + (x >>> 0) + t;
  return rotl(n, s) + b;
};

/**
 * Create an md5 digest for an input string.
 *
 * @param message - A string to return an md5 digest for.
 * @returns a string representing the md5 hash of the input string.
 */
export function md5(message: string) {
  // convert the string into an array of bytes
  const bytes = [];
  for (let i = 0; i < message.length; i++) {
    bytes.push(message.charCodeAt(i) & 0xff);
  }

  // convert the array of bytes into an array of words
  const words: number[] = [];
  for (let i = 0, j = 0; i < bytes.length; i++, j += 8) {
    words[j >>> 5] |= bytes[i] << (24 - j % 32);
  }

  const m = words;

  const l = bytes.length * 8;

  let a = INITIAL_A;
  let b = INITIAL_B;
  let c = INITIAL_C;
  let d = INITIAL_D;

  // flip the endianness of each word in the array of words
  for (let i = 0; i < m.length; i++) {
    m[i] = flipEndian(m[i]);
  }

  // add padding
  m[l >>> 5] |= 0x80 << (l % 32);
  m[(((l + 64) >>> 9) << 4) + 14] = l;

  // perform digest
  for (let i = 0; i < m.length; i += 16) {
    const aa = a;
    const bb = b;
    const cc = c;
    const dd = d;

    const step = (j: number): number => {
      const p =
        j < 16 ? FF :
        j < 32 ? GG :
        j < 48 ? HH :
        II;

      const q: [number, number, number, number] =
        j % 4 === 0 ? [a, b, c, d] :
        j % 4 === 1 ? [d, a, b, c] :
        j % 4 === 2 ? [c, d, a, b] :
        [b, c, d, a];

      const r: [number, number, number] =
        [m[i + SHIFT_A[j]], SHIFT_B[j], SINE_TABLE[j]];

      return p(...q, ...r);
    };

    for (let j = 0; j < 64; j += 4) {
      a = step(j + 0);
      d = step(j + 1);
      c = step(j + 2);
      b = step(j + 3);
    }

    a = (a + aa) >>> 0;
    b = (b + bb) >>> 0;
    c = (c + cc) >>> 0;
    d = (d + dd) >>> 0;
  }

  const resultWords = [a, b, c, d].map(flipEndian);

  const resultBytes = [];
  for (let i = 0; i < resultWords.length * 32; i += 8) {
    resultBytes.push((resultWords[i >>> 5] >>> (24 - i % 32)) & 0xff);
  }

  const resultHex = [];
  for (const resultByte of resultBytes) {
    resultHex.push((resultByte >>> 4).toString(16));
    resultHex.push((resultByte & 0xf).toString(16));
  }

  return resultHex.join('');
}
