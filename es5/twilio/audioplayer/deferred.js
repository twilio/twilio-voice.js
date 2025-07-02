"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGVmZXJyZWQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL2F1ZGlvcGxheWVyL2RlZmVycmVkLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsY0FBYztBQUNkO0lBU0U7UUFBQSxpQkFLQztRQUpDLElBQUksQ0FBQyxPQUFPLEdBQUcsSUFBSSxPQUFPLENBQUMsVUFBQyxPQUFPLEVBQUUsTUFBTTtZQUN6QyxLQUFJLENBQUMsUUFBUSxHQUFHLE9BQU8sQ0FBQztZQUN4QixLQUFJLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQztRQUN4QixDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFWRCxzQkFBSSw0QkFBTTthQUFWLGNBQWUsT0FBTyxJQUFJLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQzs7O09BQUE7SUFHckMsc0JBQUksNkJBQU87YUFBWCxjQUFnQixPQUFPLElBQUksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDOzs7T0FBQTtJQVF6QyxlQUFDO0FBQUQsQ0FBQyxBQWZELElBZUMifQ==