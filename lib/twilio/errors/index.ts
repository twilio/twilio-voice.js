/* tslint:disable max-classes-per-file */

// TODO: Consider refactoring this export (VBLOCKS-4589)

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

/**
 * Get an error constructor using the [[PRECISE_SIGNALING_ERROR_CODES]] set.
 * @internal
 * @param enableImprovedSignalingErrorPrecision - A boolean representing the
 * optional flag whether or not to use more precise error codes.
 * @param errorCode - The error code.
 * @returns This function returns `undefined` if the passed error code does not
 * correlate to an error or should not be constructed with a more precise error
 * constructor. A sub-class of {@link TwilioError} if the code does correlate to
 * an error.
 */
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

/**
 * The error that is thrown when an invalid argument is passed to a library API.
 */
export class InvalidArgumentError extends Error {
  /**
   * @internal
   */
  constructor(message?: string) {
    super(message);
    this.name = 'InvalidArgumentError';
  }
}

/**
 * The error that is thrown when the library has entered an invalid state.
 */
export class InvalidStateError extends Error {
  /**
   * @internal
   */
  constructor(message?: string) {
    super(message);
    this.name = 'InvalidStateError';
  }
}

/**
 * The error that is thrown when an attempt is made to use an API that is not
 * supported on the current platform.
 */
export class NotSupportedError extends Error {
  /**
   * @internal
   */
  constructor(message?: string) {
    super(message);
    this.name = 'NotSupportedError';
  }
}

/**
 * This should only be used to look up error codes returned by a server
 * using the same repo of error codes.
 * @internal
 */
export function getErrorByCode(code: number): (typeof TwilioError) {
  const error: (typeof TwilioError) | undefined = errorsByCode.get(code);
  if (!error) {
    throw new InvalidArgumentError(`Error code ${code} not found`);
  }
  return error;
}

/**
 * This should only be used to look up error codes returned by a server
 * using the same repo of error codes.
 * @internal
 */
export function hasErrorByCode(code: number): boolean {
  return errorsByCode.has(code);
}

/**
 * @privateRemarks
 *
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
