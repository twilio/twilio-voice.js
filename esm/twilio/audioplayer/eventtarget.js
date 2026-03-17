import { EventEmitter } from 'events';

// @ts-nocheck
class EventTarget {
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

export { EventTarget as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZXZlbnR0YXJnZXQuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vYXVkaW9wbGF5ZXIvZXZlbnR0YXJnZXQudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUdjLE1BQU8sV0FBVyxDQUFBO0FBQWhDLElBQUEsV0FBQSxHQUFBO0FBQ1UsUUFBQSxJQUFBLENBQUEsYUFBYSxHQUFpQixJQUFJLFlBQVksRUFBRTtJQWExRDtJQVhFLGdCQUFnQixDQUFDLElBQVksRUFBRSxPQUFpQixFQUFBO1FBQzlDLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQztJQUN0RDtBQUVBLElBQUEsYUFBYSxDQUFDLElBQVksRUFBRSxHQUFHLElBQVcsRUFBQTtRQUN4QyxPQUFPLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQztJQUMvQztJQUVBLG1CQUFtQixDQUFDLElBQVksRUFBRSxPQUFpQixFQUFBO1FBQ2pELE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFLE9BQU8sQ0FBQztJQUN6RDtBQUNEOzs7OyJ9
