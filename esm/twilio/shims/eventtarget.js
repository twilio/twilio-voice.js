/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnR0YXJnZXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3NoaW1zL2V2ZW50dGFyZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7O0dBSUc7QUFDSCxjQUFjO0FBRWQsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUV0QyxTQUFTLFdBQVc7SUFDbEIsTUFBTSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRTtRQUM1QixhQUFhLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxZQUFZLEVBQUUsRUFBRTtRQUM1QyxTQUFTLEVBQUUsRUFBRSxLQUFLLEVBQUUsRUFBRyxFQUFFO0tBQzFCLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxXQUFXLENBQUMsU0FBUyxDQUFDLGFBQWEsR0FBRyxTQUFTLGFBQWEsQ0FBQyxLQUFLO0lBQ2hFLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksRUFBRSxLQUFLLENBQUMsQ0FBQztBQUNwRCxDQUFDLENBQUM7QUFFRixXQUFXLENBQUMsU0FBUyxDQUFDLGdCQUFnQixHQUFHLFNBQVMsZ0JBQWdCO0lBQ2hFLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQztBQUN0RCxDQUFDLENBQUM7QUFFRixXQUFXLENBQUMsU0FBUyxDQUFDLG1CQUFtQixHQUFHLFNBQVMsbUJBQW1CO0lBQ3RFLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxjQUFjLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQztBQUN6RCxDQUFDLENBQUM7QUFFRixXQUFXLENBQUMsU0FBUyxDQUFDLG1CQUFtQixHQUFHLFNBQVMsbUJBQW1CLENBQUMsU0FBUztJQUNoRixNQUFNLElBQUksR0FBRyxJQUFJLENBQUM7SUFDbEIsTUFBTSxDQUFDLGNBQWMsQ0FBQyxJQUFJLEVBQUUsS0FBSyxTQUFTLEVBQUUsRUFBRTtRQUM1QyxHQUFHO1lBQ0QsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ25DLENBQUM7UUFDRCxHQUFHLENBQUMsVUFBVTtZQUNaLE1BQU0sVUFBVSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsU0FBUyxDQUFDLENBQUM7WUFFN0MsSUFBSSxVQUFVO21CQUNULENBQUMsT0FBTyxVQUFVLEtBQUssVUFBVTt1QkFDL0IsT0FBTyxVQUFVLEtBQUssV0FBVzt1QkFDakMsVUFBVSxLQUFLLElBQUksQ0FBQyxFQUFFO2dCQUMzQixJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxHQUFHLElBQUksQ0FBQztnQkFDakMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLFNBQVMsRUFBRSxVQUFVLENBQUMsQ0FBQzthQUNqRDtZQUVELElBQUksT0FBTyxVQUFVLEtBQUssVUFBVSxFQUFFO2dCQUNwQyxJQUFJLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxHQUFHLFVBQVUsQ0FBQztnQkFDdkMsSUFBSSxDQUFDLGdCQUFnQixDQUFDLFNBQVMsRUFBRSxVQUFVLENBQUMsQ0FBQzthQUM5QztRQUNILENBQUM7S0FDRixDQUFDLENBQUM7QUFDTCxDQUFDLENBQUM7QUFFRixlQUFlLFdBQVcsQ0FBQyJ9