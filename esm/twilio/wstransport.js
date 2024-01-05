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