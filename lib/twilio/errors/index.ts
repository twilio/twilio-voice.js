/**
 * @packageDocumentation
 * @internalapi
 */
/* tslint:disable max-classes-per-file */
import {
  AuthorizationErrors,
  ClientErrors,
  errorsByCode,
  GeneralErrors,
  MalformedRequestErrors,
  MediaErrors,
  SignalingErrors,
  SignatureValidationErrors,
  SIPServerErrors,
  TwilioError,
  UserMediaErrors,
} from './generated';

/**
 * NOTE(mhuynh): Replacing generic error codes with new (more specific) codes,
 * is a breaking change. If an error code is found in this set, we only perform
 * the transformation if the feature flag is enabled.
 *
 * With every major version bump, such that we are allowed to introduce breaking
 * changes as per semver specification, this array should be cleared.
 *
 * TODO: [VBLOCKS-2295] Remove this in 3.x
 */
const PRECISE_SIGNALING_ERROR_CODES: Set<number> = new Set([
  /**
   * 310XX Errors
   */
  31001,
  31002,
  31003,
  /**
   * 311XX Errors
   */
  31101,
  31102,
  31103,
  31104,
  31105,
  31107,
  /**
   * 312XX Errors
   */
  31201,
  31202,
  31203,
  31204,
  31205,
  31207,
  /**
   * 314XX Errors
   */
  31404,
  31480,
  31486,
  /**
   * 316XX Errors
   */
  31603,
]);
export function getPreciseSignalingErrorByCode(
  enableImprovedSignalingErrorPrecision: boolean,
  errorCode: number,
): typeof TwilioError | undefined {
  if (typeof errorCode !== 'number') {
    return;
  }

  if (!hasErrorByCode(errorCode)) {
    return;
  }

  const shouldTransform = enableImprovedSignalingErrorPrecision
    ? true
    : !PRECISE_SIGNALING_ERROR_CODES.has(errorCode);
  if (!shouldTransform) {
    return;
  }

  return getErrorByCode(errorCode);
}

// Application errors that can be avoided by good app logic
export class InvalidArgumentError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'InvalidArgumentError';
  }
}
export class InvalidStateError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'InvalidStateError';
  }
}
export class NotSupportedError extends Error {
  constructor(message?: string) {
    super(message);
    this.name = 'NotSupportedError';
  }
}

// This should only be used to look up error codes returned by a server
// using the same repo of error codes.
export function getErrorByCode(code: number): (typeof TwilioError) {
  const error: (typeof TwilioError) | undefined = errorsByCode.get(code);
  if (!error) {
    throw new InvalidArgumentError(`Error code ${code} not found`);
  }
  return error;
}

// This should only be used to look up error codes returned by a server
// using the same repo of error codes.
export function hasErrorByCode(code: number): boolean {
  return errorsByCode.has(code);
}

/**
 * All errors we want to throw or emit locally in the SDK need to be passed
 * through here.
 *
 * They need to first be defined in the `USED_ERRORS` list. See:
 * ```
 * scripts/errors.js
 * ```
 */
export {
  AuthorizationErrors,
  ClientErrors,
  GeneralErrors,
  MalformedRequestErrors,
  MediaErrors,
  SignalingErrors,
  SignatureValidationErrors,
  SIPServerErrors,
  TwilioError,
  UserMediaErrors,
};
