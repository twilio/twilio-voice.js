"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorsByCode = exports.MediaErrors = exports.SignalingErrors = exports.UserMediaErrors = exports.MalformedRequestErrors = exports.GeneralErrors = exports.SIPServerErrors = exports.ClientErrors = exports.SignatureValidationErrors = exports.AuthorizationErrors = exports.TwilioError = void 0;
/* tslint:disable max-classes-per-file max-line-length */
/**
 * This is a generated file. Any modifications here will be overwritten. See scripts/errors.js.
 */
var twilioError_1 = require("./twilioError");
exports.TwilioError = twilioError_1.default;
var AuthorizationErrors;
(function (AuthorizationErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var AccessTokenInvalid = /** @class */ (function (_super) {
        __extends(AccessTokenInvalid, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return AccessTokenInvalid;
    }(twilioError_1.default));
    AuthorizationErrors.AccessTokenInvalid = AccessTokenInvalid;
    /**
     * Error received from the Twilio backend.
     */
    var AccessTokenExpired = /** @class */ (function (_super) {
        __extends(AccessTokenExpired, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return AccessTokenExpired;
    }(twilioError_1.default));
    AuthorizationErrors.AccessTokenExpired = AccessTokenExpired;
    /**
     * Error received from the Twilio backend.
     */
    var AuthenticationFailed = /** @class */ (function (_super) {
        __extends(AuthenticationFailed, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return AuthenticationFailed;
    }(twilioError_1.default));
    AuthorizationErrors.AuthenticationFailed = AuthenticationFailed;
})(AuthorizationErrors || (exports.AuthorizationErrors = AuthorizationErrors = {}));
var SignatureValidationErrors;
(function (SignatureValidationErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var AccessTokenSignatureValidationFailed = /** @class */ (function (_super) {
        __extends(AccessTokenSignatureValidationFailed, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return AccessTokenSignatureValidationFailed;
    }(twilioError_1.default));
    SignatureValidationErrors.AccessTokenSignatureValidationFailed = AccessTokenSignatureValidationFailed;
})(SignatureValidationErrors || (exports.SignatureValidationErrors = SignatureValidationErrors = {}));
var ClientErrors;
(function (ClientErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var BadRequest = /** @class */ (function (_super) {
        __extends(BadRequest, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return BadRequest;
    }(twilioError_1.default));
    ClientErrors.BadRequest = BadRequest;
    /**
     * Error received from the Twilio backend.
     */
    var NotFound = /** @class */ (function (_super) {
        __extends(NotFound, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return NotFound;
    }(twilioError_1.default));
    ClientErrors.NotFound = NotFound;
    /**
     * Error received from the Twilio backend.
     */
    var TemporarilyUnavailable = /** @class */ (function (_super) {
        __extends(TemporarilyUnavailable, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return TemporarilyUnavailable;
    }(twilioError_1.default));
    ClientErrors.TemporarilyUnavailable = TemporarilyUnavailable;
    /**
     * Error received from the Twilio backend.
     */
    var BusyHere = /** @class */ (function (_super) {
        __extends(BusyHere, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return BusyHere;
    }(twilioError_1.default));
    ClientErrors.BusyHere = BusyHere;
})(ClientErrors || (exports.ClientErrors = ClientErrors = {}));
var SIPServerErrors;
(function (SIPServerErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var Decline = /** @class */ (function (_super) {
        __extends(Decline, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return Decline;
    }(twilioError_1.default));
    SIPServerErrors.Decline = Decline;
})(SIPServerErrors || (exports.SIPServerErrors = SIPServerErrors = {}));
var GeneralErrors;
(function (GeneralErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var UnknownError = /** @class */ (function (_super) {
        __extends(UnknownError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return UnknownError;
    }(twilioError_1.default));
    GeneralErrors.UnknownError = UnknownError;
    /**
     * Error received from the Twilio backend.
     */
    var ApplicationNotFoundError = /** @class */ (function (_super) {
        __extends(ApplicationNotFoundError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ApplicationNotFoundError;
    }(twilioError_1.default));
    GeneralErrors.ApplicationNotFoundError = ApplicationNotFoundError;
    /**
     * Error received from the Twilio backend.
     */
    var ConnectionDeclinedError = /** @class */ (function (_super) {
        __extends(ConnectionDeclinedError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ConnectionDeclinedError;
    }(twilioError_1.default));
    GeneralErrors.ConnectionDeclinedError = ConnectionDeclinedError;
    /**
     * Error received from the Twilio backend.
     */
    var ConnectionTimeoutError = /** @class */ (function (_super) {
        __extends(ConnectionTimeoutError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ConnectionTimeoutError;
    }(twilioError_1.default));
    GeneralErrors.ConnectionTimeoutError = ConnectionTimeoutError;
    /**
     * Error received from the Twilio backend.
     */
    var ConnectionError = /** @class */ (function (_super) {
        __extends(ConnectionError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ConnectionError;
    }(twilioError_1.default));
    GeneralErrors.ConnectionError = ConnectionError;
    /**
     * Error received from the Twilio backend.
     */
    var CallCancelledError = /** @class */ (function (_super) {
        __extends(CallCancelledError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return CallCancelledError;
    }(twilioError_1.default));
    GeneralErrors.CallCancelledError = CallCancelledError;
    /**
     * Error received from the Twilio backend.
     */
    var TransportError = /** @class */ (function (_super) {
        __extends(TransportError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return TransportError;
    }(twilioError_1.default));
    GeneralErrors.TransportError = TransportError;
})(GeneralErrors || (exports.GeneralErrors = GeneralErrors = {}));
var MalformedRequestErrors;
(function (MalformedRequestErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var MalformedRequestError = /** @class */ (function (_super) {
        __extends(MalformedRequestError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return MalformedRequestError;
    }(twilioError_1.default));
    MalformedRequestErrors.MalformedRequestError = MalformedRequestError;
    /**
     * Error received from the Twilio backend.
     */
    var MissingParameterArrayError = /** @class */ (function (_super) {
        __extends(MissingParameterArrayError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return MissingParameterArrayError;
    }(twilioError_1.default));
    MalformedRequestErrors.MissingParameterArrayError = MissingParameterArrayError;
    /**
     * Error received from the Twilio backend.
     */
    var AuthorizationTokenMissingError = /** @class */ (function (_super) {
        __extends(AuthorizationTokenMissingError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return AuthorizationTokenMissingError;
    }(twilioError_1.default));
    MalformedRequestErrors.AuthorizationTokenMissingError = AuthorizationTokenMissingError;
    /**
     * Error received from the Twilio backend.
     */
    var MaxParameterLengthExceededError = /** @class */ (function (_super) {
        __extends(MaxParameterLengthExceededError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return MaxParameterLengthExceededError;
    }(twilioError_1.default));
    MalformedRequestErrors.MaxParameterLengthExceededError = MaxParameterLengthExceededError;
    /**
     * Error received from the Twilio backend.
     */
    var InvalidBridgeTokenError = /** @class */ (function (_super) {
        __extends(InvalidBridgeTokenError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return InvalidBridgeTokenError;
    }(twilioError_1.default));
    MalformedRequestErrors.InvalidBridgeTokenError = InvalidBridgeTokenError;
    /**
     * Error received from the Twilio backend.
     */
    var InvalidClientNameError = /** @class */ (function (_super) {
        __extends(InvalidClientNameError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return InvalidClientNameError;
    }(twilioError_1.default));
    MalformedRequestErrors.InvalidClientNameError = InvalidClientNameError;
    /**
     * Error received from the Twilio backend.
     */
    var ReconnectParameterInvalidError = /** @class */ (function (_super) {
        __extends(ReconnectParameterInvalidError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ReconnectParameterInvalidError;
    }(twilioError_1.default));
    MalformedRequestErrors.ReconnectParameterInvalidError = ReconnectParameterInvalidError;
})(MalformedRequestErrors || (exports.MalformedRequestErrors = MalformedRequestErrors = {}));
(function (AuthorizationErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var AuthorizationError = /** @class */ (function (_super) {
        __extends(AuthorizationError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return AuthorizationError;
    }(twilioError_1.default));
    AuthorizationErrors.AuthorizationError = AuthorizationError;
    /**
     * Error received from the Twilio backend.
     */
    var NoValidAccountError = /** @class */ (function (_super) {
        __extends(NoValidAccountError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return NoValidAccountError;
    }(twilioError_1.default));
    AuthorizationErrors.NoValidAccountError = NoValidAccountError;
    /**
     * Error received from the Twilio backend.
     */
    var InvalidJWTTokenError = /** @class */ (function (_super) {
        __extends(InvalidJWTTokenError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return InvalidJWTTokenError;
    }(twilioError_1.default));
    AuthorizationErrors.InvalidJWTTokenError = InvalidJWTTokenError;
    /**
     * Error received from the Twilio backend.
     */
    var JWTTokenExpiredError = /** @class */ (function (_super) {
        __extends(JWTTokenExpiredError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return JWTTokenExpiredError;
    }(twilioError_1.default));
    AuthorizationErrors.JWTTokenExpiredError = JWTTokenExpiredError;
    /**
     * Error received from the Twilio backend.
     */
    var RateExceededError = /** @class */ (function (_super) {
        __extends(RateExceededError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return RateExceededError;
    }(twilioError_1.default));
    AuthorizationErrors.RateExceededError = RateExceededError;
    /**
     * Error received from the Twilio backend.
     */
    var JWTTokenExpirationTooLongError = /** @class */ (function (_super) {
        __extends(JWTTokenExpirationTooLongError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return JWTTokenExpirationTooLongError;
    }(twilioError_1.default));
    AuthorizationErrors.JWTTokenExpirationTooLongError = JWTTokenExpirationTooLongError;
    /**
     * Error received from the Twilio backend.
     */
    var ReconnectAttemptError = /** @class */ (function (_super) {
        __extends(ReconnectAttemptError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ReconnectAttemptError;
    }(twilioError_1.default));
    AuthorizationErrors.ReconnectAttemptError = ReconnectAttemptError;
    /**
     * Error received from the Twilio backend.
     */
    var CallMessageEventTypeInvalidError = /** @class */ (function (_super) {
        __extends(CallMessageEventTypeInvalidError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return CallMessageEventTypeInvalidError;
    }(twilioError_1.default));
    AuthorizationErrors.CallMessageEventTypeInvalidError = CallMessageEventTypeInvalidError;
    /**
     * Error received from the Twilio backend.
     */
    var PayloadSizeExceededError = /** @class */ (function (_super) {
        __extends(PayloadSizeExceededError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return PayloadSizeExceededError;
    }(twilioError_1.default));
    AuthorizationErrors.PayloadSizeExceededError = PayloadSizeExceededError;
})(AuthorizationErrors || (exports.AuthorizationErrors = AuthorizationErrors = {}));
var UserMediaErrors;
(function (UserMediaErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var PermissionDeniedError = /** @class */ (function (_super) {
        __extends(PermissionDeniedError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return PermissionDeniedError;
    }(twilioError_1.default));
    UserMediaErrors.PermissionDeniedError = PermissionDeniedError;
    /**
     * Error received from the Twilio backend.
     */
    var AcquisitionFailedError = /** @class */ (function (_super) {
        __extends(AcquisitionFailedError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return AcquisitionFailedError;
    }(twilioError_1.default));
    UserMediaErrors.AcquisitionFailedError = AcquisitionFailedError;
})(UserMediaErrors || (exports.UserMediaErrors = UserMediaErrors = {}));
var SignalingErrors;
(function (SignalingErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var ConnectionError = /** @class */ (function (_super) {
        __extends(ConnectionError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ConnectionError;
    }(twilioError_1.default));
    SignalingErrors.ConnectionError = ConnectionError;
    /**
     * Error received from the Twilio backend.
     */
    var ConnectionDisconnected = /** @class */ (function (_super) {
        __extends(ConnectionDisconnected, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ConnectionDisconnected;
    }(twilioError_1.default));
    SignalingErrors.ConnectionDisconnected = ConnectionDisconnected;
})(SignalingErrors || (exports.SignalingErrors = SignalingErrors = {}));
var MediaErrors;
(function (MediaErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var ClientLocalDescFailed = /** @class */ (function (_super) {
        __extends(ClientLocalDescFailed, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ClientLocalDescFailed;
    }(twilioError_1.default));
    MediaErrors.ClientLocalDescFailed = ClientLocalDescFailed;
    /**
     * Error received from the Twilio backend.
     */
    var ClientRemoteDescFailed = /** @class */ (function (_super) {
        __extends(ClientRemoteDescFailed, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ClientRemoteDescFailed;
    }(twilioError_1.default));
    MediaErrors.ClientRemoteDescFailed = ClientRemoteDescFailed;
    /**
     * Error received from the Twilio backend.
     */
    var ConnectionError = /** @class */ (function (_super) {
        __extends(ConnectionError, _super);
        /**
         * @internal
         */
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
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ConnectionError;
    }(twilioError_1.default));
    MediaErrors.ConnectionError = ConnectionError;
})(MediaErrors || (exports.MediaErrors = MediaErrors = {}));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9lcnJvcnMvZ2VuZXJhdGVkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBLHlEQUF5RDtBQUN6RDs7R0FFRztBQUNILDZDQUF3QztBQUMvQixzQkFERixxQkFBVyxDQUNFO0FBRXBCLElBQWlCLG1CQUFtQixDQTZJbkM7QUE3SUQsV0FBaUIsbUJBQW1CO0lBQ2xDOztPQUVHO0lBQ0g7UUFBd0Msc0NBQVc7UUF3QmpEOztXQUVHO1FBQ0gsNEJBQVksY0FBd0MsRUFBRSxLQUFzQjtZQUMxRSxZQUFBLE1BQUssWUFBQyxjQUFjLEVBQUUsS0FBSyxDQUFDLFNBQUM7WUEzQi9CLFlBQU0sR0FBYSxFQUFFLENBQUM7WUFDdEIsVUFBSSxHQUFXLEtBQUssQ0FBQztZQUNyQixpQkFBVyxHQUFXLHNCQUFzQixDQUFDO1lBQzdDLGlCQUFXLEdBQVcsaURBQWlELENBQUM7WUFDeEUsVUFBSSxHQUFXLG9CQUFvQixDQUFDO1lBQ3BDLGVBQVMsR0FBYSxFQUFFLENBQUM7WUF1QnZCLE1BQU0sQ0FBQyxjQUFjLENBQUMsS0FBSSxFQUFFLG1CQUFtQixDQUFDLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRTlFLElBQU0sT0FBTyxHQUFXLE9BQU8sY0FBYyxLQUFLLFFBQVE7Z0JBQ3hELENBQUMsQ0FBQyxjQUFjO2dCQUNoQixDQUFDLENBQUMsS0FBSSxDQUFDLFdBQVcsQ0FBQztZQUVyQixJQUFNLGFBQWEsR0FBK0IsT0FBTyxjQUFjLEtBQUssUUFBUTtnQkFDbEYsQ0FBQyxDQUFDLGNBQWM7Z0JBQ2hCLENBQUMsQ0FBQyxLQUFLLENBQUM7WUFFVixLQUFJLENBQUMsT0FBTyxHQUFHLFVBQUcsS0FBSSxDQUFDLElBQUksZUFBSyxLQUFJLENBQUMsSUFBSSxnQkFBTSxPQUFPLENBQUUsQ0FBQztZQUN6RCxLQUFJLENBQUMs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