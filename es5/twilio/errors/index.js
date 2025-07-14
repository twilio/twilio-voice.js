"use strict";
/* tslint:disable max-classes-per-file */
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
exports.UserMediaErrors = exports.TwilioError = exports.SIPServerErrors = exports.SignatureValidationErrors = exports.SignalingErrors = exports.MediaErrors = exports.MalformedRequestErrors = exports.GeneralErrors = exports.ClientErrors = exports.AuthorizationErrors = exports.NotSupportedError = exports.InvalidStateError = exports.InvalidArgumentError = void 0;
exports.getPreciseSignalingErrorByCode = getPreciseSignalingErrorByCode;
exports.getErrorByCode = getErrorByCode;
exports.hasErrorByCode = hasErrorByCode;
// TODO: Consider refactoring this export (VBLOCKS-4589)
var generated_1 = require("./generated");
Object.defineProperty(exports, "AuthorizationErrors", { enumerable: true, get: function () { return generated_1.AuthorizationErrors; } });
Object.defineProperty(exports, "ClientErrors", { enumerable: true, get: function () { return generated_1.ClientErrors; } });
Object.defineProperty(exports, "GeneralErrors", { enumerable: true, get: function () { return generated_1.GeneralErrors; } });
Object.defineProperty(exports, "MalformedRequestErrors", { enumerable: true, get: function () { return generated_1.MalformedRequestErrors; } });
Object.defineProperty(exports, "MediaErrors", { enumerable: true, get: function () { return generated_1.MediaErrors; } });
Object.defineProperty(exports, "SignalingErrors", { enumerable: true, get: function () { return generated_1.SignalingErrors; } });
Object.defineProperty(exports, "SignatureValidationErrors", { enumerable: true, get: function () { return generated_1.SignatureValidationErrors; } });
Object.defineProperty(exports, "SIPServerErrors", { enumerable: true, get: function () { return generated_1.SIPServerErrors; } });
Object.defineProperty(exports, "TwilioError", { enumerable: true, get: function () { return generated_1.TwilioError; } });
Object.defineProperty(exports, "UserMediaErrors", { enumerable: true, get: function () { return generated_1.UserMediaErrors; } });
/**
 * NOTE(mhuynh): Replacing generic error codes with new (more specific) codes,
 * is a breaking change. If an error code is found in this set, we only perform
 * the transformation if the feature flag is enabled.
 *
 * With every major version bump, such that we are allowed to introduce breaking
 * changes as per semver specification, this array should be cleared.
 *
 * TODO: [VBLOCKS-2295] Remove this in 3.x
 */
var PRECISE_SIGNALING_ERROR_CODES = new Set([
    /**
     * 310XX Errors
     */
    31001,
    31002,
    31003,
    /**
     * 311XX Errors
     */
    31101,
    31102,
    31103,
    31104,
    31105,
    31107,
    /**
     * 312XX Errors
     */
    31201,
    31202,
    31203,
    31204,
    31205,
    31207,
    /**
     * 314XX Errors
     */
    31404,
    31480,
    31486,
    /**
     * 316XX Errors
     */
    31603,
]);
/**
 * Get an error constructor using the [[PRECISE_SIGNALING_ERROR_CODES]] set.
 * @internal
 * @param enableImprovedSignalingErrorPrecision - A boolean representing the
 * optional flag whether or not to use more precise error codes.
 * @param errorCode - The error code.
 * @returns This function returns `undefined` if the passed error code does not
 * correlate to an error or should not be constructed with a more precise error
 * constructor. A sub-class of {@link TwilioError} if the code does correlate to
 * an error.
 */
function getPreciseSignalingErrorByCode(enableImprovedSignalingErrorPrecision, errorCode) {
    if (typeof errorCode !== 'number') {
        return;
    }
    if (!hasErrorByCode(errorCode)) {
        return;
    }
    var shouldTransform = enableImprovedSignalingErrorPrecision
        ? true
        : !PRECISE_SIGNALING_ERROR_CODES.has(errorCode);
    if (!shouldTransform) {
        return;
    }
    return getErrorByCode(errorCode);
}
/**
 * The error that is thrown when an invalid argument is passed to a library API.
 */
var InvalidArgumentError = /** @class */ (function (_super) {
    __extends(InvalidArgumentError, _super);
    /**
     * @internal
     */
    function InvalidArgumentError(message) {
        var _this = _super.call(this, message) || this;
        _this.name = 'InvalidArgumentError';
        return _this;
    }
    return InvalidArgumentError;
}(Error));
exports.InvalidArgumentError = InvalidArgumentError;
/**
 * The error that is thrown when the library has entered an invalid state.
 */
var InvalidStateError = /** @class */ (function (_super) {
    __extends(InvalidStateError, _super);
    /**
     * @internal
     */
    function InvalidStateError(message) {
        var _this = _super.call(this, message) || this;
        _this.name = 'InvalidStateError';
        return _this;
    }
    return InvalidStateError;
}(Error));
exports.InvalidStateError = InvalidStateError;
/**
 * The error that is thrown when an attempt is made to use an API that is not
 * supported on the current platform.
 */
var NotSupportedError = /** @class */ (function (_super) {
    __extends(NotSupportedError, _super);
    /**
     * @internal
     */
    function NotSupportedError(message) {
        var _this = _super.call(this, message) || this;
        _this.name = 'NotSupportedError';
        return _this;
    }
    return NotSupportedError;
}(Error));
exports.NotSupportedError = NotSupportedError;
/**
 * This should only be used to look up error codes returned by a server
 * using the same repo of error codes.
 * @internal
 */
