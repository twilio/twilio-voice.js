"use strict";
/* tslint:disable max-classes-per-file max-line-length */
/**
 * @packageDocumentation
 * @module Voice
 * @publicapi
 * @internal
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
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
    [31401, UserMediaErrors.PermissionDeniedError],
    [31402, UserMediaErrors.AcquisitionFailedError],
    [53000, SignalingErrors.ConnectionError],
    [53001, SignalingErrors.ConnectionDisconnected],
    [53400, MediaErrors.ClientLocalDescFailed],
    [53402, MediaErrors.ClientRemoteDescFailed],
    [53405, MediaErrors.ConnectionError],
]);
Object.freeze(exports.errorsByCode);
//# sourceMappingURL=generated.js.map