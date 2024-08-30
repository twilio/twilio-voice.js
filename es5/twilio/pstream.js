"use strict";
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
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
var events_1 = require("events");
var C = require("./constants");
var errors_1 = require("./errors");
var log_1 = require("./log");
var wstransport_1 = require("./wstransport");
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
    __extends(PStream, _super);
    function PStream(token, uris, options) {
        var _this = _super.call(this) || this;
        if (!(_this instanceof PStream)) {
            return new PStream(token, uris, options);
        }
        var defaults = {
            TransportFactory: wstransport_1.default,
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
        _this._log = new log_1.default('PStream');
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
}(events_1.EventEmitter));
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
                twilioError: new errors_1.SignalingErrors.ConnectionDisconnected(),
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
        payload.error.twilioError = new errors_1.SignalingErrors.ConnectionError();
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
    this._log.info("maxPreferredDurationMs:" + t);
    if (typeof t === 'number' && t >= 0) {
        reconnectTimeout = Math.min(Math.ceil(t / 1000), MAX_RECONNECT_TIMEOUT_ALLOWED);
    }
    this._log.info("reconnectTimeout:" + reconnectTimeout);
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
    this._publish('register', regPayload, true);
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
                twilioError: new errors_1.GeneralErrors.TransportError(),
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
        v: C.RELEASE_VERSION,
    };
    return info;
}
exports.default = PStream;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHN0cmVhbS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vcHN0cmVhbS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFBQTs7OztHQUlHO0FBQ0gsY0FBYztBQUNkLGlDQUFzQztBQUN0QywrQkFBaUM7QUFDakMsbUNBQTBEO0FBQzFELDZCQUF3QjtBQUN4Qiw2Q0FBd0M7QUFFeEMsSUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDO0FBRTlCLGFBQWE7QUFDYixJQUFNLDZCQUE2QixHQUFHLEVBQUUsQ0FBQztBQUV6Qzs7Ozs7Ozs7Ozs7Ozs7R0FjRztBQUNIO0lBQXNCLDJCQUFZO0lBQ2hDLGlCQUFZLEtBQUssRUFBRSxJQUFJLEVBQUUsT0FBTztRQUFoQyxZQUNFLGlCQUFPLFNBdUZSO1FBckZDLElBQUksQ0FBQyxDQUFDLEtBQUksWUFBWSxPQUFPLENBQUMsRUFBRTtZQUM5QixPQUFPLElBQUksT0FBTyxDQUFDLEtBQUssRUFBRSxJQUFJLEVBQUUsT0FBTyxDQUFDLENBQUM7U0FDMUM7UUFDRCxJQUFNLFFBQVEsR0FBRztZQUNmLGdCQUFnQixFQUFFLHFCQUFXO1NBQzlCLENBQUM7UUFDRixPQUFPLEdBQUcsT0FBTyxJQUFJLEVBQUUsQ0FBQztRQUN4QixLQUFLLElBQU0sSUFBSSxJQUFJLFFBQVEsRUFBRTtZQUMzQixJQUFJLElBQUksSUFBSSxPQUFPLEVBQUU7Z0JBQ25CLFNBQVM7YUFDVjtZQUNELE9BQU8sQ0FBQyxJQUFJLENBQUMsR0FBRyxRQUFRLENBQUMsSUFBSSxDQUFDLENBQUM7U0FDaEM7UUFDRCxLQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztRQUN2QixLQUFJLENBQUMsS0FBSyxHQUFHLEtBQUssSUFBSSxFQUFFLENBQUM7UUFDekIsS0FBSSxDQUFDLE1BQU0sR0FBRyxjQUFjLENBQUM7UUFDN0IsS0FBSSxDQUFDLE9BQU8sR0FBRyxJQUFJLENBQUM7UUFDcEIsS0FB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