function getErrorByCode(code) {
    var error = generated_1.errorsByCode.get(code);
    if (!error) {
        throw new InvalidArgumentError("Error code ".concat(code, " not found"));
    }
    return error;
}
/**
 * This should only be used to look up error codes returned by a server
 * using the same repo of error codes.
 * @internal
 */
function hasErrorByCode(code) {
    return generated_1.errorsByCode.has(code);
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL2Vycm9ycy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEseUNBQXlDOzs7Ozs7Ozs7Ozs7Ozs7Ozs7QUE0RXpDLHdFQW9CQztBQStDRCx3Q0FNQztBQU9ELHdDQUVDO0FBNUpELHdEQUF3RDtBQUV4RCx5Q0FZcUI7QUE0Sm5CLG9HQXZLQSwrQkFBbUIsT0F1S0E7QUFDbkIsNkZBdktBLHdCQUFZLE9BdUtBO0FBQ1osOEZBdEtBLHlCQUFhLE9Bc0tBO0FBQ2IsdUdBdEtBLGtDQUFzQixPQXNLQTtBQUN0Qiw0RkF0S0EsdUJBQVcsT0FzS0E7QUFDWCxnR0F0S0EsMkJBQWUsT0FzS0E7QUFDZiwwR0F0S0EscUNBQXlCLE9Bc0tBO0FBQ3pCLGdHQXRLQSwyQkFBZSxPQXNLQTtBQUNmLDRGQXRLQSx1QkFBVyxPQXNLQTtBQUNYLGdHQXRLQSwyQkFBZSxPQXNLQTtBQW5LakI7Ozs7Ozs7OztHQVNHO0FBQ0gsSUFBTSw2QkFBNkIsR0FBZ0IsSUFBSSxHQUFHLENBQUM7SUFDekQ7O09BRUc7SUFDSCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTDs7T0FFRztJQUNILEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMOztPQUVHO0lBQ0gsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0lBQ0w7O09BRUc7SUFDSCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTDs7T0FFRztJQUNILEtBQUs7Q0FDTixDQUFDLENBQUM7QUFFSDs7Ozs7Ozs7OztHQVVHO0FBQ0gsU0FBZ0IsOEJBQThCLENBQzVDLHFDQUE4QyxFQUM5QyxTQUFpQjtJQUVqQixJQUFJLE9BQU8sU0FBUyxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQ2xDLE9BQU87SUFDVCxDQUFDO0lBRUQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1FBQy9CLE9BQU87SUFDVCxDQUFDO0lBRUQsSUFBTSxlQUFlLEdBQUcscUNBQXFDO1FBQzNELENBQUMsQ0FBQyxJQUFJO1FBQ04sQ0FBQyxDQUFDLENBQUMsNkJBQTZCLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0lBQ2xELElBQUksQ0FBQyxlQUFlLEVBQUUsQ0FBQztRQUNyQixPQUFPO0lBQ1QsQ0FBQztJQUVELE9BQU8sY0FBYyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ25DLENBQUM7QUFFRDs7R0FFRztBQUNIO0lBQTBDLHdDQUFLO0lBQzdDOztPQUVHO0lBQ0gsOEJBQVksT0FBZ0I7UUFDMUIsWUFBQSxNQUFLLFlBQUMsT0FBTyxDQUFDLFNBQUM7UUFDZixLQUFJLENBQUMsSUFBSSxHQUFHLHNCQUFzQixDQUFDOztJQUNyQyxDQUFDO0lBQ0gsMkJBQUM7QUFBRCxDQUFDLEFBUkQsQ0FBMEMsS0FBSyxHQVE5QztBQVJZLG9EQUFvQjtBQVVqQzs7R0FFRztBQUNIO0lBQXVDLHFDQUFLO0lBQzFDOztPQUVHO0lBQ0gsMkJBQVksT0FBZ0I7UUFDMUIsWUFBQSxNQUFLLFlBQUMsT0FBTyxDQUFDLFNBQUM7UUFDZixLQUFJLENBQUMsSUFBSSxHQUFHLG1CQUFtQixDQUFDOztJQUNsQyxDQUFDO0lBQ0gsd0JBQUM7QUFBRCxDQUFDLEFBUkQsQ0FBdUMsS0FBSyxHQVEzQztBQVJZLDhDQUFpQjtBQVU5Qjs7O0dBR0c7QUFDSDtJQUF1QyxxQ0FBSztJQUMxQzs7T0FFRztJQUNILDJCQUFZLE9BQWdCO1FBQzFCLFlBQUEsTUFBSyxZQUFDLE9BQU8sQ0FBQyxTQUFDO1FBQ2YsS0FBSSxDQUFDLElBQUksR0FBRyxtQkFBbUIsQ0FBQzs7SUFDbEMsQ0FBQztJQUNILHdCQUFDO0FBQUQsQ0FBQyxBQVJELENBQXVDLEtBQUssR0FRM0M7QUFSWSw4Q0FBaUI7QUFVOUI7Ozs7R0FJRztBQUNILFNBQWdCLGNBQWMsQ0FBQyxJQUFZO0lBQ3pDLElBQU0sS0FBSyxHQUFxQyx3QkFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN2RSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDWCxNQUFNLElBQUksb0JBQW9CLENBQUMscUJBQWMsSUFBSSxlQUFZLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBQ0QsT0FBTyxLQUFLLENBQUM7QUFDZixDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQWdCLGNBQWMsQ0FBQyxJQUFZO0lBQ3pDLE9BQU8sd0JBQVksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLENBQUM7QUFDaEMsQ0FBQyJ9