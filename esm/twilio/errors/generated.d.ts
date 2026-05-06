/**
 * This is a generated file. Any modifications here will be overwritten. See scripts/errors.js.
 */
import TwilioError from './twilioError';
export { TwilioError };
export declare namespace AuthorizationErrors {
    /**
     * Error received from the Twilio backend.
     */
    class AccessTokenInvalid extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class AccessTokenExpired extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class AuthenticationFailed extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
}
export declare namespace SignatureValidationErrors {
    /**
     * Error received from the Twilio backend.
     */
    class AccessTokenSignatureValidationFailed extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
}
export declare namespace ClientErrors {
    /**
     * Error received from the Twilio backend.
     */
    class BadRequest extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class NotFound extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class TemporarilyUnavailable extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class BusyHere extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
}
export declare namespace SIPServerErrors {
    /**
     * Error received from the Twilio backend.
     */
    class Decline extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
}
export declare namespace GeneralErrors {
    /**
     * Error received from the Twilio backend.
     */
    class UnknownError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class ApplicationNotFoundError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class ConnectionDeclinedError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class ConnectionTimeoutError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class ConnectionError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class CallCancelledError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class TransportError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
}
export declare namespace MalformedRequestErrors {
    /**
     * Error received from the Twilio backend.
     */
    class MalformedRequestError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class MissingParameterArrayError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class AuthorizationTokenMissingError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class MaxParameterLengthExceededError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class InvalidBridgeTokenError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class InvalidClientNameError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class ReconnectParameterInvalidError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
}
export declare namespace AuthorizationErrors {
    /**
     * Error received from the Twilio backend.
     */
    class AuthorizationError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class NoValidAccountError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class InvalidJWTTokenError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class JWTTokenExpiredError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class RateExceededError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class JWTTokenExpirationTooLongError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class ReconnectAttemptError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class CallMessageEventTypeInvalidError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class PayloadSizeExceededError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
}
export declare namespace UserMediaErrors {
    /**
     * Error received from the Twilio backend.
     */
    class PermissionDeniedError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class AcquisitionFailedError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
}
export declare namespace SignalingErrors {
    /**
     * Error received from the Twilio backend.
     */
    class ConnectionError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class ConnectionDisconnected extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
}
export declare namespace MediaErrors {
    /**
     * Error received from the Twilio backend.
     */
    class ClientLocalDescFailed extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class ClientRemoteDescFailed extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
    /**
     * Error received from the Twilio backend.
     */
    class ConnectionError extends TwilioError {
        causes: string[];
        code: number;
        description: string;
        explanation: string;
        name: string;
        solutions: string[];
        /**
         * @internal
         */
        constructor();
        /**
         * @internal
         */
        constructor(message: string);
        /**
         * @internal
         */
        constructor(error: Error | object);
        /**
         * @internal
         */
        constructor(message: string, error: Error | object);
    }
}
/**
 * @private
 */
export declare const errorsByCode: ReadonlyMap<number, any>;
