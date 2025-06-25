// @ts-nocheck
import { EventEmitter } from 'events';
function EventTarget() {
    Object.defineProperties(this, {
        _eventEmitter: { value: new EventEmitter() },
        _handlers: { value: {} },
    });
}
EventTarget.prototype.dispatchEvent = function dispatchEvent(event) {
    return this._eventEmitter.emit(event.type, event);
};
EventTarget.prototype.addEventListener = function addEventListener() {
    return this._eventEmitter.addListener(...arguments);
};
EventTarget.prototype.removeEventListener = function removeEventListener() {
    return this._eventEmitter.removeListener(...arguments);
};
EventTarget.prototype._defineEventHandler = function _defineEventHandler(eventName) {
    const self = this;
    Object.defineProperty(this, `on${eventName}`, {
        get() {
            return self._handlers[eventName];
        },
        set(newHandler) {
            const oldHandler = self._handlers[eventName];
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
export default EventTarget;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnR0YXJnZXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3NoaW1zL2V2ZW50dGFyZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGNBQWM7QUFFZCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBRXRDLFNBQVMsV0FBVztJQUNsQixNQUFNLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFO1FBQzVCLGFBQWEsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJLFlBQVksRUFBRSxFQUFFO1FBQzVDLFNBQVMsRUFBRSxFQUFFLEtBQUssRUFBRSxFQUFHLEVBQUU7S0FDMUIsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELFdBQVcsQ0FBQyxTQUFTLENBQUMsYUFBYSxHQUFHLFNBQVMsYUFBYSxDQUFDLEtBQUs7SUFDaEUsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxFQUFFLEtBQUssQ0FBQyxDQUFDO0FBQ3BELENBQUMsQ0FBQztBQUVGLFdBQVcsQ0FBQyxTQUFTLENBQUMsZ0JBQWdCLEdBQUcsU0FBUyxnQkFBZ0I7SUFDaEUsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDO0FBQ3RELENBQUMsQ0FBQztBQUVGLFdBQVcsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLEdBQUcsU0FBUyxtQkFBbUI7SUFDdEUsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLGNBQWMsQ0FBQyxHQUFHLFNBQVMsQ0FBQyxDQUFDO0FBQ3pELENBQUMsQ0FBQztBQUVGLFdBQVcsQ0FBQyxTQUFTLENBQUMsbUJBQW1CLEdBQUcsU0FBUyxtQkFBbUIsQ0FBQyxTQUFTO0lBQ2hGLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQztJQUNsQixNQUFNLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxLQUFLLFNBQVMsRUFBRSxFQUFFO1FBQzVDLEdBQUc7WUFDRCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUM7UUFDbkMsQ0FBQztRQUNELEdBQUcsQ0FBQyxVQUFVO1lBQ1osTUFBTSxVQUFVLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsQ0FBQztZQUU3QyxJQUFJLFVBQVU7bUJBQ1QsQ0FBQyxPQUFPLFVBQVUsS0FBSyxVQUFVO3VCQUMvQixPQUFPLFVBQVUsS0FBSyxXQUFXO3VCQUNqQyxVQUFVLEtBQUssSUFBSSxDQUFDLEVBQUUsQ0FBQztnQkFDNUIsSUFBSSxDQUFDLFNBQVMsQ0FBQyxTQUFTLENBQUMsR0FBRyxJQUFJLENBQUM7Z0JBQ2pDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQyxTQUFTLEVBQUUsVUFBVSxDQUFDLENBQUM7WUFDbEQsQ0FBQztZQUVELElBQUksT0FBTyxVQUFVLEtBQUssVUFBVSxFQUFFLENBQUM7Z0JBQ3JDLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLEdBQUcsVUFBVSxDQUFDO2dCQUN2QyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsU0FBUyxFQUFFLFVBQVUsQ0FBQyxDQUFDO1lBQy9DLENBQUM7UUFDSCxDQUFDO0tBQ0YsQ0FBQyxDQUFDO0FBQ0wsQ0FBQyxDQUFDO0FBRUYsZUFBZSxXQUFXLENBQUMifQ==