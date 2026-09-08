import { EventEmitter } from 'events';
import { RELEASE_VERSION } from './constants.js';
import { SignalingErrors, GeneralErrors } from './errors/generated.js';
import Log from './log.js';
import WSTransport from './wstransport.js';

// @ts-nocheck
const PSTREAM_VERSION = '1.6';
// In seconds
const MAX_RECONNECT_TIMEOUT_ALLOWED = 30;
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
class PStream extends EventEmitter {
    constructor(token, uris, options) {
        super();
        if (!(this instanceof PStream)) {
            return new PStream(token, uris, options);
        }
        const defaults = {
            TransportFactory: WSTransport,
        };
        options = options || {};
        for (const prop in defaults) {
            if (prop in options) {
                continue;
            }
            options[prop] = defaults[prop];
        }
        this.options = options;
        this.token = token || '';
        this.status = 'disconnected';
        this.gateway = null;
        this.region = null;
        this._messageQueue = [];
        this._preferredUri = null;
        this._uris = uris;
        this._handleTransportClose = this._handleTransportClose.bind(this);
        this._handleTransportError = this._handleTransportError.bind(this);
        this._handleTransportMessage = this._handleTransportMessage.bind(this);
        this._handleTransportOpen = this._handleTransportOpen.bind(this);
        this._log = new Log('PStream');
        // NOTE(mroberts): EventEmitter requires that we catch all errors.
        this.on('error', () => {
            this._log.warn('Unexpected error handled in pstream');
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
        const self = this;
        this.addListener('ready', () => {
            self.status = 'ready';
        });
        this.addListener('offline', () => {
            self.status = 'offline';
        });
        this.addListener('close', () => {
            self._log.info('Received "close" from server. Destroying PStream...');
            self._destroy();
        });
        this.transport = new this.options.TransportFactory(this._uris, {
            backoffMaxMs: this.options.backoffMaxMs,
            maxPreferredDurationMs: this.options.maxPreferredDurationMs,
        });
        Object.defineProperties(this, {
            uri: {
                enumerable: true,
                get() {
                    return this.transport.uri;
                },
            },
        });
        this.transport.on('close', this._handleTransportClose);
        this.transport.on('error', this._handleTransportError);
        this.transport.on('message', this._handleTransportMessage);
        this.transport.on('open', this._handleTransportOpen);
        this.transport.open();
        return this;
    }
}
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
                twilioError: new SignalingErrors.ConnectionDisconnected(),
            } });
        return;
    }
    // We receive some errors without call metadata (just the error). We need to convert these
    // to be contained within the 'error' field so that these errors match the expected format.
    this.emit('error', typeof error.code !== 'undefined' ? { error } : error);
};
PStream.prototype._handleTransportMessage = function (msg) {
    if (!msg || !msg.data || typeof msg.data !== 'string') {
        return;
    }
    const { type, payload = {} } = JSON.parse(msg.data);
    this.gateway = payload.gateway || this.gateway;
    this.region = payload.region || this.region;
    if (type === 'error' && payload.error) {
        payload.error.twilioError = new SignalingErrors.ConnectionError();
    }
    this.emit(type, payload);
};
PStream.prototype._handleTransportOpen = function () {
    this.status = 'connected';
    this.setToken(this.token);
    this.emit('transportOpen');
    const messages = this._messageQueue.splice(0, this._messageQueue.length);
    messages.forEach(message => this._publish(...message));
};
/**
 * @return {string}
 */
