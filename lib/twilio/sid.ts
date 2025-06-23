import { NotSupportedError } from './errors';

/**
 * Generates a 128-bit long random string that is formatted as a 32 long string
 * of characters where each character is from the set:
 * [0,1,2,3,4,5,6,7,8,9,a,b,c,d,e,f].
 */
function generateRandomizedString(): string {
  if (typeof window !== 'object') {
    throw new NotSupportedError('This platform is not supported.');
  }

  const { crypto } = window;
  if (typeof crypto !== 'object') {
    throw new NotSupportedError(
      'The `crypto` module is not available on this platform.',
    );
  }

  if (typeof crypto.getRandomValues !== 'function') {
    throw new NotSupportedError(
      'The function `crypto.getRandomValues` is not available on this ' +
      'platform.',
    );
  }

  if (typeof window.Uint8Array !== 'function') {
    throw new NotSupportedError(
      'The `Uint8Array` module is not available on this platform.',
    );
  }

  return crypto
    .getRandomValues(new window.Uint8Array(16))
    .reduce((r, n) => `${r}${n.toString(16).padStart(2, '0')}`, '');
}

export function generateVoiceEventSid() {
  return `KX${generateRandomizedString()}`;
}
