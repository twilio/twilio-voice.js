import { EventEmitter } from 'events';
export default class EventTarget {
    private _eventEmitter;
    addEventListener(name: string, handler: Function): EventEmitter;
    dispatchEvent(name: string, ...args: any[]): boolean;
    removeEventListener(name: string, handler: Function): EventEmitter;
}
