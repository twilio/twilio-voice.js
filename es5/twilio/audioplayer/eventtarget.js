"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
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
        return (_a = this._eventEmitter).emit.apply(_a, __spreadArrays([name], args));
    };
    EventTarget.prototype.removeEventListener = function (name, handler) {
        return this._eventEmitter.removeListener(name, handler);
    };
    return EventTarget;
}());
exports.default = EventTarget;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnR0YXJnZXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL2F1ZGlvcGxheWVyL2V2ZW50dGFyZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBOzs7O0dBSUc7QUFDSCxjQUFjO0FBQ2QsaUNBQXNDO0FBRXRDO0lBQUE7UUFDVSxrQkFBYSxHQUFpQixJQUFJLHFCQUFZLEVBQUUsQ0FBQztJQWEzRCxDQUFDO0lBWEMsc0NBQWdCLEdBQWhCLFVBQWlCLElBQVksRUFBRSxPQUFpQjtRQUM5QyxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN2RCxDQUFDO0lBRUQsbUNBQWEsR0FBYixVQUFjLElBQVk7O1FBQUUsY0FBYzthQUFkLFVBQWMsRUFBZCxxQkFBYyxFQUFkLElBQWM7WUFBZCw2QkFBYzs7UUFDeEMsT0FBTyxDQUFBLEtBQUEsSUFBSSxDQUFDLGFBQWEsQ0FBQSxDQUFDLElBQUksMkJBQUMsSUFBSSxHQUFLLElBQUksR0FBRTtJQUNoRCxDQUFDO0lBRUQseUNBQW1CLEdBQW5CLFVBQW9CLElBQVksRUFBRSxPQUFpQjtRQUNqRCxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztJQUMxRCxDQUFDO0lBQ0gsa0JBQUM7QUFBRCxDQUFDLEFBZEQsSUFjQyJ9