'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var events = require('events');
var constants = require('./constants.js');
require('./errors/index.js');
var log = require('./log.js');
var wstransport = require('./wstransport.js');
var generated = require('./errors/generated.js');

var PSTREAM_VERSION = '1.6';
// In seconds
var MAX_RECONNECT_TIMEOUT_ALLOWED = 30;
// Non-enumerable mark on 'error' payloads raised because the transport failed
// (socket error or abnormal close, or no transport to send on), as opposed to
// an error message received from the signaling server.
var TRANSPORT_ERROR_MARK = '_isTransportError';
/**
 * Mark an 'error' payload as raised by the transport.
 * @param payload - The payload to mark.
 * @returns The same payload.
 */
function markTransportErrorPayload(payload) {
    if (payload && typeof payload === 'object') {
        Object.defineProperty(payload, TRANSPORT_ERROR_MARK, { value: true });
    }
    return payload;
}
/**
 * Whether an 'error' payload was raised by the transport.
 * @param payload - The payload to check.
 */
function isTransportErrorPayload(payload) {
    return !!payload && typeof payload === 'object' && payload[TRANSPORT_ERROR_MARK] === true;
}
/**
 * Constructor for PStream objects.
 *
 * @exports PStream as Twilio.PStream
 * @memberOf Twilio
 * @borrows EventEmitter#addListener as #addListener
 * @borrows EventEmitter#removeListener as #removeListener
 * @borrows EventEmitter#emit as #emit
 * @borrows EventEmitter#hasListener as #hasListener
 * @constructor
 * @param {string} token The Twilio capabilities JWT
 * @param {string[]} uris An array of PStream endpoint URIs
 * @param {object} [options]
 * @config {boolean} [options.backoffMaxMs=20000] Enable debugging
 */
var PStream = /** @class */ (function (_super) {
    tslib.__extends(PStream, _super);
    function PStream(token, uris, options) {
        var _this = _super.call(this) || this;
        if (!(_this instanceof PStream)) {
            return new PStream(token, uris, options);
        }
        var defaults = {
            TransportFactory: wstransport.default,
        };
        options = options || {};
        for (var prop in defaults) {
            if (prop in options) {
                continue;
            }
            options[prop] = defaults[prop];
        }
        _this.options = options;
        _this.token = token || '';
        _this.status = 'disconnected';
        _this.gateway = null;
        _this.region = null;
        /**
         * The signaling connection id (`payload.connectionId`) received in the
         * most recent `connected` message on the current WebSocket, or `null` if
         * none has been received since the transport last closed. Cleared after
         * 'transportClose' listeners run and before 'offline' is emitted (or on
         * destroy), so a replacement connection never inherits the previous id.
         * @type {string|null}
         */
        _this.signalingConnectionId = null;
        /**
         * The signaling connection id of the connection that most recently closed
         * after receiving one, or `null`. Set when the transport closes, kept
         * across reconnect attempts that never reach `connected`, and cleared on
         * the next `connected` message (with or without an id) and on destroy.
         * Device uses it only for the one Insights transport error event published
         * per lost connection, so that event names the connection that dropped
         * even when the transport closed before raising any error.
         * @type {string|null}
         */
        _this.lastClosedSignalingConnectionId = null;
        _this._messageQueue = [];
        _this._preferredUri = null;
        _this._uris = uris;
        _this._handleTransportClose = _this._handleTransportClose.bind(_this);
        _this._handleTransportError = _this._handleTransportError.bind(_this);
        _this._handleTransportMessage = _this._handleTransportMessage.bind(_this);
        _this._handleTransportOpen = _this._handleTransportOpen.bind(_this);
        _this._log = new log.default('PStream');
        // NOTE(mroberts): EventEmitter requires that we catch all errors.
        _this.on('error', function () {
            _this._log.warn('Unexpected error handled in pstream');
        });
        /*
         *events used by device
         *'invite',
         *'ready',
         *'error',
         *'offline',
         *
         *'cancel',
         *'presence',
         *'roster',
         *'answer',
         *'candidate',
         *'hangup'
         */
        var self = _this;
        _this.addListener('ready', function () {
            self.status = 'ready';
        });
        _this.addListener('offline', function () {
            self.status = 'offline';
        });
        _this.addListener('close', function () {
            self._log.info('Received "close" from server. Destroying PStream...');
            self._destroy();
        });
        _this.transport = new _this.options.TransportFactory(_this._uris, {
            backoffMaxMs: _this.options.backoffMaxMs,
            maxPreferredDurationMs: _this.options.maxPreferredDurationMs,
        });
        Object.defineProperties(_this, {
            uri: {
                enumerable: true,
                get: function () {
                    return this.transport.uri;
                },
            },
        });
        _this.transport.on('close', _this._handleTransportClose);
        _this.transport.on('error', _this._handleTransportError);
        _this.transport.on('message', _this._handleTransportMessage);
        _this.transport.on('open', _this._handleTransportOpen);
        _this.transport.open();
        return _this;
    }
    return PStream;
}(events.EventEmitter));
PStream.prototype._handleTransportClose = function () {
    // 'transportClose' listeners describe the connection that just closed, so
    // events they publish keep its id. Clear it before going offline.
    try {
        this.emit('transportClose');
    }
    finally {
        if (this.signalingConnectionId !== null) {
            this.lastClosedSignalingConnectionId = this.signalingConnectionId;
        }
        this._clearSignalingConnectionId();
    }
    if (this.status !== 'disconnected') {
        if (this.status !== 'offline') {
            this.emit('offline', this);
        }
        this.status = 'disconnected';
    }
};
PStream.prototype._clearSignalingConnectionId = function () {
    if (this.signalingConnectionId !== null) {
        this._log.info("Clearing signaling connection id: ".concat(this.signalingConnectionId));
    }
    this.signalingConnectionId = null;
};
PStream.prototype._updateSignalingConnectionId = function (signalingConnectionId) {
    if (typeof signalingConnectionId !== 'string' || signalingConnectionId === this.signalingConnectionId) {
        return;
    }
    this._log.info("Setting signaling connection id: ".concat(signalingConnectionId));
    this.signalingConnectionId = signalingConnectionId;
};
PStream.prototype._handleTransportError = function (error) {
    if (!error) {
        this.emit('error', markTransportErrorPayload({ error: {
                code: 31000,
                message: 'Websocket closed without a provided reason',
                twilioError: new generated.SignalingErrors.ConnectionDisconnected(),
            } }));
        return;
    }
    // We receive some errors without call metadata (just the error). We need to convert these
    // to be contained within the 'error' field so that these errors match the expected format.
    this.emit('error', markTransportErrorPayload(typeof error.code !== 'undefined' ? { error: error } : error));
};
PStream.prototype._handleTransportMessage = function (msg) {
    if (!msg || !msg.data || typeof msg.data !== 'string') {
        return;
    }
    var _a = JSON.parse(msg.data), type = _a.type, _b = _a.payload, payload = _b === void 0 ? {} : _b;
    this.gateway = payload.gateway || this.gateway;
    this.region = payload.region || this.region;
    if (type === 'connected') {
        // A new connection is established: the dropped one no longer applies.
        this.lastClosedSignalingConnectionId = null;
        this._updateSignalingConnectionId(payload.connectionId);
    }
    if (type === 'error' && payload.error) {
        payload.error.twilioError = new generated.SignalingErrors.ConnectionError();
    }
    this.emit(type, payload);
};
PStream.prototype._handleTransportOpen = function () {
    var _this = this;
    this.status = 'connected';
    this.setToken(this.token);
    this.emit('transportOpen');
    var messages = this._messageQueue.splice(0, this._messageQueue.length);
    messages.forEach(function (message) { return _this._publish.apply(_this, message); });
};
/**
 * @return {string}
 */
