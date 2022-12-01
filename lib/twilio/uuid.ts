/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */

import * as md5 from 'md5';
import { NotSupportedError } from '../twilio/errors';

function generateUuid(): string {
  if (typeof window !== 'object') {
    throw new NotSupportedError('This platform is not supported.');
  }

  const crypto: Crypto & { randomUUID?: () => string } = window.crypto;
  if (typeof crypto !== 'object') {
    throw new NotSupportedError(
      'The `crypto` module is not available on this platform.',
    );
  }
  if (typeof (crypto.randomUUID || crypto.getRandomValues) === 'undefined') {
    throw new NotSupportedError(
      'Neither `crypto.randomUUID` or `crypto.getRandomValues` are available ' +
      'on this platform.',
    );
  }

  const uInt32Arr: typeof Uint32Array = window.Uint32Array;
  if (typeof uInt32Arr === 'undefined') {
    throw new NotSupportedError(
      'The `Uint32Array` module is not available on this platform.',
    );
  }

  const generateRandomValues: () => string =
    typeof crypto.randomUUID === 'function'
      ? () => crypto.randomUUID!()
      : () => crypto.getRandomValues(new Uint32Array(32)).toString();

  return md5(generateRandomValues());
}

export function generateVoiceEventSid() {
  return `KX${generateUuid()}`;
}
