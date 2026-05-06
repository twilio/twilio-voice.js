'use strict';

var tslib = require('tslib');
var twilioError = require('./twilioError.js');

exports.AuthorizationErrors = void 0;
(function (AuthorizationErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var AccessTokenInvalid = /** @class */ (function (_super) {
        tslib.__extends(AccessTokenInvalid, _super);
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
    }(twilioError.default));
    AuthorizationErrors.AccessTokenInvalid = AccessTokenInvalid;
    /**
     * Error received from the Twilio backend.
     */
    var AccessTokenExpired = /** @class */ (function (_super) {
        tslib.__extends(AccessTokenExpired, _super);
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
    }(twilioError.default));
    AuthorizationErrors.AccessTokenExpired = AccessTokenExpired;
    /**
     * Error received from the Twilio backend.
     */
    var AuthenticationFailed = /** @class */ (function (_super) {
        tslib.__extends(AuthenticationFailed, _super);
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
    }(twilioError.default));
    AuthorizationErrors.AuthenticationFailed = AuthenticationFailed;
})(exports.AuthorizationErrors || (exports.AuthorizationErrors = {}));
exports.SignatureValidationErrors = void 0;
(function (SignatureValidationErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var AccessTokenSignatureValidationFailed = /** @class */ (function (_super) {
        tslib.__extends(AccessTokenSignatureValidationFailed, _super);
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
    }(twilioError.default));
    SignatureValidationErrors.AccessTokenSignatureValidationFailed = AccessTokenSignatureValidationFailed;
})(exports.SignatureValidationErrors || (exports.SignatureValidationErrors = {}));
exports.ClientErrors = void 0;
(function (ClientErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var BadRequest = /** @class */ (function (_super) {
        tslib.__extends(BadRequest, _super);
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
    }(twilioError.default));
    ClientErrors.BadRequest = BadRequest;
    /**
     * Error received from the Twilio backend.
     */
    var NotFound = /** @class */ (function (_super) {
        tslib.__extends(NotFound, _super);
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
    }(twilioError.default));
    ClientErrors.NotFound = NotFound;
    /**
     * Error received from the Twilio backend.
     */
    var TemporarilyUnavailable = /** @class */ (function (_super) {
        tslib.__extends(TemporarilyUnavailable, _super);
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
    }(twilioError.default));
    ClientErrors.TemporarilyUnavailable = TemporarilyUnavailable;
    /**
     * Error received from the Twilio backend.
     */
    var BusyHere = /** @class */ (function (_super) {
        tslib.__extends(BusyHere, _super);
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
    }(twilioError.default));
    ClientErrors.BusyHere = BusyHere;
})(exports.ClientErrors || (exports.ClientErrors = {}));
exports.SIPServerErrors = void 0;
(function (SIPServerErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var Decline = /** @class */ (function (_super) {
        tslib.__extends(Decline, _super);
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
    }(twilioError.default));
    SIPServerErrors.Decline = Decline;
})(exports.SIPServerErrors || (exports.SIPServerErrors = {}));
exports.GeneralErrors = void 0;
(function (GeneralErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var UnknownError = /** @class */ (function (_super) {
        tslib.__extends(UnknownError, _super);
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
    }(twilioError.default));
    GeneralErrors.UnknownError = UnknownError;
    /**
     * Error received from the Twilio backend.
     */
    var ApplicationNotFoundError = /** @class */ (function (_super) {
        tslib.__extends(ApplicationNotFoundError, _super);
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
    }(twilioError.default));
    GeneralErrors.ApplicationNotFoundError = ApplicationNotFoundError;
    /**
     * Error received from the Twilio backend.
     */
    var ConnectionDeclinedError = /** @class */ (function (_super) {
        tslib.__extends(ConnectionDeclinedError, _super);
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
    }(twilioError.default));
    GeneralErrors.ConnectionDeclinedError = ConnectionDeclinedError;
    /**
     * Error received from the Twilio backend.
     */
    var ConnectionTimeoutError = /** @class */ (function (_super) {
        tslib.__extends(ConnectionTimeoutError, _super);
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
    }(twilioError.default));
    GeneralErrors.ConnectionTimeoutError = ConnectionTimeoutError;
    /**
     * Error received from the Twilio backend.
     */
    var ConnectionError = /** @class */ (function (_super) {
        tslib.__extends(ConnectionError, _super);
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
    }(twilioError.default));
    GeneralErrors.ConnectionError = ConnectionError;
    /**
     * Error received from the Twilio backend.
     */
    var CallCancelledError = /** @class */ (function (_super) {
        tslib.__extends(CallCancelledError, _super);
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
    }(twilioError.default));
    GeneralErrors.CallCancelledError = CallCancelledError;
    /**
     * Error received from the Twilio backend.
     */
    var TransportError = /** @class */ (function (_super) {
        tslib.__extends(TransportError, _super);
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
    }(twilioError.default));
    GeneralErrors.TransportError = TransportError;
})(exports.GeneralErrors || (exports.GeneralErrors = {}));
exports.MalformedRequestErrors = void 0;
(function (MalformedRequestErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var MalformedRequestError = /** @class */ (function (_super) {
        tslib.__extends(MalformedRequestError, _super);
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
    }(twilioError.default));
    MalformedRequestErrors.MalformedRequestError = MalformedRequestError;
    /**
     * Error received from the Twilio backend.
     */
    var MissingParameterArrayError = /** @class */ (function (_super) {
        tslib.__extends(MissingParameterArrayError, _super);
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
    }(twilioError.default));
    MalformedRequestErrors.MissingParameterArrayError = MissingParameterArrayError;
    /**
     * Error received from the Twilio backend.
     */
    var AuthorizationTokenMissingError = /** @class */ (function (_super) {
        tslib.__extends(AuthorizationTokenMissingError, _super);
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
    }(twilioError.default));
    MalformedRequestErrors.AuthorizationTokenMissingError = AuthorizationTokenMissingError;
    /**
     * Error received from the Twilio backend.
     */
    var MaxParameterLengthExceededError = /** @class */ (function (_super) {
        tslib.__extends(MaxParameterLengthExceededError, _super);
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
    }(twilioError.default));
    MalformedRequestErrors.MaxParameterLengthExceededError = MaxParameterLengthExceededError;
    /**
     * Error received from the Twilio backend.
     */
    var InvalidBridgeTokenError = /** @class */ (function (_super) {
        tslib.__extends(InvalidBridgeTokenError, _super);
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
    }(twilioError.default));
    MalformedRequestErrors.InvalidBridgeTokenError = InvalidBridgeTokenError;
    /**
     * Error received from the Twilio backend.
     */
    var InvalidClientNameError = /** @class */ (function (_super) {
        tslib.__extends(InvalidClientNameError, _super);
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
    }(twilioError.default));
    MalformedRequestErrors.InvalidClientNameError = InvalidClientNameError;
    /**
     * Error received from the Twilio backend.
     */
    var ReconnectParameterInvalidError = /** @class */ (function (_super) {
        tslib.__extends(ReconnectParameterInvalidError, _super);
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
    }(twilioError.default));
    MalformedRequestErrors.ReconnectParameterInvalidError = ReconnectParameterInvalidError;
})(exports.MalformedRequestErrors || (exports.MalformedRequestErrors = {}));
(function (AuthorizationErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var AuthorizationError = /** @class */ (function (_super) {
        tslib.__extends(AuthorizationError, _super);
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
    }(twilioError.default));
    AuthorizationErrors.AuthorizationError = AuthorizationError;
    /**
     * Error received from the Twilio backend.
     */
    var NoValidAccountError = /** @class */ (function (_super) {
        tslib.__extends(NoValidAccountError, _super);
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
    }(twilioError.default));
    AuthorizationErrors.NoValidAccountError = NoValidAccountError;
    /**
     * Error received from the Twilio backend.
     */
    var InvalidJWTTokenError = /** @class */ (function (_super) {
        tslib.__extends(InvalidJWTTokenError, _super);
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
    }(twilioError.default));
    AuthorizationErrors.InvalidJWTTokenError = InvalidJWTTokenError;
    /**
     * Error received from the Twilio backend.
     */
    var JWTTokenExpiredError = /** @class */ (function (_super) {
        tslib.__extends(JWTTokenExpiredError, _super);
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
    }(twilioError.default));
    AuthorizationErrors.JWTTokenExpiredError = JWTTokenExpiredError;
    /**
     * Error received from the Twilio backend.
     */
    var RateExceededError = /** @class */ (function (_super) {
        tslib.__extends(RateExceededError, _super);
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
    }(twilioError.default));
    AuthorizationErrors.RateExceededError = RateExceededError;
    /**
     * Error received from the Twilio backend.
     */
    var JWTTokenExpirationTooLongError = /** @class */ (function (_super) {
        tslib.__extends(JWTTokenExpirationTooLongError, _super);
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
    }(twilioError.default));
    AuthorizationErrors.JWTTokenExpirationTooLongError = JWTTokenExpirationTooLongError;
    /**
     * Error received from the Twilio backend.
     */
    var ReconnectAttemptError = /** @class */ (function (_super) {
        tslib.__extends(ReconnectAttemptError, _super);
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
    }(twilioError.default));
    AuthorizationErrors.ReconnectAttemptError = ReconnectAttemptError;
    /**
     * Error received from the Twilio backend.
     */
    var CallMessageEventTypeInvalidError = /** @class */ (function (_super) {
        tslib.__extends(CallMessageEventTypeInvalidError, _super);
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
    }(twilioError.default));
    AuthorizationErrors.CallMessageEventTypeInvalidError = CallMessageEventTypeInvalidError;
    /**
     * Error received from the Twilio backend.
     */
    var PayloadSizeExceededError = /** @class */ (function (_super) {
        tslib.__extends(PayloadSizeExceededError, _super);
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
    }(twilioError.default));
    AuthorizationErrors.PayloadSizeExceededError = PayloadSizeExceededError;
})(exports.AuthorizationErrors || (exports.AuthorizationErrors = {}));
exports.UserMediaErrors = void 0;
(function (UserMediaErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var PermissionDeniedError = /** @class */ (function (_super) {
        tslib.__extends(PermissionDeniedError, _super);
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
    }(twilioError.default));
    UserMediaErrors.PermissionDeniedError = PermissionDeniedError;
    /**
     * Error received from the Twilio backend.
     */
    var AcquisitionFailedError = /** @class */ (function (_super) {
        tslib.__extends(AcquisitionFailedError, _super);
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
    }(twilioError.default));
    UserMediaErrors.AcquisitionFailedError = AcquisitionFailedError;
})(exports.UserMediaErrors || (exports.UserMediaErrors = {}));
exports.SignalingErrors = void 0;
(function (SignalingErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var ConnectionError = /** @class */ (function (_super) {
        tslib.__extends(ConnectionError, _super);
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
    }(twilioError.default));
    SignalingErrors.ConnectionError = ConnectionError;
    /**
     * Error received from the Twilio backend.
     */
    var ConnectionDisconnected = /** @class */ (function (_super) {
        tslib.__extends(ConnectionDisconnected, _super);
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
    }(twilioError.default));
    SignalingErrors.ConnectionDisconnected = ConnectionDisconnected;
})(exports.SignalingErrors || (exports.SignalingErrors = {}));
exports.MediaErrors = void 0;
(function (MediaErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var ClientLocalDescFailed = /** @class */ (function (_super) {
        tslib.__extends(ClientLocalDescFailed, _super);
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
    }(twilioError.default));
    MediaErrors.ClientLocalDescFailed = ClientLocalDescFailed;
    /**
     * Error received from the Twilio backend.
     */
    var ClientRemoteDescFailed = /** @class */ (function (_super) {
        tslib.__extends(ClientRemoteDescFailed, _super);
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
    }(twilioError.default));
    MediaErrors.ClientRemoteDescFailed = ClientRemoteDescFailed;
    /**
     * Error received from the Twilio backend.
     */
    var ConnectionError = /** @class */ (function (_super) {
        tslib.__extends(ConnectionError, _super);
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
    }(twilioError.default));
    MediaErrors.ConnectionError = ConnectionError;
})(exports.MediaErrors || (exports.MediaErrors = {}));
/**
 * @private
 */
