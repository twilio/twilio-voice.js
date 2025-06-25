// @ts-nocheck
import { EventEmitter } from 'events';
export default class EventTarget {
    constructor() {
        this._eventEmitter = new EventEmitter();
    }
    addEventListener(name, handler) {
        return this._eventEmitter.addListener(name, handler);
    }
    dispatchEvent(name, ...args) {
        return this._eventEmitter.emit(name, ...args);
    }
    removeEventListener(name, handler) {
        return this._eventEmitter.removeListener(name, handler);
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnR0YXJnZXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL2F1ZGlvcGxheWVyL2V2ZW50dGFyZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGNBQWM7QUFDZCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBRXRDLE1BQU0sQ0FBQyxPQUFPLE9BQU8sV0FBVztJQUFoQztRQUNVLGtCQUFhLEdBQWlCLElBQUksWUFBWSxFQUFFLENBQUM7SUFhM0QsQ0FBQztJQVhDLGdCQUFnQixDQUFDLElBQVksRUFBRSxPQUFpQjtRQUM5QyxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztJQUN2RCxDQUFDO0lBRUQsYUFBYSxDQUFDLElBQVksRUFBRSxHQUFHLElBQVc7UUFDeEMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztJQUNoRCxDQUFDO0lBRUQsbUJBQW1CLENBQUMsSUFBWSxFQUFFLE9BQWlCO1FBQ2pELE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBQzFELENBQUM7Q0FDRiJ9