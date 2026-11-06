'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var events = require('events');

var EventTarget = /** @class */ (function () {
    function EventTarget() {
        this._eventEmitter = new events.EventEmitter();
    }
    EventTarget.prototype.addEventListener = function (name, handler) {
        return this._eventEmitter.addListener(name, handler);
    };
    EventTarget.prototype.dispatchEvent = function (name) {
        var _a;
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        return (_a = this._eventEmitter).emit.apply(_a, tslib.__spreadArray([name], args, false));
    };
    EventTarget.prototype.removeEventListener = function (name, handler) {
        return this._eventEmitter.removeListener(name, handler);
    };
    return EventTarget;
}());

exports.default = EventTarget;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnR0YXJnZXQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vYXVkaW9wbGF5ZXIvZXZlbnR0YXJnZXQudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOlsiRXZlbnRFbWl0dGVyIiwiX19zcHJlYWRBcnJheSJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUdBLElBQUEsV0FBQSxrQkFBQSxZQUFBO0FBQUEsSUFBQSxTQUFBLFdBQUEsR0FBQTtBQUNVLFFBQUEsSUFBQSxDQUFBLGFBQWEsR0FBaUIsSUFBSUEsbUJBQVksRUFBRTtJQWExRDtBQVhFLElBQUEsV0FBQSxDQUFBLFNBQUEsQ0FBQSxnQkFBZ0IsR0FBaEIsVUFBaUIsSUFBWSxFQUFFLE9BQWlCLEVBQUE7UUFDOUMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDO0lBQ3RELENBQUM7SUFFRCxXQUFBLENBQUEsU0FBQSxDQUFBLGFBQWEsR0FBYixVQUFjLElBQVksRUFBQTs7UUFBRSxJQUFBLElBQUEsR0FBQSxFQUFBO2FBQUEsSUFBQSxFQUFBLEdBQUEsQ0FBYyxFQUFkLEVBQUEsR0FBQSxTQUFBLENBQUEsTUFBYyxFQUFkLEVBQUEsRUFBYyxFQUFBO1lBQWQsSUFBQSxDQUFBLEVBQUEsR0FBQSxDQUFBLENBQUEsR0FBQSxTQUFBLENBQUEsRUFBQSxDQUFBOztBQUMxQixRQUFBLE9BQU8sQ0FBQSxFQUFBLEdBQUEsSUFBSSxDQUFDLGFBQWEsRUFBQyxJQUFJLENBQUEsS0FBQSxDQUFBLEVBQUEsRUFBQUMsbUJBQUEsQ0FBQSxDQUFDLElBQUksQ0FBQSxFQUFLLElBQUksRUFBQSxLQUFBLENBQUEsQ0FBQTtJQUM5QyxDQUFDO0FBRUQsSUFBQSxXQUFBLENBQUEsU0FBQSxDQUFBLG1CQUFtQixHQUFuQixVQUFvQixJQUFZLEVBQUUsT0FBaUIsRUFBQTtRQUNqRCxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUM7SUFDekQsQ0FBQztJQUNILE9BQUEsV0FBQztBQUFELENBQUMsRUFkRDs7OzsifQ==
