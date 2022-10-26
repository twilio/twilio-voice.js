'use strict';

function _toConsumableArray(arr) { if (Array.isArray(arr)) { for (var i = 0, arr2 = Array(arr.length); i < arr.length; i++) { arr2[i] = arr[i]; } return arr2; } else { return Array.from(arr); } }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

function _possibleConstructorReturn(self, call) { if (!self) { throw new ReferenceError("this hasn't been initialised - super() hasn't been called"); } return call && (typeof call === "object" || typeof call === "function") ? call : self; }

function _inherits(subClass, superClass) { if (typeof superClass !== "function" && superClass !== null) { throw new TypeError("Super expression must either be null or a function, not " + typeof superClass); } subClass.prototype = Object.create(superClass && superClass.prototype, { constructor: { value: subClass, enumerable: false, writable: true, configurable: true } }); if (superClass) Object.setPrototypeOf ? Object.setPrototypeOf(subClass, superClass) : subClass.__proto__ = superClass; }

var C = require('./constants');
var EventEmitter = require('events').EventEmitter;
var Log = require('./log').default;

var WSTransport = require('./wstransport').default;

var _require = require('./errors'),
    GeneralErrors = _require.GeneralErrors,
    SignalingErrors = _require.SignalingErrors;

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

var PStream = function (_EventEmitter) {
  _inherits(PStream, _EventEmitter);

  function PStream(token, uris, options) {
    var _ret2;

    _classCallCheck(this, PStream);

    var _this = _possibleConstructorReturn(this, (PStream.__proto__ || Object.getPrototypeOf(PStream)).call(this));

    if (!(_this instanceof PStream)) {
      var _ret;

      return _ret = new PStream(token, uris, options), _possibleConstructorReturn(_this, _ret);
    }
    var defaults = {
      TransportFactory: WSTransport
    };
    options = options || {};
    for (var prop in defaults) {
      if (prop in options) continue;
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

    _this._log = Log.getInstance();

    // NOTE(mroberts): EventEmitter requires that we catch all errors.
    _this.on('error', function () {});

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
      maxPreferredDurationMs: _this.options.maxPreferredDurationMs
    });

    Object.defineProperties(_this, {
      uri: {
        enumerable: true,
        get: function get() {
          return this.transport.uri;
        }
      }
    });

    _this.transport.on('close', _this._handleTransportClose);
    _this.transport.on('error', _this._handleTransportError);
    _this.transport.on('message', _this._handleTransportMessage);
    _this.transport.on('open', _this._handleTransportOpen);
    _this.transport.open();

    return _ret2 = _this, _possibleConstructorReturn(_this, _ret2);
  }

  return PStream;
}(EventEmitter);

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
  var _this2 = this;

  this.status = 'connected';
  this.setToken(this.token);

  this.emit('transportOpen');

  var messages = this._messageQueue.splice(0, this._messageQueue.length);
  messages.forEach(function (message) {
    return _this2._publish.apply(_this2, _toConsumableArray(message));
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

PStream.prototype.reconnect = function (sdp, callsid, reconnect, params) {
  var payload = {
    callsid: callsid,
    sdp: sdp,
    reconnect: reconnect,
    preflight: false,
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