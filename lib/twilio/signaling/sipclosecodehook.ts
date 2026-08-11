import Log from '../log';

/**
 * Holds the close code of the most recent WebSocket close event, or
 * undefined if no close has been observed (or the hook failed to install).
 */
export interface CloseCodeRecorder {
  lastCloseCode?: number;
}

/**
 * SIP.js's Transport does not expose the WebSocket close code. Its close
 * handler folds the code into a human-readable Error message
 * (`WebSocket closed <server> (code: 1006)`) and hands only that Error to
 * `UserAgentDelegate.onDisconnect`. Parsing that string would couple us to a
 * log format with no API guarantee.
 *
 * Instead we wrap the transport's close handler. SIP.js registers its
 * listener as `ws.addEventListener('close', (ev) => this.onWebSocketClose(ev, ws))`,
 * so the dispatch goes through `this` and an own property on the instance
 * takes precedence over the prototype method. Ours therefore runs BEFORE the
 * base implementation, which is what lets us record the code before
 * `onDisconnect` fires.
 *
 * Two alternatives do not work:
 *  - Adding a second listener via the public `ws` getter: SIP.js registers
 *    its own listener when the socket is created, so ours would run after
 *    `onDisconnect` had already been dispatched.
 *  - Subclassing Transport: this SDK builds to ES5, and the emitted
 *    `__extends` helper cannot `super.call()` SIP.js's native ES6 class.
 *
 * SIP.js creates its Transport once in the UserAgent constructor and reuses
 * it across `reconnect()`, so a single install covers the whole lifetime.
 *
 * @param transport - the SIP.js Transport instance to wrap.
 * @param log - logger used to report a failed install.
 * @returns a recorder whose `lastCloseCode` is updated on every close.
 */
export function installCloseCodeHook(transport: any, log: Log): CloseCodeRecorder {
  const recorder: CloseCodeRecorder = {};

  const baseOnWebSocketClose = transport?.onWebSocketClose;

  // Degrade rather than throw. A missing method means SIP.js renamed or
  // removed it in an upgrade; losing close codes costs a diagnostic, whereas
  // throwing here would break calling entirely. The unit test asserting the
  // method still exists is what catches this at build time.
  if (typeof baseOnWebSocketClose !== 'function') {
    log.error(
      'Could not install WebSocket close-code hook: transport.onWebSocketClose ' +
      'is not a function. Close codes will be unavailable.',
    );
    return recorder;
  }

  transport.onWebSocketClose = (event: CloseEvent, ws: WebSocket): void => {
    recorder.lastCloseCode = event?.code;
    baseOnWebSocketClose.call(transport, event, ws);
  };

  return recorder;
}
