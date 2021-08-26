'use strict';

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

var C = require('./constants');
var EventEmitter = require('events').EventEmitter;
var Log = require('./log').default;
var util = require('util');

var WSTransport = require('./wstransport').default;

var _require = require('./errors'),
    GeneralErrors = _require.GeneralErrors,
    SignalingErrors = _require.SignalingErrors;

var PSTREAM_VERSION = '1.5';

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
function PStream(token, uris, options) {
  if (!(this instanceof PStream)) {
    return new PStream(token, uris, options);
  }
  var defaults = {
    TransportFactory: WSTransport
  };
  options = options || {};
  for (var prop in defaults) {
    if (prop in options) continue;
    options[prop] = defaults[prop];
  }
  this.options = options;
  this.token = token || '';
  this.status = 'disconnected';
  this.gateway = null;
  this.region = null;
  this._messageQueue = [];
  this._uris = uris;

  this._handleTransportClose = this._handleTransportClose.bind(this);
  this._handleTransportError = this._handleTransportError.bind(this);
  this._handleTransportMessage = this._handleTransportMessage.bind(this);
  this._handleTransportOpen = this._handleTransportOpen.bind(this);

  this._log = Log.getInstance();

  // NOTE(mroberts): EventEmitter requires that we catch all errors.
  this.on('error', function () {});

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

  var self = this;

  this.addListener('ready', function () {
    self.status = 'ready';
  });

  this.addListener('offline', function () {
    self.status = 'offline';
  });

  this.addListener('close', function () {
    self._log.info('Received "close" from server. Destroying PStream...');
    self._destroy();
  });

  this.transport = new this.options.TransportFactory(this._uris, {
    backoffMaxMs: this.options.backoffMaxMs
  });

  Object.defineProperties(this, {
    uri: {
      enumerable: true,
      get: function get() {
        return this.transport.uri;
      }
    }
  });

  this.transport.on('close', this._handleTransportClose);
  this.transport.on('error', this._handleTransportError);
  this.transport.on('message', this._handleTransportMessage);
  this.transport.on('open', this._handleTransportOpen);
  this.transport.open();

  return this;
}

util.inherits(PStream, EventEmitter);

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
        twilioError: new SignalingErrors.ConnectionDisconnected()
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

  var _JSON$parse = JSON.parse(msg.data),
      type = _JSON$parse.type,
      _JSON$parse$payload = _JSON$parse.payload,
      payload = _JSON$parse$payload === undefined ? {} : _JSON$parse$payload;

  this.gateway = payload.gateway || this.gateway;
  this.region = payload.region || this.region;

  if (type === 'error' && payload.error) {
    payload.error.twilioError = new SignalingErrors.ConnectionError();
  }

  this.emit(type, payload);
};

PStream.prototype._handleTransportOpen = function () {
  var _this = this;

  this.status = 'connected';
  this.setToken(this.token);

  var messages = this._messageQueue.splice(0, this._messageQueue.length);
  messages.forEach(function (message) {
    return _this._publish.apply(_this, _toConsumableArray(message));
  });
};

/**
 * @return {string}
 */
PStream.toString = function () {
  return '[Twilio.PStream class]';
};
PStream.prototype.toString = function () {
  return '[Twilio.PStream instance]';
};

PStream.prototype.setToken = function (token) {
  this._log.info('Setting token and publishing listen');
  this.token = token;
  var payload = {
    token: token,
    browserinfo: getBrowserInfo()
  };
  this._publish('listen', payload);
};

PStream.prototype.register = function (mediaCapabilities) {
  var regPayload = {
    media: mediaCapabilities
  };
  this._publish('register', regPayload, true);
};

PStream.prototype.invite = function (sdp, callsid, preflight, params) {
  var payload = {
    callsid: callsid,
    sdp: sdp,
    preflight: !!preflight,
    twilio: params ? { params: params } : {}
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

PStream.prototype.publish = function (type, payload) {
  return this._publish(type, payload, true);
};

PStream.prototype._publish = function (type, payload, shouldRetry) {
  var msg = JSON.stringify({
    type: type,
    version: PSTREAM_VERSION,
    payload: payload
  });
  var isSent = !!this.transport.send(msg);

  if (!isSent) {
    this.emit('error', { error: {
        code: 31009,
        message: 'No transport available to send or receive messages',
        twilioError: new GeneralErrors.TransportError()
      } });

    if (shouldRetry) {
      this._messageQueue.push([type, payload, true]);
    }
  }
};

function getBrowserInfo() {
  var nav = typeof navigator !== 'undefined' ? navigator : {};

  var info = {
    p: 'browser',
    v: C.RELEASE_VERSION,
    browser: {
      userAgent: nav.userAgent || 'unknown',
      platform: nav.platform || 'unknown'
    },
    plugin: 'rtc'
  };

  return info;
}

module.exports = PStream;