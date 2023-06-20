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
exports.errorsByCode = exports.MediaErrors = exports.SignalingErrors = exports.UserMediaErrors = exports.MalformedRequestErrors = exports.GeneralErrors = exports.ClientErrors = exports.AuthorizationErrors = exports.TwilioError = void 0;
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
})(ClientErrors = exports.ClientErrors || (exports.ClientErrors = {}));
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
})(MalformedRequestErrors = exports.MalformedRequestErrors || (exports.MalformedRequestErrors = {}));
(function (AuthorizationErrors) {
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
    var PayloadSizeExceededError = /** @class */ (function (_super) {
        __extends(PayloadSizeExceededError, _super);
        function PayloadSizeExceededError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The payload size of Call Message Event exceeds the authorized limit.',
            ];
            _this.code = 31209;
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
    [31400, ClientErrors.BadRequest],
    [31000, GeneralErrors.UnknownError],
    [31005, GeneralErrors.ConnectionError],
    [31008, GeneralErrors.CallCancelledError],
    [31009, GeneralErrors.TransportError],
    [31100, MalformedRequestErrors.MalformedRequestError],
    [31206, AuthorizationErrors.RateExceededError],
    [31209, AuthorizationErrors.PayloadSizeExceededError],
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