var errorsByCode = new Map([
    [20101, exports.AuthorizationErrors.AccessTokenInvalid],
    [20104, exports.AuthorizationErrors.AccessTokenExpired],
    [20151, exports.AuthorizationErrors.AuthenticationFailed],
    [31202, exports.SignatureValidationErrors.AccessTokenSignatureValidationFailed],
    [31400, exports.ClientErrors.BadRequest],
    [31404, exports.ClientErrors.NotFound],
    [31480, exports.ClientErrors.TemporarilyUnavailable],
    [31486, exports.ClientErrors.BusyHere],
    [31603, exports.SIPServerErrors.Decline],
    [31000, exports.GeneralErrors.UnknownError],
    [31001, exports.GeneralErrors.ApplicationNotFoundError],
    [31002, exports.GeneralErrors.ConnectionDeclinedError],
    [31003, exports.GeneralErrors.ConnectionTimeoutError],
    [31005, exports.GeneralErrors.ConnectionError],
    [31008, exports.GeneralErrors.CallCancelledError],
    [31009, exports.GeneralErrors.TransportError],
    [31100, exports.MalformedRequestErrors.MalformedRequestError],
    [31101, exports.MalformedRequestErrors.MissingParameterArrayError],
    [31102, exports.MalformedRequestErrors.AuthorizationTokenMissingError],
    [31103, exports.MalformedRequestErrors.MaxParameterLengthExceededError],
    [31104, exports.MalformedRequestErrors.InvalidBridgeTokenError],
    [31105, exports.MalformedRequestErrors.InvalidClientNameError],
    [31107, exports.MalformedRequestErrors.ReconnectParameterInvalidError],
    [31201, exports.AuthorizationErrors.AuthorizationError],
    [31203, exports.AuthorizationErrors.NoValidAccountError],
    [31204, exports.AuthorizationErrors.InvalidJWTTokenError],
    [31205, exports.AuthorizationErrors.JWTTokenExpiredError],
    [31206, exports.AuthorizationErrors.RateExceededError],
    [31207, exports.AuthorizationErrors.JWTTokenExpirationTooLongError],
    [31209, exports.AuthorizationErrors.ReconnectAttemptError],
    [31210, exports.AuthorizationErrors.CallMessageEventTypeInvalidError],
    [31212, exports.AuthorizationErrors.PayloadSizeExceededError],
    [31401, exports.UserMediaErrors.PermissionDeniedError],
    [31402, exports.UserMediaErrors.AcquisitionFailedError],
    [53000, exports.SignalingErrors.ConnectionError],
    [53001, exports.SignalingErrors.ConnectionDisconnected],
    [53400, exports.MediaErrors.ClientLocalDescFailed],
    [53402, exports.MediaErrors.ClientRemoteDescFailed],
    [53405, exports.MediaErrors.ConnectionError],
]);
Object.freeze(errorsByCode);

