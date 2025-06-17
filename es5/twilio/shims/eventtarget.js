"use strict";
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
    Object.defineProperty(this, "on".concat(eventName), {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnR0YXJnZXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3NoaW1zL2V2ZW50dGFyZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxjQUFjOztBQUVkLGlDQUFzQztBQUV0QyxTQUFTLFdBQVc7SUFDbEIsTUFBTSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRTtRQUM1QixhQUFhLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxxQkFBWSxFQUFFLEVBQUU7UUFDNUMsU0FBUyxFQUFFLEVBQUUsS0FBSyxFQUFFLEVBQUcsRUFBRTtLQUMxQixDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsV0FBVyxDQUFDLFNBQVMsQ0FBQyxhQUFhLEdBQUcsU0FBUyxhQUFhLENBQUMsS0FBSztJQUNoRSxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEVBQUUsS0FBSyxDQUFDLENBQUM7QUFDcEQsQ0FBQyxDQUFDO0FBRUYsV0FBVyxDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsR0FBRyxTQUFTLGdCQUFnQjs7SUFDaEUsT0FBTyxDQUFBLEtBQUEsSUFBSSxDQUFDLGFBQWEsQ0FBQSxDQUFDLFdBQVcsV0FBSSxTQUFTLEVBQUU7QUFDdEQsQ0FBQyxDQUFDO0FBRUYsV0FBVyxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsR0FBRyxTQUFTLG1CQUFtQjs7SUFDdEUsT0FBTyxDQUFBLEtBQUEsSUFBSSxDQUFDLGFBQWEsQ0FBQSxDQUFDLGNBQWMsV0FBSSxTQUFTLEVBQUU7QUFDekQsQ0FBQyxDQUFDO0FBRUYsV0FBVyxDQUFDLFNBQVMsQ0FBQyxtQkFBbUIsR0FBRyxTQUFTLG1CQUFtQixDQUFDLFNBQVM7SUFDaEYsSUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDO0lBQ2xCLE1BQU0sQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLFlBQUssU0FBUyxDQUFFLEVBQUU7UUFDNUMsR0FBRztZQUNELE9BQU8sSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQztRQUNuQyxDQUFDO1FBQ0QsR0FBRyxZQUFDLFVBQVU7WUFDWixJQUFNLFVBQVUsR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1lBRTdDLElBQUksVUFBVTttQkFDVCxDQUFDLE9BQU8sVUFBVSxLQUFLLFVBQVU7dUJBQy9CLE9BQU8sVUFBVSxLQUFLLFdBQVc7dUJBQ2pDLFVBQVUsS0FBSyxJQUFJLENBQUMsRUFBRSxDQUFDO2dCQUM1QixJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQztnQkFDakMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxVQUFVLENBQUMsQ0FBQztZQUNsRCxDQUFDO1lBRUQsSUFBSSxPQUFPLFVBQVUsS0FBSyxVQUFVLEVBQUUsQ0FBQztnQkFDckMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsR0FBRyxVQUFVLENBQUM7Z0JBQ3ZDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFDL0MsQ0FBQztRQUNILENBQUM7S0FDRixDQUFDLENBQUM7QUFDTCxDQUFDLENBQUM7QUFFRixrQkFBZSxXQUFXLENBQUMifQ==