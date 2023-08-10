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
  SIPServerErrors,
  TwilioError,
  UserMediaErrors,
} from './generated';

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
  SIPServerErrors,
  TwilioError,
  UserMediaErrors,
};
