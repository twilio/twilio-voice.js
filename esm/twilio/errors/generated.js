import TwilioError from './twilioError.js';

/* tslint:disable max-classes-per-file max-line-length */
/**
 * This is a generated file. Any modifications here will be overwritten. See scripts/errors.js.
 */
var AuthorizationErrors;
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
var SignatureValidationErrors;
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
var ClientErrors;
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
var SIPServerErrors;
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
var GeneralErrors;
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
var MalformedRequestErrors;
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
var UserMediaErrors;
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
var SignalingErrors;
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
var MediaErrors;
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
const errorsByCode = new Map([
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

export { AuthorizationErrors, ClientErrors, GeneralErrors, MalformedRequestErrors, MediaErrors, SIPServerErrors, SignalingErrors, SignatureValidationErrors, TwilioError, UserMediaErrors, errorsByCode };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL2Vycm9ycy9nZW5lcmF0ZWQudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUNBOztBQUVHO0FBSUcsSUFBVztBQUFqQixDQUFBLFVBQWlCLG1CQUFtQixFQUFBO0FBQ2xDOztBQUVHO0lBQ0gsTUFBYSxrQkFBbUIsU0FBUSxXQUFXLENBQUE7QUF3QmpEOztBQUVHO1FBQ0gsV0FBQSxDQUFZLGNBQXdDLEVBQUUsS0FBc0IsRUFBQTtBQUMxRSxZQUFBLEtBQUssQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDO1lBM0I5QixJQUFBLENBQUEsTUFBTSxHQUFhLEVBQUU7WUFDckIsSUFBQSxDQUFBLElBQUksR0FBVyxLQUFLO1lBQ3BCLElBQUEsQ0FBQSxXQUFXLEdBQVcsc0JBQXNCO1lBQzVDLElBQUEsQ0FBQSxXQUFXLEdBQVcsaURBQWlEO1lBQ3ZFLElBQUEsQ0FBQSxJQUFJLEdBQVcsb0JBQW9CO1lBQ25DLElBQUEsQ0FBQSxTQUFTLEdBQWEsRUFBRTtZQXVCdEIsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsbUJBQW1CLENBQUMsa0JBQWtCLENBQUMsU0FBUyxDQUFDO0FBRTdFLFlBQUEsTUFBTSxPQUFPLEdBQVcsT0FBTyxjQUFjLEtBQUs7QUFDaEQsa0JBQUU7QUFDRixrQkFBRSxJQUFJLENBQUMsV0FBVztBQUVwQixZQUFBLE1BQU0sYUFBYSxHQUErQixPQUFPLGNBQWMsS0FBSztBQUMxRSxrQkFBRTtrQkFDQSxLQUFLO0FBRVQsWUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLENBQUEsRUFBRyxJQUFJLENBQUMsSUFBSSxDQUFBLEVBQUEsRUFBSyxJQUFJLENBQUMsSUFBSSxDQUFBLEdBQUEsRUFBTSxPQUFPLEVBQUU7QUFDeEQsWUFBQSxJQUFJLENBQUMsYUFBYSxHQUFHLGFBQWE7UUFDcEM7QUFDRDtBQTFDWSxJ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
