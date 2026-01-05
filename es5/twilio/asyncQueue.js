'use strict';

var tslib = require('tslib');
var deferred = require('./deferred.js');

/**
 * Queue async operations and executes them synchronously.
 */
var AsyncQueue = /** @class */ (function () {
    function AsyncQueue() {
        /**
         * The list of async operations in this queue
         */
        this._operations = [];
    }
    /**
     * Adds the async operation to the queue
     * @param callback An async callback that returns a promise
     * @returns A promise that will get resolved or rejected after executing the callback
     */
    AsyncQueue.prototype.enqueue = function (callback) {
        var hasPending = !!this._operations.length;
        var deferred$1 = new deferred.default();
        this._operations.push({ deferred: deferred$1, callback: callback });
        if (!hasPending) {
            this._processQueue();
        }
        return deferred$1.promise;
    };
    /**
     * Start processing the queue. This executes the first item and removes it after.
     * Then do the same for next items until the queue is emptied.
     */
    AsyncQueue.prototype._processQueue = function () {
        return tslib.__awaiter(this, void 0, void 0, function () {
            var _a, deferred, callback, result, error, hasResolved, e_1;
            return tslib.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this._operations.length) return [3 /*break*/, 5];
                        _a = this._operations[0], deferred = _a.deferred, callback = _a.callback;
                        result = void 0;
                        error = void 0;
                        hasResolved = void 0;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, callback()];
                    case 2:
                        result = _b.sent();
                        hasResolved = true;
                        return [3 /*break*/, 4];
                    case 3:
                        e_1 = _b.sent();
                        error = e_1;
                        return [3 /*break*/, 4];
                    case 4:
                        // Remove the item
                        this._operations.shift();
                        if (hasResolved) {
                            deferred.resolve(result);
                        }
                        else {
                            deferred.reject(error);
                        }
                        return [3 /*break*/, 0];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return AsyncQueue;
}());

exports.AsyncQueue = AsyncQueue;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXN5bmNRdWV1ZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9hc3luY1F1ZXVlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbImRlZmVycmVkIiwiRGVmZXJyZWQiXSwibWFwcGluZ3MiOiI7Ozs7O0FBRUE7O0FBRUc7QUFDSCxJQUFBLFVBQUEsa0JBQUEsWUFBQTtBQUFBLElBQUEsU0FBQSxVQUFBLEdBQUE7QUFDRTs7QUFFRztRQUNLLElBQUEsQ0FBQSxXQUFXLEdBQTJCLEVBQUU7SUFtRGxEO0FBakRFOzs7O0FBSUc7SUFDSCxVQUFBLENBQUEsU0FBQSxDQUFBLE9BQU8sR0FBUCxVQUFRLFFBQTRCLEVBQUE7UUFDbEMsSUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTTtBQUM1QyxRQUFBLElBQU1BLFVBQVEsR0FBRyxJQUFJQyxnQkFBUSxFQUFFO0FBRS9CLFFBQUEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRSxRQUFRLEVBQUFELFVBQUEsRUFBRSxRQUFRLEVBQUEsUUFBQSxFQUFFLENBQUM7UUFFN0MsSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNmLElBQUksQ0FBQyxhQUFhLEVBQUU7UUFDdEI7UUFFQSxPQUFPQSxVQUFRLENBQUMsT0FBTztJQUN6QixDQUFDO0FBRUQ7OztBQUdHO0FBQ1csSUFBQSxVQUFBLENBQUEsU0FBQSxDQUFBLGFBQWEsR0FBM0IsWUFBQTs7Ozs7OzZCQUNTLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxFQUFBLE9BQUEsQ0FBQSxDQUFBLFlBQUEsQ0FBQSxDQUFBO0FBRXRCLHdCQUFBLEVBQUEsR0FBeUIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUMsRUFBMUMsUUFBUSxHQUFBLEVBQUEsQ0FBQSxRQUFBLEVBQUUsUUFBUSxHQUFBLEVBQUEsQ0FBQSxRQUFBO0FBR3RCLHdCQUFBLE1BQU0sU0FBQTtBQUNOLHdCQUFBLEtBQUssU0FBQTtBQUVMLHdCQUFBLFdBQVcsU0FBQTs7Ozt3QkFFSixPQUFBLENBQUEsQ0FBQSxZQUFNLFFBQVEsRUFBRSxDQUFBOzt3QkFBekIsTUFBTSxHQUFHLFNBQWdCO3dCQUN6QixXQUFXLEdBQUcsSUFBSTs7Ozt3QkFFbEIsS0FBSyxHQUFHLEdBQUM7Ozs7QUFJWCx3QkFBQSxJQUFJLENBQUMsV0FBVyxDQUFDLEtBQUssRUFBRTt3QkFFeEIsSUFBSSxXQUFXLEVBQUU7QUFDZiw0QkFBQSxRQUFRLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQzt3QkFDMUI7NkJBQU87QUFDTCw0QkFBQSxRQUFRLENBQUMsTUFBTSxDQUFDLEtBQUssQ0FBQzt3QkFDeEI7Ozs7OztBQUVILElBQUEsQ0FBQTtJQUNILE9BQUEsVUFBQztBQUFELENBQUMsRUF2REQ7Ozs7In0=
