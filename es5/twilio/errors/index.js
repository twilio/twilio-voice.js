"use strict";
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
 * @packageDocumentation
 * @internalapi
 */
/* tslint:disable max-classes-per-file */
var generated_1 = require("./generated");
exports.AuthorizationErrors = generated_1.AuthorizationErrors;
exports.ClientErrors = generated_1.ClientErrors;
exports.GeneralErrors = generated_1.GeneralErrors;
exports.MediaErrors = generated_1.MediaErrors;
exports.SignalingErrors = generated_1.SignalingErrors;
exports.TwilioError = generated_1.TwilioError;
exports.UserMediaErrors = generated_1.UserMediaErrors;
// Application errors that can be avoided by good app logic
var InvalidArgumentError = /** @class */ (function (_super) {
    __extends(InvalidArgumentError, _super);
    function InvalidArgumentError(message) {
        var _this = _super.call(this, message) || this;
        _this.name = 'InvalidArgumentError';
        return _this;
    }
    return InvalidArgumentError;
}(Error));
exports.InvalidArgumentError = InvalidArgumentError;
var InvalidStateError = /** @class */ (function (_super) {
    __extends(InvalidStateError, _super);
    function InvalidStateError(message) {
        var _this = _super.call(this, message) || this;
        _this.name = 'InvalidStateError';
        return _this;
    }
    return InvalidStateError;
}(Error));
exports.InvalidStateError = InvalidStateError;
var NotSupportedError = /** @class */ (function (_super) {
    __extends(NotSupportedError, _super);
    function NotSupportedError(message) {
        var _this = _super.call(this, message) || this;
        _this.name = 'NotSupportedError';
        return _this;
    }
    return NotSupportedError;
}(Error));
exports.NotSupportedError = NotSupportedError;
// This should only be used to look up error codes returned by a server
// using the same repo of error codes.
function getErrorByCode(code) {
    var error = generated_1.errorsByCode.get(code);
    if (!error) {
        throw new InvalidArgumentError("Error code " + code + " not found");
    }
    return error;
}
exports.getErrorByCode = getErrorByCode;
// This should only be used to look up error codes returned by a server
// using the same repo of error codes.
function hasErrorByCode(code) {
    return generated_1.errorsByCode.has(code);
}
exports.hasErrorByCode = hasErrorByCode;
//# sourceMappingURL=index.js.map