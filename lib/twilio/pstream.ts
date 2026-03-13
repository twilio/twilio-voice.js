import { EventEmitter } from 'events';
import * as C from './constants';
import { GeneralErrors, SignalingErrors } from './errors';
import Log from './log';
import WSTransport from './wstransport';

const PSTREAM_VERSION = '1.6';

// In seconds
const MAX_RECONNECT_TIMEOUT_ALLOWED = 30;

interface PStreamOptions {
  TransportFactory?: any;
  backoffMaxMs?: number;
  maxPreferredDurationMs?: number;
  [key: string]: any;
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
  options: PStreamOptions;
  token: string;
  status: string;
  gateway: string | null;
  region: string | null;
  transport: any;
  _messageQueue: any[];
  _preferredUri: string | null;
  _uris: string[];
  _log: Log;

  get uri(): string {
    return this.transport.uri;
  }

  /**
   * @return {string}
   */
  static toString(): string {
    return '[Twilio.PStream class]';
  }

  constructor(token: string, uris: string[], options?: PStreamOptions) {
    super();

    const defaults: PStreamOptions = {
      TransportFactory: WSTransport,
    };
    options = options || {};
    for (const prop in defaults) {
      if (prop in options) {
        continue;
      }
      (options as any)[prop] = (defaults as any)[prop];
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

    this.transport.on('close', this._handleTransportClose);
    this.transport.on('error', this._handleTransportError);
    this.transport.on('message', this._handleTransportMessage);
    this.transport.on('open', this._handleTransportOpen);
    this.transport.open();
  }

  toString(): string {
    return '[Twilio.PStream instance]';
  }

  _handleTransportClose(): void {
    this.emit('transportClose');

    if (this.status !== 'disconnected') {
      if (this.status !== 'offline') {
        this.emit('offline', this);
      }
      this.status = 'disconnected';
    }
  }

  _handleTransportError(error: any): void {
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
  }

  _handleTransportMessage(msg: any): void {
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
  }

  _handleTransportOpen(): void {
    this.status = 'connected';
    this.setToken(this.token);

    this.emit('transportOpen');

    const messages = this._messageQueue.splice(0, this._messageQueue.length);
    messages.forEach((message: any[]) => this._publish(message[0], message[1], message[2]));
  }

  setToken(token: string): void {
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
  }

  sendMessage(
    callsid: string,
    content: string,
    contenttype: string = 'application/json',
    messagetype: string,
    voiceeventsid: string,
  ): void {
    const payload = {
      callsid,
      content,
      contenttype,
      messagetype,
      voiceeventsid,
    };
    this._publish('message', payload, true);
  }

  register(mediaCapabilities: any): void {
    const regPayload = { media: mediaCapabilities };
    this._publish('register', regPayload, true);
  }

  invite(sdp: string, callsid: string, params: any): void {
    const payload: any = {
      callsid,
      sdp,
      twilio: params ? { params } : {},
    };
    this._publish('invite', payload, true);
  }

  reconnect(sdp: string, callsid: string, reconnect: string): void {
    const payload = {
      callsid,
      reconnect,
      sdp,
      twilio: {},
    };
    this._publish('invite', payload, true);
  }

  answer(sdp: string, callsid: string): void {
    this._publish('answer', { sdp, callsid }, true);
  }

  dtmf(callsid: string, digits: string): void {
    this._publish('dtmf', { callsid, dtmf: digits }, true);
  }

  hangup(callsid: string, message?: any): void {
    const payload = message ? { callsid, message } : { callsid };
    this._publish('hangup', payload, true);
  }

  reject(callsid: string): void {
    this._publish('reject', { callsid }, true);
  }

  reinvite(sdp: string, callsid: string): void {
    this._publish('reinvite', { sdp, callsid }, false);
  }

  _destroy(): void {
    this.transport.removeListener('close', this._handleTransportClose);
    this.transport.removeListener('error', this._handleTransportError);
    this.transport.removeListener('message', this._handleTransportMessage);
    this.transport.removeListener('open', this._handleTransportOpen);
    this.transport.close();

    this.emit('offline', this);
  }

  destroy(): this {
    this._log.info('PStream.destroy() called...');
    this._destroy();
    return this;
  }

  updatePreferredURI(uri: string): void {
    this._preferredUri = uri;
    this.transport.updatePreferredURI(uri);
  }

  updateURIs(uris: string[]): void {
    this._uris = uris;
    this.transport.updateURIs(this._uris);
  }

  publish(type: string, payload: any): void {
    return this._publish(type, payload, true);
  }

  _publish(type: string, payload: any, shouldRetry?: boolean): void {
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
  }
}

function getBrowserInfo(): object {
  const nav: any = typeof navigator !== 'undefined' ? navigator : {};

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