PStream.toString = function () { return '[Twilio.PStream class]'; };
PStream.prototype.toString = function () { return '[Twilio.PStream instance]'; };
PStream.prototype.setToken = function (token) {
    this._log.info('Setting token and publishing listen');
    this.token = token;
    var reconnectTimeout = 0;
    var t = this.options.maxPreferredDurationMs;
    this._log.info("maxPreferredDurationMs:".concat(t));
    if (typeof t === 'number' && t >= 0) {
        reconnectTimeout = Math.min(Math.ceil(t / 1000), MAX_RECONNECT_TIMEOUT_ALLOWED);
    }
    this._log.info("reconnectTimeout:".concat(reconnectTimeout));
    var payload = {
        browserinfo: getBrowserInfo(),
        reconnectTimeout: reconnectTimeout,
        token: token,
    };
    this._publish('listen', payload);
};
PStream.prototype.sendMessage = function (callsid, content, contenttype, messagetype, voiceeventsid) {
    if (contenttype === void 0) { contenttype = 'application/json'; }
    var payload = {
        callsid: callsid,
        content: content,
        contenttype: contenttype,
        messagetype: messagetype,
        voiceeventsid: voiceeventsid,
    };
    this._publish('message', payload, true);
};
PStream.prototype.register = function (mediaCapabilities) {
    var regPayload = { media: mediaCapabilities };
    // A queued register is replayed alongside `listen`, before the server
    // validates the token, and earns a 31204. Re-register on `connected` covers it.
    this._publish('register', regPayload, false);
};
PStream.prototype.invite = function (sdp, callsid, params) {
    var payload = {
        callsid: callsid,
        sdp: sdp,
        twilio: params ? { params: params } : {},
    };
    this._publish('invite', payload, true);
};
PStream.prototype.reconnect = function (sdp, callsid, reconnect) {
    var payload = {
        callsid: callsid,
        reconnect: reconnect,
        sdp: sdp,
        twilio: {},
    };
    this._publish('invite', payload, true);
};
PStream.prototype.answer = function (sdp, callsid) {
    this._publish('answer', { sdp: sdp, callsid: callsid }, true);
};
PStream.prototype.dtmf = function (callsid, digits) {
    this._publish('dtmf', { callsid: callsid, dtmf: digits }, true);
};
PStream.prototype.hangup = function (callsid, message) {
    var payload = message ? { callsid: callsid, message: message } : { callsid: callsid };
    this._publish('hangup', payload, true);
};
PStream.prototype.reject = function (callsid) {
    this._publish('reject', { callsid: callsid }, true);
};
PStream.prototype.reinvite = function (sdp, callsid) {
    this._publish('reinvite', { sdp: sdp, callsid: callsid }, false);
};
PStream.prototype._destroy = function () {
    this.transport.removeListener('close', this._handleTransportClose);
    this.transport.removeListener('error', this._handleTransportError);
    this.transport.removeListener('message', this._handleTransportMessage);
    this.transport.removeListener('open', this._handleTransportOpen);
    this.transport.close();
    this._clearSignalingConnectionId();
    this.lastClosedSignalingConnectionId = null;
    this.emit('offline', this);
};
PStream.prototype.destroy = function () {
    this._log.info('PStream.destroy() called...');
    this._destroy();
    return this;
};
PStream.prototype.updatePreferredURI = function (uri) {
    this._preferredUri = uri;
    this.transport.updatePreferredURI(uri);
};
PStream.prototype.updateURIs = function (uris) {
    this._uris = uris;
    this.transport.updateURIs(this._uris);
};
PStream.prototype.publish = function (type, payload) {
    return this._publish(type, payload, true);
};
PStream.prototype._publish = function (type, payload, shouldRetry) {
    var msg = JSON.stringify({
        payload: payload,
        type: type,
        version: PSTREAM_VERSION,
    });
    var isSent = !!this.transport.send(msg);
    if (!isSent) {
        this.emit('error', markTransportErrorPayload({ error: {
                code: 31009,
                message: 'No transport available to send or receive messages',
                twilioError: new generated.GeneralErrors.TransportError(),
            } }));
        if (shouldRetry) {
            this._messageQueue.push([type, payload, true]);
        }
    }
};
function getBrowserInfo() {
    var nav = typeof navigator !== 'undefined' ? navigator : {};
    var info = {
        browser: {
            platform: nav.platform || 'unknown',
            userAgent: nav.userAgent || 'unknown',
        },
        p: 'browser',
        plugin: 'rtc',
        v: constants.RELEASE_VERSION,
    };
    return info;
}

