import { EventEmitter } from 'events';
import Backoff from './backoff.js';
import { SignalingErrors } from './errors/generated.js';
import Log from './log.js';

const WebSocket = globalThis.WebSocket;
const CONNECT_SUCCESS_TIMEOUT = 10000;
const CONNECT_TIMEOUT = 5000;
const HEARTBEAT_TIMEOUT = 15000;
const MAX_PREFERRED_DURATION = 15000;
const MAX_PRIMARY_DURATION = Infinity;
const MAX_RETRY_AFTER_DURATION = 75000;
const MAX_PREFERRED_DELAY = 1000;
const MAX_PRIMARY_DELAY = 20000;
const MAX_RETRY_AFTER_DELAY = 60000;
/**
 * All possible states of WSTransport.
 */
var WSTransportState;
(function (WSTransportState) {
    /**
     * The WebSocket is not open but is trying to connect.
     */
    WSTransportState["Connecting"] = "connecting";
    /**
     * The WebSocket is not open and is not trying to connect.
     */
    WSTransportState["Closed"] = "closed";
    /**
     * The underlying WebSocket is open and active.
     */
    WSTransportState["Open"] = "open";
})(WSTransportState || (WSTransportState = {}));
/**
 * WebSocket Transport
 */
class WSTransport extends EventEmitter {
    /**
     * @constructor
     * @param uris - List of URI of the endpoints to connect to.
     * @param [options] - Constructor options.
     */
    constructor(uris, options = {}) {
        super();
        /**
         * The current state of the WSTransport.
         */
        this.state = WSTransportState.Closed;
        /**
         * Start timestamp values for backoffs.
         */
        this._backoffStartTime = {
            preferred: null,
            primary: null,
        };
        /**
         * The URI that the transport is connecting or connected to. The value of this
         * property is `null` if a connection attempt has not been made yet.
         */
        this._connectedUri = null;
        /**
         * An instance of Logger to use.
         */
        this._log = new Log('WSTransport');
        /**
         * The retryAfter value from signaling error, in seconds.
         */
        this._retryAfter = null;
        /**
         * Whether we should attempt to fallback if we receive an applicable error
         * when trying to connect to a signaling endpoint.
         */
        this._shouldFallback = false;
        /**
         * The current uri index that the transport is connected to.
         */
        this._uriIndex = 0;
        /**
         * Move the uri index to the next index
         * If the index is at the end, the index goes back to the first one.
         */
        this._moveUriIndex = () => {
            this._uriIndex++;
            if (this._uriIndex >= this._uris.length) {
                this._uriIndex = 0;
            }
        };
        /**
         * Called in response to WebSocket#close event.
         */
        this._onSocketClose = (event) => {
            this._log.error(`Received websocket close event code: ${event.code}. Reason: ${event.reason}`);
            // 1006: Abnormal close. When the server is unreacheable
            // 1015: TLS Handshake error
            if (event.code === 1006 || event.code === 1015) {
                this.emit('error', {
                    code: 31005,
                    message: event.reason ||
                        'Websocket connection to Twilio\'s signaling servers were ' +
                            'unexpectedly ended. If this is happening consistently, there may ' +
                            'be an issue resolving the hostname provided. If a region or an ' +
                            'edge is being specified in Device setup, ensure it is valid.',
                    twilioError: new SignalingErrors.ConnectionError(),
                });
                const wasConnected = (
                // Only in Safari and certain Firefox versions, on network interruption, websocket drops right away with 1006
                // Let's check current state if it's open, meaning we should not fallback
                // because we're coming from a previously connected session
                this.state === WSTransportState.Open ||
                    // But on other browsers, websocket doesn't drop
                    // but our heartbeat catches it, setting the internal state to "Connecting".
                    // With this, we should check the previous state instead.
                    this._previousState === WSTransportState.Open);
                // Only fallback if this is not the first error
                // and if we were not connected previously
                if (this._shouldFallback || !wasConnected) {
                    this._moveUriIndex();
                }
                this._shouldFallback = true;
            }
            this._closeSocket();
        };
        /**
         * Called in response to WebSocket#error event.
         */
        this._onSocketError = (err) => {
            this._log.error(`WebSocket received error: ${err.message}`);
            this.emit('error', {
                code: 31000,
                message: err.message || 'WSTransport socket error',
                twilioError: new SignalingErrors.ConnectionDisconnected(),
            });
        };
        /**
         * Called in response to WebSocket#message event.
         */
        this._onSocketMessage = (message) => {
            // Clear heartbeat timeout on any incoming message, as they
            // all indicate an active connection.
            this._setHeartbeatTimeout();
            // Filter and respond to heartbeats
            if (this._socket && message.data === '\n') {
                this._socket.send('\n');
                this._log.debug('heartbeat');
                return;
            }
            if (message && typeof message.data === 'string') {
                this._log.debug(`Received: ${message.data}`);
                const { type, payload = {} } = JSON.parse(message.data);
                if (type === 'error' && payload.error && payload.error.retryAfter) {
                    this._retryAfter = payload.error.retryAfter * 1000; // convert to milliseconds
                }
            }
            this.emit('message', message);
        };
        /**
         * Called in response to WebSocket#open event.
         */
        this._onSocketOpen = () => {
            this._log.info('WebSocket opened successfully.');
            this._timeOpened = Date.now();
            this._shouldFallback = false;
            this._setState(WSTransportState.Open);
            clearTimeout(this._connectTimeout);
            if (this._backoff) {
                this._resetBackoffs();
            }
            this._setHeartbeatTimeout();
            this.emit('open');
        };
        this._options = Object.assign(Object.assign({}, WSTransport.defaultConstructorOptions), options);
        this._uris = uris;
        this._backoff = null;
    }
    /**
     * Close the WebSocket, and don't try to reconnect.
     */
    close() {
        this._log.info('WSTransport.close() called...');
        this._close();
    }
    /**
     * Attempt to open a WebSocket connection.
     */
    open() {
        this._log.info('WSTransport.open() called...');
        if (this._socket &&
            (this._socket.readyState === WebSocket.CONNECTING ||
                this._socket.readyState === WebSocket.OPEN)) {
            this._log.info('WebSocket already open.');
            return;
        }
        if (this._preferredUri) {
            this._connect(this._preferredUri);
        }
        else {
            this._connect(this._uris[this._uriIndex]);
        }
    }
    /**
     * Send a message through the WebSocket connection.
     * @param message - A message to send to the endpoint.
     * @returns Whether the message was sent.
     */
    send(message) {
        this._log.debug(`Sending: ${message}`);
        // We can't send the message if the WebSocket isn't open
        if (!this._socket || this._socket.readyState !== WebSocket.OPEN) {
            this._log.debug('Cannot send message. WebSocket is not open.');
            return false;
        }
        try {
            this._socket.send(message);
        }
        catch (e) {
            // Some unknown error occurred. Reset the socket to get a fresh session.
            this._log.error('Error while sending message:', e.message);
            this._closeSocket();
            return false;
        }
        return true;
    }
    /**
     * Update the preferred URI to connect to. Useful for Call signaling
     * reconnection, which requires connecting on the same edge. If `null` is
     * passed, the preferred URI is unset and the original `uris` array and
     * `uriIndex` is used to determine the signaling URI to connect to.
     * @param uri
     */
    updatePreferredURI(uri) {
        this._preferredUri = uri;
    }
    /**
     * Update acceptable URIs to reconnect to. Resets the URI index to 0.
     */
    updateURIs(uris) {
        if (typeof uris === 'string') {
            uris = [uris];
        }
        this._uris = uris;
        this._uriIndex = 0;
    }
    /**
     * Close the WebSocket, and don't try to reconnect.
     */
    _close() {
        this._setState(WSTransportState.Closed);
        this._closeSocket();
    }
    /**
     * Close the WebSocket and remove all event listeners.
     */
    _closeSocket() {
        clearTimeout(this._connectTimeout);
        clearTimeout(this._heartbeatTimeout);
        this._log.info('Closing and cleaning up WebSocket...');
        if (!this._socket) {
            this._log.info('No WebSocket to clean up.');
            return;
        }
        this._socket.removeEventListener('close', this._onSocketClose);
        this._socket.removeEventListener('error', this._onSocketError);
        this._socket.removeEventListener('message', this._onSocketMessage);
        this._socket.removeEventListener('open', this._onSocketOpen);
        if (this._socket.readyState === WebSocket.CONNECTING ||
            this._socket.readyState === WebSocket.OPEN) {
            this._socket.close();
        }
        // Reset backoff counter if connection was open for long enough to be considered successful
        if (this._backoff && this._timeOpened && ((Date.now() - this._timeOpened) > CONNECT_SUCCESS_TIMEOUT)) {
            this._resetBackoffs();
        }
        if (this.state !== WSTransportState.Closed) {
            if (!this._backoff) {
                this._backoff = this._setupBackoffs();
            }
            this._performBackoff();
        }
        delete this._socket;
        this.emit('close');
    }
    /**
     * Attempt to connect to the endpoint via WebSocket.
     * @param [uri] - URI string to connect to.
     * @param [retryCount] - Retry number, if this is a retry. Undefined if
     *   first attempt, 1+ if a retry.
     */
    _connect(uri, retryCount) {
        this._log.info(typeof retryCount === 'number'
            ? `Attempting to reconnect (retry #${retryCount})...`
            : 'Attempting to connect...');
        this._closeSocket();
        this._setState(WSTransportState.Connecting);
        this._connectedUri = uri;
        try {
            this._socket = new this._options.WebSocket(this._connectedUri);
        }
        catch (e) {
            this._log.error('Could not connect to endpoint:', e.message);
            this._close();
            this.emit('error', {
                code: 31000,
                message: e.message || `Could not connect to ${this._connectedUri}`,
                twilioError: new SignalingErrors.ConnectionDisconnected(),
            });
            return;
        }
        this._socket.addEventListener('close', this._onSocketClose);
        this._socket.addEventListener('error', this._onSocketError);
        this._socket.addEventListener('message', this._onSocketMessage);
        this._socket.addEventListener('open', this._onSocketOpen);
        delete this._timeOpened;
        this._connectTimeout = setTimeout(() => {
            this._log.info('WebSocket connection attempt timed out.');
            this._moveUriIndex();
            this._closeSocket();
        }, this._options.connectTimeoutMs);
    }
    /**
     * Perform a backoff. If a preferred URI is set (not null), then backoff
     * using the preferred mechanism. Otherwise, use the primary mechanism.
     */
    _performBackoff() {
        if (!this._backoff) {
            this._log.info('No backoff instance to perform backoff.');
            return;
        }
        if (this._preferredUri) {
            this._log.info('Preferred URI set; backing off.');
            this._backoff.preferred.backoff();
        }
        else {
            this._log.info('Preferred URI not set; backing off.');
            this._backoff.primary.backoff();
        }
    }
    /**
     * Reset both primary and preferred backoff mechanisms.
     */
    _resetBackoffs() {
        if (!this._backoff) {
            this._log.info('No backoff instance to reset.');
            return;
        }
        this._backoff.preferred.removeAllListeners('backoff');
        this._backoff.preferred.removeAllListeners('ready');
        this._backoff.primary.removeAllListeners('backoff');
        this._backoff.primary.removeAllListeners('ready');
        this._backoff = null;
        this._retryAfter = null;
        this._backoffStartTime.preferred = null;
        this._backoffStartTime.primary = null;
    }
    /**
     * Set a timeout to reconnect after HEARTBEAT_TIMEOUT milliseconds
     *   have passed without receiving a message over the WebSocket.
     */
    _setHeartbeatTimeout() {
        clearTimeout(this._heartbeatTimeout);
        this._heartbeatTimeout = setTimeout(() => {
            this._log.info(`No messages received in ${HEARTBEAT_TIMEOUT / 1000} seconds. Reconnecting...`);
            this._shouldFallback = true;
            this._closeSocket();
        }, HEARTBEAT_TIMEOUT);
    }
    /**
     * Set the current and previous state
     */
    _setState(state) {
        this._previousState = this.state;
        this.state = state;
    }
    /**
     * Set up the primary and preferred backoff mechanisms.
     */
    _setupBackoffs() {
        const preferredRetryAfter = this._retryAfter !== null && this._preferredUri ? this._retryAfter : null;
        if (preferredRetryAfter) {
            this._log.info(`Setting initial preferred backoff value to retryAfter: ${preferredRetryAfter}ms`);
        }
        const maxPreferredDurationMs = preferredRetryAfter
            ? this._options.maxRetryAfterDurationMs
            : this._options.maxPreferredDurationMs;
        const preferredBackoffConfig = {
            factor: 2.0,
            jitter: 0.40,
            max: preferredRetryAfter ? this._options.maxRetryAfterDelayMs : this._options.maxPreferredDelayMs,
            min: preferredRetryAfter || 100,
            useInitialValue: Boolean(preferredRetryAfter),
        };
        this._log.info('Initializing preferred transport backoff using config: ', preferredBackoffConfig);
        const preferredBackoff = new Backoff(preferredBackoffConfig);
        preferredBackoff.on('backoff', (attempt, delay) => {
            if (this.state === WSTransportState.Closed) {
                this._log.info('Preferred backoff initiated but transport state is closed; not attempting a connection.');
                return;
            }
            this._log.info(`Will attempt to reconnect Websocket to preferred URI in ${delay}ms`);
            if (attempt === 0) {
                this._backoffStartTime.preferred = Date.now();
                this._log.info(`Preferred backoff start; ${this._backoffStartTime.preferred}`);
            }
        });
        preferredBackoff.on('ready', (attempt, _delay) => {
            if (this.state === WSTransportState.Closed) {
                this._log.info('Preferred backoff ready but transport state is closed; not attempting a connection.');
                return;
            }
            if (this._backoffStartTime.preferred === null) {
                this._log.info('Preferred backoff start time invalid; not attempting a connection.');
                return;
            }
            if (!this._backoff) {
                this._log.info('Preferred backoff instance invalid; not attempting a connection.');
                return;
            }
            if (Date.now() - this._backoffStartTime.preferred > maxPreferredDurationMs) {
                this._log.info('Max preferred backoff attempt time exceeded; falling back to primary backoff.');
                this._preferredUri = null;
                this._backoff.primary.backoff();
                return;
            }
            if (typeof this._preferredUri !== 'string') {
                this._log.info('Preferred URI cleared; falling back to primary backoff.');
                this._preferredUri = null;
                this._backoff.primary.backoff();
                return;
            }
            this._connect(this._preferredUri, attempt + 1);
        });
        const primaryBackoffConfig = {
            factor: 2.0,
            jitter: 0.40,
            max: this._options.maxPrimaryDelayMs,
            // We only want a random initial delay if there are any fallback edges
            // Initial delay between 1s and 5s both inclusive
            min: this._uris && this._uris.length > 1
                ? Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000
                : 100,
        };
        this._log.info('Initializing primary transport backoff using config: ', primaryBackoffConfig);
        const primaryBackoff = new Backoff(primaryBackoffConfig);
        primaryBackoff.on('backoff', (attempt, delay) => {
            if (this.state === WSTransportState.Closed) {
                this._log.info('Primary backoff initiated but transport state is closed; not attempting a connection.');
                return;
            }
            this._log.info(`Will attempt to reconnect WebSocket in ${delay}ms`);
            if (attempt === 0) {
                this._backoffStartTime.primary = Date.now();
                this._log.info(`Primary backoff start; ${this._backoffStartTime.primary}`);
            }
        });
        primaryBackoff.on('ready', (attempt, _delay) => {
            if (this.state === WSTransportState.Closed) {
                this._log.info('Primary backoff ready but transport state is closed; not attempting a connection.');
                return;
            }
            if (this._backoffStartTime.primary === null) {
                this._log.info('Primary backoff start time invalid; not attempting a connection.');
                return;
            }
            if (Date.now() - this._backoffStartTime.primary > this._options.maxPrimaryDurationMs) {
                this._log.info('Max primary backoff attempt time exceeded; not attempting a connection.');
                return;
            }
            this._connect(this._uris[this._uriIndex], attempt + 1);
        });
        return {
            preferred: preferredBackoff,
            primary: primaryBackoff,
        };
    }
    /**
     * The uri the transport is currently connected to
     */
    get uri() {
        return this._connectedUri;
    }
}
WSTransport.defaultConstructorOptions = {
    WebSocket,
    connectTimeoutMs: CONNECT_TIMEOUT,
    maxPreferredDelayMs: MAX_PREFERRED_DELAY,
    maxPreferredDurationMs: MAX_PREFERRED_DURATION,
    maxPrimaryDelayMs: MAX_PRIMARY_DELAY,
    maxPrimaryDurationMs: MAX_PRIMARY_DURATION,
    maxRetryAfterDelayMs: MAX_RETRY_AFTER_DELAY,
    maxRetryAfterDurationMs: MAX_RETRY_AFTER_DURATION,
};

