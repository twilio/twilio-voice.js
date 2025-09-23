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
var MAX_PREFERRED_DELAY = 1000;
var MAX_PRIMARY_DELAY = 20000;
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
            _this._resetBackoffs();
            _this._setHeartbeatTimeout();
            _this.emit('open');
        };
        _this._options = tslib.__assign(tslib.__assign({}, WSTransport.defaultConstructorOptions), options);
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
        if (this._timeOpened && Date.now() - this._timeOpened > CONNECT_SUCCESS_TIMEOUT) {
            this._resetBackoffs();
        }
        if (this.state !== exports.WSTransportState.Closed) {
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
        var preferredBackoffConfig = {
            factor: 2.0,
            jitter: 0.40,
            max: this._options.maxPreferredDelayMs,
            min: 100,
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
    };
    return WSTransport;
}(events.EventEmitter));

exports.default = WSTransport;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoid3N0cmFuc3BvcnQuanMiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vd3N0cmFuc3BvcnQudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOlsiV1NUcmFuc3BvcnRTdGF0ZSIsIl9fZXh0ZW5kcyIsIkxvZyIsIlNpZ25hbGluZ0Vycm9ycyIsIl9fYXNzaWduIiwiQmFja29mZiIsIkV2ZW50RW1pdHRlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7QUFLQSxJQUFNLFNBQVMsR0FBRyxVQUFVLENBQUMsU0FBUztBQUV0QyxJQUFNLHVCQUF1QixHQUFHLEtBQUs7QUFDckMsSUFBTSxlQUFlLEdBQUcsSUFBSTtBQUM1QixJQUFNLGlCQUFpQixHQUFHLEtBQUs7QUFDL0IsSUFBTSxzQkFBc0IsR0FBRyxLQUFLO0FBQ3BDLElBQU0sb0JBQW9CLEdBQUcsUUFBUTtBQUNyQyxJQUFNLG1CQUFtQixHQUFHLElBQUk7QUFDaEMsSUFBTSxpQkFBaUIsR0FBRyxLQUFLO0FBUS9COztBQUVHO0FBQ1NBO0FBQVosQ0FBQSxVQUFZLGdCQUFnQixFQUFBO0FBQzFCOztBQUVHO0FBQ0gsSUFBQSxnQkFBQSxDQUFBLFlBQUEsQ0FBQSxHQUFBLFlBQXlCO0FBRXpCOztBQUVHO0FBQ0gsSUFBQSxnQkFBQSxDQUFBLFFBQUEsQ0FBQSxHQUFBLFFBQWlCO0FBRWpCOztBQUVHO0FBQ0gsSUFBQSxnQkFBQSxDQUFBLE1BQUEsQ0FBQSxHQUFBLE1BQWE7QUFDZixDQUFDLEVBZldBLHdCQUFnQixLQUFoQkEsd0JBQWdCLEdBQUEsRUFBQSxDQUFBLENBQUE7QUF5RDVCOztBQUVHO0FBQ0gsSUFBQSxXQUFBLGtCQUFBLFVBQUEsTUFBQSxFQUFBO0lBQXlDQyxlQUFBLENBQUEsV0FBQSxFQUFBLE1BQUEsQ0FBQTtBQXdHdkM7Ozs7QUFJRztJQUNILFNBQUEsV0FBQSxDQUFZLElBQWMsRUFBRSxPQUE2QyxFQUFBO0FBQTdDLFFBQUEsSUFBQSxPQUFBLEtBQUEsTUFBQSxFQUFB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
