"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
var events_1 = require("events");
var EventTarget = /** @class */ (function () {
    function EventTarget() {
        this._eventEmitter = new events_1.EventEmitter();
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
        return (_a = this._eventEmitter).emit.apply(_a, __spreadArray([name], args, false));
    };
    EventTarget.prototype.removeEventListener = function (name, handler) {
        return this._eventEmitter.removeListener(name, handler);
    };
    return EventTarget;
}());
exports.default = EventTarget;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnR0YXJnZXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL2F1ZGlvcGxheWVyL2V2ZW50dGFyZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7O0FBQUEsY0FBYztBQUNkLGlDQUFzQztBQUV0QztJQUFBO1FBQ1Usa0JBQWEsR0FBaUIsSUFBSSxxQkFBWSxFQUFFLENBQUM7SUFhM0QsQ0FBQztJQVhDLHNDQUFnQixHQUFoQixVQUFpQixJQUFZLEVBQUUsT0FBaUI7UUFDOUMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDdkQsQ0FBQztJQUVELG1DQUFhLEdBQWIsVUFBYyxJQUFZOztRQUFFLGNBQWM7YUFBZCxVQUFjLEVBQWQscUJBQWMsRUFBZCxJQUFjO1lBQWQsNkJBQWM7O1FBQ3hDLE9BQU8sQ0FBQSxLQUFBLElBQUksQ0FBQyxhQUFhLENBQUEsQ0FBQyxJQUFJLDBCQUFDLElBQUksR0FBSyxJQUFJLFVBQUU7SUFDaEQsQ0FBQztJQUVELHlDQUFtQixHQUFuQixVQUFvQixJQUFZLEVBQUUsT0FBaUI7UUFDakQsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDMUQsQ0FBQztJQUNILGtCQUFDO0FBQUQsQ0FBQyxBQWRELElBY0MifQ==