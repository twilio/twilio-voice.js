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
/**
 * @packageDocumentation
 * @module Voice
 * @publicapi
 * @internal
 */
var TwilioError = /** @class */ (function (_super) {
    __extends(TwilioError, _super);
    function TwilioError(messageOrError, error) {
        var _this = _super.call(this) || this;
        Object.setPrototypeOf(_this, TwilioError.prototype);
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
    return TwilioError;
}(Error));
exports.default = TwilioError;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHdpbGlvRXJyb3IuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL2Vycm9ycy90d2lsaW9FcnJvci50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFBQTs7Ozs7R0FLRztBQUNIO0lBQXlDLCtCQUFLO0lBeUM1QyxxQkFBWSxjQUF3QyxFQUFFLEtBQXNCO1FBQTVFLFlBQ0UsaUJBQU8sU0FhUjtRQVpDLE1BQU0sQ0FBQyxjQUFjLENBQUMsS0FBSSxFQUFFLFdBQVcsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUVuRCxJQUFNLE9BQU8sR0FBVyxPQUFPLGNBQWMsS0FBSyxRQUFRO1lBQ3hELENBQUMsQ0FBQyxjQUFjO1lBQ2hCLENBQUMsQ0FBQyxLQUFJLENBQUMsV0FBVyxDQUFDO1FBRXJCLElBQU0sYUFBYSxHQUErQixPQUFPLGNBQWMsS0FBSyxRQUFRO1lBQ2xGLENBQUMsQ0FBQyxjQUFjO1lBQ2hCLENBQUMsQ0FBQyxLQUFLLENBQUM7UUFFVixLQUFJLENBQUMsT0FBTyxHQUFNLEtBQUksQ0FBQyxJQUFJLFVBQUssS0FBSSxDQUFDLElBQUksV0FBTSxPQUFTLENBQUM7UUFDekQsS0FBSSxDQUFDLGFBQWEsR0FBRyxhQUFhLENBQUM7O0lBQ3JDLENBQUM7SUFDSCxrQkFBQztBQUFELENBQUMsQUF4REQsQ0FBeUMsS0FBSyxHQXdEN0MifQ==