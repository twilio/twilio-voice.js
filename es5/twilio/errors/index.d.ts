/**
 * @packageDocumentation
 * @internalapi
 */
import { AuthorizationErrors, ClientErrors, GeneralErrors, MediaErrors, SignalingErrors, TwilioError, UserMediaErrors } from './generated';
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
export { AuthorizationErrors, ClientErrors, GeneralErrors, MediaErrors, SignalingErrors, TwilioError, UserMediaErrors, };
