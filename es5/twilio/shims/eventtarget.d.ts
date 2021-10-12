export = EventTarget;
declare function EventTarget(): void;
declare class EventTarget {
    dispatchEvent(event: any): any;
    addEventListener(...args: any[]): any;
    removeEventListener(...args: any[]): any;
    _defineEventHandler(eventName: any): void;
}
