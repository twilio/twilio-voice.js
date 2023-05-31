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
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
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
var events_1 = require("events");
var WebSocket = require("ws");
var backoff_1 = require("./backoff");
var errors_1 = require("./errors");
var log_1 = require("./log");
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
        _this._log = log_1.default.getInstance();
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
            _this._log.info("Received websocket close event code: " + event.code + ". Reason: " + event.reason);
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
            _this._log.info("WebSocket received error: " + err.message);
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
            this._log.info('Error while sending message:', e.message);
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
            this._log.info('Could not connect to endpoint:', e.message);
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
        enumerable: true,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid3N0cmFuc3BvcnQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL3dzdHJhbnNwb3J0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHOzs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUVILGlDQUFzQztBQUN0Qyw4QkFBZ0M7QUFDaEMscUNBQWdDO0FBQ2hDLG1DQUEyQztBQUMzQyw2QkFBd0I7QUFFeEIsSUFBTSx1QkFBdUIsR0FBRyxLQUFLLENBQUM7QUFDdEMsSUFBTSxlQUFlLEdBQUcsSUFBSSxDQUFDO0FBQzdCLElBQU0saUJBQWlCLEdBQUcsS0FBSyxDQUFDO0FBQ2hDLElBQU0sc0JBQXNCLEdBQUcsS0FBSyxDQUFDO0FBQ3JDLElBQU0sb0JBQW9CLEdBQUcsUUFBUSxDQUFDO0FBQ3RDLElBQU0sbUJBQW1CLEdBQUcsSUFBSSxDQUFDO0FBQ2pDLElBQU0saUJBQWlCLEdBQUcsS0FBSyxDQUFDO0FBUWhDOztHQUVHO0FBQ0gsSUFBWSxnQkFlWDtBQWZELFdBQVksZ0JBQWdCO0lBQzFCOztPQUVHO0lBQ0gsNkNBQXlCLENBQUE7SUFFekI7O09BRUc7SUFDSCxxQ0FBaUIsQ0FBQTtJQUVqQjs7T0FFRztJQUNILGlDQUFhLENBQUE7QUFDZixDQUFDLEVBZlcsZ0JBQWdCLEdBQWhCLHdCQUFnQixLQUFoQix3QkFBZ0IsUUFlM0I7QUEwQ0Q7O0dBRUc7QUFDSDtJQUF5QywrQkFBWTtJQXdHbkQ7Ozs7T0FJRztJQUNILHFCQUFZLElBQWMsRUFBRSxPQUE2QztRQUE3Qyx3QkFBQSxFQUFBLFlBQTZDO1FBQXpFLFlBQ0UsaUJBQU8sU0FPUjtRQTNHRDs7V0FFRztRQUNILFdBQUssR0FBcUIsZ0JBQWdCLENBQUMsTUFBTSxDQUFDO1FBVWxEOztXQUVHO1FBQ0ssdUJBQWlCLEdBR3JCO1lBQ0YsU0FBUyxFQUFFLElBQUk7WUFDZixPQUFPLEVBQUUsSUFBSTtTQUNkLENBQUM7UUFFRjs7O1dBR0c7UUFD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