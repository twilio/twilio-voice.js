/* tslint:disable max-classes-per-file max-line-length */
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
export var AuthorizationErrors;
(function (AuthorizationErrors) {
    class AccessTokenInvalid extends TwilioError {
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
    class AccessTokenExpired extends TwilioError {
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
    class AuthenticationFailed extends TwilioError {
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
    class AccessTokenSignatureValidationFailed extends TwilioError {
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
    class BadRequest extends TwilioError {
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
    class NotFound extends TwilioError {
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
    class TemporarilyUnavailable extends TwilioError {
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
    class BusyHere extends TwilioError {
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
    class Decline extends TwilioError {
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
    class UnknownError extends TwilioError {
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
    class ApplicationNotFoundError extends TwilioError {
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
    class ConnectionDeclinedError extends TwilioError {
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
    class ConnectionTimeoutError extends TwilioError {
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
    class ConnectionError extends TwilioError {
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
    class CallCancelledError extends TwilioError {
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
    class TransportError extends TwilioError {
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
    class MalformedRequestError extends TwilioError {
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
    class MissingParameterArrayError extends TwilioError {
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
    class AuthorizationTokenMissingError extends TwilioError {
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
    class MaxParameterLengthExceededError extends TwilioError {
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
    class InvalidBridgeTokenError extends TwilioError {
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
    class InvalidClientNameError extends TwilioError {
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
    class ReconnectParameterInvalidError extends TwilioError {
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
    class AuthorizationError extends TwilioError {
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
    class NoValidAccountError extends TwilioError {
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
    class InvalidJWTTokenError extends TwilioError {
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
    class JWTTokenExpiredError extends TwilioError {
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
    class RateExceededError extends TwilioError {
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
    class JWTTokenExpirationTooLongError extends TwilioError {
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
    class ReconnectAttemptError extends TwilioError {
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
    class CallMessageEventTypeInvalidError extends TwilioError {
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
    class PayloadSizeExceededError extends TwilioError {
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
    class PermissionDeniedError extends TwilioError {
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
    class AcquisitionFailedError extends TwilioError {
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
    class ConnectionError extends TwilioError {
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
    class ConnectionDisconnected extends TwilioError {
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
    class ClientLocalDescFailed extends TwilioError {
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
    class ClientRemoteDescFailed extends TwilioError {
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
    class ConnectionError extends TwilioError {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9lcnJvcnMvZ2VuZXJhdGVkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLHlEQUF5RDtBQUN6RDs7OztHQUlHO0FBRUg7O0dBRUc7QUFDSCxPQUFPLFdBQVcsTUFBTSxlQUFlLENBQUM7QUFDeEMsT0FBTyxFQUFFLFdBQVcsRUFBRSxDQUFDO0FBRXZCLE1BQU0sS0FBVyxtQkFBbUIsQ0F1Rm5DO0FBdkZELFdBQWlCLG1CQUFtQjtJQUNsQyxNQUFhLGtCQUFtQixTQUFRLFdBQVc7UUFZakQsWUFBWSxjQUF3QyxFQUFFLEtBQXNCO1lBQzFFLEtBQUssQ0FBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLENBQUM7WUFaL0IsV0FBTSxHQUFhLEVBQUUsQ0FBQztZQUN0QixTQUFJLEdBQVcsS0FBSyxDQUFDO1lBQ3JCLGdCQUFXLEdBQVcsc0JBQXNCLENBQUM7WUFDN0MsZ0JBQVcsR0FBVyxpREFBaUQsQ0FBQztZQUN4RSxTQUFJLEdBQVcsb0JBQW9CLENBQUM7WUFDcEMsY0FBUyxHQUFhLEVBQUUsQ0FBQztZQVF2QixNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxtQkFBbUIsQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUU5RSxNQUFNLE9BQU8sR0FBVyxPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUN4RCxDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUM7WUFFckIsTUFBTSxhQUFhLEdBQStCLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ2xGLENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsS0FBSyxDQUFDO1lBRVYsSUFBSSxDQUFDLE9BQU8sR0FBRyxHQUFHLElBQUksQ0FBQyxJQUFJLEtBQUssSUFBSSxDQUFDLElBQUksTUFBTSxPQUFPLEVBQUUsQ0FBQztZQUN6RCxJQUFJLENB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