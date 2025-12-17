'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var events = require('events');
var backoff = require('./backoff.js');
require('./errors/index.js');
var log = require('./log.js');
var generated = require('./errors/generated.js');

var WebSocket = globalThis.WebSocket;
var CONNECT_SUCCESS_TIMEOUT = 10000;
var CONNECT_TIMEOUT = 5000;
var HEARTBEAT_TIMEOUT = 15000;
var MAX_PREFERRED_DURATION = 15000;
var MAX_PRIMARY_DURATION = Infinity;
var MAX_RETRY_AFTER_DURATION = 75000;
var MAX_PREFERRED_DELAY = 1000;
var MAX_PRIMARY_DELAY = 20000;
var MAX_RETRY_AFTER_DELAY = 60000;
/**
 * All possible states of WSTransport.
 */
exports.WSTransportState = void 0;
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
})(exports.WSTransportState || (exports.WSTransportState = {}));
/**
 * WebSocket Transport
 */
var WSTransport = /** @class */ (function (_super) {
    tslib.__extends(WSTransport, _super);
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
        _this.state = exports.WSTransportState.Closed;
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
        _this._log = new log.default('WSTransport');
        /**
         * The retryAfter value from signaling error, in seconds.
         */
        _this._retryAfter = null;
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
            _this._log.error("Received websocket close event code: ".concat(event.code, ". Reason: ").concat(event.reason));
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
                    twilioError: new generated.SignalingErrors.ConnectionError(),
                });
                var wasConnected = (
                // Only in Safari and certain Firefox versions, on network interruption, websocket drops right away with 1006
                // Let's check current state if it's open, meaning we should not fallback
                // because we're coming from a previously connected session
                _this.state === exports.WSTransportState.Open ||
                    // But on other browsers, websocket doesn't drop
                    // but our heartbeat catches it, setting the internal state to "Connecting".
                    // With this, we should check the previous state instead.
                    _this._previousState === exports.WSTransportState.Open);
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
            _this._log.error("WebSocket received error: ".concat(err.message));
            _this.emit('error', {
                code: 31000,
                message: err.message || 'WSTransport socket error',
                twilioError: new generated.SignalingErrors.ConnectionDisconnected(),
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
                _this._log.debug("Received: ".concat(message.data));
                var _a = JSON.parse(message.data), type = _a.type, _b = _a.payload, payload = _b === void 0 ? {} : _b;
                if (type === 'error' && payload.error && payload.error.retryAfter) {
                    _this._retryAfter = payload.error.retryAfter * 1000; // convert to milliseconds
                }
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
            _this._setState(exports.WSTransportState.Open);
            clearTimeout(_this._connectTimeout);
            if (_this._backoff) {
                _this._resetBackoffs();
            }
            _this._setHeartbeatTimeout();
            _this.emit('open');
        };
        _this._options = tslib.__assign(tslib.__assign({}, WSTransport.defaultConstructorOptions), options);
        _this._uris = uris;
        _this._backoff = null;
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
        this._log.debug("Sending: ".concat(message));
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
        this._setState(exports.WSTransportState.Closed);
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
        if (this._backoff && this._timeOpened && ((Date.now() - this._timeOpened) > CONNECT_SUCCESS_TIMEOUT)) {
            this._resetBackoffs();
        }
        if (this.state !== exports.WSTransportState.Closed) {
            if (!this._backoff) {
                this._backoff = this._setupBackoffs();
            }
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
            ? "Attempting to reconnect (retry #".concat(retryCount, ")...")
            : 'Attempting to connect...');
        this._closeSocket();
        this._setState(exports.WSTransportState.Connecting);
        this._connectedUri = uri;
        try {
            this._socket = new this._options.WebSocket(this._connectedUri);
        }
        catch (e) {
            this._log.error('Could not connect to endpoint:', e.message);
            this._close();
            this.emit('error', {
                code: 31000,
                message: e.message || "Could not connect to ".concat(this._connectedUri),
                twilioError: new generated.SignalingErrors.ConnectionDisconnected(),
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
    };
    /**
     * Reset both primary and preferred backoff mechanisms.
     */
    WSTransport.prototype._resetBackoffs = function () {
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
    };
    /**
     * Set a timeout to reconnect after HEARTBEAT_TIMEOUT milliseconds
     *   have passed without receiving a message over the WebSocket.
     */
    WSTransport.prototype._setHeartbeatTimeout = function () {
        var _this = this;
        clearTimeout(this._heartbeatTimeout);
        this._heartbeatTimeout = setTimeout(function () {
            _this._log.info("No messages received in ".concat(HEARTBEAT_TIMEOUT / 1000, " seconds. Reconnecting..."));
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
        var preferredRetryAfter = this._retryAfter !== null && this._preferredUri ? this._retryAfter : null;
        if (preferredRetryAfter) {
            this._log.info("Setting initial preferred backoff value to retryAfter: ".concat(preferredRetryAfter, "ms"));
        }
        var maxPreferredDurationMs = preferredRetryAfter
            ? this._options.maxRetryAfterDurationMs
            : this._options.maxPreferredDurationMs;
        var preferredBackoffConfig = {
            factor: 2.0,
            jitter: 0.40,
            max: preferredRetryAfter ? this._options.maxRetryAfterDelayMs : this._options.maxPreferredDelayMs,
            min: preferredRetryAfter || 100,
            useInitialValue: Boolean(preferredRetryAfter),
        };
        this._log.info('Initializing preferred transport backoff using config: ', preferredBackoffConfig);
        var preferredBackoff = new backoff.default(preferredBackoffConfig);
        preferredBackoff.on('backoff', function (attempt, delay) {
            if (_this.state === exports.WSTransportState.Closed) {
                _this._log.info('Preferred backoff initiated but transport state is closed; not attempting a connection.');
                return;
            }
            _this._log.info("Will attempt to reconnect Websocket to preferred URI in ".concat(delay, "ms"));
            if (attempt === 0) {
                _this._backoffStartTime.preferred = Date.now();
                _this._log.info("Preferred backoff start; ".concat(_this._backoffStartTime.preferred));
            }
        });
        preferredBackoff.on('ready', function (attempt, _delay) {
            if (_this.state === exports.WSTransportState.Closed) {
                _this._log.info('Preferred backoff ready but transport state is closed; not attempting a connection.');
                return;
            }
            if (_this._backoffStartTime.preferred === null) {
                _this._log.info('Preferred backoff start time invalid; not attempting a connection.');
                return;
            }
            if (!_this._backoff) {
                _this._log.info('Preferred backoff instance invalid; not attempting a connection.');
                return;
            }
            if (Date.now() - _this._backoffStartTime.preferred > maxPreferredDurationMs) {
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
        var primaryBackoff = new backoff.default(primaryBackoffConfig);
        primaryBackoff.on('backoff', function (attempt, delay) {
            if (_this.state === exports.WSTransportState.Closed) {
                _this._log.info('Primary backoff initiated but transport state is closed; not attempting a connection.');
                return;
            }
            _this._log.info("Will attempt to reconnect WebSocket in ".concat(delay, "ms"));
            if (attempt === 0) {
                _this._backoffStartTime.primary = Date.now();
                _this._log.info("Primary backoff start; ".concat(_this._backoffStartTime.primary));
            }
        });
        primaryBackoff.on('ready', function (attempt, _delay) {
            if (_this.state === exports.WSTransportState.Closed) {
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
        maxRetryAfterDelayMs: MAX_RETRY_AFTER_DELAY,
        maxRetryAfterDurationMs: MAX_RETRY_AFTER_DURATION,
    };
    return WSTransport;
}(events.EventEmitter));

exports.default = WSTransport;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid3N0cmFuc3BvcnQuanMiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vd3N0cmFuc3BvcnQudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOlsiV1NUcmFuc3BvcnRTdGF0ZSIsIl9fZXh0ZW5kcyIsIkxvZyIsIlNpZ25hbGluZ0Vycm9ycyIsIl9fYXNzaWduIiwiQmFja29mZiIsIkV2ZW50RW1pdHRlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFLQSxJQUFNLFNBQVMsR0FBRyxVQUFVLENBQUMsU0FBUztBQUV0QyxJQUFNLHVCQUF1QixHQUFHLEtBQUs7QUFDckMsSUFBTSxlQUFlLEdBQUcsSUFBSTtBQUM1QixJQUFNLGlCQUFpQixHQUFHLEtBQUs7QUFDL0IsSUFBTSxzQkFBc0IsR0FBRyxLQUFLO0FBQ3BDLElBQU0sb0JBQW9CLEdBQUcsUUFBUTtBQUNyQyxJQUFNLHdCQUF3QixHQUFHLEtBQUs7QUFDdEMsSUFBTSxtQkFBbUIsR0FBRyxJQUFJO0FBQ2hDLElBQU0saUJBQWlCLEdBQUcsS0FBSztBQUMvQixJQUFNLHFCQUFxQixHQUFHLEtBQUs7QUFRbkM7O0FBRUc7QUFDU0E7QUFBWixDQUFBLFVBQVksZ0JBQWdCLEVBQUE7QUFDMUI7O0FBRUc7QUFDSCxJQUFBLGdCQUFBLENBQUEsWUFBQSxDQUFBLEdBQUEsWUFBeUI7QUFFekI7O0FBRUc7QUFDSCxJQUFBLGdCQUFBLENBQUEsUUFBQSxDQUFBLEdBQUEsUUFBaUI7QUFFakI7O0FBRUc7QUFDSCxJQUFBLGdCQUFBLENBQUEsTUFBQSxDQUFBLEdBQUEsTUFBYTtBQUNmLENBQUMsRUFmV0Esd0JBQWdCLEtBQWhCQSx3QkFBZ0IsR0FBQSxFQUFBLENBQUEsQ0FBQTtBQW1FNUI7O0FBRUc7QUFDSCxJQUFBLFdBQUEsa0JBQUEsVUFBQSxNQUFBLEVBQUE7SUFBeUNDLGVBQUEsQ0FBQSxXQUFBLEVBQUEsTUFBQSxDQUFBO0FBK0d2Qzs7OztBQUlHO0lBQ0gsU0FBQSxXQUFBLENBQVks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
