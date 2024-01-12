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
                return;
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