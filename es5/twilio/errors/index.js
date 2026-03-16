'use strict';

var tslib = require('tslib');
var generated = require('./generated.js');
var twilioError = require('./twilioError.js');

/* tslint:disable max-classes-per-file */
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
    tslib.__extends(InvalidArgumentError, _super);
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
/**
 * The error that is thrown when the library has entered an invalid state.
 */
var InvalidStateError = /** @class */ (function (_super) {
    tslib.__extends(InvalidStateError, _super);
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
/**
 * The error that is thrown when an attempt is made to use an API that is not
 * supported on the current platform.
 */
var NotSupportedError = /** @class */ (function (_super) {
    tslib.__extends(NotSupportedError, _super);
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
/**
 * This should only be used to look up error codes returned by a server
 * using the same repo of error codes.
 * @internal
 */
function getErrorByCode(code) {
    var error = generated.errorsByCode.get(code);
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
    return generated.errorsByCode.has(code);
}

Object.defineProperty(exports, "AuthorizationErrors", {
    enumerable: true,
    get: function () { return generated.AuthorizationErrors; }
});
Object.defineProperty(exports, "ClientErrors", {
    enumerable: true,
    get: function () { return generated.ClientErrors; }
});
Object.defineProperty(exports, "GeneralErrors", {
    enumerable: true,
    get: function () { return generated.GeneralErrors; }
});
Object.defineProperty(exports, "MalformedRequestErrors", {
    enumerable: true,
    get: function () { return generated.MalformedRequestErrors; }
});
Object.defineProperty(exports, "MediaErrors", {
    enumerable: true,
    get: function () { return generated.MediaErrors; }
});
Object.defineProperty(exports, "SIPServerErrors", {
    enumerable: true,
    get: function () { return generated.SIPServerErrors; }
});
Object.defineProperty(exports, "SignalingErrors", {
    enumerable: true,
    get: function () { return generated.SignalingErrors; }
});
Object.defineProperty(exports, "SignatureValidationErrors", {
    enumerable: true,
    get: function () { return generated.SignatureValidationErrors; }
});
Object.defineProperty(exports, "UserMediaErrors", {
    enumerable: true,
    get: function () { return generated.UserMediaErrors; }
});
exports.TwilioError = twilioError.default;
exports.InvalidArgumentError = InvalidArgumentError;
exports.InvalidStateError = InvalidStateError;
exports.NotSupportedError = NotSupportedError;
exports.getErrorByCode = getErrorByCode;
exports.getPreciseSignalingErrorByCode = getPreciseSignalingErrorByCode;
exports.hasErrorByCode = hasErrorByCode;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vZXJyb3JzL2luZGV4LnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIl9fZXh0ZW5kcyIsImVycm9yc0J5Q29kZSJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7QUFrQkE7Ozs7Ozs7OztBQVNHO0FBQ0gsSUFBTSw2QkFBNkIsR0FBZ0IsSUFBSSxHQUFHLENBQUM7QUFDekQ7O0FBRUc7SUFDSCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7QUFDTDs7QUFFRztJQUNILEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztBQUNMOztBQUVHO0lBQ0gsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0FBQ0w7O0FBRUc7SUFDSCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7QUFDTDs7QUFFRztJQUNILEtBQUs7QUFDTixDQUFBLENBQUM7QUFFRjs7Ozs7Ozs7OztBQVVHO0FBQ0csU0FBVSw4QkFBOEIsQ0FDNUMscUNBQThDLEVBQzlDLFNBQWlCLEVBQUE7QUFFakIsSUFBQSxJQUFJLE9BQU8sU0FBUyxLQUFLLFFBQVEsRUFBRTtRQUNqQztJQUNGO0FBRUEsSUFBQSxJQUFJLENBQUMsY0FBYyxDQUFDLFNBQVMsQ0FBQyxFQUFFO1FBQzlCO0lBQ0Y7SUFFQSxJQUFNLGVBQWUsR0FBRztBQUN0QixVQUFFO1VBQ0EsQ0FBQyw2QkFBNkIsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDO0lBQ2pELElBQUksQ0FBQyxlQUFlLEVBQUU7UUFDcEI7SUFDRjtBQUVBLElBQUEsT0FBTyxjQUFjLENBQUMsU0FBUyxDQUFDO0FBQ2xDO0FBRUE7O0FBRUc7QUFDSCxJQUFBLG9CQUFBLGtCQUFBLFVBQUEsTUFBQSxFQUFBO0lBQTBDQSxlQUFBLENBQUEsb0JBQUEsRUFBQSxNQUFBLENBQUE7QUFDeEM7O0FBRUc7QUFDSCxJQUFBLFNBQUEsb0JBQUEsQ0FBWSxPQUFnQixFQUFBO0FBQzFCLFFBQUEsSUFBQSxLQUFBLEdBQUEsTUFBSyxDQUFBLElBQUEsQ0FBQSxJQUFBLEVBQUMsT0FBTyxDQUFDLElBQUEsSUFBQTtBQUNkLFFBQUEsS0FBSSxDQUFDLElBQUksR0FBRyxzQkFBc0I7O0lBQ3BDO0lBQ0YsT0FBQSxvQkFBQztBQUFELENBUkEsQ0FBMEMsS0FBSyxDQUFBO0FBVS9DOztBQUVHO0FBQ0gsSUFBQSxpQkFBQSxrQkFBQSxVQUFBLE1BQUEsRUFBQTtJQUF1Q0EsZUFBQSxDQUFBLGlCQUFBLEVBQUEsTUFBQSxDQUFBO0FBQ3JDOztBQUVHO0FBQ0gsSUFBQSxTQUFBLGlCQUFBLENBQVksT0FBZ0IsRUFBQTtBQUMxQixRQUFBLElBQUEsS0FBQSxHQUFBLE1BQUssQ0FBQSxJQUFBLENBQUEsSUFBQSxFQUFDLE9BQU8sQ0FBQyxJQUFBLElBQUE7QUFDZCxRQUFBLEtBQUksQ0FBQyxJQUFJLEdBQUcsbUJBQW1COztJQUNqQztJQUNGLE9BQUEsaUJBQUM7QUFBRCxDQVJBLENBQXVDLEtBQUssQ0FBQTtBQVU1Qzs7O0FBR0c7QUFDSCxJQUFBLGlCQUFBLGtCQUFBLFVBQUEsTUFBQSxFQUFBO0lBQXVDQSxlQUFBLENBQUEsaUJBQUEsRUFBQSxNQUFBLENBQUE7QUFDckM7O0FBRUc7QUFDSCxJQUFBLFNBQUEsaUJBQUEsQ0FBWSxPQUFnQixFQUFBO0FBQzFCLFFBQUEsSUFBQSxLQUFBLEdBQUEsTUFBSyxDQUFBLElBQUEsQ0FBQSxJQUFBLEVBQUMsT0FBTyxDQUFDLElBQUEsSUFBQTtBQUNkLFFBQUEsS0FBSSxDQUFDLElBQUksR0FBRyxtQkFBbUI7O0lBQ2pDO0lBQ0YsT0FBQSxpQkFBQztBQUFELENBUkEsQ0FBdUMsS0FBSyxDQUFBO0FBVTVDOzs7O0FBSUc7QUFDRyxTQUFVLGNBQWMsQ0FBQyxJQUFZLEVBQUE7SUFDekMsSUFBTSxLQUFLLEdBQXFDQyxzQkFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUM7SUFDdEUsSUFBSSxDQUFDLEtBQUssRUFBRTtBQUNWLFFBQUEsTUFBTSxJQUFJLG9CQUFvQixDQUFDLHFCQUFjLElBQUksRUFBQSxZQUFBLENBQVksQ0FBQztJQUNoRTtBQUNBLElBQUEsT0FBTyxLQUFLO0FBQ2Q7QUFFQTs7OztBQUlHO0FBQ0csU0FBVSxjQUFjLENBQUMsSUFBWSxFQUFBO0FBQ3pDLElBQUEsT0FBT0Esc0JBQVksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDO0FBQy9COzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OyJ9
