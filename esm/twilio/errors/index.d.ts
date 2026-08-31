import { AuthorizationErrors, ClientErrors, GeneralErrors, MalformedRequestErrors, MediaErrors, SignalingErrors, SignatureValidationErrors, SIPServerErrors, TwilioError, UserMediaErrors } from './generated';
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
export declare function getPreciseSignalingErrorByCode(enableImprovedSignalingErrorPrecision: boolean, errorCode: number): typeof TwilioError | undefined;
/**
 * The error that is thrown when an invalid argument is passed to a library API.
 */
export declare class InvalidArgumentError extends Error {
    /**
     * @internal
     */
    constructor(message?: string);
}
/**
 * The error that is thrown when the library has entered an invalid state.
 */
export declare class InvalidStateError extends Error {
    /**
     * @internal
     */
    constructor(message?: string);
}
/**
 * The error that is thrown when an attempt is made to use an API that is not
 * supported on the current platform.
 */
export declare class NotSupportedError extends Error {
    /**
     * @internal
     */
    constructor(message?: string);
}
/**
 * This should only be used to look up error codes returned by a server
 * using the same repo of error codes.
 * @internal
 */
export declare function getErrorByCode(code: number): (typeof TwilioError);
/**
 * This should only be used to look up error codes returned by a server
 * using the same repo of error codes.
 * @internal
 */
export declare function hasErrorByCode(code: number): boolean;
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
export { AuthorizationErrors, ClientErrors, GeneralErrors, MalformedRequestErrors, MediaErrors, SignalingErrors, SignatureValidationErrors, SIPServerErrors, TwilioError, UserMediaErrors, };
