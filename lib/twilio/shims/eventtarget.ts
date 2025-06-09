// @ts-nocheck

import { EventEmitter } from 'events';

function EventTarget() {
  Object.defineProperties(this, {
    _eventEmitter: { value: new EventEmitter() },
    _handlers: { value: { } },
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
