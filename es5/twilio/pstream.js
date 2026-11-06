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
    this.emit('transportClose');
    if (this.status !== 'disconnected') {
        if (this.status !== 'offline') {
            this.emit('offline', this);
        }
        this.status = 'disconnected';
    }
};
PStream.prototype._handleTransportError = function (error) {
    if (!error) {
        this.emit('error', { error: {
                code: 31000,
                message: 'Websocket closed without a provided reason',
                twilioError: new generated.SignalingErrors.ConnectionDisconnected(),
            } });
        return;
    }
    // We receive some errors without call metadata (just the error). We need to convert these
    // to be contained within the 'error' field so that these errors match the expected format.
    this.emit('error', typeof error.code !== 'undefined' ? { error: error } : error);
};
PStream.prototype._handleTransportMessage = function (msg) {
    if (!msg || !msg.data || typeof msg.data !== 'string') {
        return;
    }
    var _a = JSON.parse(msg.data), type = _a.type, _b = _a.payload, payload = _b === void 0 ? {} : _b;
    this.gateway = payload.gateway || this.gateway;
    this.region = payload.region || this.region;
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
        this.emit('error', { error: {
                code: 31009,
                message: 'No transport available to send or receive messages',
                twilioError: new generated.GeneralErrors.TransportError(),
            } });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHN0cmVhbS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9wc3RyZWFtLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIl9fZXh0ZW5kcyIsIldTVHJhbnNwb3J0IiwiTG9nIiwiRXZlbnRFbWl0dGVyIiwiU2lnbmFsaW5nRXJyb3JzIiwiR2VuZXJhbEVycm9ycyIsIkMuUkVMRUFTRV9WRVJTSU9OIl0sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7QUFPQSxJQUFNLGVBQWUsR0FBRyxLQUFLO0FBRTdCO0FBQ0EsSUFBTSw2QkFBNkIsR0FBRyxFQUFFO0FBRXhDOzs7Ozs7Ozs7Ozs7OztBQWNHO0FBQ0gsSUFBQSxPQUFBLGtCQUFBLFVBQUEsTUFBQSxFQUFBO0lBQXNCQSxlQUFBLENBQUEsT0FBQSxFQUFBLE1BQUEsQ0FBQTtBQUNwQixJQUFBLFNBQUEsT0FBQSxDQUFZLEtBQUssRUFBRSxJQUFJLEVBQUUsT0FBTyxFQUFBO1FBQzlCLElBQUEsS0FBQSxHQUFBLE1BQUssV0FBRSxJQUFBLElBQUE7QUFFUCxRQUFBLElBQUksRUFBRSxLQUFJLFlBQVksT0FBTyxDQUFDLEVBQUU7WUFDOUIsT0FBTyxJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQztRQUMxQztBQUNBLFFBQUEsSUFBTSxRQUFRLEdBQUc7QUFDZixZQUFBLGdCQUFnQixFQUFFQyxtQkFBVztTQUM5QjtBQUNELFFBQUEsT0FBTyxHQUFHLE9BQU8sSUFBSSxFQUFFO0FBQ3ZCLFFBQUEsS0FBSyxJQUFNLElBQUksSUFBSSxRQUFRLEVBQUU7QUFDM0IsWUFBQSxJQUFJLElBQUksSUFBSSxPQUFPLEVBQUU7Z0JBQ25CO1lBQ0Y7WUFDQSxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQztRQUNoQztBQUNBLFFBQUEsS0FBSSxDQUFDLE9BQU8sR0FBRyxPQUFPO0FBQ3RCLFFBQUEsS0FBSSxDQUFDLEtBQUssR0FBRyxL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
