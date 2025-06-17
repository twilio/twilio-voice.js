/* tslint:disable max-classes-per-file max-line-length */
/**
 * This is a generated file. Any modifications here will be overwritten. See scripts/errors.js.
 */
import TwilioError from './twilioError';
export { TwilioError };
export var AuthorizationErrors;
(function (AuthorizationErrors) {
    /**
     * Error received from the Twilio backend.
     */
    class AccessTokenInvalid extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 20101;
            this.description = 'Invalid access token';
            this.explanation = 'Twilio was unable to validate your Access Token';
            this.name = 'AccessTokenInvalid';
            this.solutions = [];
            Object.setPrototypeOf(this, AuthorizationErrors.AccessTokenInvalid.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    AuthorizationErrors.AccessTokenInvalid = AccessTokenInvalid;
    /**
     * Error received from the Twilio backend.
     */
    class AccessTokenExpired extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 20104;
            this.description = 'Access token expired or expiration date invalid';
            this.explanation = 'The Access Token provided to the Twilio API has expired, the expiration time specified in the token was invalid, or the expiration time specified was too far in the future';
            this.name = 'AccessTokenExpired';
            this.solutions = [];
            Object.setPrototypeOf(this, AuthorizationErrors.AccessTokenExpired.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    AuthorizationErrors.AccessTokenExpired = AccessTokenExpired;
    /**
     * Error received from the Twilio backend.
     */
    class AuthenticationFailed extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 20151;
            this.description = 'Authentication Failed';
            this.explanation = 'The Authentication with the provided JWT failed';
            this.name = 'AuthenticationFailed';
            this.solutions = [];
            Object.setPrototypeOf(this, AuthorizationErrors.AuthenticationFailed.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    AuthorizationErrors.AuthenticationFailed = AuthenticationFailed;
})(AuthorizationErrors || (AuthorizationErrors = {}));
export var SignatureValidationErrors;
(function (SignatureValidationErrors) {
    /**
     * Error received from the Twilio backend.
     */
    class AccessTokenSignatureValidationFailed extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [
                'The access token has an invalid Account SID, API Key, or API Key Secret.',
            ];
            this.code = 31202;
            this.description = 'Signature validation failed.';
            this.explanation = 'The provided access token failed signature validation.';
            this.name = 'AccessTokenSignatureValidationFailed';
            this.solutions = [
                'Ensure the Account SID, API Key, and API Key Secret are valid when generating your access token.',
            ];
            Object.setPrototypeOf(this, SignatureValidationErrors.AccessTokenSignatureValidationFailed.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    SignatureValidationErrors.AccessTokenSignatureValidationFailed = AccessTokenSignatureValidationFailed;
})(SignatureValidationErrors || (SignatureValidationErrors = {}));
export var ClientErrors;
(function (ClientErrors) {
    /**
     * Error received from the Twilio backend.
     */
    class BadRequest extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31400;
            this.description = 'Bad Request (HTTP/SIP)';
            this.explanation = 'The request could not be understood due to malformed syntax.';
            this.name = 'BadRequest';
            this.solutions = [];
            Object.setPrototypeOf(this, ClientErrors.BadRequest.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    ClientErrors.BadRequest = BadRequest;
    /**
     * Error received from the Twilio backend.
     */
    class NotFound extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [
                'The outbound call was made to an invalid phone number.',
                'The TwiML application sid is missing a Voice URL.',
            ];
            this.code = 31404;
            this.description = 'Not Found (HTTP/SIP)';
            this.explanation = 'The server has not found anything matching the request.';
            this.name = 'NotFound';
            this.solutions = [
                'Ensure the phone number dialed is valid.',
                'Ensure the TwiML application is configured correctly with a Voice URL link.',
            ];
            Object.setPrototypeOf(this, ClientErrors.NotFound.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    ClientErrors.NotFound = NotFound;
    /**
     * Error received from the Twilio backend.
     */
    class TemporarilyUnavailable extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31480;
            this.description = 'Temporarily Unavailable (SIP)';
            this.explanation = 'The callee is currently unavailable.';
            this.name = 'TemporarilyUnavailable';
            this.solutions = [];
            Object.setPrototypeOf(this, ClientErrors.TemporarilyUnavailable.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    ClientErrors.TemporarilyUnavailable = TemporarilyUnavailable;
    /**
     * Error received from the Twilio backend.
     */
    class BusyHere extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31486;
            this.description = 'Busy Here (SIP)';
            this.explanation = 'The callee is busy.';
            this.name = 'BusyHere';
            this.solutions = [];
            Object.setPrototypeOf(this, ClientErrors.BusyHere.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    ClientErrors.BusyHere = BusyHere;
})(ClientErrors || (ClientErrors = {}));
export var SIPServerErrors;
(function (SIPServerErrors) {
    /**
     * Error received from the Twilio backend.
     */
    class Decline extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31603;
            this.description = 'Decline (SIP)';
            this.explanation = 'The callee does not wish to participate in the call.';
            this.name = 'Decline';
            this.solutions = [];
            Object.setPrototypeOf(this, SIPServerErrors.Decline.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    SIPServerErrors.Decline = Decline;
})(SIPServerErrors || (SIPServerErrors = {}));
export var GeneralErrors;
(function (GeneralErrors) {
    /**
     * Error received from the Twilio backend.
     */
    class UnknownError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31000;
            this.description = 'Unknown Error';
            this.explanation = 'An unknown error has occurred. See error details for more information.';
            this.name = 'UnknownError';
            this.solutions = [];
            Object.setPrototypeOf(this, GeneralErrors.UnknownError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    GeneralErrors.UnknownError = UnknownError;
    /**
     * Error received from the Twilio backend.
     */
    class ApplicationNotFoundError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31001;
            this.description = 'Application Not Found';
            this.explanation = '';
            this.name = 'ApplicationNotFoundError';
            this.solutions = [];
            Object.setPrototypeOf(this, GeneralErrors.ApplicationNotFoundError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    GeneralErrors.ApplicationNotFoundError = ApplicationNotFoundError;
    /**
     * Error received from the Twilio backend.
     */
    class ConnectionDeclinedError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31002;
            this.description = 'Connection Declined';
            this.explanation = '';
            this.name = 'ConnectionDeclinedError';
            this.solutions = [];
            Object.setPrototypeOf(this, GeneralErrors.ConnectionDeclinedError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    GeneralErrors.ConnectionDeclinedError = ConnectionDeclinedError;
    /**
     * Error received from the Twilio backend.
     */
    class ConnectionTimeoutError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31003;
            this.description = 'Connection Timeout';
            this.explanation = 'The server could not produce a response within a suitable amount of time.';
            this.name = 'ConnectionTimeoutError';
            this.solutions = [];
            Object.setPrototypeOf(this, GeneralErrors.ConnectionTimeoutError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    GeneralErrors.ConnectionTimeoutError = ConnectionTimeoutError;
    /**
     * Error received from the Twilio backend.
     */
    class ConnectionError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31005;
            this.description = 'Connection error';
            this.explanation = 'A connection error occurred during the call';
            this.name = 'ConnectionError';
            this.solutions = [];
            Object.setPrototypeOf(this, GeneralErrors.ConnectionError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    GeneralErrors.ConnectionError = ConnectionError;
    /**
     * Error received from the Twilio backend.
     */
    class CallCancelledError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [
                'The incoming call was cancelled because it was not answered in time or it was accepted/rejected by another application instance registered with the same identity.',
            ];
            this.code = 31008;
            this.description = 'Call cancelled';
            this.explanation = 'Unable to answer because the call has ended';
            this.name = 'CallCancelledError';
            this.solutions = [];
            Object.setPrototypeOf(this, GeneralErrors.CallCancelledError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    GeneralErrors.CallCancelledError = CallCancelledError;
    /**
     * Error received from the Twilio backend.
     */
    class TransportError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31009;
            this.description = 'Transport error';
            this.explanation = 'No transport available to send or receive messages';
            this.name = 'TransportError';
            this.solutions = [];
            Object.setPrototypeOf(this, GeneralErrors.TransportError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    GeneralErrors.TransportError = TransportError;
})(GeneralErrors || (GeneralErrors = {}));
export var MalformedRequestErrors;
(function (MalformedRequestErrors) {
    /**
     * Error received from the Twilio backend.
     */
    class MalformedRequestError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [
                'Invalid content or MessageType passed to sendMessage method.',
            ];
            this.code = 31100;
            this.description = 'The request had malformed syntax.';
            this.explanation = 'The request could not be understood due to malformed syntax.';
            this.name = 'MalformedRequestError';
            this.solutions = [
                'Ensure content and MessageType passed to sendMessage method are valid.',
            ];
            Object.setPrototypeOf(this, MalformedRequestErrors.MalformedRequestError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    MalformedRequestErrors.MalformedRequestError = MalformedRequestError;
    /**
     * Error received from the Twilio backend.
     */
    class MissingParameterArrayError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31101;
            this.description = 'Missing parameter array in request';
            this.explanation = '';
            this.name = 'MissingParameterArrayError';
            this.solutions = [];
            Object.setPrototypeOf(this, MalformedRequestErrors.MissingParameterArrayError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    MalformedRequestErrors.MissingParameterArrayError = MissingParameterArrayError;
    /**
     * Error received from the Twilio backend.
     */
    class AuthorizationTokenMissingError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31102;
            this.description = 'Authorization token missing in request.';
            this.explanation = '';
            this.name = 'AuthorizationTokenMissingError';
            this.solutions = [];
            Object.setPrototypeOf(this, MalformedRequestErrors.AuthorizationTokenMissingError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    MalformedRequestErrors.AuthorizationTokenMissingError = AuthorizationTokenMissingError;
    /**
     * Error received from the Twilio backend.
     */
    class MaxParameterLengthExceededError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31103;
            this.description = 'Maximum parameter length has been exceeded.';
            this.explanation = 'Length of parameters cannot exceed MAX_PARAM_LENGTH.';
            this.name = 'MaxParameterLengthExceededError';
            this.solutions = [];
            Object.setPrototypeOf(this, MalformedRequestErrors.MaxParameterLengthExceededError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    MalformedRequestErrors.MaxParameterLengthExceededError = MaxParameterLengthExceededError;
    /**
     * Error received from the Twilio backend.
     */
    class InvalidBridgeTokenError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31104;
            this.description = 'Invalid bridge token';
            this.explanation = '';
            this.name = 'InvalidBridgeTokenError';
            this.solutions = [];
            Object.setPrototypeOf(this, MalformedRequestErrors.InvalidBridgeTokenError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    MalformedRequestErrors.InvalidBridgeTokenError = InvalidBridgeTokenError;
    /**
     * Error received from the Twilio backend.
     */
    class InvalidClientNameError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [
                'Client name contains invalid characters.',
            ];
            this.code = 31105;
            this.description = 'Invalid client name';
            this.explanation = 'Client name should not contain control, space, delims, or unwise characters.';
            this.name = 'InvalidClientNameError';
            this.solutions = [
                'Make sure that client name does not contain any of the invalid characters.',
            ];
            Object.setPrototypeOf(this, MalformedRequestErrors.InvalidClientNameError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    MalformedRequestErrors.InvalidClientNameError = InvalidClientNameError;
    /**
     * Error received from the Twilio backend.
     */
    class ReconnectParameterInvalidError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31107;
            this.description = 'The reconnect parameter is invalid';
            this.explanation = '';
            this.name = 'ReconnectParameterInvalidError';
            this.solutions = [];
            Object.setPrototypeOf(this, MalformedRequestErrors.ReconnectParameterInvalidError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    MalformedRequestErrors.ReconnectParameterInvalidError = ReconnectParameterInvalidError;
})(MalformedRequestErrors || (MalformedRequestErrors = {}));
(function (AuthorizationErrors) {
    /**
     * Error received from the Twilio backend.
     */
    class AuthorizationError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31201;
            this.description = 'Authorization error';
            this.explanation = 'The request requires user authentication. The server understood the request, but is refusing to fulfill it.';
            this.name = 'AuthorizationError';
            this.solutions = [];
            Object.setPrototypeOf(this, AuthorizationErrors.AuthorizationError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    AuthorizationErrors.AuthorizationError = AuthorizationError;
    /**
     * Error received from the Twilio backend.
     */
    class NoValidAccountError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31203;
            this.description = 'No valid account';
            this.explanation = '';
            this.name = 'NoValidAccountError';
            this.solutions = [];
            Object.setPrototypeOf(this, AuthorizationErrors.NoValidAccountError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    AuthorizationErrors.NoValidAccountError = NoValidAccountError;
    /**
     * Error received from the Twilio backend.
     */
    class InvalidJWTTokenError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31204;
            this.description = 'Invalid JWT token';
            this.explanation = '';
            this.name = 'InvalidJWTTokenError';
            this.solutions = [];
            Object.setPrototypeOf(this, AuthorizationErrors.InvalidJWTTokenError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    AuthorizationErrors.InvalidJWTTokenError = InvalidJWTTokenError;
    /**
     * Error received from the Twilio backend.
     */
    class JWTTokenExpiredError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31205;
            this.description = 'JWT token expired';
            this.explanation = '';
            this.name = 'JWTTokenExpiredError';
            this.solutions = [];
            Object.setPrototypeOf(this, AuthorizationErrors.JWTTokenExpiredError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    AuthorizationErrors.JWTTokenExpiredError = JWTTokenExpiredError;
    /**
     * Error received from the Twilio backend.
     */
    class RateExceededError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [
                'Rate limit exceeded.',
            ];
            this.code = 31206;
            this.description = 'Rate exceeded authorized limit.';
            this.explanation = 'The request performed exceeds the authorized limit.';
            this.name = 'RateExceededError';
            this.solutions = [
                'Ensure message send rate does not exceed authorized limits.',
            ];
            Object.setPrototypeOf(this, AuthorizationErrors.RateExceededError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    AuthorizationErrors.RateExceededError = RateExceededError;
    /**
     * Error received from the Twilio backend.
     */
    class JWTTokenExpirationTooLongError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31207;
            this.description = 'JWT token expiration too long';
            this.explanation = '';
            this.name = 'JWTTokenExpirationTooLongError';
            this.solutions = [];
            Object.setPrototypeOf(this, AuthorizationErrors.JWTTokenExpirationTooLongError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    AuthorizationErrors.JWTTokenExpirationTooLongError = JWTTokenExpirationTooLongError;
    /**
     * Error received from the Twilio backend.
     */
    class ReconnectAttemptError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 31209;
            this.description = 'Reconnect attempt is not authorized.';
            this.explanation = '';
            this.name = 'ReconnectAttemptError';
            this.solutions = [];
            Object.setPrototypeOf(this, AuthorizationErrors.ReconnectAttemptError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    AuthorizationErrors.ReconnectAttemptError = ReconnectAttemptError;
    /**
     * Error received from the Twilio backend.
     */
    class CallMessageEventTypeInvalidError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [
                'The Call Message Event Type is invalid and is not understood by Twilio Voice.',
            ];
            this.code = 31210;
            this.description = 'Call Message Event Type is invalid.';
            this.explanation = 'The Call Message Event Type is invalid and is not understood by Twilio Voice.';
            this.name = 'CallMessageEventTypeInvalidError';
            this.solutions = [
                'Ensure the Call Message Event Type is Valid and understood by Twilio Voice and try again.',
            ];
            Object.setPrototypeOf(this, AuthorizationErrors.CallMessageEventTypeInvalidError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    AuthorizationErrors.CallMessageEventTypeInvalidError = CallMessageEventTypeInvalidError;
    /**
     * Error received from the Twilio backend.
     */
    class PayloadSizeExceededError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [
                'The payload size of Call Message Event exceeds the authorized limit.',
            ];
            this.code = 31212;
            this.description = 'Call Message Event Payload size exceeded authorized limit.';
            this.explanation = 'The request performed to send a Call Message Event exceeds the payload size authorized limit';
            this.name = 'PayloadSizeExceededError';
            this.solutions = [
                'Reduce payload size of Call Message Event to be within the authorized limit and try again.',
            ];
            Object.setPrototypeOf(this, AuthorizationErrors.PayloadSizeExceededError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    AuthorizationErrors.PayloadSizeExceededError = PayloadSizeExceededError;
})(AuthorizationErrors || (AuthorizationErrors = {}));
export var UserMediaErrors;
(function (UserMediaErrors) {
    /**
     * Error received from the Twilio backend.
     */
    class PermissionDeniedError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [
                'The user denied the getUserMedia request.',
                'The browser denied the getUserMedia request.',
            ];
            this.code = 31401;
            this.description = 'UserMedia Permission Denied Error';
            this.explanation = 'The browser or end-user denied permissions to user media. Therefore we were unable to acquire input audio.';
            this.name = 'PermissionDeniedError';
            this.solutions = [
                'The user should accept the request next time prompted. If the browser saved the deny, the user should change that permission in their browser.',
                'The user should to verify that the browser has permission to access the microphone at this address.',
            ];
            Object.setPrototypeOf(this, UserMediaErrors.PermissionDeniedError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    UserMediaErrors.PermissionDeniedError = PermissionDeniedError;
    /**
     * Error received from the Twilio backend.
     */
    class AcquisitionFailedError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [
                'NotFoundError - The deviceID specified was not found.',
                'The getUserMedia constraints were overconstrained and no devices matched.',
            ];
            this.code = 31402;
            this.description = 'UserMedia Acquisition Failed Error';
            this.explanation = 'The browser and end-user allowed permissions, however getting the media failed. Usually this is due to bad constraints, but can sometimes fail due to browser, OS or hardware issues.';
            this.name = 'AcquisitionFailedError';
            this.solutions = [
                'Ensure the deviceID being specified exists.',
                'Try acquiring media with fewer constraints.',
            ];
            Object.setPrototypeOf(this, UserMediaErrors.AcquisitionFailedError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    UserMediaErrors.AcquisitionFailedError = AcquisitionFailedError;
})(UserMediaErrors || (UserMediaErrors = {}));
export var SignalingErrors;
(function (SignalingErrors) {
    /**
     * Error received from the Twilio backend.
     */
    class ConnectionError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [];
            this.code = 53000;
            this.description = 'Signaling connection error';
            this.explanation = 'Raised whenever a signaling connection error occurs that is not covered by a more specific error code.';
            this.name = 'ConnectionError';
            this.solutions = [];
            Object.setPrototypeOf(this, SignalingErrors.ConnectionError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    SignalingErrors.ConnectionError = ConnectionError;
    /**
     * Error received from the Twilio backend.
     */
    class ConnectionDisconnected extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [
                'The device running your application lost its Internet connection.',
            ];
            this.code = 53001;
            this.description = 'Signaling connection disconnected';
            this.explanation = 'Raised whenever the signaling connection is unexpectedly disconnected.';
            this.name = 'ConnectionDisconnected';
            this.solutions = [
                'Ensure the device running your application has access to a stable Internet connection.',
            ];
            Object.setPrototypeOf(this, SignalingErrors.ConnectionDisconnected.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    SignalingErrors.ConnectionDisconnected = ConnectionDisconnected;
})(SignalingErrors || (SignalingErrors = {}));
export var MediaErrors;
(function (MediaErrors) {
    /**
     * Error received from the Twilio backend.
     */
    class ClientLocalDescFailed extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [
                'The Client may not be using a supported WebRTC implementation.',
                'The Client may not have the necessary resources to create or apply a new media description.',
            ];
            this.code = 53400;
            this.description = 'Client is unable to create or apply a local media description';
            this.explanation = 'Raised whenever a Client is unable to create or apply a local media description.';
            this.name = 'ClientLocalDescFailed';
            this.solutions = [
                'If you are experiencing this error using the JavaScript SDK, ensure you are running it with a supported WebRTC implementation.',
            ];
            Object.setPrototypeOf(this, MediaErrors.ClientLocalDescFailed.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    MediaErrors.ClientLocalDescFailed = ClientLocalDescFailed;
    /**
     * Error received from the Twilio backend.
     */
    class ClientRemoteDescFailed extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [
                'The Client may not be using a supported WebRTC implementation.',
                'The Client may be connecting peer-to-peer with another Participant that is not using a supported WebRTC implementation.',
                'The Client may not have the necessary resources to apply a new media description.',
            ];
            this.code = 53402;
            this.description = 'Client is unable to apply a remote media description';
            this.explanation = 'Raised whenever the Client receives a remote media description but is unable to apply it.';
            this.name = 'ClientRemoteDescFailed';
            this.solutions = [
                'If you are experiencing this error using the JavaScript SDK, ensure you are running it with a supported WebRTC implementation.',
            ];
            Object.setPrototypeOf(this, MediaErrors.ClientRemoteDescFailed.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    MediaErrors.ClientRemoteDescFailed = ClientRemoteDescFailed;
    /**
     * Error received from the Twilio backend.
     */
    class ConnectionError extends TwilioError {
        /**
         * @internal
         */
        constructor(messageOrError, error) {
            super(messageOrError, error);
            this.causes = [
                'The Client was unable to establish a media connection.',
                'A media connection which was active failed liveliness checks.',
            ];
            this.code = 53405;
            this.description = 'Media connection failed';
            this.explanation = 'Raised by the Client or Server whenever a media connection fails.';
            this.name = 'ConnectionError';
            this.solutions = [
                'If the problem persists, try connecting to another region.',
                'Check your Client\'s network connectivity.',
                'If you\'ve provided custom ICE Servers then ensure that the URLs and credentials are valid.',
            ];
            Object.setPrototypeOf(this, MediaErrors.ConnectionError.prototype);
            const message = typeof messageOrError === 'string'
                ? messageOrError
                : this.explanation;
            const originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            this.message = `${this.name} (${this.code}): ${message}`;
            this.originalError = originalError;
        }
    }
    MediaErrors.ConnectionError = ConnectionError;
})(MediaErrors || (MediaErrors = {}));
/**
 * @private
 */
export const errorsByCode = new Map([
    [20101, AuthorizationErrors.AccessTokenInvalid],
    [20104, AuthorizationErrors.AccessTokenExpired],
    [20151, AuthorizationErrors.AuthenticationFailed],
    [31202, SignatureValidationErrors.AccessTokenSignatureValidationFailed],
    [31400, ClientErrors.BadRequest],
    [31404, ClientErrors.NotFound],
    [31480, ClientErrors.TemporarilyUnavailable],
    [31486, ClientErrors.BusyHere],
    [31603, SIPServerErrors.Decline],
    [31000, GeneralErrors.UnknownError],
    [31001, GeneralErrors.ApplicationNotFoundError],
    [31002, GeneralErrors.ConnectionDeclinedError],
    [31003, GeneralErrors.ConnectionTimeoutError],
    [31005, GeneralErrors.ConnectionError],
    [31008, GeneralErrors.CallCancelledError],
    [31009, GeneralErrors.TransportError],
    [31100, MalformedRequestErrors.MalformedRequestError],
    [31101, MalformedRequestErrors.MissingParameterArrayError],
    [31102, MalformedRequestErrors.AuthorizationTokenMissingError],
    [31103, MalformedRequestErrors.MaxParameterLengthExceededError],
    [31104, MalformedRequestErrors.InvalidBridgeTokenError],
    [31105, MalformedRequestErrors.InvalidClientNameError],
    [31107, MalformedRequestErrors.ReconnectParameterInvalidError],
    [31201, AuthorizationErrors.AuthorizationError],
    [31203, AuthorizationErrors.NoValidAccountError],
    [31204, AuthorizationErrors.InvalidJWTTokenError],
    [31205, AuthorizationErrors.JWTTokenExpiredError],
    [31206, AuthorizationErrors.RateExceededError],
    [31207, AuthorizationErrors.JWTTokenExpirationTooLongError],
    [31209, AuthorizationErrors.ReconnectAttemptError],
    [31210, AuthorizationErrors.CallMessageEventTypeInvalidError],
    [31212, AuthorizationErrors.PayloadSizeExceededError],
    [31401, UserMediaErrors.PermissionDeniedError],
    [31402, UserMediaErrors.AcquisitionFailedError],
    [53000, SignalingErrors.ConnectionError],
    [53001, SignalingErrors.ConnectionDisconnected],
    [53400, MediaErrors.ClientLocalDescFailed],
    [53402, MediaErrors.ClientRemoteDescFailed],
    [53405, MediaErrors.ConnectionError],
]);
Object.freeze(errorsByCode);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9lcnJvcnMvZ2VuZXJhdGVkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLHlEQUF5RDtBQUN6RDs7R0FFRztBQUNILE9BQU8sV0FBVyxNQUFNLGVBQWUsQ0FBQztBQUN4QyxPQUFPLEVBQUUsV0FBVyxFQUFFLENBQUM7QUFFdkIsTUFBTSxLQUFXLG1CQUFtQixDQTZJbkM7QUE3SUQsV0FBaUIsbUJBQW1CO0lBQ2xDOztPQUVHO0lBQ0gsTUFBYSxrQkFBbUIsU0FBUSxXQUFXO1FBd0JqRDs7V0FFRztRQUNILFlBQVksY0FBd0MsRUFBRSxLQUFzQjtZQUMxRSxLQUFLLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBM0IvQixXQUFNLEdBQWEsRUFBRSxDQUFDO1lBQ3RCLFNBQUksR0FBVyxLQUFLLENBQUM7WUFDckIsZ0JBQVcsR0FBVyxzQkFBc0IsQ0FBQztZQUM3QyxnQkFBVyxHQUFXLGlEQUFpRCxDQUFDO1lBQ3hFLFNBQUksR0FBVyxvQkFBb0IsQ0FBQztZQUNwQyxjQUFTLEdBQWEsRUFBRSxDQUFDO1lBdUJ2QixNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxtQkFBbUIsQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUU5RSxNQUFNLE9BQU8sR0FBVyxPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUN4RCxDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7WUFFckIsTUFBTSxhQUFhLEdBQStCLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ2xGLENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsS0FBSyxDQUFDO1lBRVYsSUFBSSxDQUFDLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksTUFBTSxPQUFPLEVBQUUsQ0FBQztZQUN6RCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNyQyxDQUFDO0tBQ0Y7SUExQ1ksc0NBQWtCLHFCQTBDOUIsQ0FBQTtJQUVEOztPQUVHO0lBQ0gsTUFBYSxrQkFBbUIsU0FBUSxXQUFXO1FBd0JqRDs7V0FFRztRQUNILFlBQVksY0FBd0MsRUFBRSxLQUFzQjtZQUMxRSxLQUFLLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBM0IvQixXQUFNLEdBQWEsRUFBRSxDQUFDO1lBQ3RCLFNBQUksR0FBVyxLQUFLLENBQUM7WUFDckIsZ0JBQVcsR0FBVyxpREFBaUQsQ0FBQztZQUN4RSxnQkFBVyxHQUFXLDZLQUE2SyxDQUFDO1lBQ3BNLFNBQUksR0FBVyxvQkFBb0IsQ0FBQztZQUNwQyxjQUFTLEdBQWEsRUFBRSxDQUFDO1lBdUJ2QixNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxtQkFBbUIsQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUU5RSxNQUFNLE9BQU8sR0FBVyxPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUN4RCxDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7WUFFckIsTUFBTSxhQUFhLEdBQStCLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ2xGLENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsS0FBSyxDQUFDO1lBRVYsSUFBSSxDQUFDLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksTUFBTSxPQUFPLEVBQUUsQ0FBQztZQUN6RCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNyQyxDQUFDO0tBQ0Y7SUExQ1ksc0NBQWtCLHFCQTBDOUIsQ0FBQTtJQUVEOztPQUVHO0lBQ0gsTUFBYSxvQkFBcUIsU0FBUSxXQUFXO1FBd0JuRDs7V0FFRztRQUNILFlBQVksY0FBd0MsRUFBRSxLQUFzQjtZQUMxRSxLQUFLLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBM0IvQixXQUFNLEdBQWEsRUFBRSxDQUFDO1lBQ3RCLFNBQUksR0FBVyxLQUFLLENBQUM7WUFDckIsZ0JBQVcsR0FBVyx1QkFBdUIsQ0FBQztZQUM5QyxnQkFBVyxHQUFXLGlEQUFpRCxDQUFDO1lBQ3hFLFNBQUksR0FBVyxzQkFBc0IsQ0FBQztZQUN0QyxjQUFTLEdBQWEsRUFBRSxDQUFDO1lBdUJ2QixNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxtQkFBbUIsQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUVoRixNQUFNLE9BQU8sR0FBVyxPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUN4RCxDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7WUFFckIsTUFBTSxhQUFhLEdBQStCLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ2xGLENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsS0FBSyxDQUFDO1lBRVYsSUFBSSxDQUFDLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksTUFBTSxPQUFPLEVBQUUsQ0FBQztZQUN6RCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNyQyxDQUFDO0tBQ0Y7SUExQ1ksd0NBQW9CLHVCQTBDaEMsQ0FBQTtBQUNILENBQUMsRUE3SWdCLG1CQUFtQixLQUFuQixtQkFBbUIsUUE2SW5DO0FBRUQsTUFBTSxLQUFXLHlCQUF5QixDQW1EekM7QUFuREQsV0FBaUIseUJBQXlCO0lBQ3hDOztPQUVHO0lBQ0gsTUFBYSxvQ0FBcUMsU0FBUSxXQUFXO1FBNEJuRTs7V0FFRztRQUNILFlBQVksY0FBd0MsRUFBRSxLQUFzQjtZQUMxRSxLQUFLLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBL0IvQixXQUFNLEdBQWE7Z0JBQ2pCLDBFQUEwRTthQUMzRSxDQUFDO1lBQ0YsU0FBSSxHQUFXLEtBQUssQ0FBQztZQUNyQixnQkFBVyxHQUFXLDhCQUE4QixDQUFDO1lBQ3JELGdCQUFXLEdBQVcsd0RBQXdELENBQUM7WUFDL0UsU0FBSSxHQUFXLHNDQUFzQyxDQUFDO1lBQ3RELGNBQVMsR0FBYTtnQkFDcEIsa0dBQWtHO2FBQ25HLENBQUM7WUF1QkEsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUseUJBQXlCLENBQUMsb0NBQW9DLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFdEcsTUFBTSxPQUFPLEdBQVcsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDeEQsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDO1lBRXJCLE1BQU0sYUFBYSxHQUErQixPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUNsRixDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUVWLElBQUksQ0FBQyxPQUFPLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLE1BQU0sT0FBTyxFQUFFLENBQUM7WUFDekQsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7UUFDckMsQ0FBQztLQUNGO0lBOUNZLDhEQUFvQyx1Q0E4Q2hELENBQUE7QUFDSCxDQUFDLEVBbkRnQix5QkFBeUIsS0FBekIseUJBQXlCLFFBbUR6QztBQUVELE1BQU0sS0FBVyxZQUFZLENBa001QjtBQWxNRCxXQUFpQixZQUFZO0lBQzNCOztPQUVHO0lBQ0gsTUFBYSxVQUFXLFNBQVEsV0FBVztRQXdCekM7O1dBRUc7UUFDSCxZQUFZLGNBQXdDLEVBQUUsS0FBc0I7WUFDMUUsS0FBSyxDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQTNCL0IsV0FBTSxHQUFhLEVBQUUsQ0FBQztZQUN0QixTQUFJLEdBQVcsS0FBSyxDQUFDO1lBQ3JCLGdCQUFXLEdBQVcsd0JBQXdCLENBQUM7WUFDL0MsZ0JBQVcsR0FBVyw4REFBOEQsQ0FBQztZQUNyRixTQUFJLEdBQVcsWUFBWSxDQUFDO1lBQzVCLGNBQVMsR0FBYSxFQUFFLENBQUM7WUF1QnZCLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxVQUFVLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFL0QsTUFBTSxPQUFPLEdBQVcsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDeEQsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDO1lBRXJCLE1BQU0sYUFBYSxHQUErQixPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUNsRixDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUVWLElBQUksQ0FBQyxPQUFPLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLE1BQU0sT0FBTyxFQUFFLENBQUM7WUFDekQsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7UUFDckMsQ0FBQztLQUNGO0lBMUNZLHVCQUFVLGFBMEN0QixDQUFBO0lBRUQ7O09BRUc7SUFDSCxNQUFhLFFBQVMsU0FBUSxXQUFXO1FBOEJ2Qzs7V0FFRztRQUNILFlBQVksY0FBd0MsRUFBRSxLQUFzQjtZQUMxRSxLQUFLLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBakMvQixXQUFNLEdBQWE7Z0JBQ2pCLHdEQUF3RDtnQkFDeEQsbURBQW1EO2FBQ3BELENBQUM7WUFDRixTQUFJLEdBQVcsS0FBSyxDQUFDO1lBQ3JCLGdCQUFXLEdBQVcsc0JBQXNCLENBQUM7WUFDN0MsZ0JBQVcsR0FBVyx5REFBeUQsQ0FBQztZQUNoRixTQUFJLEdBQVcsVUFBVSxDQUFDO1lBQzFCLGNBQVMsR0FBYTtnQkFDcEIsMENBQTBDO2dCQUMxQyw2RUFBNkU7YUFDOUUsQ0FBQztZQXVCQSxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRTdELE1BQU0sT0FBTyxHQUFXLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ3hELENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUVyQixNQUFNLGFBQWEsR0FBK0IsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDbEYsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFFVixJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxNQUFNLE9BQU8sRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBQ3JDLENBQUM7S0FDRjtJQWhEWSxxQkFBUSxXQWdEcEIsQ0FBQTtJQUVEOztPQUVHO0lBQ0gsTUFBYSxzQkFBdUIsU0FBUSxXQUFXO1FBd0JyRDs7V0FFRztRQUNILFlBQVksY0FBd0MsRUFBRSxLQUFzQjtZQUMxRSxLQUFLLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBM0IvQixXQUFNLEdBQWEsRUFBRSxDQUFDO1lBQ3RCLFNBQUksR0FBVyxLQUFLLENBQUM7WUFDckIsZ0JBQVcsR0FBVywrQkFBK0IsQ0FBQztZQUN0RCxnQkFBVyxHQUFXLHNDQUFzQyxDQUFDO1lBQzdELFNBQUksR0FBVyx3QkFBd0IsQ0FBQztZQUN4QyxjQUFTLEdBQWEsRUFBRSxDQUFDO1lBdUJ2QixNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsc0JBQXNCLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFM0UsTUFBTSxPQUFPLEdBQVcsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDeEQsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDO1lBRXJCLE1BQU0sYUFBYSxHQUErQixPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUNsRixDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUVWLElBQUksQ0FBQyxPQUFPLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLE1BQU0sT0FBTyxFQUFFLENBQUM7WUFDekQsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7UUFDckMsQ0FBQztLQUNGO0lBMUNZLG1DQUFzQix5QkEwQ2xDLENBQUE7SUFFRDs7T0FFRztJQUNILE1BQWEsUUFBUyxTQUFRLFdBQVc7UUF3QnZDOztXQUVHO1FBQ0gsWUFBWSxjQUF3QyxFQUFFLEtBQXNCO1lBQzFFLEtBQUssQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7WUEzQi9CLFdBQU0sR0FBYSxFQUFFLENBQUM7WUFDdEIsU0FBSSxHQUFXLEtBQUssQ0FBQztZQUNyQixnQkFBVyxHQUFXLGlCQUFpQixDQUFDO1lBQ3hDLGdCQUFXLEdBQVcscUJBQXFCLENBQUM7WUFDNUMsU0FBSSxHQUFXLFVBQVUsQ0FBQztZQUMxQixjQUFTLEdBQWEsRUFBRSxDQUFDO1lBdUJ2QixNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsUUFBUSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRTdELE1BQU0sT0FBTyxHQUFXLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ3hELENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUVyQixNQUFNLGFBQWEsR0FBK0IsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDbEYsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFFVixJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxNQUFNLE9BQU8sRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBQ3JDLENBQUM7S0FDRjtJQTFDWSxxQkFBUSxXQTBDcEIsQ0FBQTtBQUNILENBQUMsRUFsTWdCLFlBQVksS0FBWixZQUFZLFFBa001QjtBQUVELE1BQU0sS0FBVyxlQUFlLENBK0MvQjtBQS9DRCxXQUFpQixlQUFlO0lBQzlCOztPQUVHO0lBQ0gsTUFBYSxPQUFRLFNBQVEsV0FBVztRQXdCdEM7O1dBRUc7UUFDSCxZQUFZLGNBQXdDLEVBQUUsS0FBc0I7WUFDMUUsS0FBSyxDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQTNCL0IsV0FBTSxHQUFhLEVBQUUsQ0FBQztZQUN0QixTQUFJLEdBQVcsS0FBSyxDQUFDO1lBQ3JCLGdCQUFXLEdBQVcsZUFBZSxDQUFDO1lBQ3RDLGdCQUFXLEdBQVcsc0RBQXNELENBQUM7WUFDN0UsU0FBSSxHQUFXLFNBQVMsQ0FBQztZQUN6QixjQUFTLEdBQWEsRUFBRSxDQUFDO1lBdUJ2QixNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxlQUFlLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRS9ELE1BQU0sT0FBTyxHQUFXLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ3hELENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUVyQixNQUFNLGFBQWEsR0FBK0IsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDbEYsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFFVixJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxNQUFNLE9BQU8sRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBQ3JDLENBQUM7S0FDRjtJQTFDWSx1QkFBTyxVQTBDbkIsQ0FBQTtBQUNILENBQUMsRUEvQ2dCLGVBQWUsS0FBZixlQUFlLFFBK0MvQjtBQUVELE1BQU0sS0FBVyxhQUFhLENBMlU3QjtBQTNVRCxXQUFpQixhQUFhO0lBQzVCOztPQUVHO0lBQ0gsTUFBYSxZQUFhLFNBQVEsV0FBVztRQXdCM0M7O1dBRUc7UUFDSCxZQUFZLGNBQXdDLEVBQUUsS0FBc0I7WUFDMUUsS0FBSyxDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQTNCL0IsV0FBTSxHQUFhLEVBQUUsQ0FBQztZQUN0QixTQUFJLEdBQVcsS0FBSyxDQUFDO1lBQ3JCLGdCQUFXLEdBQVcsZUFBZSxDQUFDO1lBQ3RDLGdCQUFXLEdBQVcsd0VBQXdFLENBQUM7WUFDL0YsU0FBSSxHQUFXLGNBQWMsQ0FBQztZQUM5QixjQUFTLEdBQWEsRUFBRSxDQUFDO1lBdUJ2QixNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRWxFLE1BQU0sT0FBTyxHQUFXLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ3hELENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUVyQixNQUFNLGFBQWEsR0FBK0IsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDbEYsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFFVixJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxNQUFNLE9BQU8sRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBQ3JDLENBQUM7S0FDRjtJQTFDWSwwQkFBWSxlQTBDeEIsQ0FBQTtJQUVEOztPQUVHO0lBQ0gsTUFBYSx3QkFBeUIsU0FBUSxXQUFXO1FBd0J2RDs7V0FFRztRQUNILFlBQVksY0FBd0MsRUFBRSxLQUFzQjtZQUMxRSxLQUFLLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBM0IvQixXQUFNLEdBQWEsRUFBRSxDQUFDO1lBQ3RCLFNBQUksR0FBVyxLQUFLLENBQUM7WUFDckIsZ0JBQVcsR0FBVyx1QkFBdUIsQ0FBQztZQUM5QyxnQkFBVyxHQUFXLEVBQUUsQ0FBQztZQUN6QixTQUFJLEdBQVcsMEJBQTBCLENBQUM7WUFDMUMsY0FBUyxHQUFhLEVBQUUsQ0FBQztZQXVCdkIsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLHdCQUF3QixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRTlFLE1BQU0sT0FBTyxHQUFXLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ3hELENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUVyQixNQUFNLGFBQWEsR0FBK0IsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDbEYsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFFVixJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxNQUFNLE9BQU8sRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBQ3JDLENBQUM7S0FDRjtJQTFDWSxzQ0FBd0IsMkJBMENwQyxDQUFBO0lBRUQ7O09BRUc7SUFDSCxNQUFhLHVCQUF3QixTQUFRLFdBQVc7UUF3QnREOztXQUVHO1FBQ0gsWUFBWSxjQUF3QyxFQUFFLEtBQXNCO1lBQzFFLEtBQUssQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7WUEzQi9CLFdBQU0sR0FBYSxFQUFFLENBQUM7WUFDdEIsU0FBSSxHQUFXLEtBQUssQ0FBQztZQUNyQixnQkFBVyxHQUFXLHFCQUFxQixDQUFDO1lBQzVDLGdCQUFXLEdBQVcsRUFBRSxDQUFDO1lBQ3pCLFNBQUksR0FBVyx5QkFBeUIsQ0FBQztZQUN6QyxjQUFTLEdBQWEsRUFBRSxDQUFDO1lBdUJ2QixNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsdUJBQXVCLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFN0UsTUFBTSxPQUFPLEdBQVcsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDeEQsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDO1lBRXJCLE1BQU0sYUFBYSxHQUErQixPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUNsRixDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUVWLElBQUksQ0FBQyxPQUFPLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLE1BQU0sT0FBTyxFQUFFLENBQUM7WUFDekQsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7UUFDckMsQ0FBQztLQUNGO0lBMUNZLHFDQUF1QiwwQkEwQ25DLENBQUE7SUFFRDs7T0FFRztJQUNILE1BQWEsc0JBQXVCLFNBQVEsV0FBVztRQXdCckQ7O1dBRUc7UUFDSCxZQUFZLGNBQXdDLEVBQUUsS0FBc0I7WUFDMUUsS0FBSyxDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQTNCL0IsV0FBTSxHQUFhLEVBQUUsQ0FBQztZQUN0QixTQUFJLEdBQVcsS0FBSyxDQUFDO1lBQ3JCLGdCQUFXLEdBQVcsb0JBQW9CLENBQUM7WUFDM0MsZ0JBQVcsR0FBVywyRUFBMkUsQ0FBQztZQUNsRyxTQUFJLEdBQVcsd0JBQXdCLENBQUM7WUFDeEMsY0FBUyxHQUFhLEVBQUUsQ0FBQztZQXVCdkIsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLHNCQUFzQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRTVFLE1BQU0sT0FBTyxHQUFXLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ3hELENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUVyQixNQUFNLGFBQWEsR0FBK0IsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDbEYsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFFVixJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxNQUFNLE9BQU8sRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBQ3JDLENBQUM7S0FDRjtJQTFDWSxvQ0FBc0IseUJBMENsQyxDQUFBO0lBRUQ7O09BRUc7SUFDSCxNQUFhLGVBQWdCLFNBQVEsV0FBVztRQXdCOUM7O1dBRUc7UUFDSCxZQUFZLGNBQXdDLEVBQUUsS0FBc0I7WUFDMUUsS0FBSyxDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQTNCL0IsV0FBTSxHQUFhLEVBQUUsQ0FBQztZQUN0QixTQUFJLEdBQVcsS0FBSyxDQUFDO1lBQ3JCLGdCQUFXLEdBQVcsa0JBQWtCLENBQUM7WUFDekMsZ0JBQVcsR0FBVyw2Q0FBNkMsQ0FBQztZQUNwRSxTQUFJLEdBQVcsaUJBQWlCLENBQUM7WUFDakMsY0FBUyxHQUFhLEVBQUUsQ0FBQztZQXVCdkIsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLGVBQWUsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUVyRSxNQUFNLE9BQU8sR0FBVyxPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUN4RCxDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7WUFFckIsTUFBTSxhQUFhLEdBQStCLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ2xGLENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsS0FBSyxDQUFDO1lBRVYsSUFBSSxDQUFDLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksTUFBTSxPQUFPLEVBQUUsQ0FBQztZQUN6RCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNyQyxDQUFDO0tBQ0Y7SUExQ1ksNkJBQWUsa0JBMEMzQixDQUFBO0lBRUQ7O09BRUc7SUFDSCxNQUFhLGtCQUFtQixTQUFRLFdBQVc7UUEwQmpEOztXQUVHO1FBQ0gsWUFBWSxjQUF3QyxFQUFFLEtBQXNCO1lBQzFFLEtBQUssQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7WUE3Qi9CLFdBQU0sR0FBYTtnQkFDakIsb0tBQW9LO2FBQ3JLLENBQUM7WUFDRixTQUFJLEdBQVcsS0FBSyxDQUFDO1lBQ3JCLGdCQUFXLEdBQVcsZ0JBQWdCLENBQUM7WUFDdkMsZ0JBQVcsR0FBVyw2Q0FBNkMsQ0FBQztZQUNwRSxTQUFJLEdBQVcsb0JBQW9CLENBQUM7WUFDcEMsY0FBUyxHQUFhLEVBQUUsQ0FBQztZQXVCdkIsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsYUFBYSxDQUFDLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRXhFLE1BQU0sT0FBTyxHQUFXLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ3hELENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUVyQixNQUFNLGFBQWEsR0FBK0IsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDbEYsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFFVixJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxNQUFNLE9BQU8sRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBQ3JDLENBQUM7S0FDRjtJQTVDWSxnQ0FBa0IscUJBNEM5QixDQUFBO0lBRUQ7O09BRUc7SUFDSCxNQUFhLGNBQWUsU0FBUSxXQUFXO1FBd0I3Qzs7V0FFRztRQUNILFlBQVksY0FBd0MsRUFBRSxLQUFzQjtZQUMxRSxLQUFLLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBM0IvQixXQUFNLEdBQWEsRUFBRSxDQUFDO1lBQ3RCLFNBQUksR0FBVyxLQUFLLENBQUM7WUFDckIsZ0JBQVcsR0FBVyxpQkFBaUIsQ0FBQztZQUN4QyxnQkFBVyxHQUFXLG9EQUFvRCxDQUFDO1lBQzNFLFNBQUksR0FBVyxnQkFBZ0IsQ0FBQztZQUNoQyxjQUFTLEdBQWEsRUFBRSxDQUFDO1lBdUJ2QixNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxhQUFhLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRXBFLE1BQU0sT0FBTyxHQUFXLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ3hELENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUVyQixNQUFNLGFBQWEsR0FBK0IsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDbEYsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFFVixJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxNQUFNLE9BQU8sRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBQ3JDLENBQUM7S0FDRjtJQTFDWSw0QkFBYyxpQkEwQzFCLENBQUE7QUFDSCxDQUFDLEVBM1VnQixhQUFhLEtBQWIsYUFBYSxRQTJVN0I7QUFFRCxNQUFNLEtBQVcsc0JBQXNCLENBaVZ0QztBQWpWRCxXQUFpQixzQkFBc0I7SUFDckM7O09BRUc7SUFDSCxNQUFhLHFCQUFzQixTQUFRLFdBQVc7UUE0QnBEOztXQUVHO1FBQ0gsWUFBWSxjQUF3QyxFQUFFLEtBQXNCO1lBQzFFLEtBQUssQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7WUEvQi9CLFdBQU0sR0FBYTtnQkFDakIsOERBQThEO2FBQy9ELENBQUM7WUFDRixTQUFJLEdBQVcsS0FBSyxDQUFDO1lBQ3JCLGdCQUFXLEdBQVcsbUNBQW1DLENBQUM7WUFDMUQsZ0JBQVcsR0FBVyw4REFBOEQsQ0FBQztZQUNyRixTQUFJLEdBQVcsdUJBQXVCLENBQUM7WUFDdkMsY0FBUyxHQUFhO2dCQUNwQix3RUFBd0U7YUFDekUsQ0FBQztZQXVCQSxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxzQkFBc0IsQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUVwRixNQUFNLE9BQU8sR0FBVyxPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUN4RCxDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7WUFFckIsTUFBTSxhQUFhLEdBQStCLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ2xGLENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsS0FBSyxDQUFDO1lBRVYsSUFBSSxDQUFDLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksTUFBTSxPQUFPLEVBQUUsQ0FBQztZQUN6RCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNyQyxDQUFDO0tBQ0Y7SUE5Q1ksNENBQXFCLHdCQThDakMsQ0FBQTtJQUVEOztPQUVHO0lBQ0gsTUFBYSwwQkFBMkIsU0FBUSxXQUFXO1FBd0J6RDs7V0FFRztRQUNILFlBQVksY0FBd0MsRUFBRSxLQUFzQjtZQUMxRSxLQUFLLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBM0IvQixXQUFNLEdBQWEsRUFBRSxDQUFDO1lBQ3RCLFNBQUksR0FBVyxLQUFLLENBQUM7WUFDckIsZ0JBQVcsR0FBVyxvQ0FBb0MsQ0FBQztZQUMzRCxnQkFBVyxHQUFXLEVBQUUsQ0FBQztZQUN6QixTQUFJLEdBQVcsNEJBQTRCLENBQUM7WUFDNUMsY0FBUyxHQUFhLEVBQUUsQ0FBQztZQXVCdkIsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLENBQUMsMEJBQTBCLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFekYsTUFBTSxPQUFPLEdBQVcsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDeEQsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDO1lBRXJCLE1BQU0sYUFBYSxHQUErQixPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUNsRixDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUVWLElBQUksQ0FBQyxPQUFPLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLE1BQU0sT0FBTyxFQUFFLENBQUM7WUFDekQsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7UUFDckMsQ0FBQztLQUNGO0lBMUNZLGlEQUEwQiw2QkEwQ3RDLENBQUE7SUFFRDs7T0FFRztJQUNILE1BQWEsOEJBQStCLFNBQVEsV0FBVztRQXdCN0Q7O1dBRUc7UUFDSCxZQUFZLGNBQXdDLEVBQUUsS0FBc0I7WUFDMUUsS0FBSyxDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQTNCL0IsV0FBTSxHQUFhLEVBQUUsQ0FBQztZQUN0QixTQUFJLEdBQVcsS0FBSyxDQUFDO1lBQ3JCLGdCQUFXLEdBQVcseUNBQXlDLENBQUM7WUFDaEUsZ0JBQVcsR0FBVyxFQUFFLENBQUM7WUFDekIsU0FBSSxHQUFXLGdDQUFnQyxDQUFDO1lBQ2hELGNBQVMsR0FBYSxFQUFFLENBQUM7WUF1QnZCLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLHNCQUFzQixDQUFDLDhCQUE4QixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRTdGLE1BQU0sT0FBTyxHQUFXLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ3hELENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUVyQixNQUFNLGFBQWEsR0FBK0IsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDbEYsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFFVixJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxNQUFNLE9BQU8sRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBQ3JDLENBQUM7S0FDRjtJQTFDWSxxREFBOEIsaUNBMEMxQyxDQUFBO0lBRUQ7O09BRUc7SUFDSCxNQUFhLCtCQUFnQyxTQUFRLFdBQVc7UUF3QjlEOztXQUVHO1FBQ0gsWUFBWSxjQUF3QyxFQUFFLEtBQXNCO1lBQzFFLEtBQUssQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7WUEzQi9CLFdBQU0sR0FBYSxFQUFFLENBQUM7WUFDdEIsU0FBSSxHQUFXLEtBQUssQ0FBQztZQUNyQixnQkFBVyxHQUFXLDZDQUE2QyxDQUFDO1lBQ3BFLGdCQUFXLEdBQVcsc0RBQXNELENBQUM7WUFDN0UsU0FBSSxHQUFXLGlDQUFpQyxDQUFDO1lBQ2pELGNBQVMsR0FBYSxFQUFFLENBQUM7WUF1QnZCLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLHNCQUFzQixDQUFDLCtCQUErQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRTlGLE1BQU0sT0FBTyxHQUFXLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ3hELENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUVyQixNQUFNLGFBQWEsR0FBK0IsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDbEYsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFFVixJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxNQUFNLE9BQU8sRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBQ3JDLENBQUM7S0FDRjtJQTFDWSxzREFBK0Isa0NBMEMzQyxDQUFBO0lBRUQ7O09BRUc7SUFDSCxNQUFhLHVCQUF3QixTQUFRLFdBQVc7UUF3QnREOztXQUVHO1FBQ0gsWUFBWSxjQUF3QyxFQUFFLEtBQXNCO1lBQzFFLEtBQUssQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7WUEzQi9CLFdBQU0sR0FBYSxFQUFFLENBQUM7WUFDdEIsU0FBSSxHQUFXLEtBQUssQ0FBQztZQUNyQixnQkFBVyxHQUFXLHNCQUFzQixDQUFDO1lBQzdDLGdCQUFXLEdBQVcsRUFBRSxDQUFDO1lBQ3pCLFNBQUksR0FBVyx5QkFBeUIsQ0FBQztZQUN6QyxjQUFTLEdBQWEsRUFBRSxDQUFDO1lBdUJ2QixNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxzQkFBc0IsQ0FBQyx1QkFBdUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUV0RixNQUFNLE9BQU8sR0FBVyxPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUN4RCxDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7WUFFckIsTUFBTSxhQUFhLEdBQStCLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ2xGLENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsS0FBSyxDQUFDO1lBRVYsSUFBSSxDQUFDLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksTUFBTSxPQUFPLEVBQUUsQ0FBQztZQUN6RCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNyQyxDQUFDO0tBQ0Y7SUExQ1ksOENBQXVCLDBCQTBDbkMsQ0FBQTtJQUVEOztPQUVHO0lBQ0gsTUFBYSxzQkFBdUIsU0FBUSxXQUFXO1FBNEJyRDs7V0FFRztRQUNILFlBQVksY0FBd0MsRUFBRSxLQUFzQjtZQUMxRSxLQUFLLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBL0IvQixXQUFNLEdBQWE7Z0JBQ2pCLDBDQUEwQzthQUMzQyxDQUFDO1lBQ0YsU0FBSSxHQUFXLEtBQUssQ0FBQztZQUNyQixnQkFBVyxHQUFXLHFCQUFxQixDQUFDO1lBQzVDLGdCQUFXLEdBQVcsOEVBQThFLENBQUM7WUFDckcsU0FBSSxHQUFXLHdCQUF3QixDQUFDO1lBQ3hDLGNBQVMsR0FBYTtnQkFDcEIsNEVBQTRFO2FBQzdFLENBQUM7WUF1QkEsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsc0JBQXNCLENBQUMsc0JBQXNCLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFckYsTUFBTSxPQUFPLEdBQVcsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDeEQsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDO1lBRXJCLE1BQU0sYUFBYSxHQUErQixPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUNsRixDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUVWLElBQUksQ0FBQyxPQUFPLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLE1BQU0sT0FBTyxFQUFFLENBQUM7WUFDekQsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7UUFDckMsQ0FBQztLQUNGO0lBOUNZLDZDQUFzQix5QkE4Q2xDLENBQUE7SUFFRDs7T0FFRztJQUNILE1BQWEsOEJBQStCLFNBQVEsV0FBVztRQXdCN0Q7O1dBRUc7UUFDSCxZQUFZLGNBQXdDLEVBQUUsS0FBc0I7WUFDMUUsS0FBSyxDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQTNCL0IsV0FBTSxHQUFhLEVBQUUsQ0FBQztZQUN0QixTQUFJLEdBQVcsS0FBSyxDQUFDO1lBQ3JCLGdCQUFXLEdBQVcsb0NBQW9DLENBQUM7WUFDM0QsZ0JBQVcsR0FBVyxFQUFFLENBQUM7WUFDekIsU0FBSSxHQUFXLGdDQUFnQyxDQUFDO1lBQ2hELGNBQVMsR0FBYSxFQUFFLENBQUM7WUF1QnZCLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLHNCQUFzQixDQUFDLDhCQUE4QixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRTdGLE1BQU0sT0FBTyxHQUFXLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ3hELENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUVyQixNQUFNLGFBQWEsR0FBK0IsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDbEYsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFFVixJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxNQUFNLE9BQU8sRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBQ3JDLENBQUM7S0FDRjtJQTFDWSxxREFBOEIsaUNBMEMxQyxDQUFBO0FBQ0gsQ0FBQyxFQWpWZ0Isc0JBQXNCLEtBQXRCLHNCQUFzQixRQWlWdEM7QUFFRCxXQUFpQixtQkFBbUI7SUFDbEM7O09BRUc7SUFDSCxNQUFhLGtCQUFtQixTQUFRLFdBQVc7UUF3QmpEOztXQUVHO1FBQ0gsWUFBWSxjQUF3QyxFQUFFLEtBQXNCO1lBQzFFLEtBQUssQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7WUEzQi9CLFdBQU0sR0FBYSxFQUFFLENBQUM7WUFDdEIsU0FBSSxHQUFXLEtBQUssQ0FBQztZQUNyQixnQkFBVyxHQUFXLHFCQUFxQixDQUFDO1lBQzVDLGdCQUFXLEdBQVcsNkdBQTZHLENBQUM7WUFDcEksU0FBSSxHQUFXLG9CQUFvQixDQUFDO1lBQ3BDLGNBQVMsR0FBYSxFQUFFLENBQUM7WUF1QnZCLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLG1CQUFtQixDQUFDLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRTlFLE1BQU0sT0FBTyxHQUFXLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ3hELENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUVyQixNQUFNLGFBQWEsR0FBK0IsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDbEYsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFFVixJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxNQUFNLE9BQU8sRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBQ3JDLENBQUM7S0FDRjtJQTFDWSxzQ0FBa0IscUJBMEM5QixDQUFBO0lBRUQ7O09BRUc7SUFDSCxNQUFhLG1CQUFvQixTQUFRLFdBQVc7UUF3QmxEOztXQUVHO1FBQ0gsWUFBWSxjQUF3QyxFQUFFLEtBQXNCO1lBQzFFLEtBQUssQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7WUEzQi9CLFdBQU0sR0FBYSxFQUFFLENBQUM7WUFDdEIsU0FBSSxHQUFXLEtBQUssQ0FBQztZQUNyQixnQkFBVyxHQUFXLGtCQUFrQixDQUFDO1lBQ3pDLGdCQUFXLEdBQVcsRUFBRSxDQUFDO1lBQ3pCLFNBQUksR0FBVyxxQkFBcUIsQ0FBQztZQUNyQyxjQUFTLEdBQWEsRUFBRSxDQUFDO1lBdUJ2QixNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxtQkFBbUIsQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUUvRSxNQUFNLE9BQU8sR0FBVyxPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUN4RCxDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7WUFFckIsTUFBTSxhQUFhLEdBQStCLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ2xGLENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsS0FBSyxDQUFDO1lBRVYsSUFBSSxDQUFDLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksTUFBTSxPQUFPLEVBQUUsQ0FBQztZQUN6RCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNyQyxDQUFDO0tBQ0Y7SUExQ1ksdUNBQW1CLHNCQTBDL0IsQ0FBQTtJQUVEOztPQUVHO0lBQ0gsTUFBYSxvQkFBcUIsU0FBUSxXQUFXO1FBd0JuRDs7V0FFRztRQUNILFlBQVksY0FBd0MsRUFBRSxLQUFzQjtZQUMxRSxLQUFLLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBM0IvQixXQUFNLEdBQWEsRUFBRSxDQUFDO1lBQ3RCLFNBQUksR0FBVyxLQUFLLENBQUM7WUFDckIsZ0JBQVcsR0FBVyxtQkFBbUIsQ0FBQztZQUMxQyxnQkFBVyxHQUFXLEVBQUUsQ0FBQztZQUN6QixTQUFJLEdBQVcsc0JBQXNCLENBQUM7WUFDdEMsY0FBUyxHQUFhLEVBQUUsQ0FBQztZQXVCdkIsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLENBQUMsb0JBQW9CLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFaEYsTUFBTSxPQUFPLEdBQVcsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDeEQsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDO1lBRXJCLE1BQU0sYUFBYSxHQUErQixPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUNsRixDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUVWLElBQUksQ0FBQyxPQUFPLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLE1BQU0sT0FBTyxFQUFFLENBQUM7WUFDekQsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7UUFDckMsQ0FBQztLQUNGO0lBMUNZLHdDQUFvQix1QkEwQ2hDLENBQUE7SUFFRDs7T0FFRztJQUNILE1BQWEsb0JBQXFCLFNBQVEsV0FBVztRQXdCbkQ7O1dBRUc7UUFDSCxZQUFZLGNBQXdDLEVBQUUsS0FBc0I7WUFDMUUsS0FBSyxDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQTNCL0IsV0FBTSxHQUFhLEVBQUUsQ0FBQztZQUN0QixTQUFJLEdBQVcsS0FBSyxDQUFDO1lBQ3JCLGdCQUFXLEdBQVcsbUJBQW1CLENBQUM7WUFDMUMsZ0JBQVcsR0FBVyxFQUFFLENBQUM7WUFDekIsU0FBSSxHQUFXLHNCQUFzQixDQUFDO1lBQ3RDLGNBQVMsR0FBYSxFQUFFLENBQUM7WUF1QnZCLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLG1CQUFtQixDQUFDLG9CQUFvQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRWhGLE1BQU0sT0FBTyxHQUFXLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ3hELENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUVyQixNQUFNLGFBQWEsR0FBK0IsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDbEYsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFFVixJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxNQUFNLE9BQU8sRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBQ3JDLENBQUM7S0FDRjtJQTFDWSx3Q0FBb0IsdUJBMENoQyxDQUFBO0lBRUQ7O09BRUc7SUFDSCxNQUFhLGlCQUFrQixTQUFRLFdBQVc7UUE0QmhEOztXQUVHO1FBQ0gsWUFBWSxjQUF3QyxFQUFFLEtBQXNCO1lBQzFFLEtBQUssQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7WUEvQi9CLFdBQU0sR0FBYTtnQkFDakIsc0JBQXNCO2FBQ3ZCLENBQUM7WUFDRixTQUFJLEdBQVcsS0FBSyxDQUFDO1lBQ3JCLGdCQUFXLEdBQVcsaUNBQWlDLENBQUM7WUFDeEQsZ0JBQVcsR0FBVyxxREFBcUQsQ0FBQztZQUM1RSxTQUFJLEdBQVcsbUJBQW1CLENBQUM7WUFDbkMsY0FBUyxHQUFhO2dCQUNwQiw2REFBNkQ7YUFDOUQsQ0FBQztZQXVCQSxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxtQkFBbUIsQ0FBQyxpQkFBaUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUU3RSxNQUFNLE9BQU8sR0FBVyxPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUN4RCxDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7WUFFckIsTUFBTSxhQUFhLEdBQStCLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ2xGLENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsS0FBSyxDQUFDO1lBRVYsSUFBSSxDQUFDLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksTUFBTSxPQUFPLEVBQUUsQ0FBQztZQUN6RCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNyQyxDQUFDO0tBQ0Y7SUE5Q1kscUNBQWlCLG9CQThDN0IsQ0FBQTtJQUVEOztPQUVHO0lBQ0gsTUFBYSw4QkFBK0IsU0FBUSxXQUFXO1FBd0I3RDs7V0FFRztRQUNILFlBQVksY0FBd0MsRUFBRSxLQUFzQjtZQUMxRSxLQUFLLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBM0IvQixXQUFNLEdBQWEsRUFBRSxDQUFDO1lBQ3RCLFNBQUksR0FBVyxLQUFLLENBQUM7WUFDckIsZ0JBQVcsR0FBVywrQkFBK0IsQ0FBQztZQUN0RCxnQkFBVyxHQUFXLEVBQUUsQ0FBQztZQUN6QixTQUFJLEdBQVcsZ0NBQWdDLENBQUM7WUFDaEQsY0FBUyxHQUFhLEVBQUUsQ0FBQztZQXVCdkIsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLENBQUMsOEJBQThCLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFMUYsTUFBTSxPQUFPLEdBQVcsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDeEQsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDO1lBRXJCLE1BQU0sYUFBYSxHQUErQixPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUNsRixDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUVWLElBQUksQ0FBQyxPQUFPLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLE1BQU0sT0FBTyxFQUFFLENBQUM7WUFDekQsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7UUFDckMsQ0FBQztLQUNGO0lBMUNZLGtEQUE4QixpQ0EwQzFDLENBQUE7SUFFRDs7T0FFRztJQUNILE1BQWEscUJBQXNCLFNBQVEsV0FBVztRQXdCcEQ7O1dBRUc7UUFDSCxZQUFZLGNBQXdDLEVBQUUsS0FBc0I7WUFDMUUsS0FBSyxDQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsQ0FBQztZQTNCL0IsV0FBTSxHQUFhLEVBQUUsQ0FBQztZQUN0QixTQUFJLEdBQVcsS0FBSyxDQUFDO1lBQ3JCLGdCQUFXLEdBQVcsc0NBQXNDLENBQUM7WUFDN0QsZ0JBQVcsR0FBVyxFQUFFLENBQUM7WUFDekIsU0FBSSxHQUFXLHVCQUF1QixDQUFDO1lBQ3ZDLGNBQVMsR0FBYSxFQUFFLENBQUM7WUF1QnZCLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLG1CQUFtQixDQUFDLHFCQUFxQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRWpGLE1BQU0sT0FBTyxHQUFXLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ3hELENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUVyQixNQUFNLGFBQWEsR0FBK0IsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDbEYsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFFVixJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxNQUFNLE9BQU8sRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBQ3JDLENBQUM7S0FDRjtJQTFDWSx5Q0FBcUIsd0JBMENqQyxDQUFBO0lBRUQ7O09BRUc7SUFDSCxNQUFhLGdDQUFpQyxTQUFRLFdBQVc7UUE0Qi9EOztXQUVHO1FBQ0gsWUFBWSxjQUF3QyxFQUFFLEtBQXNCO1lBQzFFLEtBQUssQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7WUEvQi9CLFdBQU0sR0FBYTtnQkFDakIsK0VBQStFO2FBQ2hGLENBQUM7WUFDRixTQUFJLEdBQVcsS0FBSyxDQUFDO1lBQ3JCLGdCQUFXLEdBQVcscUNBQXFDLENBQUM7WUFDNUQsZ0JBQVcsR0FBVywrRUFBK0UsQ0FBQztZQUN0RyxTQUFJLEdBQVcsa0NBQWtDLENBQUM7WUFDbEQsY0FBUyxHQUFhO2dCQUNwQiwyRkFBMkY7YUFDNUYsQ0FBQztZQXVCQSxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxtQkFBbUIsQ0FBQyxnQ0FBZ0MsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUU1RixNQUFNLE9BQU8sR0FBVyxPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUN4RCxDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7WUFFckIsTUFBTSxhQUFhLEdBQStCLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ2xGLENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsS0FBSyxDQUFDO1lBRVYsSUFBSSxDQUFDLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksTUFBTSxPQUFPLEVBQUUsQ0FBQztZQUN6RCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNyQyxDQUFDO0tBQ0Y7SUE5Q1ksb0RBQWdDLG1DQThDNUMsQ0FBQTtJQUVEOztPQUVHO0lBQ0gsTUFBYSx3QkFBeUIsU0FBUSxXQUFXO1FBNEJ2RDs7V0FFRztRQUNILFlBQVksY0FBd0MsRUFBRSxLQUFzQjtZQUMxRSxLQUFLLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBL0IvQixXQUFNLEdBQWE7Z0JBQ2pCLHNFQUFzRTthQUN2RSxDQUFDO1lBQ0YsU0FBSSxHQUFXLEtBQUssQ0FBQztZQUNyQixnQkFBVyxHQUFXLDREQUE0RCxDQUFDO1lBQ25GLGdCQUFXLEdBQVcsOEZBQThGLENBQUM7WUFDckgsU0FBSSxHQUFXLDBCQUEwQixDQUFDO1lBQzFDLGNBQVMsR0FBYTtnQkFDcEIsNEZBQTRGO2FBQzdGLENBQUM7WUF1QkEsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLENBQUMsd0JBQXdCLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFcEYsTUFBTSxPQUFPLEdBQVcsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDeEQsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDO1lBRXJCLE1BQU0sYUFBYSxHQUErQixPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUNsRixDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUVWLElBQUksQ0FBQyxPQUFPLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLE1BQU0sT0FBTyxFQUFFLENBQUM7WUFDekQsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7UUFDckMsQ0FBQztLQUNGO0lBOUNZLDRDQUF3QiwyQkE4Q3BDLENBQUE7QUFDSCxDQUFDLEVBbmJnQixtQkFBbUIsS0FBbkIsbUJBQW1CLFFBbWJuQztBQUVELE1BQU0sS0FBVyxlQUFlLENBMEcvQjtBQTFHRCxXQUFpQixlQUFlO0lBQzlCOztPQUVHO0lBQ0gsTUFBYSxxQkFBc0IsU0FBUSxXQUFXO1FBOEJwRDs7V0FFRztRQUNILFlBQVksY0FBd0MsRUFBRSxLQUFzQjtZQUMxRSxLQUFLLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBakMvQixXQUFNLEdBQWE7Z0JBQ2pCLDJDQUEyQztnQkFDM0MsOENBQThDO2FBQy9DLENBQUM7WUFDRixTQUFJLEdBQVcsS0FBSyxDQUFDO1lBQ3JCLGdCQUFXLEdBQVcsbUNBQW1DLENBQUM7WUFDMUQsZ0JBQVcsR0FBVyw0R0FBNEcsQ0FBQztZQUNuSSxTQUFJLEdBQVcsdUJBQXVCLENBQUM7WUFDdkMsY0FBUyxHQUFhO2dCQUNwQixnSkFBZ0o7Z0JBQ2hKLHFHQUFxRzthQUN0RyxDQUFDO1lBdUJBLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLGVBQWUsQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUU3RSxNQUFNLE9BQU8sR0FBVyxPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUN4RCxDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7WUFFckIsTUFBTSxhQUFhLEdBQStCLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ2xGLENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsS0FBSyxDQUFDO1lBRVYsSUFBSSxDQUFDLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksTUFBTSxPQUFPLEVBQUUsQ0FBQztZQUN6RCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNyQyxDQUFDO0tBQ0Y7SUFoRFkscUNBQXFCLHdCQWdEakMsQ0FBQTtJQUVEOztPQUVHO0lBQ0gsTUFBYSxzQkFBdUIsU0FBUSxXQUFXO1FBOEJyRDs7V0FFRztRQUNILFlBQVksY0FBd0MsRUFBRSxLQUFzQjtZQUMxRSxLQUFLLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBakMvQixXQUFNLEdBQWE7Z0JBQ2pCLHVEQUF1RDtnQkFDdkQsMkVBQTJFO2FBQzVFLENBQUM7WUFDRixTQUFJLEdBQVcsS0FBSyxDQUFDO1lBQ3JCLGdCQUFXLEdBQVcsb0NBQW9DLENBQUM7WUFDM0QsZ0JBQVcsR0FBVyx1TEFBdUwsQ0FBQztZQUM5TSxTQUFJLEdBQVcsd0JBQXdCLENBQUM7WUFDeEMsY0FBUyxHQUFhO2dCQUNwQiw2Q0FBNkM7Z0JBQzdDLDZDQUE2QzthQUM5QyxDQUFDO1lBdUJBLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLGVBQWUsQ0FBQyxzQkFBc0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUU5RSxNQUFNLE9BQU8sR0FBVyxPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUN4RCxDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7WUFFckIsTUFBTSxhQUFhLEdBQStCLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ2xGLENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsS0FBSyxDQUFDO1lBRVYsSUFBSSxDQUFDLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksTUFBTSxPQUFPLEVBQUUsQ0FBQztZQUN6RCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNyQyxDQUFDO0tBQ0Y7SUFoRFksc0NBQXNCLHlCQWdEbEMsQ0FBQTtBQUNILENBQUMsRUExR2dCLGVBQWUsS0FBZixlQUFlLFFBMEcvQjtBQUVELE1BQU0sS0FBVyxlQUFlLENBa0cvQjtBQWxHRCxXQUFpQixlQUFlO0lBQzlCOztPQUVHO0lBQ0gsTUFBYSxlQUFnQixTQUFRLFdBQVc7UUF3QjlDOztXQUVHO1FBQ0gsWUFBWSxjQUF3QyxFQUFFLEtBQXNCO1lBQzFFLEtBQUssQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7WUEzQi9CLFdBQU0sR0FBYSxFQUFFLENBQUM7WUFDdEIsU0FBSSxHQUFXLEtBQUssQ0FBQztZQUNyQixnQkFBVyxHQUFXLDRCQUE0QixDQUFDO1lBQ25ELGdCQUFXLEdBQVcsd0dBQXdHLENBQUM7WUFDL0gsU0FBSSxHQUFXLGlCQUFpQixDQUFDO1lBQ2pDLGNBQVMsR0FBYSxFQUFFLENBQUM7WUF1QnZCLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLGVBQWUsQ0FBQyxlQUFlLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFdkUsTUFBTSxPQUFPLEdBQVcsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDeEQsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDO1lBRXJCLE1BQU0sYUFBYSxHQUErQixPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUNsRixDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLEtBQUssQ0FBQztZQUVWLElBQUksQ0FBQyxPQUFPLEdBQUcsR0FBRyxJQUFJLENBQUMsSUFBSSxLQUFLLElBQUksQ0FBQyxJQUFJLE1BQU0sT0FBTyxFQUFFLENBQUM7WUFDekQsSUFBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7UUFDckMsQ0FBQztLQUNGO0lBMUNZLCtCQUFlLGtCQTBDM0IsQ0FBQTtJQUVEOztPQUVHO0lBQ0gsTUFBYSxzQkFBdUIsU0FBUSxXQUFXO1FBNEJyRDs7V0FFRztRQUNILFlBQVksY0FBd0MsRUFBRSxLQUFzQjtZQUMxRSxLQUFLLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBL0IvQixXQUFNLEdBQWE7Z0JBQ2pCLG1FQUFtRTthQUNwRSxDQUFDO1lBQ0YsU0FBSSxHQUFXLEtBQUssQ0FBQztZQUNyQixnQkFBVyxHQUFXLG1DQUFtQyxDQUFDO1lBQzFELGdCQUFXLEdBQVcsd0VBQXdFLENBQUM7WUFDL0YsU0FBSSxHQUFXLHdCQUF3QixDQUFDO1lBQ3hDLGNBQVMsR0FBYTtnQkFDcEIsd0ZBQXdGO2FBQ3pGLENBQUM7WUF1QkEsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsZUFBZSxDQUFDLHNCQUFzQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRTlFLE1BQU0sT0FBTyxHQUFXLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ3hELENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUVyQixNQUFNLGFBQWEsR0FBK0IsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDbEYsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFFVixJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxNQUFNLE9BQU8sRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBQ3JDLENBQUM7S0FDRjtJQTlDWSxzQ0FBc0IseUJBOENsQyxDQUFBO0FBQ0gsQ0FBQyxFQWxHZ0IsZUFBZSxLQUFmLGVBQWUsUUFrRy9CO0FBRUQsTUFBTSxLQUFXLFdBQVcsQ0ErSjNCO0FBL0pELFdBQWlCLFdBQVc7SUFDMUI7O09BRUc7SUFDSCxNQUFhLHFCQUFzQixTQUFRLFdBQVc7UUE2QnBEOztXQUVHO1FBQ0gsWUFBWSxjQUF3QyxFQUFFLEtBQXNCO1lBQzFFLEtBQUssQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFoQy9CLFdBQU0sR0FBYTtnQkFDakIsZ0VBQWdFO2dCQUNoRSw2RkFBNkY7YUFDOUYsQ0FBQztZQUNGLFNBQUksR0FBVyxLQUFLLENBQUM7WUFDckIsZ0JBQVcsR0FBVywrREFBK0QsQ0FBQztZQUN0RixnQkFBVyxHQUFXLGtGQUFrRixDQUFDO1lBQ3pHLFNBQUksR0FBVyx1QkFBdUIsQ0FBQztZQUN2QyxjQUFTLEdBQWE7Z0JBQ3BCLGdJQUFnSTthQUNqSSxDQUFDO1lBdUJBLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxxQkFBcUIsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUV6RSxNQUFNLE9BQU8sR0FBVyxPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUN4RCxDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7WUFFckIsTUFBTSxhQUFhLEdBQStCLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ2xGLENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsS0FBSyxDQUFDO1lBRVYsSUFBSSxDQUFDLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksTUFBTSxPQUFPLEVBQUUsQ0FBQztZQUN6RCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNyQyxDQUFDO0tBQ0Y7SUEvQ1ksaUNBQXFCLHdCQStDakMsQ0FBQTtJQUVEOztPQUVHO0lBQ0gsTUFBYSxzQkFBdUIsU0FBUSxXQUFXO1FBOEJyRDs7V0FFRztRQUNILFlBQVksY0FBd0MsRUFBRSxLQUFzQjtZQUMxRSxLQUFLLENBQUMsY0FBYyxFQUFFLEtBQUssQ0FBQyxDQUFDO1lBakMvQixXQUFNLEdBQWE7Z0JBQ2pCLGdFQUFnRTtnQkFDaEUseUhBQXlIO2dCQUN6SCxtRkFBbUY7YUFDcEYsQ0FBQztZQUNGLFNBQUksR0FBVyxLQUFLLENBQUM7WUFDckIsZ0JBQVcsR0FBVyxzREFBc0QsQ0FBQztZQUM3RSxnQkFBVyxHQUFXLDJGQUEyRixDQUFDO1lBQ2xILFNBQUksR0FBVyx3QkFBd0IsQ0FBQztZQUN4QyxjQUFTLEdBQWE7Z0JBQ3BCLGdJQUFnSTthQUNqSSxDQUFDO1lBdUJBLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFdBQVcsQ0FBQyxzQkFBc0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUUxRSxNQUFNLE9BQU8sR0FBVyxPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUN4RCxDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7WUFFckIsTUFBTSxhQUFhLEdBQStCLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ2xGLENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsS0FBSyxDQUFDO1lBRVYsSUFBSSxDQUFDLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksTUFBTSxPQUFPLEVBQUUsQ0FBQztZQUN6RCxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWEsQ0FBQztRQUNyQyxDQUFDO0tBQ0Y7SUFoRFksa0NBQXNCLHlCQWdEbEMsQ0FBQTtJQUVEOztPQUVHO0lBQ0gsTUFBYSxlQUFnQixTQUFRLFdBQVc7UUErQjlDOztXQUVHO1FBQ0gsWUFBWSxjQUF3QyxFQUFFLEtBQXNCO1lBQzFFLEtBQUssQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFsQy9CLFdBQU0sR0FBYTtnQkFDakIsd0RBQXdEO2dCQUN4RCwrREFBK0Q7YUFDaEUsQ0FBQztZQUNGLFNBQUksR0FBVyxLQUFLLENBQUM7WUFDckIsZ0JBQVcsR0FBVyx5QkFBeUIsQ0FBQztZQUNoRCxnQkFBVyxHQUFXLG1FQUFtRSxDQUFDO1lBQzFGLFNBQUksR0FBVyxpQkFBaUIsQ0FBQztZQUNqQyxjQUFTLEdBQWE7Z0JBQ3BCLDREQUE0RDtnQkFDNUQsNENBQTRDO2dCQUM1Qyw2RkFBNkY7YUFDOUYsQ0FBQztZQXVCQSxNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxXQUFXLENBQUMsZUFBZSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRW5FLE1BQU0sT0FBTyxHQUFXLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ3hELENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztZQUVyQixNQUFNLGFBQWEsR0FBK0IsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDbEYsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFFVixJQUFJLENBQUMsT0FBTyxHQUFHLEdBQUcsSUFBSSxDQUFDLElBQUksS0FBSyxJQUFJLENBQUMsSUFBSSxNQUFNLE9BQU8sRUFBRSxDQUFDO1lBQ3pELElBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDO1FBQ3JDLENBQUM7S0FDRjtJQWpEWSwyQkFBZSxrQkFpRDNCLENBQUE7QUFDSCxDQUFDLEVBL0pnQixXQUFXLEtBQVgsV0FBVyxRQStKM0I7QUFFRDs7R0FFRztBQUNILE1BQU0sQ0FBQyxNQUFNLFlBQVksR0FBNkIsSUFBSSxHQUFHLENBQUM7SUFDNUQsQ0FBRSxLQUFLLEVBQUUsbUJBQW1CLENBQUMsa0JBQWtCLENBQUU7SUFDakQsQ0FBRSxLQUFLLEVBQUUsbUJBQW1CLENBQUMsa0JBQWtCLENBQUU7SUFDakQsQ0FBRSxLQUFLLEVBQUUsbUJBQW1CLENBQUMsb0JBQW9CLENBQUU7SUFDbkQsQ0FBRSxLQUFLLEVBQUUseUJBQXlCLENBQUMsb0NBQW9DLENBQUU7SUFDekUsQ0FBRSxLQUFLLEVBQUUsWUFBWSxDQUFDLFVBQVUsQ0FBRTtJQUNsQyxDQUFFLEtBQUssRUFBRSxZQUFZLENBQUMsUUFBUSxDQUFFO0lBQ2hDLENBQUUsS0FBSyxFQUFFLFlBQVksQ0FBQyxzQkFBc0IsQ0FBRTtJQUM5QyxDQUFFLEtBQUssRUFBRSxZQUFZLENBQUMsUUFBUSxDQUFFO0lBQ2hDLENBQUUsS0FBSyxFQUFFLGVBQWUsQ0FBQyxPQUFPLENBQUU7SUFDbEMsQ0FBRSxLQUFLLEVBQUUsYUFBYSxDQUFDLFlBQVksQ0FBRTtJQUNyQyxDQUFFLEtBQUssRUFBRSxhQUFhLENBQUMsd0JBQXdCLENBQUU7SUFDakQsQ0FBRSxLQUFLLEVBQUUsYUFBYSxDQUFDLHVCQUF1QixDQUFFO0lBQ2hELENBQUUsS0FBSyxFQUFFLGFBQWEsQ0FBQyxzQkFBc0IsQ0FBRTtJQUMvQyxDQUFFLEtBQUssRUFBRSxhQUFhLENBQUMsZUFBZSxDQUFFO0lBQ3hDLENBQUUsS0FBSyxFQUFFLGFBQWEsQ0FBQyxrQkFBa0IsQ0FBRTtJQUMzQyxDQUFFLEtBQUssRUFBRSxhQUFhLENBQUMsY0FBYyxDQUFFO0lBQ3ZDLENBQUUsS0FBSyxFQUFFLHNCQUFzQixDQUFDLHFCQUFxQixDQUFFO0lBQ3ZELENBQUUsS0FBSyxFQUFFLHNCQUFzQixDQUFDLDBCQUEwQixDQUFFO0lBQzVELENBQUUsS0FBSyxFQUFFLHNCQUFzQixDQUFDLDhCQUE4QixDQUFFO0lBQ2hFLENBQUUsS0FBSyxFQUFFLHNCQUFzQixDQUFDLCtCQUErQixDQUFFO0lBQ2pFLENBQUUsS0FBSyxFQUFFLHNCQUFzQixDQUFDLHVCQUF1QixDQUFFO0lBQ3pELENBQUUsS0FBSyxFQUFFLHNCQUFzQixDQUFDLHNCQUFzQixDQUFFO0lBQ3hELENBQUUsS0FBSyxFQUFFLHNCQUFzQixDQUFDLDhCQUE4QixDQUFFO0lBQ2hFLENBQUUsS0FBSyxFQUFFLG1CQUFtQixDQUFDLGtCQUFrQixDQUFFO0lBQ2pELENBQUUsS0FBSyxFQUFFLG1CQUFtQixDQUFDLG1CQUFtQixDQUFFO0lBQ2xELENBQUUsS0FBSyxFQUFFLG1CQUFtQixDQUFDLG9CQUFvQixDQUFFO0lBQ25ELENBQUUsS0FBSyxFQUFFLG1CQUFtQixDQUFDLG9CQUFvQixDQUFFO0lBQ25ELENBQUUsS0FBSyxFQUFFLG1CQUFtQixDQUFDLGlCQUFpQixDQUFFO0lBQ2hELENBQUUsS0FBSyxFQUFFLG1CQUFtQixDQUFDLDhCQUE4QixDQUFFO0lBQzdELENBQUUsS0FBSyxFQUFFLG1CQUFtQixDQUFDLHFCQUFxQixDQUFFO0lBQ3BELENBQUUsS0FBSyxFQUFFLG1CQUFtQixDQUFDLGdDQUFnQyxDQUFFO0lBQy9ELENBQUUsS0FBSyxFQUFFLG1CQUFtQixDQUFDLHdCQUF3QixDQUFFO0lBQ3ZELENBQUUsS0FBSyxFQUFFLGVBQWUsQ0FBQyxxQkFBcUIsQ0FBRTtJQUNoRCxDQUFFLEtBQUssRUFBRSxlQUFlLENBQUMsc0JBQXNCLENBQUU7SUFDakQsQ0FBRSxLQUFLLEVBQUUsZUFBZSxDQUFDLGVBQWUsQ0FBRTtJQUMxQyxDQUFFLEtBQUssRUFBRSxlQUFlLENBQUMsc0JBQXNCLENBQUU7SUFDakQsQ0FBRSxLQUFLLEVBQUUsV0FBVyxDQUFDLHFCQUFxQixDQUFFO0lBQzVDLENBQUUsS0FBSyxFQUFFLFdBQVcsQ0FBQyxzQkFBc0IsQ0FBRTtJQUM3QyxDQUFFLEtBQUssRUFBRSxXQUFXLENBQUMsZUFBZSxDQUFFO0NBQ3ZDLENBQUMsQ0FBQztBQUVILE1BQU0sQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDLENBQUMifQ==