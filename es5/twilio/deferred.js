"use strict";
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
Object.defineProperty(exports, "__esModule", { value: true });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmZXJyZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2RlZmVycmVkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHOztBQUVIOztHQUVHO0FBQ0g7SUFnQkU7O09BRUc7SUFDSDtRQUFBLGlCQUtDO1FBSkMsSUFBSSxDQUFDLFFBQVEsR0FBRyxJQUFJLE9BQU8sQ0FBTSxVQUFDLE9BQU8sRUFBRSxNQUFNO1lBQy9DLEtBQUksQ0FBQyxRQUFRLEdBQUcsT0FBTyxDQUFDO1lBQ3hCLEtBQUksQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDO1FBQ3hCLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUtELHNCQUFJLDZCQUFPO1FBSFg7O1dBRUc7YUFDSDtZQUNFLE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQztRQUN2QixDQUFDOzs7T0FBQTtJQUVEOztPQUVHO0lBQ0gseUJBQU0sR0FBTixVQUFPLE1BQVk7UUFDakIsSUFBSSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN2QixDQUFDO0lBRUQ7O09BRUc7SUFDSCwwQkFBTyxHQUFQLFVBQVEsS0FBVztRQUNqQixJQUFJLENBQUMsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3ZCLENBQUM7SUFDSCxlQUFDO0FBQUQsQ0FBQyxBQTlDRCxJQThDQyJ9