PStream.toString = () => '[Twilio.PStream class]';
PStream.prototype.toString = () => '[Twilio.PStream instance]';
PStream.prototype.setToken = function (token) {
    this._log.info('Setting token and publishing listen');
    this.token = token;
    let reconnectTimeout = 0;
    const t = this.options.maxPreferredDurationMs;
    this._log.info(`maxPreferredDurationMs:${t}`);
    if (typeof t === 'number' && t >= 0) {
        reconnectTimeout = Math.min(Math.ceil(t / 1000), MAX_RECONNECT_TIMEOUT_ALLOWED);
    }
    this._log.info(`reconnectTimeout:${reconnectTimeout}`);
    const payload = {
        browserinfo: getBrowserInfo(),
        reconnectTimeout,
        token,
    };
    this._publish('listen', payload);
};
PStream.prototype.sendMessage = function (callsid, content, contenttype = 'application/json', messagetype, voiceeventsid) {
    const payload = {
        callsid,
        content,
        contenttype,
        messagetype,
        voiceeventsid,
    };
    this._publish('message', payload, true);
};
PStream.prototype.register = function (mediaCapabilities) {
    const regPayload = { media: mediaCapabilities };
    // A queued register is replayed alongside `listen`, before the server
    // validates the token, and earns a 31204. Re-register on `connected` covers it.
    this._publish('register', regPayload, false);
};
PStream.prototype.invite = function (sdp, callsid, params) {
    const payload = {
        callsid,
        sdp,
        twilio: params ? { params } : {},
    };
    this._publish('invite', payload, true);
};
PStream.prototype.reconnect = function (sdp, callsid, reconnect) {
    const payload = {
        callsid,
        reconnect,
        sdp,
        twilio: {},
    };
    this._publish('invite', payload, true);
};
PStream.prototype.answer = function (sdp, callsid) {
    this._publish('answer', { sdp, callsid }, true);
};
PStream.prototype.dtmf = function (callsid, digits) {
    this._publish('dtmf', { callsid, dtmf: digits }, true);
};
PStream.prototype.hangup = function (callsid, message) {
    const payload = message ? { callsid, message } : { callsid };
    this._publish('hangup', payload, true);
};
PStream.prototype.reject = function (callsid) {
    this._publish('reject', { callsid }, true);
};
PStream.prototype.reinvite = function (sdp, callsid) {
    this._publish('reinvite', { sdp, callsid }, false);
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
    const msg = JSON.stringify({
        payload,
        type,
        version: PSTREAM_VERSION,
    });
    const isSent = !!this.transport.send(msg);
    if (!isSent) {
        this.emit('error', { error: {
                code: 31009,
                message: 'No transport available to send or receive messages',
                twilioError: new GeneralErrors.TransportError(),
            } });
        if (shouldRetry) {
            this._messageQueue.push([type, payload, true]);
        }
    }
};
function getBrowserInfo() {
    const nav = typeof navigator !== 'undefined' ? navigator : {};
    const info = {
        browser: {
            platform: nav.platform || 'unknown',
            userAgent: nav.userAgent || 'unknown',
        },
        p: 'browser',
        plugin: 'rtc',
        v: RELEASE_VERSION,
    };
    return info;
}

export { PStream as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHN0cmVhbS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9wc3RyZWFtLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIkMuUkVMRUFTRV9WRVJTSU9OIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTtBQU9BLE1BQU0sZUFBZSxHQUFHLEtBQUs7QUFFN0I7QUFDQSxNQUFNLDZCQUE2QixHQUFHLEVBQUU7QUFFeEM7Ozs7Ozs7Ozs7Ozs7O0FBY0c7QUFDSCxNQUFNLE9BQVEsU0FBUSxZQUFZLENBQUE7QUFDaEMsSUFBQSxXQUFBLENBQVksS0FBSyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUE7QUFDOUIsUUFBQSxLQUFLLEVBQUU7QUFFUCxRQUFBLElBQUksRUFBRSxJQUFJLFlBQVksT0FBTyxDQUFDLEVBQUU7WUFDOUIsT0FBTyxJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQztRQUMxQztBQUNBLFFBQUEsTUFBTSxRQUFRLEdBQUc7QUFDZixZQUFBLGdCQUFnQixFQUFFLFdBQVc7U0FDOUI7QUFDRCxRQUFBLE9BQU8sR0FBRyxPQUFPLElBQUksRUFBRTtBQUN2QixRQUFBLEtBQUssTUFBTSxJQUFJLElBQUksUUFBUSxFQUFFO0FBQzNCLFlBQUEsSUFBSSxJQUFJLElBQUksT0FBTyxFQUFFO2dCQUNuQjtZQUNGO1lBQ0EsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLFFBQVEsQ0FBQyxJQUFJLENBQUM7UUFDaEM7QUFDQSxRQUFBLElBQUksQ0FBQyxPQUFPLEdBQUcsT0FBTztBQUN0QixRQUFBLElBQUksQ0FBQyxLQUFLLEdBQUcsS0FBSyxJQUFJLEVBQUU7QUFDeEIsUUFBQSxJQUFJLENBQUMsTUFBTSxHQUFHLGNBQWM7QUFDNUIsUUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLElBQUk7QUFDbkIsUUFBQSxJQUFJLENBQUMsTUFBTSxHQUFHLElBQUk7QUFDbEIsUUFBQSxJQUFJLENBQUMsYUFBYSxHQUFH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
