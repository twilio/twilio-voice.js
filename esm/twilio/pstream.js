/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
import { EventEmitter } from 'events';
import * as C from './constants';
import { GeneralErrors, SignalingErrors } from './errors';
import Log from './log';
import WSTransport from './wstransport';
const PSTREAM_VERSION = '1.6';
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
    const payload = {
        browserinfo: getBrowserInfo(),
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
    this._publish('register', regPayload, true);
};
PStream.prototype.invite = function (sdp, callsid, preflight, params) {
    const payload = {
        callsid,
        preflight: !!preflight,
        sdp,
        twilio: params ? { params } : {},
    };
    this._publish('invite', payload, true);
};
PStream.prototype.reconnect = function (sdp, callsid, reconnect, params) {
    const payload = {
        callsid,
        preflight: false,
        reconnect,
        sdp,
        twilio: params ? { params } : {},
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
        v: C.RELEASE_VERSION,
    };
    return info;
}
export default PStream;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicHN0cmVhbS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vcHN0cmVhbS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7OztHQUlHO0FBQ0gsY0FBYztBQUNkLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDdEMsT0FBTyxLQUFLLENBQUMsTUFBTSxhQUFhLENBQUM7QUFDakMsT0FBTyxFQUFFLGFBQWEsRUFBRSxlQUFlLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFDMUQsT0FBTyxHQUFHLE1BQU0sT0FBTyxDQUFDO0FBQ3hCLE9BQU8sV0FBVyxNQUFNLGVBQWUsQ0FBQztBQUV4QyxNQUFNLGVBQWUsR0FBRyxLQUFLLENBQUM7QUFFOUI7Ozs7Ozs7Ozs7Ozs7O0dBY0c7QUFDSCxNQUFNLE9BQVEsU0FBUSxZQUFZO0lBQ2hDLFlBQVksS0FBSyxFQUFFLElBQUksRUFBRSxPQUFPO1FBQzlCLEtBQUssRUFBRSxDQUFDO1FBRVIsSUFBSSxDQUFDLENBQUMsSUFBSSxZQUFZLE9BQU8sQ0FBQyxFQUFFO1lBQzlCLE9BQU8sSUFBSSxPQUFPLENBQUMsS0FBSyxFQUFFLElBQUksRUFBRSxPQUFPLENBQUMsQ0FBQztTQUMxQztRQUNELE1BQU0sUUFBUSxHQUFHO1lBQ2YsZ0JBQWdCLEVBQUUsV0FBVztTQUM5QixDQUFDO1FBQ0YsT0FBTyxHQUFHLE9BQU8sSUFBSSxFQUFFLENBQUM7UUFDeEIsS0FBSyxNQUFNLElBQUksSUFBSSxRQUFRLEVBQUU7WUFDM0IsSUFBSSxJQUFJLElBQUksT0FBTyxFQUFFO2dCQUNuQixTQUFTO2FBQ1Y7WUFDRCxPQUFPLENBQUMsSUFBSSxDQUFDLEdBQUcsUUFBUSxDQUFDLElBQUksQ0FBQyxDQUFDO1NBQ2hDO1FBQ0QsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7UUFDdkIsSUFBSSxDQUFDLEtBQUssR0FBRyxLQUFLLElBQUksRUFBRSxDQUFDO1FBQ3pCLElBQUks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