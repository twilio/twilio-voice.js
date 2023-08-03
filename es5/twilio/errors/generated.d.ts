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
}
export declare namespace AuthorizationErrors {
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
