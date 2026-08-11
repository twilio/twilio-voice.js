import Log from '../log';

/**
 * Close code of the most recent WebSocket close, or undefined if none has been
 * observed (or the hook failed to install). The reader clears it once consumed.
 */
export interface CloseCodeRecorder {
  lastCloseCode?: number;
}

/**
 * SIP.js only exposes the close code inside the Error message it hands to
 * `onDisconnect`, so capture it structurally instead of parsing that string.
 *
 * SIP.js dispatches through `this.onWebSocketClose(...)`, so an own property
 * shadows the prototype method and runs before it, which is what lets us
 * record the code before `onDisconnect` fires. A second `close` listener would
 * run too late, and subclassing fails under this SDK's ES5 build.
 *
 * The Transport is created once and reused across `reconnect()`, so one
 * install covers the whole lifetime.
 *
 * @param transport - the SIP.js Transport instance to wrap.
 * @param log - logger used to report a failed install.
 * @returns a recorder updated on every close of the active socket.
 */
export function installCloseCodeHook(transport: any, log: Log): CloseCodeRecorder {
  const recorder: CloseCodeRecorder = {};

  const baseOnWebSocketClose = transport?.onWebSocketClose;

  // A SIP.js rename should cost a diagnostic, not break calling. The unit test
  // asserting the method still exists is what catches the upgrade.
  if (typeof baseOnWebSocketClose !== 'function') {
    log.error(
      'Could not install WebSocket close-code hook: transport.onWebSocketClose ' +
      'is not a function. Close codes will be unavailable.',
    );
    return recorder;
  }

  transport.onWebSocketClose = (event: CloseEvent, ws: WebSocket): void => {
    // Mirror SIP.js's own `if (ws !== this._ws) { return; }`: a replaced socket
    // can still emit its close, and its code isn't the live connection's.
    if (ws === transport.ws) {
      recorder.lastCloseCode = event?.code;
    }
    baseOnWebSocketClose.call(transport, event, ws);
  };

  return recorder;
}
