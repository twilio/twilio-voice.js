"use strict";
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
Object.defineProperty(exports, "__esModule", { value: true });
var events_1 = require("events");
function EventTarget() {
    Object.defineProperties(this, {
        _eventEmitter: { value: new events_1.EventEmitter() },
        _handlers: { value: {} },
    });
}
EventTarget.prototype.dispatchEvent = function dispatchEvent(event) {
    return this._eventEmitter.emit(event.type, event);
};
EventTarget.prototype.addEventListener = function addEventListener() {
    var _a;
    return (_a = this._eventEmitter).addListener.apply(_a, arguments);
};
EventTarget.prototype.removeEventListener = function removeEventListener() {
    var _a;
    return (_a = this._eventEmitter).removeListener.apply(_a, arguments);
};
EventTarget.prototype._defineEventHandler = function _defineEventHandler(eventName) {
    var self = this;
    Object.defineProperty(this, "on" + eventName, {
        get: function () {
            return self._handlers[eventName];
        },
        set: function (newHandler) {
            var oldHandler = self._handlers[eventName];
            if (oldHandler
                && (typeof newHandler === 'function'
                    || typeof newHandler === 'undefined'
                    || newHandler === null)) {
                self._handlers[eventName] = null;
                self.removeEventListener(eventName, oldHandler);
            }
            if (typeof newHandler === 'function') {
                self._handlers[eventName] = newHandler;
                self.addEventListener(eventName, newHandler);
            }
        },
    });
};
exports.default = EventTarget;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnR0YXJnZXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3NoaW1zL2V2ZW50dGFyZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHO0FBQ0gsY0FBYzs7QUFFZCxpQ0FBc0M7QUFFdEMsU0FBUyxXQUFXO0lBQ2xCLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUU7UUFDNUIsYUFBYSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUkscUJBQVksRUFBRSxFQUFFO1FBQzVDLFNBQVMsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFHLEVBQUU7S0FDMUIsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELFdBQVcsQ0FBQyxTQUFTLENBQUMsYUFBYSxHQUFHLFNBQVMsYUFBYSxDQUFDLEtBQUs7SUFDaEUsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3BELENBQUMsQ0FBQztBQUVGLFdBQVcsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLEdBQUcsU0FBUyxnQkFBZ0I7O0lBQ2hFLE9BQU8sQ0FBQSxLQUFBLElBQUksQ0FBQyxhQUFhLENBQUEsQ0FBQyxXQUFXLFdBQUksU0FBUyxFQUFFO0FBQ3RELENBQUMsQ0FBQztBQUVGLFdBQVcsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLEdBQUcsU0FBUyxtQkFBbUI7O0lBQ3RFLE9BQU8sQ0FBQSxLQUFBLElBQUksQ0FBQyxhQUFhLENBQUEsQ0FBQyxjQUFjLFdBQUksU0FBUyxFQUFFO0FBQ3pELENBQUMsQ0FBQztBQUVGLFdBQVcsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLEdBQUcsU0FBUyxtQkFBbUIsQ0FBQyxTQUFTO0lBQ2hGLElBQU0sSUFBSSxHQUFHLElBQUksQ0FBQztJQUNsQixNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxPQUFLLFNBQVcsRUFBRTtRQUM1QyxHQUFHO1lBQ0QsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ25DLENBQUM7UUFDRCxHQUFHLFlBQUMsVUFBVTtZQUNaLElBQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFN0MsSUFBSSxVQUFVO21CQUNULENBQUMsT0FBTyxVQUFVLEtBQUssVUFBVTt1QkFDL0IsT0FBTyxVQUFVLEtBQUssV0FBVzt1QkFDakMsVUFBVSxLQUFLLElBQUksQ0FBQyxFQUFFO2dCQUMzQixJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQztnQkFDakMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxVQUFVLENBQUMsQ0FBQzthQUNqRDtZQUVELElBQUksT0FBTyxVQUFVLEtBQUssVUFBVSxFQUFFO2dCQUNwQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxHQUFHLFVBQVUsQ0FBQztnQkFDdkMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxVQUFVLENBQUMsQ0FBQzthQUM5QztRQUNILENBQUM7S0FDRixDQUFDLENBQUM7QUFDTCxDQUFDLENBQUM7QUFFRixrQkFBZSxXQUFXLENBQUMifQ==