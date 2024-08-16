"use strict";
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
exports.UserMediaErrors = exports.TwilioError = exports.SIPServerErrors = exports.SignatureValidationErrors = exports.SignalingErrors = exports.MediaErrors = exports.MalformedRequestErrors = exports.GeneralErrors = exports.ClientErrors = exports.AuthorizationErrors = exports.hasErrorByCode = exports.getErrorByCode = exports.NotSupportedError = exports.InvalidStateError = exports.InvalidArgumentError = exports.getPreciseSignalingErrorByCode = void 0;
/**
 * @packageDocumentation
 * @internalapi
 */
/* tslint:disable max-classes-per-file */
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
exports.getPreciseSignalingErrorByCode = getPreciseSignalingErrorByCode;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL2Vycm9ycy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7OztHQUdHO0FBQ0gseUNBQXlDO0FBQ3pDLHlDQVlxQjtBQW9IbkIsb0dBL0hBLCtCQUFtQixPQStIQTtBQUNuQiw2RkEvSEEsd0JBQVksT0ErSEE7QUFDWiw4RkE5SEEseUJBQWEsT0E4SEE7QUFDYix1R0E5SEEsa0NBQXNCLE9BOEhBO0FBQ3RCLDRGQTlIQSx1QkFBVyxPQThIQTtBQUNYLGdHQTlIQSwyQkFBZSxPQThIQTtBQUNmLDBHQTlIQSxxQ0FBeUIsT0E4SEE7QUFDekIsZ0dBOUhBLDJCQUFlLE9BOEhBO0FBQ2YsNEZBOUhBLHVCQUFXLE9BOEhBO0FBQ1gsZ0dBOUhBLDJCQUFlLE9BOEhBO0FBM0hqQjs7Ozs7Ozs7O0dBU0c7QUFDSCxJQUFNLDZCQUE2QixHQUFnQixJQUFJLEdBQUcsQ0FBQztJQUN6RDs7T0FFRztJQUNILEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMOztPQUVHO0lBQ0gsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0lBQ0w7O09BRUc7SUFDSCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMLEtBQUs7SUFDTDs7T0FFRztJQUNILEtBQUs7SUFDTCxLQUFLO0lBQ0wsS0FBSztJQUNMOztPQUVHO0lBQ0gsS0FBSztDQUNOLENBQUMsQ0FBQztBQUNILFNBQWdCLDhCQUE4QixDQUM1QyxxQ0FBOEMsRUFDOUMsU0FBaUI7SUFFakIsSUFBSSxPQUFPLFNBQVMsS0FBSyxRQUFRLEVBQUU7UUFDakMsT0FBTztLQUNSO0lBRUQsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsRUFBRTtRQUM5QixPQUFPO0tBQ1I7SUFFRCxJQUFNLGVBQWUsR0FBRyxxQ0FBcUM7UUFDM0QsQ0FBQyxDQUFDLElBQUk7UUFDTixDQUFDLENBQUMsQ0FBQyw2QkFBNkIsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDbEQsSUFBSSxDQUFDLGVBQWUsRUFBRTtRQUNwQixPQUFPO0tBQ1I7SUFFRCxPQUFPLGNBQWMsQ0FBQyxTQUFTLENBQUMsQ0FBQztBQUNuQyxDQUFDO0FBcEJELHdFQW9CQztBQUVELDJEQUEyRDtBQUMzRDtJQUEwQyx3Q0FBSztJQUM3Qyw4QkFBWSxPQUFnQjtRQUE1QixZQUNFLGtCQUFNLE9BQU8sQ0FBQyxTQUVmO1FBREMsS0FBSSxDQUFDLElBQUksR0FBRyxzQkFBc0IsQ0FBQzs7SUFDckMsQ0FBQztJQUNILDJCQUFDO0FBQUQsQ0FBQyxBQUxELENBQTBDLEtBQUssR0FLOUM7QUFMWSxvREFBb0I7QUFNakM7SUFBdUMscUNBQUs7SUFDMUMsMkJBQVksT0FBZ0I7UUFBNUIsWUFDRSxrQkFBTSxPQUFPLENBQUMsU0FFZjtRQURDLEtBQUksQ0FBQyxJQUFJLEdBQUcsbUJBQW1CLENBQUM7O0lBQ2xDLENBQUM7SUFDSCx3QkFBQztBQUFELENBQUMsQUFMRCxDQUF1QyxLQUFLLEdBSzNDO0FBTFksOENBQWlCO0FBTTlCO0lBQXVDLHFDQUFLO0lBQzFDLDJCQUFZLE9BQWdCO1FBQTVCLFlBQ0Usa0JBQU0sT0FBTyxDQUFDLFNBRWY7UUFEQyxLQUFJLENBQUMsSUFBSSxHQUFHLG1CQUFtQixDQUFDOztJQUNsQyxDQUFDO0lBQ0gsd0JBQUM7QUFBRCxDQUFDLEFBTEQsQ0FBdUMsS0FBSyxHQUszQztBQUxZLDhDQUFpQjtBQU85Qix1RUFBdUU7QUFDdkUsc0NBQXNDO0FBQ3RDLFNBQWdCLGNBQWMsQ0FBQyxJQUFZO0lBQ3pDLElBQU0sS0FBSyxHQUFxQyx3QkFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN2RSxJQUFJLENBQUMsS0FBSyxFQUFFO1FBQ1YsTUFBTSxJQUFJLG9CQUFvQixDQUFDLGdCQUFjLElBQUksZUFBWSxDQUFDLENBQUM7S0FDaEU7SUFDRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFORCx3Q0FNQztBQUVELHVFQUF1RTtBQUN2RSxzQ0FBc0M7QUFDdEMsU0FBZ0IsY0FBYyxDQUFDLElBQVk7SUFDekMsT0FBTyx3QkFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNoQyxDQUFDO0FBRkQsd0NBRUMifQ==