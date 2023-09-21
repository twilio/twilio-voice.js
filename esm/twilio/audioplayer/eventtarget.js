/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnR0YXJnZXQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL2F1ZGlvcGxheWVyL2V2ZW50dGFyZ2V0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7O0dBSUc7QUFDSCxjQUFjO0FBQ2QsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLFFBQVEsQ0FBQztBQUV0QyxNQUFNLENBQUMsT0FBTyxPQUFPLFdBQVc7SUFBaEM7UUFDVSxrQkFBYSxHQUFpQixJQUFJLFlBQVksRUFBRSxDQUFDO0lBYTNELENBQUM7SUFYQyxnQkFBZ0IsQ0FBQyxJQUFZLEVBQUUsT0FBaUI7UUFDOUMsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDdkQsQ0FBQztJQUVELGFBQWEsQ0FBQyxJQUFZLEVBQUUsR0FBRyxJQUFXO1FBQ3hDLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7SUFDaEQsQ0FBQztJQUVELG1CQUFtQixDQUFDLElBQVksRUFBRSxPQUFpQjtRQUNqRCxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztJQUMxRCxDQUFDO0NBQ0YifQ==