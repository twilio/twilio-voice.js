/**
 * @packageDocumentation
 * @module Tools
 * @internalapi
 */
import { EventEmitter } from 'events';
import Backoff from './backoff';
import { SignalingErrors } from './errors';
import Log from './log';
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
export var WSTransportState;
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
export default class WSTransport extends EventEmitter {
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
        this._log = Log.getInstance();
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
            this._log.info(`Received websocket close event code: ${event.code}. Reason: ${event.reason}`);
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
            this._log.info(`WebSocket received error: ${err.message}`);
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
                return;
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
        // We can't send the message if the WebSocket isn't open
        if (!this._socket || this._socket.readyState !== WebSocket.OPEN) {
            return false;
        }
        try {
            this._socket.send(message);
        }
        catch (e) {
            // Some unknown error occurred. Reset the socket to get a fresh session.
            this._log.info('Error while sending message:', e.message);
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
            this._log.info('Could not connect to endpoint:', e.message);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid3N0cmFuc3BvcnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL3dzdHJhbnNwb3J0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7O0dBSUc7QUFFSCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQ3RDLE9BQU8sT0FBTyxNQUFNLFdBQVcsQ0FBQztBQUNoQyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQzNDLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQztBQUV4QixNQUFNLFNBQVMsR0FBRyxVQUFVLENBQUMsU0FBUyxDQUFDO0FBRXZDLE1BQU0sdUJBQXVCLEdBQUcsS0FBSyxDQUFDO0FBQ3RDLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQztBQUM3QixNQUFNLGlCQUFpQixHQUFHLEtBQUssQ0FBQztBQUNoQyxNQUFNLHNCQUFzQixHQUFHLEtBQUssQ0FBQztBQUNyQyxNQUFNLG9CQUFvQixHQUFHLFFBQVEsQ0FBQztBQUN0QyxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQztBQUNqQyxNQUFNLGlCQUFpQixHQUFHLEtBQUssQ0FBQztBQVFoQzs7R0FFRztBQUNILE1BQU0sQ0FBTixJQUFZLGdCQWVYO0FBZkQsV0FBWSxnQkFBZ0I7SUFDMUI7O09BRUc7SUFDSCw2Q0FBeUIsQ0FBQTtJQUV6Qjs7T0FFRztJQUNILHFDQUFpQixDQUFBO0lBRWpCOztPQUVHO0lBQ0gsaUNBQWEsQ0FBQTtBQUNmLENBQUMsRUFmVyxnQkFBZ0IsS0FBaEIsZ0JBQWdCLFFBZTNCO0FBMENEOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE9BQU8sT0FBTyxXQUFZLFNBQVEsWUFBWTtJQXdHbkQ7Ozs7T0FJRztJQUNILFlBQVksSUFBYyxFQUFFLFVBQTBDLEVBQUc7UUFDdkUsS0FBSyxFQUFFLENBQUM7UUFwR1Y7O1dBRUc7UUFDSCxVQUFLLEdBQXFCLGdCQUFnQixDQUFDLE1BQU0sQ0FBQztR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