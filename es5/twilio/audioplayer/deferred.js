'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmZXJyZWQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vYXVkaW9wbGF5ZXIvZGVmZXJyZWQudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7OztBQUFBO0FBQ0EsSUFBQSxRQUFBLGtCQUFBLFlBQUE7QUFTRSxJQUFBLFNBQUEsUUFBQSxHQUFBO1FBQUEsSUFBQSxLQUFBLEdBQUEsSUFBQTtRQUNFLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxPQUFPLENBQUMsVUFBQyxPQUFPLEVBQUUsTUFBTSxFQUFBO0FBQ3pDLFlBQUEsS0FBSSxDQUFDLFFBQVEsR0FBRyxPQUFPO0FBQ3ZCLFlBQUEsS0FBSSxDQUFDLE9BQU8sR0FBRyxNQUFNO0FBQ3ZCLFFBQUEsQ0FBQyxDQUFDO0lBQ0o7QUFWQSxJQUFBLE1BQUEsQ0FBQSxjQUFBLENBQUksUUFBQSxDQUFBLFNBQUEsRUFBQSxRQUFNLEVBQUE7QUFBVixRQUFBLEdBQUEsRUFBQSxZQUFBLEVBQWUsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzs7O0FBQUEsS0FBQSxDQUFBO0FBR3JDLElBQUEsTUFBQSxDQUFBLGNBQUEsQ0FBSSxRQUFBLENBQUEsU0FBQSxFQUFBLFNBQU8sRUFBQTtBQUFYLFFBQUEsR0FBQSxFQUFBLFlBQUEsRUFBZ0IsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUMsQ0FBQzs7O0FBQUEsS0FBQSxDQUFBO0lBUXpDLE9BQUEsUUFBQztBQUFELENBQUMsRUFmRDs7OzsifQ==
