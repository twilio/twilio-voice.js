// @ts-nocheck
import { EventEmitter } from 'events';

export default class EventTarget {
  private _eventEmitter: EventEmitter = new EventEmitter();

  addEventListener(name: string, handler: Function): EventEmitter {
    return this._eventEmitter.addListener(name, handler);
  }

  dispatchEvent(name: string, ...args: any[]): boolean {
    return this._eventEmitter.emit(name, ...args);
  }

  removeEventListener(name: string, handler: Function): EventEmitter {
    return this._eventEmitter.removeListener(name, handler);
  }
}
