/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
/**
 * This is a generated file. Any modifications here will be overwritten. See scripts/errors.js.
 */
import TwilioError from './twilioError';
export { TwilioError };
export declare namespace AuthorizationErrors {
    class AccessTokenInvalid extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class AccessTokenExpired extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class AuthenticationFailed extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
}
export declare namespace SignatureValidationErrors {
    class AccessTokenSignatureValidationFailed extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
}
export declare namespace ClientErrors {
    class BadRequest extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class NotFound extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class TemporarilyUnavailable extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class BusyHere extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
}
export declare namespace SIPServerErrors {
    class Decline extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
}
export declare namespace GeneralErrors {
    class UnknownError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class ApplicationNotFoundError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class ConnectionDeclinedError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class ConnectionTimeoutError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class ConnectionError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class CallCancelledError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class TransportError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
}
export declare namespace MalformedRequestErrors {
    class MalformedRequestError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class MissingParameterArrayError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class AuthorizationTokenMissingError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class MaxParameterLengthExceededError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class InvalidBridgeTokenError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class InvalidClientNameError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class ReconnectParameterInvalidError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
}
export declare namespace AuthorizationErrors {
    class AuthorizationError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class NoValidAccountError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class InvalidJWTTokenError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class JWTTokenExpiredError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class RateExceededError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class JWTTokenExpirationTooLongError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class ReconnectAttemptError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class CallMessageEventTypeInvalidError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class PayloadSizeExceededError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
}
export declare namespace UserMediaErrors {
    class PermissionDeniedError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class AcquisitionFailedError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
}
export declare namespace SignalingErrors {
    class ConnectionError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class ConnectionDisconnected extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
}
export declare namespace MediaErrors {
    class ClientLocalDescFailed extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class ClientRemoteDescFailed extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
    class ConnectionError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        constructor();
        constructor(message: string);
        constructor(error: Error | object);
        constructor(message: string, error: Error | object);
    }
}
/**
 * @private
 */
export declare const errorsByCode: ReadonlyMap<number, any>;
