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
    var payload = {
        browserinfo: getBrowserInfo(),
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
PStream.prototype.invite = function (sdp, callsid, preflight, params) {
    var payload = {
        callsid: callsid,
        preflight: !!preflight,
        sdp: sdp,
        twilio: params ? { params: params } : {},
    };
    this._publish('invite', payload, true);
};
PStream.prototype.reconnect = function (sdp, callsid, reconnect, params) {
    var payload = {
        callsid: callsid,
        preflight: false,
        reconnect: reconnect,
        sdp: sdp,
        twilio: params ? { params: params } : {},
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHN0cmVhbS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vcHN0cmVhbS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7Ozs7Ozs7QUFBQTs7OztHQUlHO0FBQ0gsY0FBYztBQUNkLGlDQUFzQztBQUN0QywrQkFBaUM7QUFDakMsbUNBQTBEO0FBQzFELDZCQUF3QjtBQUN4Qiw2Q0FBd0M7QUFFeEMsSUFBTSxlQUFlLEdBQUcsS0FBSyxDQUFDO0FBRTlCOzs7Ozs7Ozs7Ozs7OztHQWNHO0FBQ0g7SUFBc0IsMkJBQVk7SUFDaEMsaUJBQVksS0FBSyxFQUFFLElBQUksRUFBRSxPQUFPO1FBQWhDLFlBQ0UsaUJBQU8sU0F1RlI7UUFyRkMsSUFBSSxDQUFDLENBQUMsS0FBSSxZQUFZLE9BQU8sQ0FBQyxFQUFFO1lBQzlCLE9BQU8sSUFBSSxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztTQUMxQztRQUNELElBQU0sUUFBUSxHQUFHO1lBQ2YsZ0JBQWdCLEVBQUUscUJBQVc7U0FDOUIsQ0FBQztRQUNGLE9BQU8sR0FBRyxPQUFPLElBQUksRUFBRSxDQUFDO1FBQ3hCLEtBQUssSUFBTSxJQUFJLElBQUksUUFBUSxFQUFFO1lBQzNCLElBQUksSUFBSSxJQUFJLE9BQU8sRUFBRTtnQkFDbkIsU0FBUzthQUNWO1lBQ0QsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUMsQ0FBQztTQUNoQztRQUNELEtBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTyxDQUFDO1FBQ3ZCLEtBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxJQUFJLEVBQUUsQ0FBQztRQUN6QixLQUFJLENBQUMsTUFBTSxHQUFHLGNBQWMsQ0FBQztRQUM3QixLQUFJLENBQUMsT0FBTyxHQUFHLElBQUksQ0FBQztRQUNwQixLQUFJLENBQUMsTUFBTSxHQUFHLElBQUksQ0FBQztRQUNuQixLQUFJLENBQUMsYUFBYSxHQUFHLEVBQUUsQ0FBQztRQUN4QixLQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQztRQUMxQixLQUFJLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQztRQUVsQixLQUFJLENBQUMscUJBQXFCLEdBQUcsS0FBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxLQUFJLENBQUMsQ0FBQztRQUNuRSxLQUFJLENBQUMscUJBQXFCLEdBQUcsS0FBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxLQUFJLENBQUMsQ0FBQztRQUNuRSxLQUFJLENBQUMsdUJBQXVCLEdBQUcsS0FBSSxDQUFDLHVCQUF1QixDQUFDLElBQUksQ0FBQyxLQUFJLENBQUMsQ0FBQztRQUN2RSxLQUFJLENBQUMsb0JBQW9CLEdBQUcsS0FBSSxDQUFDLG9CQUFvQixDQUFDLElBQUksQ0FBQyxLQUFJLENBQUMsQ0FBQztRQUVqRSxLQUFJLENBQUMsSUFBSSxHQUFHLElBQUksYUFBRyxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBRS9CLGtFQUFrRTtRQUNsRSxLQUFJLENBQUMsRUFBRSxDQUFDLE9BQU8sRUFBRTtZQUNmLEtBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHFDQUFxQyxDQUFDLENBQUM7UUFDeEQsQ0FBQyxDQUFDLENBQUM7UUFFSDs7Ozs7Ozs7Ozs7OztXQWFHO1FBRUgsSUFBTSxJQUFJLEdBQUcsS0FBSSxDQUFDO1FBRWxCLEtBQUksQ0FBQyxXQUFXLENBQUMsT0FBTyxFQUFFO1lBQ3hCLElBQUksQ0FBQyxNQUFNLEdBQUcsT0FBTyxDQUFDO1FBQ3hCLENBQUMsQ0FBQyxDQUFDO1FBRUgsS0FBSSxDQUFDLFdBQVcsQ0FBQyxTQUFTLEVBQUU7WUFDMUIsSUFBSSxDQUFDLE1BQU0sR0FBRyxTQUFTLENBQUM7UUFDMUIsQ0FBQyxDQUFDLENBQUM7UUFFSCxLQUFJLENBQUMsV0FBVyxDQUFDLE9BQU8sRUFBRTtZQUN4QixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxxREFBcUQsQ0FBQyxDQUFDO1lBQ3RFLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztRQUNsQixDQUFDLENBQUMsQ0FBQztRQUVILEtBQUksQ0FBQyxTQUFTLEdBQUcsSUFBSSxLQUFJLENBQUMsT0FBTyxDQUFDLGdCQUFnQixDQUFDLEtBQUksQ0FBQyxLQUFLLEVBQUU7WUFDN0QsWUFBWSxFQUFFLEtBQUksQ0FBQyxPQUFPLENBQUMsWUFBWTtZQUN2QyxzQkFBc0IsRUFBRSxLQUFJLENBQUMsT0FBTyxDQUFDLHNCQUFzQjtTQUM1RCxDQUFDLENBQUM7UUFFSCxNQUFNLENBQUMsZ0JBQWdCLENBQUMsS0FBSSxFQUFFO1lBQzVCLEdBQUcsRUFBRTtnQkFDSCxVQUFVLEVBQUUsSUFBSTtnQkFDaEIsR0FBRztvQkFDRCxPQUFPLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDO2dCQUM1QixDQUFDO2FBQ0Y7U0FDRixDQUFDLENBQUM7UUFFSCxLQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxPQUFPLEVBQUUsS0FBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7UUFDdkQsS0FBSSxDQUFDLFNBQVMsQ0FBQyxFQUFFLENBQUMsT0FBTyxFQUFFLEtBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO1FBQ3ZELEtBQUksQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxLQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQztRQUMzRCxLQUFJLENBQUMsU0FBUyxDQUFDLEVBQUUsQ0FBQyxNQUFNLEVBQUUsS0FBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7UUFDckQsS0FBSSxDQUFDLFNBQVMsQ0FBQyxJQUFJLEVBQUUsQ0FBQztRQUV0QixPQUFPLEtBQUksQ0FBQztJQUNkLENBQUM7SUFDSCxjQUFDO0FBQUQsQ0FBQyxBQTFGRCxDQUFzQixxQkFBWSxHQTBGakM7QUFFRCxPQUFPLENBQUMsU0FBUyxDQUFDLHFCQUFxQixHQUFHO0lBQ3hDLElBQUksQ0FBQyxJQUFJLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztJQUU1QixJQUFJLElBQUksQ0FBQyxNQUFNLEtBQUssY0FBYyxFQUFFO1FBQ2xDLElBQUksSUFBSSxDQUFDLE1BQU0sS0FBSyxTQUFTLEVBQUU7WUFDN0IsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUM7U0FDNUI7UUFDRCxJQUFJLENBQUMsTUFBTSxHQUFHLGNBQWMsQ0FBQztLQUM5QjtBQUNILENBQUMsQ0FBQztBQUVGLE9BQU8sQ0FBQyxTQUFTLENBQUMscUJBQXFCLEdBQUcsVUFBUyxLQUFLO0lBQ3RELElBQUksQ0FBQyxLQUFLLEVBQUU7UUFDVixJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLEtBQUssRUFBRTtnQkFDMUIsSUFBSSxFQUFFLEtBQUs7Z0JBQ1gsT0FBTyxFQUFFLDRDQUE0QztnQkFDckQsV0FBVyxFQUFFLElBQUksd0JBQWUsQ0FBQyxzQkFBc0IsRUFBRTthQUMxRCxFQUFFLENBQUMsQ0FBQztRQUNMLE9BQU87S0FDUjtJQUNELDBGQUEwRjtJQUMxRiwyRkFBMkY7SUFDM0YsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsT0FBTyxLQUFLLENBQUMsSUFBSSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUUsRUFBRSxLQUFLLE9BQUEsRUFBRSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUM3RSxDQUFDLENBQUM7QUFFRixPQUFPLENBQUMsU0FBUyxDQUFDLHVCQUF1QixHQUFHLFVBQVMsR0FBRztJQUN0RCxJQUFJLENBQUMsR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksSUFBSSxPQUFPLEdBQUcsQ0FBQyxJQUFJLEtBQUssUUFBUSxFQUFFO1FBQ3JELE9BQU87S0FDUjtJQUVLLElBQUEsS0FBeUIsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLEVBQTNDLElBQUksVUFBQSxFQUFFLGVBQVksRUFBWixPQUFPLG1CQUFHLEVBQUUsS0FBeUIsQ0FBQztJQUNwRCxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQyxPQUFPLElBQUksSUFBSSxDQUFDLE9BQU8sQ0FBQztJQUMvQyxJQUFJLENBQUMsTUFBTSxHQUFHLE9BQU8sQ0FBQyxNQUFNLElBQUksSUFBSSxDQUFDLE1BQU0sQ0FBQztJQUU1QyxJQUFJLElBQUksS0FBSyxPQUFPLElBQUksT0FBTyxDQUFDLEtBQUssRUFBRTtRQUNyQyxPQUFPLENBQUMsS0FBSyxDQUFDLFdBQVcsR0FBRyxJQUFJLHdCQUFlLENBQUMsZUFBZSxFQUFFLENBQUM7S0FDbkU7SUFFRCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztBQUMzQixDQUFDLENBQUM7QUFFRixPQUFPLENBQUMsU0FBUyxDQUFDLG9CQUFvQixHQUFHO0lBQUEsaUJBUXhDO0lBUEMsSUFBSSxDQUFDLE1BQU0sR0FBRyxXQUFXLENBQUM7SUFDMUIsSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFFMUIsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztJQUUzQixJQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLE1BQU0sQ0FBQyxDQUFDLEVBQUUsSUFBSSxDQUFDLGFBQWEsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN6RSxRQUFRLENBQUMsT0FBTyxDQUFDLFVBQUEsT0FBTyxJQUFJLE9BQUEsS0FBSSxDQUFDLFFBQVEsT0FBYixLQUFJLEVBQWEsT0FBTyxHQUF4QixDQUF5QixDQUFDLENBQUM7QUFDekQsQ0FBQyxDQUFDO0FBRUY7O0dBRUc7QUFDSCxPQUFPLENBQUMsUUFBUSxHQUFHLGNBQU0sT0FBQSx3QkFBd0IsRUFBeEIsQ0FBd0IsQ0FBQztBQUNsRCxPQUFPLENBQUMsU0FBUyxDQUFDLFFBQVEsR0FBRyxjQUFNLE9BQUEsMkJBQTJCLEVBQTNCLENBQTJCLENBQUM7QUFFL0QsT0FBTyxDQUFDLFNBQVMsQ0FBQyxRQUFRLEdBQUcsVUFBUyxLQUFLO0lBQ3pDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHFDQUFxQyxDQUFDLENBQUM7SUFDdEQsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLENBQUM7SUFDbkIsSUFBTSxPQUFPLEdBQUc7UUFDZCxXQUFXLEVBQUUsY0FBYyxFQUFFO1FBQzdCLEtBQUssT0FBQTtLQUNOLENBQUM7SUFDRixJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxPQUFPLENBQUMsQ0FBQztBQUNuQyxDQUFDLENBQUM7QUFFRixPQUFPLENBQUMsU0FBUyxDQUFDLFdBQVcsR0FBRyxVQUM5QixPQUFPLEVBQ1AsT0FBTyxFQUNQLFdBQWdDLEVBQ2hDLFdBQVcsRUFDWCxhQUFhO0lBRmIsNEJBQUEsRUFBQSxnQ0FBZ0M7SUFJaEMsSUFBTSxPQUFPLEdBQUc7UUFDZCxPQUFPLFNBQUE7UUFDUCxPQUFPLFNBQUE7UUFDUCxXQUFXLGFBQUE7UUFDWCxXQUFXLGFBQUE7UUFDWCxhQUFhLGVBQUE7S0FDZCxDQUFDO0lBQ0YsSUFBSSxDQUFDLFFBQVEsQ0FBQyxTQUFTLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQzFDLENBQUMsQ0FBQztBQUVGLE9BQU8sQ0FBQyxTQUFTLENBQUMsUUFBUSxHQUFHLFVBQVMsaUJBQWlCO0lBQ3JELElBQU0sVUFBVSxHQUFHLEVBQUUsS0FBSyxFQUFFLGlCQUFpQixFQUFFLENBQUM7SUFDaEQsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQzlDLENBQUMsQ0FBQztBQUVGLE9BQU8sQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLFVBQVMsR0FBRyxFQUFFLE9BQU8sRUFBRSxTQUFTLEVBQUUsTUFBTTtJQUNqRSxJQUFNLE9BQU8sR0FBRztRQUNkLE9BQU8sU0FBQTtRQUNQLFNBQVMsRUFBRSxDQUFDLENBQUMsU0FBUztRQUN0QixHQUFHLEtBQUE7UUFDSCxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sUUFBQSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUU7S0FDakMsQ0FBQztJQUNGLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztBQUN6QyxDQUFDLENBQUM7QUFFRixPQUFPLENBQUMsU0FBUyxDQUFDLFNBQVMsR0FBRyxVQUFTLEdBQUcsRUFBRSxPQUFPLEVBQUUsU0FBUyxFQUFFLE1BQU07SUFDcEUsSUFBTSxPQUFPLEdBQUc7UUFDZCxPQUFPLFNBQUE7UUFDUCxTQUFTLEVBQUUsS0FBSztRQUNoQixTQUFTLFdBQUE7UUFDVCxHQUFHLEtBQUE7UUFDSCxNQUFNLEVBQUUsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLE1BQU0sUUFBQSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUU7S0FDakMsQ0FBQztJQUNGLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQztBQUN6QyxDQUFDLENBQUM7QUFFRixPQUFPLENBQUMsU0FBUyxDQUFDLE1BQU0sR0FBRyxVQUFTLEdBQUcsRUFBRSxPQUFPO0lBQzlDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLEVBQUUsR0FBRyxLQUFBLEVBQUUsT0FBTyxTQUFBLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUNsRCxDQUFDLENBQUM7QUFFRixPQUFPLENBQUMsU0FBUyxDQUFDLElBQUksR0FBRyxVQUFTLE9BQU8sRUFBRSxNQUFNO0lBQy9DLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLEVBQUUsT0FBTyxTQUFBLEVBQUUsSUFBSSxFQUFFLE1BQU0sRUFBRSxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQ3pELENBQUMsQ0FBQztBQUVGLE9BQU8sQ0FBQyxTQUFTLENBQUMsTUFBTSxHQUFHLFVBQVMsT0FBTyxFQUFFLE9BQU87SUFDbEQsSUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDLENBQUMsQ0FBQyxFQUFFLE9BQU8sU0FBQSxFQUFFLE9BQU8sU0FBQSxFQUFFLENBQUMsQ0FBQyxDQUFDLEVBQUUsT0FBTyxTQUFBLEVBQUUsQ0FBQztJQUM3RCxJQUFJLENBQUMsUUFBUSxDQUFDLFFBQVEsRUFBRSxPQUFPLEVBQUUsSUFBSSxDQUFDLENBQUM7QUFDekMsQ0FBQyxDQUFDO0FBRUYsT0FBTyxDQUFDLFNBQVMsQ0FBQyxNQUFNLEdBQUcsVUFBUyxPQUFPO0lBQ3pDLElBQUksQ0FBQyxRQUFRLENBQUMsUUFBUSxFQUFFLEVBQUUsT0FBTyxTQUFBLEVBQUUsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUM3QyxDQUFDLENBQUM7QUFFRixPQUFPLENBQUMsU0FBUyxDQUFDLFFBQVEsR0FBRyxVQUFTLEdBQUcsRUFBRSxPQUFPO0lBQ2hELElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFLEVBQUUsR0FBRyxLQUFBLEVBQUUsT0FBTyxTQUFBLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztBQUNyRCxDQUFDLENBQUM7QUFFRixPQUFPLENBQUMsU0FBUyxDQUFDLFFBQVEsR0FBRztJQUMzQixJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLHFCQUFxQixDQUFDLENBQUM7SUFDbkUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxjQUFjLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0lBQ25FLElBQUksQ0FBQyxTQUFTLENBQUMsY0FBYyxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsdUJBQXVCLENBQUMsQ0FBQztJQUN2RSxJQUFJLENBQUMsU0FBUyxDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDLG9CQUFvQixDQUFDLENBQUM7SUFDakUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztJQUV2QixJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsQ0FBQztBQUM3QixDQUFDLENBQUM7QUFFRixPQUFPLENBQUMsU0FBUyxDQUFDLE9BQU8sR0FBRztJQUMxQixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO0lBQzlDLElBQUksQ0FBQyxRQUFRLEVBQUUsQ0FBQztJQUNoQixPQUFPLElBQUksQ0FBQztBQUNkLENBQUMsQ0FBQztBQUVGLE9BQU8sQ0FBQyxTQUFTLENBQUMsa0JBQWtCLEdBQUcsVUFBUyxHQUFHO0lBQ2pELElBQUksQ0FBQyxhQUFhLEdBQUcsR0FBRyxDQUFDO0lBQ3pCLElBQUksQ0FBQyxTQUFTLENBQUMsa0JBQWtCLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDekMsQ0FBQyxDQUFDO0FBRUYsT0FBTyxDQUFDLFNBQVMsQ0FBQyxVQUFVLEdBQUcsVUFBUyxJQUFJO0lBQzFDLElBQUksQ0FBQyxLQUFLLEdBQUcsSUFBSSxDQUFDO0lBQ2xCLElBQUksQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUN4QyxDQUFDLENBQUM7QUFFRixPQUFPLENBQUMsU0FBUyxDQUFDLE9BQU8sR0FBRyxVQUFTLElBQUksRUFBRSxPQUFPO0lBQ2hELE9BQU8sSUFBSSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsT0FBTyxFQUFFLElBQUksQ0FBQyxDQUFDO0FBQzVDLENBQUMsQ0FBQztBQUVGLE9BQU8sQ0FBQyxTQUFTLENBQUMsUUFBUSxHQUFHLFVBQVMsSUFBSSxFQUFFLE9BQU8sRUFBRSxXQUFXO0lBQzlELElBQU0sR0FBRyxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUM7UUFDekIsT0FBTyxTQUFBO1FBQ1AsSUFBSSxNQUFBO1FBQ0osT0FBTyxFQUFFLGVBQWU7S0FDekIsQ0FBQyxDQUFDO0lBQ0gsSUFBTSxNQUFNLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO0lBRTFDLElBQUksQ0FBQyxNQUFNLEVBQUU7UUFDWCxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxFQUFFLEtBQUssRUFBRTtnQkFDMUIsSUFBSSxFQUFFLEtBQUs7Z0JBQ1gsT0FBTyxFQUFFLG9EQUFvRDtnQkFDN0QsV0FBVyxFQUFFLElBQUksc0JBQWEsQ0FBQyxjQUFjLEVBQUU7YUFDaEQsRUFBRSxDQUFDLENBQUM7UUFFTCxJQUFJLFdBQVcsRUFBRTtZQUNmLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLENBQUMsSUFBSSxFQUFFLE9BQU8sRUFBRSxJQUFJLENBQUMsQ0FBQyxDQUFDO1NBQ2hEO0tBQ0Y7QUFDSCxDQUFDLENBQUM7QUFFRixTQUFTLGNBQWM7SUFDckIsSUFBTSxHQUFHLEdBQUcsT0FBTyxTQUFTLEtBQUssV0FBVyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUU5RCxJQUFNLElBQUksR0FBRztRQUNYLE9BQU8sRUFBRTtZQUNQLFFBQVEsRUFBRSxHQUFHLENBQUMsUUFBUSxJQUFJLFNBQVM7WUFDbkMsU0FBUyxFQUFFLEdBQUcsQ0FBQyxTQUFTLElBQUksU0FBUztTQUN0QztRQUNELENBQUMsRUFBRSxTQUFTO1FBQ1osTUFBTSxFQUFFLEtBQUs7UUFDYixDQUFDLEVBQUUsQ0FBQyxDQUFDLGVBQWU7S0FDckIsQ0FBQztJQUVGLE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQztBQUVELGtCQUFlLE9BQU8sQ0FBQyJ9