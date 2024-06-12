/**
 * @packageDocumentation
 * @internalapi
 */
import { AuthorizationErrors, ClientErrors, GeneralErrors, MalformedRequestErrors, MediaErrors, SignalingErrors, SignatureValidationErrors, SIPServerErrors, TwilioError, UserMediaErrors } from './generated';
export declare function getPreciseSignalingErrorByCode(enableImprovedSignalingErrorPrecision: boolean, errorCode: number): typeof TwilioError | undefined;
export declare class InvalidArgumentError extends Error {
    constructor(message?: string);
}
export declare class InvalidStateError extends Error {
    constructor(message?: string);
}
export declare class NotSupportedError extends Error {
    constructor(message?: string);
}
export declare function getErrorByCode(code: number): (typeof TwilioError);
export declare function hasErrorByCode(code: number): boolean;
/**
 * All errors we want to throw or emit locally in the SDK need to be passed
 * through here.
 *
 * They need to first be defined in the `USED_ERRORS` list. See:
 * ```
 * scripts/errors.js
 * ```
 */
export { AuthorizationErrors, ClientErrors, GeneralErrors, MalformedRequestErrors, MediaErrors, SignalingErrors, SignatureValidationErrors, SIPServerErrors, TwilioError, UserMediaErrors, };
