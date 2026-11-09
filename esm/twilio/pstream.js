import { EventEmitter } from 'events';
import { RELEASE_VERSION } from './constants.js';
import { SignalingErrors, GeneralErrors } from './errors/generated.js';
import Log from './log.js';
import WSTransport from './wstransport.js';

// @ts-nocheck
const PSTREAM_VERSION = '1.6';
// In seconds
const MAX_RECONNECT_TIMEOUT_ALLOWED = 30;
// Non-enumerable mark on 'error' payloads raised because the transport failed
// (socket error or abnormal close, or no transport to send on), as opposed to
// an error message received from the signaling server.
const TRANSPORT_ERROR_MARK = '_isTransportError';
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
        /**
         * The signaling connection id (`payload.connectionId`) received in the
         * most recent `connected` message on the current WebSocket, or `null` if
         * none has been received since the transport last closed. Cleared after
         * 'transportClose' listeners run and before 'offline' is emitted (or on
         * destroy), so a replacement connection never inherits the previous id.
         * @type {string|null}
         */
        this.signalingConnectionId = null;
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
        this.lastClosedSignalingConnectionId = null;
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
        this._log.info(`Clearing signaling connection id: ${this.signalingConnectionId}`);
    }
    this.signalingConnectionId = null;
};
PStream.prototype._updateSignalingConnectionId = function (signalingConnectionId) {
    if (typeof signalingConnectionId !== 'string' || signalingConnectionId === this.signalingConnectionId) {
        return;
    }
    this._log.info(`Setting signaling connection id: ${signalingConnectionId}`);
    this.signalingConnectionId = signalingConnectionId;
};
PStream.prototype._handleTransportError = function (error) {
    if (!error) {
        this.emit('error', markTransportErrorPayload({ error: {
                code: 31000,
                message: 'Websocket closed without a provided reason',
                twilioError: new SignalingErrors.ConnectionDisconnected(),
            } }));
        return;
    }
    // We receive some errors without call metadata (just the error). We need to convert these
    // to be contained within the 'error' field so that these errors match the expected format.
    this.emit('error', markTransportErrorPayload(typeof error.code !== 'undefined' ? { error } : error));
};
PStream.prototype._handleTransportMessage = function (msg) {
    if (!msg || !msg.data || typeof msg.data !== 'string') {
        return;
    }
    const { type, payload = {} } = JSON.parse(msg.data);
    this.gateway = payload.gateway || this.gateway;
    this.region = payload.region || this.region;
    if (type === 'connected') {
        // A new connection is established: the dropped one no longer applies.
        this.lastClosedSignalingConnectionId = null;
        this._updateSignalingConnectionId(payload.connectionId);
    }
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
    const msg = JSON.stringify({
        payload,
        type,
        version: PSTREAM_VERSION,
    });
    const isSent = !!this.transport.send(msg);
    if (!isSent) {
        this.emit('error', markTransportErrorPayload({ error: {
                code: 31009,
                message: 'No transport available to send or receive messages',
                twilioError: new GeneralErrors.TransportError(),
            } }));
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

export { PStream as default, isTransportErrorPayload, markTransportErrorPayload };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHN0cmVhbS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9wc3RyZWFtLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIkMuUkVMRUFTRV9WRVJTSU9OIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTtBQU9BLE1BQU0sZUFBZSxHQUFHLEtBQUs7QUFFN0I7QUFDQSxNQUFNLDZCQUE2QixHQUFHLEVBQUU7QUFFeEM7QUFDQTtBQUNBO0FBQ0EsTUFBTSxvQkFBb0IsR0FBRyxtQkFBbUI7QUFFaEQ7Ozs7QUFJRztBQUNHLFNBQVUseUJBQXlCLENBQUMsT0FBTyxFQUFBO0FBQy9DLElBQUEsSUFBSSxPQUFPLElBQUksT0FBTyxPQUFPLEtBQUssUUFBUSxFQUFFO0FBQzFDLFFBQUEsTUFBTSxDQUFDLGNBQWMsQ0FBQyxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsRUFBRSxLQUFLLEVBQUUsSUFBSSxFQUFFLENBQUM7SUFDdkU7QUFDQSxJQUFBLE9BQU8sT0FBTztBQUNoQjtBQUVBOzs7QUFHRztBQUNHLFNBQVUsdUJBQXVCLENBQUMsT0FBTyxFQUFBO0FBQzdDLElBQUEsT0FBTyxDQUFDLENBQUMsT0FBTyxJQUFJLE9BQU8sT0FBTyxLQUFLLFFBQVEsSUFBSSxPQUFPLENBQUMsb0JBQW9CLENBQUMsS0FBSyxJQUFJO0FBQzNGO0FBRUE7Ozs7Ozs7Ozs7Ozs7O0FBY0c7QUFDSCxNQUFNLE9BQVEsU0FBUSxZQUFZLENBQUE7QUFDaEMsSUFBQSxXQUFBLENBQVksS0FBSyxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUE7QUFDOUIsUUFBQSxLQUFLLEVBQUU7QUFFUCxRQUFBLElBQUksRUFBRSxJQUFJLFlBQVksT0FBTyxDQUFDLEVBQUU7WUFDOUIsT0FBTyxJQUFJLE9BQU8sQ0FBQyxLQUFLLEVBQUUsSUFBSSxFQUFFLE9BQU8sQ0FBQztRQUMxQztBQUNBLFFBQUEsTUFBTSxRQUFRLEdBQUc7QUFDZixZQUFBLGdCQUFnQixFQUFFLFdBQVc7U0FDOUI7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
