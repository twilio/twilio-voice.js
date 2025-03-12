"use strict";
/**
 * @packageDocumentation
 * @module Tools
 * @internalapi
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.WSTransportState = void 0;
var events_1 = require("events");
var backoff_1 = require("./backoff");
var errors_1 = require("./errors");
var log_1 = require("./log");
var WebSocket = globalThis.WebSocket;
var CONNECT_SUCCESS_TIMEOUT = 10000;
var CONNECT_TIMEOUT = 5000;
var HEARTBEAT_TIMEOUT = 15000;
var MAX_PREFERRED_DURATION = 15000;
var MAX_PRIMARY_DURATION = Infinity;
var MAX_PREFERRED_DELAY = 1000;
var MAX_PRIMARY_DELAY = 20000;
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
})(WSTransportState = exports.WSTransportState || (exports.WSTransportState = {}));
/**
 * WebSocket Transport
 */
var WSTransport = /** @class */ (function (_super) {
    __extends(WSTransport, _super);
    /**
     * @constructor
     * @param uris - List of URI of the endpoints to connect to.
     * @param [options] - Constructor options.
     */
    function WSTransport(uris, options) {
        if (options === void 0) { options = {}; }
        var _this = _super.call(this) || this;
        /**
         * The current state of the WSTransport.
         */
        _this.state = WSTransportState.Closed;
        /**
         * Start timestamp values for backoffs.
         */
        _this._backoffStartTime = {
            preferred: null,
            primary: null,
        };
        /**
         * The URI that the transport is connecting or connected to. The value of this
         * property is `null` if a connection attempt has not been made yet.
         */
        _this._connectedUri = null;
        /**
         * An instance of Logger to use.
         */
        _this._log = new log_1.default('WSTransport');
        /**
         * Whether we should attempt to fallback if we receive an applicable error
         * when trying to connect to a signaling endpoint.
         */
        _this._shouldFallback = false;
        /**
         * The current uri index that the transport is connected to.
         */
        _this._uriIndex = 0;
        /**
         * Move the uri index to the next index
         * If the index is at the end, the index goes back to the first one.
         */
        _this._moveUriIndex = function () {
            _this._uriIndex++;
            if (_this._uriIndex >= _this._uris.length) {
                _this._uriIndex = 0;
            }
        };
        /**
         * Called in response to WebSocket#close event.
         */
        _this._onSocketClose = function (event) {
            _this._log.error("Received websocket close event code: " + event.code + ". Reason: " + event.reason);
            // 1006: Abnormal close. When the server is unreacheable
            // 1015: TLS Handshake error
            if (event.code === 1006 || event.code === 1015) {
                _this.emit('error', {
                    code: 31005,
                    message: event.reason ||
                        'Websocket connection to Twilio\'s signaling servers were ' +
                            'unexpectedly ended. If this is happening consistently, there may ' +
                            'be an issue resolving the hostname provided. If a region or an ' +
                            'edge is being specified in Device setup, ensure it is valid.',
                    twilioError: new errors_1.SignalingErrors.ConnectionError(),
                });
                var wasConnected = (
                // Only in Safari and certain Firefox versions, on network interruption, websocket drops right away with 1006
                // Let's check current state if it's open, meaning we should not fallback
                // because we're coming from a previously connected session
                _this.state === WSTransportState.Open ||
                    // But on other browsers, websocket doesn't drop
                    // but our heartbeat catches it, setting the internal state to "Connecting".
                    // With this, we should check the previous state instead.
                    _this._previousState === WSTransportState.Open);
                // Only fallback if this is not the first error
                // and if we were not connected previously
                if (_this._shouldFallback || !wasConnected) {
                    _this._moveUriIndex();
                }
                _this._shouldFallback = true;
            }
            _this._closeSocket();
        };
        /**
         * Called in response to WebSocket#error event.
         */
        _this._onSocketError = function (err) {
            _this._log.error("WebSocket received error: " + err.message);
            _this.emit('error', {
                code: 31000,
                message: err.message || 'WSTransport socket error',
                twilioError: new errors_1.SignalingErrors.ConnectionDisconnected(),
            });
        };
        /**
         * Called in response to WebSocket#message event.
         */
        _this._onSocketMessage = function (message) {
            // Clear heartbeat timeout on any incoming message, as they
            // all indicate an active connection.
            _this._setHeartbeatTimeout();
            // Filter and respond to heartbeats
            if (_this._socket && message.data === '\n') {
                _this._socket.send('\n');
                _this._log.debug('heartbeat');
                return;
            }
            if (message && typeof message.data === 'string') {
                _this._log.debug("Received: " + message.data);
            }
            _this.emit('message', message);
        };
        /**
         * Called in response to WebSocket#open event.
         */
        _this._onSocketOpen = function () {
            _this._log.info('WebSocket opened successfully.');
            _this._timeOpened = Date.now();
            _this._shouldFallback = false;
            _this._setState(WSTransportState.Open);
            clearTimeout(_this._connectTimeout);
            _this._resetBackoffs();
            _this._setHeartbeatTimeout();
            _this.emit('open');
        };
        _this._options = __assign(__assign({}, WSTransport.defaultConstructorOptions), options);
        _this._uris = uris;
        _this._backoff = _this._setupBackoffs();
        return _this;
    }
    /**
     * Close the WebSocket, and don't try to reconnect.
     */
    WSTransport.prototype.close = function () {
        this._log.info('WSTransport.close() called...');
        this._close();
    };
    /**
     * Attempt to open a WebSocket connection.
     */
    WSTransport.prototype.open = function () {
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
    };
    /**
     * Send a message through the WebSocket connection.
     * @param message - A message to send to the endpoint.
     * @returns Whether the message was sent.
     */
    WSTransport.prototype.send = function (message) {
        this._log.debug("Sending: " + message);
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
    };
    /**
     * Update the preferred URI to connect to. Useful for Call signaling
     * reconnection, which requires connecting on the same edge. If `null` is
     * passed, the preferred URI is unset and the original `uris` array and
     * `uriIndex` is used to determine the signaling URI to connect to.
     * @param uri
     */
    WSTransport.prototype.updatePreferredURI = function (uri) {
        this._preferredUri = uri;
    };
    /**
     * Update acceptable URIs to reconnect to. Resets the URI index to 0.
     */
    WSTransport.prototype.updateURIs = function (uris) {
        if (typeof uris === 'string') {
            uris = [uris];
        }
        this._uris = uris;
        this._uriIndex = 0;
    };
    /**
     * Close the WebSocket, and don't try to reconnect.
     */
    WSTransport.prototype._close = function () {
        this._setState(WSTransportState.Closed);
        this._closeSocket();
    };
    /**
     * Close the WebSocket and remove all event listeners.
     */
    WSTransport.prototype._closeSocket = function () {
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
    };
    /**
     * Attempt to connect to the endpoint via WebSocket.
     * @param [uri] - URI string to connect to.
     * @param [retryCount] - Retry number, if this is a retry. Undefined if
     *   first attempt, 1+ if a retry.
     */
    WSTransport.prototype._connect = function (uri, retryCount) {
        var _this = this;
        this._log.info(typeof retryCount === 'number'
            ? "Attempting to reconnect (retry #" + retryCount + ")..."
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
                message: e.message || "Could not connect to " + this._connectedUri,
                twilioError: new errors_1.SignalingErrors.ConnectionDisconnected(),
            });
            return;
        }
        this._socket.addEventListener('close', this._onSocketClose);
        this._socket.addEventListener('error', this._onSocketError);
        this._socket.addEventListener('message', this._onSocketMessage);
        this._socket.addEventListener('open', this._onSocketOpen);
        delete this._timeOpened;
        this._connectTimeout = setTimeout(function () {
            _this._log.info('WebSocket connection attempt timed out.');
            _this._moveUriIndex();
            _this._closeSocket();
        }, this._options.connectTimeoutMs);
    };
    /**
     * Perform a backoff. If a preferred URI is set (not null), then backoff
     * using the preferred mechanism. Otherwise, use the primary mechanism.
     */
    WSTransport.prototype._performBackoff = function () {
        if (this._preferredUri) {
            this._log.info('Preferred URI set; backing off.');
            this._backoff.preferred.backoff();
        }
        else {
            this._log.info('Preferred URI not set; backing off.');
            this._backoff.primary.backoff();
        }
    };
    /**
     * Reset both primary and preferred backoff mechanisms.
     */
    WSTransport.prototype._resetBackoffs = function () {
        this._backoff.preferred.reset();
        this._backoff.primary.reset();
        this._backoffStartTime.preferred = null;
        this._backoffStartTime.primary = null;
    };
    /**
     * Set a timeout to reconnect after HEARTBEAT_TIMEOUT milliseconds
     *   have passed without receiving a message over the WebSocket.
     */
    WSTransport.prototype._setHeartbeatTimeout = function () {
        var _this = this;
        clearTimeout(this._heartbeatTimeout);
        this._heartbeatTimeout = setTimeout(function () {
            _this._log.info("No messages received in " + HEARTBEAT_TIMEOUT / 1000 + " seconds. Reconnecting...");
            _this._shouldFallback = true;
            _this._closeSocket();
        }, HEARTBEAT_TIMEOUT);
    };
    /**
     * Set the current and previous state
     */
    WSTransport.prototype._setState = function (state) {
        this._previousState = this.state;
        this.state = state;
    };
    /**
     * Set up the primary and preferred backoff mechanisms.
     */
    WSTransport.prototype._setupBackoffs = function () {
        var _this = this;
        var preferredBackoffConfig = {
            factor: 2.0,
            jitter: 0.40,
            max: this._options.maxPreferredDelayMs,
            min: 100,
        };
        this._log.info('Initializing preferred transport backoff using config: ', preferredBackoffConfig);
        var preferredBackoff = new backoff_1.default(preferredBackoffConfig);
        preferredBackoff.on('backoff', function (attempt, delay) {
            if (_this.state === WSTransportState.Closed) {
                _this._log.info('Preferred backoff initiated but transport state is closed; not attempting a connection.');
                return;
            }
            _this._log.info("Will attempt to reconnect Websocket to preferred URI in " + delay + "ms");
            if (attempt === 0) {
                _this._backoffStartTime.preferred = Date.now();
                _this._log.info("Preferred backoff start; " + _this._backoffStartTime.preferred);
            }
        });
        preferredBackoff.on('ready', function (attempt, _delay) {
            if (_this.state === WSTransportState.Closed) {
                _this._log.info('Preferred backoff ready but transport state is closed; not attempting a connection.');
                return;
            }
            if (_this._backoffStartTime.preferred === null) {
                _this._log.info('Preferred backoff start time invalid; not attempting a connection.');
                return;
            }
            if (Date.now() - _this._backoffStartTime.preferred > _this._options.maxPreferredDurationMs) {
                _this._log.info('Max preferred backoff attempt time exceeded; falling back to primary backoff.');
                _this._preferredUri = null;
                _this._backoff.primary.backoff();
                return;
            }
            if (typeof _this._preferredUri !== 'string') {
                _this._log.info('Preferred URI cleared; falling back to primary backoff.');
                _this._preferredUri = null;
                _this._backoff.primary.backoff();
                return;
            }
            _this._connect(_this._preferredUri, attempt + 1);
        });
        var primaryBackoffConfig = {
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
        var primaryBackoff = new backoff_1.default(primaryBackoffConfig);
        primaryBackoff.on('backoff', function (attempt, delay) {
            if (_this.state === WSTransportState.Closed) {
                _this._log.info('Primary backoff initiated but transport state is closed; not attempting a connection.');
                return;
            }
            _this._log.info("Will attempt to reconnect WebSocket in " + delay + "ms");
            if (attempt === 0) {
                _this._backoffStartTime.primary = Date.now();
                _this._log.info("Primary backoff start; " + _this._backoffStartTime.primary);
            }
        });
        primaryBackoff.on('ready', function (attempt, _delay) {
            if (_this.state === WSTransportState.Closed) {
                _this._log.info('Primary backoff ready but transport state is closed; not attempting a connection.');
                return;
            }
            if (_this._backoffStartTime.primary === null) {
                _this._log.info('Primary backoff start time invalid; not attempting a connection.');
                return;
            }
            if (Date.now() - _this._backoffStartTime.primary > _this._options.maxPrimaryDurationMs) {
                _this._log.info('Max primary backoff attempt time exceeded; not attempting a connection.');
                return;
            }
            _this._connect(_this._uris[_this._uriIndex], attempt + 1);
        });
        return {
            preferred: preferredBackoff,
            primary: primaryBackoff,
        };
    };
    Object.defineProperty(WSTransport.prototype, "uri", {
        /**
         * The uri the transport is currently connected to
         */
        get: function () {
            return this._connectedUri;
        },
        enumerable: false,
        configurable: true
    });
    WSTransport.defaultConstructorOptions = {
        WebSocket: WebSocket,
        connectTimeoutMs: CONNECT_TIMEOUT,
        maxPreferredDelayMs: MAX_PREFERRED_DELAY,
        maxPreferredDurationMs: MAX_PREFERRED_DURATION,
        maxPrimaryDelayMs: MAX_PRIMARY_DELAY,
        maxPrimaryDurationMs: MAX_PRIMARY_DURATION,
    };
    return WSTransport;
}(events_1.EventEmitter));
exports.default = WSTransport;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid3N0cmFuc3BvcnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL3dzdHJhbnNwb3J0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpQ0FBc0M7QUFDdEMscUNBQWdDO0FBQ2hDLG1DQUEyQztBQUMzQyw2QkFBd0I7QUFFeEIsSUFBTSxTQUFTLEdBQUcsVUFBVSxDQUFDLFNBQVMsQ0FBQztBQUV2QyxJQUFNLHVCQUF1QixHQUFHLEtBQUssQ0FBQztBQUN0QyxJQUFNLGVBQWUsR0FBRyxJQUFJLENBQUM7QUFDN0IsSUFBTSxpQkFBaUIsR0FBRyxLQUFLLENBQUM7QUFDaEMsSUFBTSxzQkFBc0IsR0FBRyxLQUFLLENBQUM7QUFDckMsSUFBTSxvQkFBb0IsR0FBRyxRQUFRLENBQUM7QUFDdEMsSUFBTSxtQkFBbUIsR0FBRyxJQUFJLENBQUM7QUFDakMsSUFBTSxpQkFBaUIsR0FBRyxLQUFLLENBQUM7QUFRaEM7O0dBRUc7QUFDSCxJQUFZLGdCQWVYO0FBZkQsV0FBWSxnQkFBZ0I7SUFDMUI7O09BRUc7SUFDSCw2Q0FBeUIsQ0FBQTtJQUV6Qjs7T0FFRztJQUNILHFDQUFpQixDQUFBO0lBRWpCOztPQUVHO0lBQ0gsaUNBQWEsQ0FBQTtBQUNmLENBQUMsRUFmVyxnQkFBZ0IsR0FBaEIsd0JBQWdCLEtBQWhCLHdCQUFnQixRQWUzQjtBQTBDRDs7R0FFRztBQUNIO0lBQXlDLCtCQUFZO0lBd0duRDs7OztPQUlHO0lBQ0gscUJBQVksSUFBYyxFQUFFLE9BQTZDO1FBQTdDLHdCQUFBLEVBQUEsWUFBNkM7UUFBekUsWUFDRSxpQkFBTyxTQU9SO1FBM0dEOztXQUVHO1FBQ0gsV0FBSyxHQUFxQixnQkFBZ0IsQ0FBQyxNQUFNLENBQUM7UUFVbEQ7O1dBRUc7UUFDSyx1QkFBaUIsR0FHckI7WUFDRixTQUFTLEVBQUUsSUFBSTtZQUNmLE9BQU8sRUFBRSxJ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