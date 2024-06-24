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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid3N0cmFuc3BvcnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL3dzdHJhbnNwb3J0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7O0dBSUc7QUFFSCxPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBQ3RDLE9BQU8sT0FBTyxNQUFNLFdBQVcsQ0FBQztBQUNoQyxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sVUFBVSxDQUFDO0FBQzNDLE9BQU8sR0FBRyxNQUFNLE9BQU8sQ0FBQztBQUV4QixNQUFNLFNBQVMsR0FBRyxVQUFVLENBQUMsU0FBUyxDQUFDO0FBRXZDLE1BQU0sdUJBQXVCLEdBQUcsS0FBSyxDQUFDO0FBQ3RDLE1BQU0sZUFBZSxHQUFHLElBQUksQ0FBQztBQUM3QixNQUFNLGlCQUFpQixHQUFHLEtBQUssQ0FBQztBQUNoQyxNQUFNLHNCQUFzQixHQUFHLEtBQUssQ0FBQztBQUNyQyxNQUFNLG9CQUFvQixHQUFHLFFBQVEsQ0FBQztBQUN0QyxNQUFNLG1CQUFtQixHQUFHLElBQUksQ0FBQztBQUNqQyxNQUFNLGlCQUFpQixHQUFHLEtBQUssQ0FBQztBQVFoQzs7R0FFRztBQUNILE1BQU0sQ0FBTixJQUFZLGdCQWVYO0FBZkQsV0FBWSxnQkFBZ0I7SUFDMUI7O09BRUc7SUFDSCw2Q0FBeUIsQ0FBQTtJQUV6Qjs7T0FFRztJQUNILHFDQUFpQixDQUFBO0lBRWpCOztPQUVHO0lBQ0gsaUNBQWEsQ0FBQTtBQUNmLENBQUMsRUFmVyxnQkFBZ0IsS0FBaEIsZ0JBQWdCLFFBZTNCO0FBMENEOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE9BQU8sT0FBTyxXQUFZLFNBQVEsWUFBWTtJQXdHbkQ7Ozs7T0FJRztJQUNILFlBQVksSUFBYyxFQUFFLFVBQTBDLEVBQUc7UUFDdkUsS0FBSyxFQUFFLENBQUM7UUFwR1Y7O1dBRUc7UUFDSCxVQUFLLEdBQXFCLGdCQUFnQixDQUFDLE1BQU0sQ0FBQztR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