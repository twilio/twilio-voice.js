"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
var Deferred = /** @class */ (function () {
    function Deferred() {
        var _this = this;
        this.promise = new Promise(function (resolve, reject) {
            _this._resolve = resolve;
            _this._reject = reject;
        });
    }
    Object.defineProperty(Deferred.prototype, "reject", {
        get: function () { return this._reject; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Deferred.prototype, "resolve", {
        get: function () { return this._resolve; },
        enumerable: false,
        configurable: true
    });
    return Deferred;
}());
exports.default = Deferred;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmZXJyZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL2F1ZGlvcGxheWVyL2RlZmVycmVkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7R0FJRztBQUNILGNBQWM7QUFDZDtJQVNFO1FBQUEsaUJBS0M7UUFKQyxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUksT0FBTyxDQUFDLFVBQUMsT0FBTyxFQUFFLE1BQU07WUFDekMsS0FBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUM7WUFDeEIsS0FBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7UUFDeEIsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBVkQsc0JBQUksNEJBQU07YUFBVixjQUFlLE9BQU8sSUFBSSxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUM7OztPQUFBO0lBR3JDLHNCQUFJLDZCQUFPO2FBQVgsY0FBZ0IsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQzs7O09BQUE7SUFRekMsZUFBQztBQUFELENBQUMsQUFmRCxJQWVDIn0=