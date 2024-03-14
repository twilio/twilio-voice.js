/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
import { EventEmitter } from 'events';
import * as C from '../constants';
import { GeneralErrors, SignalingErrors } from '../errors';
import Log from '../log';
import WSTransport from './wstransport';

const PSTREAM_VERSION = '1.6';

// In seconds
const MAX_RECONNECT_TIMEOUT_ALLOWED = 30;

class PStream extends EventEmitter {
  constructor(token, uris, options) {
    super();
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

    const self = this;

    this.addListener('ready', () => {
      self._setStatus('ready');
    });

    this.addListener('offline', () => {
      self._setStatus('offline');
    });

    this.addListener('close', () => {
      self._log.info('Received "close" from server. Destroying PStream...');
      self._destroy();
    });

    this.transport = new this.options.TransportFactory(this._uris, {
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

PStream.prototype._handleTransportClose = function() {
  this.emit('transportClose');

  if (this.status !== 'disconnected') {
    if (this.status !== 'offline') {
      this.emit('offline', this);
    }
    this._setStatus('disconnected');
  }
};

PStream.prototype._handleTransportError = function(error) {
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
  this.emit('error', typeof error.code !== 'undefined' ?  { error } : error);
};

PStream.prototype._handleTransportMessage = function(msg) {
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

PStream.prototype._handleTransportOpen = function() {
  this._setStatus('connected');
  this.setToken(this.token);

  this.emit('transportOpen');

  const messages = this._messageQueue.splice(0, this._messageQueue.length);
  messages.forEach(message => this._publish(...message));
};

PStream.prototype._setStatus = function(status) {
  this.status = status;
  this.emit('status', status);
};

/**
 * @return {string}
 */
PStream.toString = () => '[Twilio.PStream class]';
PStream.prototype.toString = () => '[Twilio.PStream instance]';

PStream.prototype.setToken = function(token) {
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

PStream.prototype.sendMessage = function(callsid, content, contenttype = 'application/json', messagetype, voiceeventsid) {
  const payload = {
    callsid,
    content,
    contenttype,
    messagetype,
    voiceeventsid,
  };
  this._publish('message', payload, true);
};

PStream.prototype.register = function(mediaCapabilities) {
  const regPayload = { media: mediaCapabilities };
  this._publish('register', regPayload, true);
};

PStream.prototype.invite = function(sdp, callsid, preflight, params) {
  const payload = {
    callsid,
    preflight: !!preflight,
    sdp,
    twilio: params ? { params } : {},
  };
  this._publish('invite', payload, true);
};

PStream.prototype.reconnect = function(sdp, callsid, reconnect, params) {
  const payload = {
    callsid,
    preflight: false,
    reconnect,
    sdp,
    twilio: params ? { params } : {},
  };
  this._publish('invite', payload, true);
};

PStream.prototype.answer = function(sdp, callsid) {
  this._publish('answer', { sdp, callsid }, true);
};

PStream.prototype.dtmf = function(callsid, digits) {
  this._publish('dtmf', { callsid, dtmf: digits }, true);
};

PStream.prototype.hangup = function(callsid, message) {
  const payload = message ? { callsid, message } : { callsid };
  this._publish('hangup', payload, true);
};

PStream.prototype.reject = function(callsid) {
  this._publish('reject', { callsid }, true);
};

PStream.prototype.reinvite = function(sdp, callsid) {
  this._publish('reinvite', { sdp, callsid }, false);
};

PStream.prototype._destroy = function() {
  this.transport.removeListener('close', this._handleTransportClose);
  this.transport.removeListener('error', this._handleTransportError);
  this.transport.removeListener('message', this._handleTransportMessage);
  this.transport.removeListener('open', this._handleTransportOpen);
  this.transport.close();

  this.emit('offline', this);
};

PStream.prototype.destroy = function() {
  this._log.info('PStream.destroy() called...');
  this._destroy();
  return this;
};

PStream.prototype.updatePreferredURI = function(uri) {
  this._preferredUri = uri;
  this.transport.updatePreferredURI(uri);
};

PStream.prototype.updateURIs = function(uris) {
  this._uris = uris;
  this.transport.updateURIs(this._uris);
};

PStream.prototype.publish = function(type, payload) {
  return this._publish(type, payload, true);
};

PStream.prototype._publish = function(type, payload, shouldRetry) {
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