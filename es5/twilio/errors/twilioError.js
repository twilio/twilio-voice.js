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
//# sourceMappingURL=twilioError.js.map