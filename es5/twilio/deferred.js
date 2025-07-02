"use strict";
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmZXJyZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2RlZmVycmVkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7O0dBRUc7QUFDSDtJQWdCRTs7T0FFRztJQUNIO1FBQUEsaUJBS0M7UUFKQyxJQUFJLENBQUMsUUFBUSxHQUFHLElBQUksT0FBTyxDQUFNLFVBQUMsT0FBTyxFQUFFLE1BQU07WUFDL0MsS0FBSSxDQUFDLFFBQVEsR0FBRyxPQUFPLENBQUM7WUFDeEIsS0FBSSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUM7UUFDeEIsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBS0Qsc0JBQUksNkJBQU87UUFIWDs7V0FFRzthQUNIO1lBQ0UsT0FBTyxJQUFJLENBQUMsUUFBUSxDQUFDO1FBQ3ZCLENBQUM7OztPQUFBO0lBRUQ7O09BRUc7SUFDSCx5QkFBTSxHQUFOLFVBQU8sTUFBWTtRQUNqQixJQUFJLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDO0lBQ3ZCLENBQUM7SUFFRDs7T0FFRztJQUNILDBCQUFPLEdBQVAsVUFBUSxLQUFXO1FBQ2pCLElBQUksQ0FBQyxRQUFRLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDdkIsQ0FBQztJQUNILGVBQUM7QUFBRCxDQUFDLEFBOUNELElBOENDIn0=