exports.default = PStream;
exports.isTransportErrorPayload = isTransportErrorPayload;
exports.markTransportErrorPayload = markTransportErrorPayload;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHN0cmVhbS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9wc3RyZWFtLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIl9fZXh0ZW5kcyIsIldTVHJhbnNwb3J0IiwiTG9nIiwiRXZlbnRFbWl0dGVyIiwiU2lnbmFsaW5nRXJyb3JzIiwiR2VuZXJhbEVycm9ycyIsIkMuUkVMRUFTRV9WRVJTSU9OIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFPQSxJQUFNLGVBQWUsR0FBRyxLQUFLO0FBRTdCO0FBQ0EsSUFBTSw2QkFBNkIsR0FBRyxFQUFFO0FBRXhDO0FBQ0E7QUFDQTtBQUNBLElBQU0sb0JBQW9CLEdBQUcsbUJBQW1CO0FBRWhEOzs7O0FBSUc7QUFDRyxTQUFVLHlCQUF5QixDQUFDLE9BQU8sRUFBQTtBQUMvQyxJQUFBLElBQUksT0FBTyxJQUFJLE9BQU8sT0FBTyxLQUFLLFFBQVEsRUFBRTtBQUMxQyxRQUFBLE1BQU0sQ0FBQyxjQUFjLENBQUMsT0FBTyxFQUFFLG9CQUFvQixFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksRUFBRSxDQUFDO0lBQ3ZFO0FBQ0EsSUFBQSxPQUFPLE9BQU87QUFDaEI7QUFFQTs7O0FBR0c7QUFDRyxTQUFVLHVCQUF1QixDQUFDLE9BQU8sRUFBQTtBQUM3QyxJQUFBLE9BQU8sQ0FBQyxDQUFDLE9BQU8sSUFBSSxPQUFPLE9BQU8sS0FBSyxRQUFRLElBQUksT0FBTyxDQUFDLG9CQUFvQixDQUFDLEtBQUssSUFBSTtBQUMzRjtBQUVBOzs7Ozs7Ozs7Ozs7OztBQWNHO0FBQ0gsSUFBQSxPQUFBLGtCQUFBLFVBQUEsTUFBQSxFQUFBO0lBQXNCQSxlQUFBLENBQUEsT0FBQSxFQUFBLE1BQUEsQ0FBQTtBQUNwQixJQUFBLFNBQUEsT0FBQSxDQUFZLEtBQUssRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFBO1FBQzlCLElBQUEsS0FBQSxHQUFBLE1BQUssV0FBRSxJQUFBLElBQUE7QUFFUCxRQUFBLElBQUks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
