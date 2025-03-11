"use strict";
/* tslint:disable max-classes-per-file max-line-length */
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorsByCode = exports.MediaErrors = exports.SignalingErrors = exports.UserMediaErrors = exports.MalformedRequestErrors = exports.GeneralErrors = exports.SIPServerErrors = exports.ClientErrors = exports.SignatureValidationErrors = exports.AuthorizationErrors = exports.TwilioError = void 0;
/**
 * This is a generated file. Any modifications here will be overwritten. See scripts/errors.js.
 */
var twilioError_1 = require("./twilioError");
exports.TwilioError = twilioError_1.default;
var AuthorizationErrors;
(function (AuthorizationErrors) {
    var AccessTokenInvalid = /** @class */ (function (_super) {
        __extends(AccessTokenInvalid, _super);
        function AccessTokenInvalid(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 20101;
            _this.description = 'Invalid access token';
            _this.explanation = 'Twilio was unable to validate your Access Token';
            _this.name = 'AccessTokenInvalid';
            _this.solutions = [];
            Object.setPrototypeOf(_this, AuthorizationErrors.AccessTokenInvalid.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return AccessTokenInvalid;
    }(twilioError_1.default));
    AuthorizationErrors.AccessTokenInvalid = AccessTokenInvalid;
    var AccessTokenExpired = /** @class */ (function (_super) {
        __extends(AccessTokenExpired, _super);
        function AccessTokenExpired(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 20104;
            _this.description = 'Access token expired or expiration date invalid';
            _this.explanation = 'The Access Token provided to the Twilio API has expired, the expiration time specified in the token was invalid, or the expiration time specified was too far in the future';
            _this.name = 'AccessTokenExpired';
            _this.solutions = [];
            Object.setPrototypeOf(_this, AuthorizationErrors.AccessTokenExpired.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return AccessTokenExpired;
    }(twilioError_1.default));
    AuthorizationErrors.AccessTokenExpired = AccessTokenExpired;
    var AuthenticationFailed = /** @class */ (function (_super) {
        __extends(AuthenticationFailed, _super);
        function AuthenticationFailed(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 20151;
            _this.description = 'Authentication Failed';
            _this.explanation = 'The Authentication with the provided JWT failed';
            _this.name = 'AuthenticationFailed';
            _this.solutions = [];
            Object.setPrototypeOf(_this, AuthorizationErrors.AuthenticationFailed.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return AuthenticationFailed;
    }(twilioError_1.default));
    AuthorizationErrors.AuthenticationFailed = AuthenticationFailed;
})(AuthorizationErrors = exports.AuthorizationErrors || (exports.AuthorizationErrors = {}));
var SignatureValidationErrors;
(function (SignatureValidationErrors) {
    var AccessTokenSignatureValidationFailed = /** @class */ (function (_super) {
        __extends(AccessTokenSignatureValidationFailed, _super);
        function AccessTokenSignatureValidationFailed(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The access token has an invalid Account SID, API Key, or API Key Secret.',
            ];
            _this.code = 31202;
            _this.description = 'Signature validation failed.';
            _this.explanation = 'The provided access token failed signature validation.';
            _this.name = 'AccessTokenSignatureValidationFailed';
            _this.solutions = [
                'Ensure the Account SID, API Key, and API Key Secret are valid when generating your access token.',
            ];
            Object.setPrototypeOf(_this, SignatureValidationErrors.AccessTokenSignatureValidationFailed.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return AccessTokenSignatureValidationFailed;
    }(twilioError_1.default));
    SignatureValidationErrors.AccessTokenSignatureValidationFailed = AccessTokenSignatureValidationFailed;
})(SignatureValidationErrors = exports.SignatureValidationErrors || (exports.SignatureValidationErrors = {}));
var ClientErrors;
(function (ClientErrors) {
    var BadRequest = /** @class */ (function (_super) {
        __extends(BadRequest, _super);
        function BadRequest(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31400;
            _this.description = 'Bad Request (HTTP/SIP)';
            _this.explanation = 'The request could not be understood due to malformed syntax.';
            _this.name = 'BadRequest';
            _this.solutions = [];
            Object.setPrototypeOf(_this, ClientErrors.BadRequest.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return BadRequest;
    }(twilioError_1.default));
    ClientErrors.BadRequest = BadRequest;
    var NotFound = /** @class */ (function (_super) {
        __extends(NotFound, _super);
        function NotFound(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The outbound call was made to an invalid phone number.',
                'The TwiML application sid is missing a Voice URL.',
            ];
            _this.code = 31404;
            _this.description = 'Not Found (HTTP/SIP)';
            _this.explanation = 'The server has not found anything matching the request.';
            _this.name = 'NotFound';
            _this.solutions = [
                'Ensure the phone number dialed is valid.',
                'Ensure the TwiML application is configured correctly with a Voice URL link.',
            ];
            Object.setPrototypeOf(_this, ClientErrors.NotFound.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return NotFound;
    }(twilioError_1.default));
    ClientErrors.NotFound = NotFound;
    var TemporarilyUnavailable = /** @class */ (function (_super) {
        __extends(TemporarilyUnavailable, _super);
        function TemporarilyUnavailable(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31480;
            _this.description = 'Temporarily Unavailable (SIP)';
            _this.explanation = 'The callee is currently unavailable.';
            _this.name = 'TemporarilyUnavailable';
            _this.solutions = [];
            Object.setPrototypeOf(_this, ClientErrors.TemporarilyUnavailable.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return TemporarilyUnavailable;
    }(twilioError_1.default));
    ClientErrors.TemporarilyUnavailable = TemporarilyUnavailable;
    var BusyHere = /** @class */ (function (_super) {
        __extends(BusyHere, _super);
        function BusyHere(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31486;
            _this.description = 'Busy Here (SIP)';
            _this.explanation = 'The callee is busy.';
            _this.name = 'BusyHere';
            _this.solutions = [];
            Object.setPrototypeOf(_this, ClientErrors.BusyHere.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return BusyHere;
    }(twilioError_1.default));
    ClientErrors.BusyHere = BusyHere;
})(ClientErrors = exports.ClientErrors || (exports.ClientErrors = {}));
var SIPServerErrors;
(function (SIPServerErrors) {
    var Decline = /** @class */ (function (_super) {
        __extends(Decline, _super);
        function Decline(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31603;
            _this.description = 'Decline (SIP)';
            _this.explanation = 'The callee does not wish to participate in the call.';
            _this.name = 'Decline';
            _this.solutions = [];
            Object.setPrototypeOf(_this, SIPServerErrors.Decline.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return Decline;
    }(twilioError_1.default));
    SIPServerErrors.Decline = Decline;
})(SIPServerErrors = exports.SIPServerErrors || (exports.SIPServerErrors = {}));
var GeneralErrors;
(function (GeneralErrors) {
    var UnknownError = /** @class */ (function (_super) {
        __extends(UnknownError, _super);
        function UnknownError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31000;
            _this.description = 'Unknown Error';
            _this.explanation = 'An unknown error has occurred. See error details for more information.';
            _this.name = 'UnknownError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, GeneralErrors.UnknownError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return UnknownError;
    }(twilioError_1.default));
    GeneralErrors.UnknownError = UnknownError;
    var ApplicationNotFoundError = /** @class */ (function (_super) {
        __extends(ApplicationNotFoundError, _super);
        function ApplicationNotFoundError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31001;
            _this.description = 'Application Not Found';
            _this.explanation = '';
            _this.name = 'ApplicationNotFoundError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, GeneralErrors.ApplicationNotFoundError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return ApplicationNotFoundError;
    }(twilioError_1.default));
    GeneralErrors.ApplicationNotFoundError = ApplicationNotFoundError;
    var ConnectionDeclinedError = /** @class */ (function (_super) {
        __extends(ConnectionDeclinedError, _super);
        function ConnectionDeclinedError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31002;
            _this.description = 'Connection Declined';
            _this.explanation = '';
            _this.name = 'ConnectionDeclinedError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, GeneralErrors.ConnectionDeclinedError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return ConnectionDeclinedError;
    }(twilioError_1.default));
    GeneralErrors.ConnectionDeclinedError = ConnectionDeclinedError;
    var ConnectionTimeoutError = /** @class */ (function (_super) {
        __extends(ConnectionTimeoutError, _super);
        function ConnectionTimeoutError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31003;
            _this.description = 'Connection Timeout';
            _this.explanation = 'The server could not produce a response within a suitable amount of time.';
            _this.name = 'ConnectionTimeoutError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, GeneralErrors.ConnectionTimeoutError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return ConnectionTimeoutError;
    }(twilioError_1.default));
    GeneralErrors.ConnectionTimeoutError = ConnectionTimeoutError;
    var ConnectionError = /** @class */ (function (_super) {
        __extends(ConnectionError, _super);
        function ConnectionError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31005;
            _this.description = 'Connection error';
            _this.explanation = 'A connection error occurred during the call';
            _this.name = 'ConnectionError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, GeneralErrors.ConnectionError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return ConnectionError;
    }(twilioError_1.default));
    GeneralErrors.ConnectionError = ConnectionError;
    var CallCancelledError = /** @class */ (function (_super) {
        __extends(CallCancelledError, _super);
        function CallCancelledError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The incoming call was cancelled because it was not answered in time or it was accepted/rejected by another application instance registered with the same identity.',
            ];
            _this.code = 31008;
            _this.description = 'Call cancelled';
            _this.explanation = 'Unable to answer because the call has ended';
            _this.name = 'CallCancelledError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, GeneralErrors.CallCancelledError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return CallCancelledError;
    }(twilioError_1.default));
    GeneralErrors.CallCancelledError = CallCancelledError;
    var TransportError = /** @class */ (function (_super) {
        __extends(TransportError, _super);
        function TransportError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31009;
            _this.description = 'Transport error';
            _this.explanation = 'No transport available to send or receive messages';
            _this.name = 'TransportError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, GeneralErrors.TransportError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return TransportError;
    }(twilioError_1.default));
    GeneralErrors.TransportError = TransportError;
})(GeneralErrors = exports.GeneralErrors || (exports.GeneralErrors = {}));
var MalformedRequestErrors;
(function (MalformedRequestErrors) {
    var MalformedRequestError = /** @class */ (function (_super) {
        __extends(MalformedRequestError, _super);
        function MalformedRequestError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'Invalid content or MessageType passed to sendMessage method.',
            ];
            _this.code = 31100;
            _this.description = 'The request had malformed syntax.';
            _this.explanation = 'The request could not be understood due to malformed syntax.';
            _this.name = 'MalformedRequestError';
            _this.solutions = [
                'Ensure content and MessageType passed to sendMessage method are valid.',
            ];
            Object.setPrototypeOf(_this, MalformedRequestErrors.MalformedRequestError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return MalformedRequestError;
    }(twilioError_1.default));
    MalformedRequestErrors.MalformedRequestError = MalformedRequestError;
    var MissingParameterArrayError = /** @class */ (function (_super) {
        __extends(MissingParameterArrayError, _super);
        function MissingParameterArrayError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31101;
            _this.description = 'Missing parameter array in request';
            _this.explanation = '';
            _this.name = 'MissingParameterArrayError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, MalformedRequestErrors.MissingParameterArrayError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return MissingParameterArrayError;
    }(twilioError_1.default));
    MalformedRequestErrors.MissingParameterArrayError = MissingParameterArrayError;
    var AuthorizationTokenMissingError = /** @class */ (function (_super) {
        __extends(AuthorizationTokenMissingError, _super);
        function AuthorizationTokenMissingError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31102;
            _this.description = 'Authorization token missing in request.';
            _this.explanation = '';
            _this.name = 'AuthorizationTokenMissingError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, MalformedRequestErrors.AuthorizationTokenMissingError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return AuthorizationTokenMissingError;
    }(twilioError_1.default));
    MalformedRequestErrors.AuthorizationTokenMissingError = AuthorizationTokenMissingError;
    var MaxParameterLengthExceededError = /** @class */ (function (_super) {
        __extends(MaxParameterLengthExceededError, _super);
        function MaxParameterLengthExceededError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31103;
            _this.description = 'Maximum parameter length has been exceeded.';
            _this.explanation = 'Length of parameters cannot exceed MAX_PARAM_LENGTH.';
            _this.name = 'MaxParameterLengthExceededError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, MalformedRequestErrors.MaxParameterLengthExceededError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return MaxParameterLengthExceededError;
    }(twilioError_1.default));
    MalformedRequestErrors.MaxParameterLengthExceededError = MaxParameterLengthExceededError;
    var InvalidBridgeTokenError = /** @class */ (function (_super) {
        __extends(InvalidBridgeTokenError, _super);
        function InvalidBridgeTokenError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31104;
            _this.description = 'Invalid bridge token';
            _this.explanation = '';
            _this.name = 'InvalidBridgeTokenError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, MalformedRequestErrors.InvalidBridgeTokenError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return InvalidBridgeTokenError;
    }(twilioError_1.default));
    MalformedRequestErrors.InvalidBridgeTokenError = InvalidBridgeTokenError;
    var InvalidClientNameError = /** @class */ (function (_super) {
        __extends(InvalidClientNameError, _super);
        function InvalidClientNameError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'Client name contains invalid characters.',
            ];
            _this.code = 31105;
            _this.description = 'Invalid client name';
            _this.explanation = 'Client name should not contain control, space, delims, or unwise characters.';
            _this.name = 'InvalidClientNameError';
            _this.solutions = [
                'Make sure that client name does not contain any of the invalid characters.',
            ];
            Object.setPrototypeOf(_this, MalformedRequestErrors.InvalidClientNameError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return InvalidClientNameError;
    }(twilioError_1.default));
    MalformedRequestErrors.InvalidClientNameError = InvalidClientNameError;
    var ReconnectParameterInvalidError = /** @class */ (function (_super) {
        __extends(ReconnectParameterInvalidError, _super);
        function ReconnectParameterInvalidError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31107;
            _this.description = 'The reconnect parameter is invalid';
            _this.explanation = '';
            _this.name = 'ReconnectParameterInvalidError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, MalformedRequestErrors.ReconnectParameterInvalidError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return ReconnectParameterInvalidError;
    }(twilioError_1.default));
    MalformedRequestErrors.ReconnectParameterInvalidError = ReconnectParameterInvalidError;
})(MalformedRequestErrors = exports.MalformedRequestErrors || (exports.MalformedRequestErrors = {}));
(function (AuthorizationErrors) {
    var AuthorizationError = /** @class */ (function (_super) {
        __extends(AuthorizationError, _super);
        function AuthorizationError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31201;
            _this.description = 'Authorization error';
            _this.explanation = 'The request requires user authentication. The server understood the request, but is refusing to fulfill it.';
            _this.name = 'AuthorizationError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, AuthorizationErrors.AuthorizationError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return AuthorizationError;
    }(twilioError_1.default));
    AuthorizationErrors.AuthorizationError = AuthorizationError;
    var NoValidAccountError = /** @class */ (function (_super) {
        __extends(NoValidAccountError, _super);
        function NoValidAccountError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31203;
            _this.description = 'No valid account';
            _this.explanation = '';
            _this.name = 'NoValidAccountError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, AuthorizationErrors.NoValidAccountError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return NoValidAccountError;
    }(twilioError_1.default));
    AuthorizationErrors.NoValidAccountError = NoValidAccountError;
    var InvalidJWTTokenError = /** @class */ (function (_super) {
        __extends(InvalidJWTTokenError, _super);
        function InvalidJWTTokenError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31204;
            _this.description = 'Invalid JWT token';
            _this.explanation = '';
            _this.name = 'InvalidJWTTokenError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, AuthorizationErrors.InvalidJWTTokenError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return InvalidJWTTokenError;
    }(twilioError_1.default));
    AuthorizationErrors.InvalidJWTTokenError = InvalidJWTTokenError;
    var JWTTokenExpiredError = /** @class */ (function (_super) {
        __extends(JWTTokenExpiredError, _super);
        function JWTTokenExpiredError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31205;
            _this.description = 'JWT token expired';
            _this.explanation = '';
            _this.name = 'JWTTokenExpiredError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, AuthorizationErrors.JWTTokenExpiredError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return JWTTokenExpiredError;
    }(twilioError_1.default));
    AuthorizationErrors.JWTTokenExpiredError = JWTTokenExpiredError;
    var RateExceededError = /** @class */ (function (_super) {
        __extends(RateExceededError, _super);
        function RateExceededError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'Rate limit exceeded.',
            ];
            _this.code = 31206;
            _this.description = 'Rate exceeded authorized limit.';
            _this.explanation = 'The request performed exceeds the authorized limit.';
            _this.name = 'RateExceededError';
            _this.solutions = [
                'Ensure message send rate does not exceed authorized limits.',
            ];
            Object.setPrototypeOf(_this, AuthorizationErrors.RateExceededError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return RateExceededError;
    }(twilioError_1.default));
    AuthorizationErrors.RateExceededError = RateExceededError;
    var JWTTokenExpirationTooLongError = /** @class */ (function (_super) {
        __extends(JWTTokenExpirationTooLongError, _super);
        function JWTTokenExpirationTooLongError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31207;
            _this.description = 'JWT token expiration too long';
            _this.explanation = '';
            _this.name = 'JWTTokenExpirationTooLongError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, AuthorizationErrors.JWTTokenExpirationTooLongError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return JWTTokenExpirationTooLongError;
    }(twilioError_1.default));
    AuthorizationErrors.JWTTokenExpirationTooLongError = JWTTokenExpirationTooLongError;
    var ReconnectAttemptError = /** @class */ (function (_super) {
        __extends(ReconnectAttemptError, _super);
        function ReconnectAttemptError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31209;
            _this.description = 'Reconnect attempt is not authorized.';
            _this.explanation = '';
            _this.name = 'ReconnectAttemptError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, AuthorizationErrors.ReconnectAttemptError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return ReconnectAttemptError;
    }(twilioError_1.default));
    AuthorizationErrors.ReconnectAttemptError = ReconnectAttemptError;
    var CallMessageEventTypeInvalidError = /** @class */ (function (_super) {
        __extends(CallMessageEventTypeInvalidError, _super);
        function CallMessageEventTypeInvalidError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The Call Message Event Type is invalid and is not understood by Twilio Voice.',
            ];
            _this.code = 31210;
            _this.description = 'Call Message Event Type is invalid.';
            _this.explanation = 'The Call Message Event Type is invalid and is not understood by Twilio Voice.';
            _this.name = 'CallMessageEventTypeInvalidError';
            _this.solutions = [
                'Ensure the Call Message Event Type is Valid and understood by Twilio Voice and try again.',
            ];
            Object.setPrototypeOf(_this, AuthorizationErrors.CallMessageEventTypeInvalidError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return CallMessageEventTypeInvalidError;
    }(twilioError_1.default));
    AuthorizationErrors.CallMessageEventTypeInvalidError = CallMessageEventTypeInvalidError;
    var PayloadSizeExceededError = /** @class */ (function (_super) {
        __extends(PayloadSizeExceededError, _super);
        function PayloadSizeExceededError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The payload size of Call Message Event exceeds the authorized limit.',
            ];
            _this.code = 31212;
            _this.description = 'Call Message Event Payload size exceeded authorized limit.';
            _this.explanation = 'The request performed to send a Call Message Event exceeds the payload size authorized limit';
            _this.name = 'PayloadSizeExceededError';
            _this.solutions = [
                'Reduce payload size of Call Message Event to be within the authorized limit and try again.',
            ];
            Object.setPrototypeOf(_this, AuthorizationErrors.PayloadSizeExceededError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return PayloadSizeExceededError;
    }(twilioError_1.default));
    AuthorizationErrors.PayloadSizeExceededError = PayloadSizeExceededError;
})(AuthorizationErrors = exports.AuthorizationErrors || (exports.AuthorizationErrors = {}));
var UserMediaErrors;
(function (UserMediaErrors) {
    var PermissionDeniedError = /** @class */ (function (_super) {
        __extends(PermissionDeniedError, _super);
        function PermissionDeniedError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The user denied the getUserMedia request.',
                'The browser denied the getUserMedia request.',
            ];
            _this.code = 31401;
            _this.description = 'UserMedia Permission Denied Error';
            _this.explanation = 'The browser or end-user denied permissions to user media. Therefore we were unable to acquire input audio.';
            _this.name = 'PermissionDeniedError';
            _this.solutions = [
                'The user should accept the request next time prompted. If the browser saved the deny, the user should change that permission in their browser.',
                'The user should to verify that the browser has permission to access the microphone at this address.',
            ];
            Object.setPrototypeOf(_this, UserMediaErrors.PermissionDeniedError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return PermissionDeniedError;
    }(twilioError_1.default));
    UserMediaErrors.PermissionDeniedError = PermissionDeniedError;
    var AcquisitionFailedError = /** @class */ (function (_super) {
        __extends(AcquisitionFailedError, _super);
        function AcquisitionFailedError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'NotFoundError - The deviceID specified was not found.',
                'The getUserMedia constraints were overconstrained and no devices matched.',
            ];
            _this.code = 31402;
            _this.description = 'UserMedia Acquisition Failed Error';
            _this.explanation = 'The browser and end-user allowed permissions, however getting the media failed. Usually this is due to bad constraints, but can sometimes fail due to browser, OS or hardware issues.';
            _this.name = 'AcquisitionFailedError';
            _this.solutions = [
                'Ensure the deviceID being specified exists.',
                'Try acquiring media with fewer constraints.',
            ];
            Object.setPrototypeOf(_this, UserMediaErrors.AcquisitionFailedError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return AcquisitionFailedError;
    }(twilioError_1.default));
    UserMediaErrors.AcquisitionFailedError = AcquisitionFailedError;
})(UserMediaErrors = exports.UserMediaErrors || (exports.UserMediaErrors = {}));
var SignalingErrors;
(function (SignalingErrors) {
    var ConnectionError = /** @class */ (function (_super) {
        __extends(ConnectionError, _super);
        function ConnectionError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 53000;
            _this.description = 'Signaling connection error';
            _this.explanation = 'Raised whenever a signaling connection error occurs that is not covered by a more specific error code.';
            _this.name = 'ConnectionError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, SignalingErrors.ConnectionError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return ConnectionError;
    }(twilioError_1.default));
    SignalingErrors.ConnectionError = ConnectionError;
    var ConnectionDisconnected = /** @class */ (function (_super) {
        __extends(ConnectionDisconnected, _super);
        function ConnectionDisconnected(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The device running your application lost its Internet connection.',
            ];
            _this.code = 53001;
            _this.description = 'Signaling connection disconnected';
            _this.explanation = 'Raised whenever the signaling connection is unexpectedly disconnected.';
            _this.name = 'ConnectionDisconnected';
            _this.solutions = [
                'Ensure the device running your application has access to a stable Internet connection.',
            ];
            Object.setPrototypeOf(_this, SignalingErrors.ConnectionDisconnected.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return ConnectionDisconnected;
    }(twilioError_1.default));
    SignalingErrors.ConnectionDisconnected = ConnectionDisconnected;
})(SignalingErrors = exports.SignalingErrors || (exports.SignalingErrors = {}));
var MediaErrors;
(function (MediaErrors) {
    var ClientLocalDescFailed = /** @class */ (function (_super) {
        __extends(ClientLocalDescFailed, _super);
        function ClientLocalDescFailed(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The Client may not be using a supported WebRTC implementation.',
                'The Client may not have the necessary resources to create or apply a new media description.',
            ];
            _this.code = 53400;
            _this.description = 'Client is unable to create or apply a local media description';
            _this.explanation = 'Raised whenever a Client is unable to create or apply a local media description.';
            _this.name = 'ClientLocalDescFailed';
            _this.solutions = [
                'If you are experiencing this error using the JavaScript SDK, ensure you are running it with a supported WebRTC implementation.',
            ];
            Object.setPrototypeOf(_this, MediaErrors.ClientLocalDescFailed.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return ClientLocalDescFailed;
    }(twilioError_1.default));
    MediaErrors.ClientLocalDescFailed = ClientLocalDescFailed;
    var ClientRemoteDescFailed = /** @class */ (function (_super) {
        __extends(ClientRemoteDescFailed, _super);
        function ClientRemoteDescFailed(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The Client may not be using a supported WebRTC implementation.',
                'The Client may be connecting peer-to-peer with another Participant that is not using a supported WebRTC implementation.',
                'The Client may not have the necessary resources to apply a new media description.',
            ];
            _this.code = 53402;
            _this.description = 'Client is unable to apply a remote media description';
            _this.explanation = 'Raised whenever the Client receives a remote media description but is unable to apply it.';
            _this.name = 'ClientRemoteDescFailed';
            _this.solutions = [
                'If you are experiencing this error using the JavaScript SDK, ensure you are running it with a supported WebRTC implementation.',
            ];
            Object.setPrototypeOf(_this, MediaErrors.ClientRemoteDescFailed.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return ClientRemoteDescFailed;
    }(twilioError_1.default));
    MediaErrors.ClientRemoteDescFailed = ClientRemoteDescFailed;
    var ConnectionError = /** @class */ (function (_super) {
        __extends(ConnectionError, _super);
        function ConnectionError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The Client was unable to establish a media connection.',
                'A media connection which was active failed liveliness checks.',
            ];
            _this.code = 53405;
            _this.description = 'Media connection failed';
            _this.explanation = 'Raised by the Client or Server whenever a media connection fails.';
            _this.name = 'ConnectionError';
            _this.solutions = [
                'If the problem persists, try connecting to another region.',
                'Check your Client\'s network connectivity.',
                'If you\'ve provided custom ICE Servers then ensure that the URLs and credentials are valid.',
            ];
            Object.setPrototypeOf(_this, MediaErrors.ConnectionError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = _this.name + " (" + _this.code + "): " + message;
            _this.originalError = originalError;
            return _this;
        }
        return ConnectionError;
    }(twilioError_1.default));
    MediaErrors.ConnectionError = ConnectionError;
})(MediaErrors = exports.MediaErrors || (exports.MediaErrors = {}));
/**
 * @private
 */
exports.errorsByCode = new Map([
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
Object.freeze(exports.errorsByCode);
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9lcnJvcnMvZ2VuZXJhdGVkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSx5REFBeUQ7QUFDekQ7Ozs7R0FJRzs7Ozs7Ozs7Ozs7Ozs7OztBQUVIOztHQUVHO0FBQ0gsNkNBQXdDO0FBQy9CLHNCQURGLHFCQUFXLENBQ0U7QUFFcEIsSUFBaUIsbUJBQW1CLENBdUZuQztBQXZGRCxXQUFpQixtQkFBbUI7SUFDbEM7UUFBd0Msc0NBQVc7UUFZakQsNEJBQVksY0FBd0MsRUFBRSxLQUFzQjtZQUE1RSxZQUNFLGtCQUFNLGNBQWMsRUFBRSxLQUFLLENBQUMsU0FhN0I7WUF6QkQsWUFBTSxHQUFhLEVBQUUsQ0FBQztZQUN0QixVQUFJLEdBQVcsS0FBSyxDQUFDO1lBQ3JCLGlCQUFXLEdBQVcsc0JBQXNCLENBQUM7WUFDN0MsaUJBQVcsR0FBVyxpREFBaUQsQ0FBQztZQUN4RSxVQUFJLEdBQVcsb0JBQW9CLENBQUM7WUFDcEMsZUFBUyxHQUFhLEVBQUUsQ0FBQztZQVF2QixNQUFNLENBQUMsY0FBYyxDQUFDLEtBQUksRUFBRSxtQkFBbUIsQ0FBQyxrQkFBa0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUU5RSxJQUFNLE9BQU8sR0FBVyxPQUFPLGNBQWMsS0FBSyxRQUFRO2dCQUN4RCxDQUFDLENBQUMsY0FBYztnQkFDaEIsQ0FBQyxDQUFDLEtBQUksQ0FBQyxXQUFXLENBQUM7WUFFckIsSUFBTSxhQUFhLEdBQStCLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ2xGLENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsS0FBSyxDQUFDO1lBRVYsS0FBSSxDQUFDLE9BQU8sR0FBTSxLQUFJLENBQUMsSUFBSSxVQUFLLEtBQUksQ0FBQyxJQUFJLFdBQU0sT0FBUyxDQUFDO1lBQ3pELEtBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYSxDQUFDOztRQUNyQyxD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