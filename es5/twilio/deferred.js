'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/**
 * Deferred Promise
 */
var Deferred = /** @class */ (function () {
    /**
     * @constructor
     */
    function Deferred() {
        var _this = this;
        this._promise = new Promise(function (resolve, reject) {
            _this._resolve = resolve;
            _this._reject = reject;
        });
    }
    Object.defineProperty(Deferred.prototype, "promise", {
        /**
         * @returns The {@link Deferred} Promise
         */
        get: function () {
            return this._promise;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Rejects this promise
     */
    Deferred.prototype.reject = function (reason) {
        this._reject(reason);
    };
    /**
     * Resolves this promise
     */
    Deferred.prototype.resolve = function (value) {
        this._resolve(value);
    };
    return Deferred;
}());

exports.default = Deferred;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmZXJyZWQuanMiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vZGVmZXJyZWQudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7OztBQUFBOztBQUVHO0FBQ0gsSUFBQSxRQUFBLGtCQUFBLFlBQUE7QUFnQkU7O0FBRUc7QUFDSCxJQUFBLFNBQUEsUUFBQSxHQUFBO1FBQUEsSUFBQSxLQUFBLEdBQUEsSUFBQTtRQUNFLElBQUksQ0FBQyxRQUFRLEdBQUcsSUFBSSxPQUFPLENBQU0sVUFBQyxPQUFPLEVBQUUsTUFBTSxFQUFBO0FBQy9DLFlBQUEsS0FBSSxDQUFDLFFBQVEsR0FBRyxPQUFPO0FBQ3ZCLFlBQUEsS0FBSSxDQUFDLE9BQU8sR0FBRyxNQUFNO0FBQ3ZCLFFBQUEsQ0FBQyxDQUFDO0lBQ0o7QUFLQSxJQUFBLE1BQUEsQ0FBQSxjQUFBLENBQUksUUFBQSxDQUFBLFNBQUEsRUFBQSxTQUFPLEVBQUE7QUFIWDs7QUFFRztBQUNILFFBQUEsR0FBQSxFQUFBLFlBQUE7WUFDRSxPQUFPLElBQUksQ0FBQyxRQUFRO1FBQ3RCLENBQUM7OztBQUFBLEtBQUEsQ0FBQTtBQUVEOztBQUVHO0lBQ0gsUUFBQSxDQUFBLFNBQUEsQ0FBQSxNQUFNLEdBQU4sVUFBTyxNQUFZLEVBQUE7QUFDakIsUUFBQSxJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztJQUN0QixDQUFDO0FBRUQ7O0FBRUc7SUFDSCxRQUFBLENBQUEsU0FBQSxDQUFBLE9BQU8sR0FBUCxVQUFRLEtBQVcsRUFBQTtBQUNqQixRQUFBLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDO0lBQ3RCLENBQUM7SUFDSCxPQUFBLFFBQUM7QUFBRCxDQUFDLEVBOUNEOzs7OyJ9
