'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');

/**
 * Base class for all possible errors that the library can receive from the
 * Twilio backend.
 */
var TwilioError = /** @class */ (function (_super) {
    tslib.__extends(TwilioError, _super);
    /**
     * @internal
     */
    function TwilioError(messageOrError, error) {
        var _this = _super.call(this) || this;
        Object.setPrototypeOf(_this, TwilioError.prototype);
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
    return TwilioError;
}(Error));

exports.default = TwilioError;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHdpbGlvRXJyb3IuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vZXJyb3JzL3R3aWxpb0Vycm9yLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIl9fZXh0ZW5kcyJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7OztBQUdHO0FBQ0gsSUFBQSxXQUFBLGtCQUFBLFVBQUEsTUFBQSxFQUFBO0lBQXlDQSxlQUFBLENBQUEsV0FBQSxFQUFBLE1BQUEsQ0FBQTtBQXlDdkM7O0FBRUc7SUFDSCxTQUFBLFdBQUEsQ0FBWSxjQUF3QyxFQUFFLEtBQXNCLEVBQUE7UUFDMUUsSUFBQSxLQUFBLEdBQUEsTUFBSyxXQUFFLElBQUEsSUFBQTtRQUNQLE1BQU0sQ0FBQyxjQUFjLENBQUMsS0FBSSxFQUFFLFdBQVcsQ0FBQyxTQUFTLENBQUM7QUFFbEQsUUFBQSxJQUFNLE9BQU8sR0FBVyxPQUFPLGNBQWMsS0FBSztBQUNoRCxjQUFFO0FBQ0YsY0FBRSxLQUFJLENBQUMsV0FBVztBQUVwQixRQUFBLElBQU0sYUFBYSxHQUErQixPQUFPLGNBQWMsS0FBSztBQUMxRSxjQUFFO2NBQ0EsS0FBSztBQUVULFFBQUEsS0FBSSxDQUFDLE9BQU8sR0FBRyxFQUFBLENBQUEsTUFBQSxDQUFHLEtBQUksQ0FBQyxJQUFJLEVBQUEsSUFBQSxDQUFBLENBQUEsTUFBQSxDQUFLLEtBQUksQ0FBQyxJQUFJLEVBQUEsS0FBQSxDQUFBLENBQUEsTUFBQSxDQUFNLE9BQU8sQ0FBRTtBQUN4RCxRQUFBLEtBQUksQ0FBQyxhQUFhLEdBQUcsYUFBYTs7SUFDcEM7SUFDRixPQUFBLFdBQUM7QUFBRCxDQTNEQSxDQUF5QyxLQUFLLENBQUE7Ozs7In0=
