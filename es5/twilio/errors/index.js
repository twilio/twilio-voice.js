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
exports.UserMediaErrors = exports.TwilioError = exports.SignalingErrors = exports.MediaErrors = exports.GeneralErrors = exports.ClientErrors = exports.AuthorizationErrors = exports.hasErrorByCode = exports.getErrorByCode = exports.NotSupportedError = exports.InvalidStateError = exports.InvalidArgumentError = void 0;
/**
 * @packageDocumentation
 * @internalapi
 */
/* tslint:disable max-classes-per-file */
var generated_1 = require("./generated");
Object.defineProperty(exports, "AuthorizationErrors", { enumerable: true, get: function () { return generated_1.AuthorizationErrors; } });
Object.defineProperty(exports, "ClientErrors", { enumerable: true, get: function () { return generated_1.ClientErrors; } });
Object.defineProperty(exports, "GeneralErrors", { enumerable: true, get: function () { return generated_1.GeneralErrors; } });
Object.defineProperty(exports, "MediaErrors", { enumerable: true, get: function () { return generated_1.MediaErrors; } });
Object.defineProperty(exports, "SignalingErrors", { enumerable: true, get: function () { return generated_1.SignalingErrors; } });
Object.defineProperty(exports, "TwilioError", { enumerable: true, get: function () { return generated_1.TwilioError; } });
Object.defineProperty(exports, "UserMediaErrors", { enumerable: true, get: function () { return generated_1.UserMediaErrors; } });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL2Vycm9ycy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7O0FBQUE7OztHQUdHO0FBQ0gseUNBQXlDO0FBQ3pDLHlDQVNxQjtBQXdDbkIsb0dBaERBLCtCQUFtQixPQWdEQTtBQUNuQiw2RkFoREEsd0JBQVksT0FnREE7QUFDWiw4RkEvQ0EseUJBQWEsT0ErQ0E7QUFDYiw0RkEvQ0EsdUJBQVcsT0ErQ0E7QUFDWCxnR0EvQ0EsMkJBQWUsT0ErQ0E7QUFDZiw0RkEvQ0EsdUJBQVcsT0ErQ0E7QUFDWCxnR0EvQ0EsMkJBQWUsT0ErQ0E7QUE1Q2pCLDJEQUEyRDtBQUMzRDtJQUEwQyx3Q0FBSztJQUM3Qyw4QkFBWSxPQUFnQjtRQUE1QixZQUNFLGtCQUFNLE9BQU8sQ0FBQyxTQUVmO1FBREMsS0FBSSxDQUFDLElBQUksR0FBRyxzQkFBc0IsQ0FBQzs7SUFDckMsQ0FBQztJQUNILDJCQUFDO0FBQUQsQ0FBQyxBQUxELENBQTBDLEtBQUssR0FLOUM7QUFMWSxvREFBb0I7QUFNakM7SUFBdUMscUNBQUs7SUFDMUMsMkJBQVksT0FBZ0I7UUFBNUIsWUFDRSxrQkFBTSxPQUFPLENBQUMsU0FFZjtRQURDLEtBQUksQ0FBQyxJQUFJLEdBQUcsbUJBQW1CLENBQUM7O0lBQ2xDLENBQUM7SUFDSCx3QkFBQztBQUFELENBQUMsQUFMRCxDQUF1QyxLQUFLLEdBSzNDO0FBTFksOENBQWlCO0FBTTlCO0lBQXVDLHFDQUFLO0lBQzFDLDJCQUFZLE9BQWdCO1FBQTVCLFlBQ0Usa0JBQU0sT0FBTyxDQUFDLFNBRWY7UUFEQyxLQUFJLENBQUMsSUFBSSxHQUFHLG1CQUFtQixDQUFDOztJQUNsQyxDQUFDO0lBQ0gsd0JBQUM7QUFBRCxDQUFDLEFBTEQsQ0FBdUMsS0FBSyxHQUszQztBQUxZLDhDQUFpQjtBQU85Qix1RUFBdUU7QUFDdkUsc0NBQXNDO0FBQ3RDLFNBQWdCLGNBQWMsQ0FBQyxJQUFZO0lBQ3pDLElBQU0sS0FBSyxHQUFxQyx3QkFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUN2RSxJQUFJLENBQUMsS0FBSyxFQUFFO1FBQ1YsTUFBTSxJQUFJLG9CQUFvQixDQUFDLGdCQUFjLElBQUksZUFBWSxDQUFDLENBQUM7S0FDaEU7SUFDRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFORCx3Q0FNQztBQUVELHVFQUF1RTtBQUN2RSxzQ0FBc0M7QUFDdEMsU0FBZ0IsY0FBYyxDQUFDLElBQVk7SUFDekMsT0FBTyx3QkFBWSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsQ0FBQztBQUNoQyxDQUFDO0FBRkQsd0NBRUMifQ==