export { WSTransportState, WSTransport as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid3N0cmFuc3BvcnQuanMiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vd3N0cmFuc3BvcnQudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFLQSxNQUFNLFNBQVMsR0FBRyxVQUFVLENBQUMsU0FBUztBQUV0QyxNQUFNLHVCQUF1QixHQUFHLEtBQUs7QUFDckMsTUFBTSxlQUFlLEdBQUcsSUFBSTtBQUM1QixNQUFNLGlCQUFpQixHQUFHLEtBQUs7QUFDL0IsTUFBTSxzQkFBc0IsR0FBRyxLQUFLO0FBQ3BDLE1BQU0sb0JBQW9CLEdBQUcsUUFBUTtBQUNyQyxNQUFNLHdCQUF3QixHQUFHLEtBQUs7QUFDdEMsTUFBTSxtQkFBbUIsR0FBRyxJQUFJO0FBQ2hDLE1BQU0saUJBQWlCLEdBQUcsS0FBSztBQUMvQixNQUFNLHFCQUFxQixHQUFHLEtBQUs7QUFRbkM7O0FBRUc7SUFDUztBQUFaLENBQUEsVUFBWSxnQkFBZ0IsRUFBQTtBQUMxQjs7QUFFRztBQUNILElBQUEsZ0JBQUEsQ0FBQSxZQUFBLENBQUEsR0FBQSxZQUF5QjtBQUV6Qjs7QUFFRztBQUNILElBQUEsZ0JBQUEsQ0FBQSxRQUFBLENBQUEsR0FBQSxRQUFpQjtBQUVqQjs7QUFFRztBQUNILElBQUEsZ0JBQUEsQ0FBQSxNQUFBLENBQUEsR0FBQSxNQUFhO0FBQ2YsQ0FBQyxFQWZXLGdCQUFnQixLQUFoQixnQkFBZ0IsR0FBQSxFQUFBLENBQUEsQ0FBQTtBQW1FNUI7O0FBRUc7QUFDSCxNQUFxQixXQUFZLFNBQVEsWUFBWSxDQUFBO0FBK0duRDs7OztBQUlHO0lBQ0gsV0FBQSxDQUFZLElBQWMsRUFBRSxPQUFBLEdBQTBDLEVBQUcsRUFBQTtBQUN2RSxRQUFBLEtBQUssRUFBRTtBQXpHVDs7QUFFRztBQUNILFFBQUEsSUFBQSxDQUFBLEtBQUssR0FBcUIsZ0JBQWdCLENBQUMsTUFBTTtBQVVqRDs7QUFFRztBQUNLLFFBQUEsSUFBQSxDQUFBLGlC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
