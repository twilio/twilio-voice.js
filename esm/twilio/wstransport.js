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
const MAX_PREFERRED_DELAY = 1000;
const MAX_PRIMARY_DELAY = 20000;
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
            this._resetBackoffs();
            this._setHeartbeatTimeout();
            this.emit('open');
        };
        this._options = Object.assign(Object.assign({}, WSTransport.defaultConstructorOptions), options);
        this._uris = uris;
        this._backoff = this._setupBackoffs();
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
        if (this._timeOpened && Date.now() - this._timeOpened > CONNECT_SUCCESS_TIMEOUT) {
            this._resetBackoffs();
        }
        if (this.state !== WSTransportState.Closed) {
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
        this._backoff.preferred.reset();
        this._backoff.primary.reset();
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
        const preferredBackoffConfig = {
            factor: 2.0,
            jitter: 0.40,
            max: this._options.maxPreferredDelayMs,
            min: 100,
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
            if (Date.now() - this._backoffStartTime.preferred > this._options.maxPreferredDurationMs) {
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
};

export { WSTransportState, WSTransport as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid3N0cmFuc3BvcnQuanMiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vd3N0cmFuc3BvcnQudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFLQSxNQUFNLFNBQVMsR0FBRyxVQUFVLENBQUMsU0FBUztBQUV0QyxNQUFNLHVCQUF1QixHQUFHLEtBQUs7QUFDckMsTUFBTSxlQUFlLEdBQUcsSUFBSTtBQUM1QixNQUFNLGlCQUFpQixHQUFHLEtBQUs7QUFDL0IsTUFBTSxzQkFBc0IsR0FBRyxLQUFLO0FBQ3BDLE1BQU0sb0JBQW9CLEdBQUcsUUFBUTtBQUNyQyxNQUFNLG1CQUFtQixHQUFHLElBQUk7QUFDaEMsTUFBTSxpQkFBaUIsR0FBRyxLQUFLO0FBUS9COztBQUVHO0lBQ1M7QUFBWixDQUFBLFVBQVksZ0JBQWdCLEVBQUE7QUFDMUI7O0FBRUc7QUFDSCxJQUFBLGdCQUFBLENBQUEsWUFBQSxDQUFBLEdBQUEsWUFBeUI7QUFFekI7O0FBRUc7QUFDSCxJQUFBLGdCQUFBLENBQUEsUUFBQSxDQUFBLEdBQUEsUUFBaUI7QUFFakI7O0FBRUc7QUFDSCxJQUFBLGdCQUFBLENBQUEsTUFBQSxDQUFBLEdBQUEsTUFBYTtBQUNmLENBQUMsRUFmVyxnQkFBZ0IsS0FBaEIsZ0JBQWdCLEdBQUEsRUFBQSxDQUFBLENBQUE7QUF5RDVCOztBQUVHO0FBQ0gsTUFBcUIsV0FBWSxTQUFRLFlBQVksQ0FBQTtBQXdHbkQ7Ozs7QUFJRztJQUNILFdBQUEsQ0FBWSxJQUFjLEVBQUUsT0FBQSxHQUEwQyxFQUFHLEVBQUE7QUFDdkUsUUFBQSxLQUFLLEVBQUU7QUFwR1Q7O0FBRUc7QUFDSCxRQUFBLElBQUEsQ0FBQSxLQUFLLEdBQXFCLGdCQUFnQixDQUFDLE1BQU07QUFVakQ7O0FBRUc7QUFDSyxRQUFBLElBQUEsQ0FBQSxpQkFBaUIsR0FHckI7QUFDRixZQUFBLFNBQVMsRUFBRSxJQUFJO0FBQ2YsWUFBQSxPQUFPLEVBQUUs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