exports.TwilioError = twilioError.default;
exports.errorsByCode = errorsByCode;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2VuZXJhdGVkLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL2Vycm9ycy9nZW5lcmF0ZWQudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOlsiQXV0aG9yaXphdGlvbkVycm9ycyIsIl9fZXh0ZW5kcyIsIlR3aWxpb0Vycm9yIiwiU2lnbmF0dXJlVmFsaWRhdGlvbkVycm9ycyIsIkNsaWVudEVycm9ycyIsIlNJUFNlcnZlckVycm9ycyIsIkdlbmVyYWxFcnJvcnMiLCJNYWxmb3JtZWRSZXF1ZXN0RXJyb3JzIiwiVXNlck1lZGlhRXJyb3JzIiwiU2lnbmFsaW5nRXJyb3JzIiwiTWVkaWFFcnJvcnMiXSwibWFwcGluZ3MiOiI7Ozs7O0FBT2lCQTtBQUFqQixDQUFBLFVBQWlCLG1CQUFtQixFQUFBO0FBQ2xDOztBQUVHO0FBQ0gsSUFBQSxJQUFBLGtCQUFBLGtCQUFBLFVBQUEsTUFBQSxFQUFBO1FBQXdDQyxlQUFBLENBQUEsa0JBQUEsRUFBQSxNQUFBLENBQUE7QUF3QnRDOztBQUVHO1FBQ0gsU0FBQSxrQkFBQSxDQUFZLGNBQXdDLEVBQUUsS0FBc0IsRUFBQTtBQUMxRSxZQUFBLElBQUEsS0FBQSxHQUFBLE1BQUssQ0FBQSxJQUFBLENBQUEsSUFBQSxFQUFDLGNBQWMsRUFBRSxLQUFLLENBQUMsSUFBQSxJQUFBO1lBM0I5QixLQUFBLENBQUEsTUFBTSxHQUFhLEVBQUU7WUFDckIsS0FBQSxDQUFBLElBQUksR0FBVyxLQUFLO1lBQ3BCLEtBQUEsQ0FBQSxXQUFXLEdBQVcsc0JBQXNCO1lBQzVDLEtBQUEsQ0FBQSxXQUFXLEdBQVcsaURBQWlEO1lBQ3ZFLEtBQUEsQ0FBQSxJQUFJLEdBQVcsb0JBQW9CO1lBQ25DLEtBQUEsQ0FBQSxTQUFTLEdBQWEsRUFBRTtZQXVCdEIsTUFBTSxDQUFDLGNBQWMsQ0FBQyxLQUFJLEVBQUUsbUJBQW1CLENBQUMsa0JBQWtCLENBQUMsU0FBUyxDQUFDO0FBRTdFLFlBQUEsSUFBTSxPQUFPLEdBQVcs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
