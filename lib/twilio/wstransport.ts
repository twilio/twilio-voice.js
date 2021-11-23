/**
 * @packageDocumentation
 * @module Tools
 * @internalapi
 */

import { EventEmitter } from 'events';
import * as WebSocket from 'ws';
import { SignalingErrors } from './errors';
import Log from './log';

// tslint:disable-next-line
const Backoff = require('backoff');

const CONNECT_SUCCESS_TIMEOUT = 10000;
const CONNECT_TIMEOUT = 5000;
const HEARTBEAT_TIMEOUT = 15000;
const MAX_PREFERRED_URI_CONNECT_ATTEMPTS = 5;

export interface IMessageEvent {
  data: string;
  target: WebSocket;
  type: string;
}

/**
 * All possible states of WSTransport.
 */
export enum WSTransportState {
  /**
   * The WebSocket is not open but is trying to connect.
   */
  Connecting = 'connecting',

  /**
   * The WebSocket is not open and is not trying to connect.
   */
  Closed = 'closed',

  /**
   * The underlying WebSocket is open and active.
   */
  Open = 'open',
}

/**
 * Options to be passed to the WSTransport constructor.
 */
export interface IWSTransportConstructorOptions {
  /**
   * Maximum time to wait before attempting to reconnect the signaling websocket.
   * Default is 20000ms. Minimum is 3000ms.
   */
  backoffMaxMs?: number;

  /**
   * Time in milliseconds before websocket times out when attempting to connect
   */
  connectTimeoutMs?: number;

  /**
   * Max attempts on a preferred URI.
   */
  maxPreferredURIConnectAttempts?: number;

  /**
   * A WebSocket factory to use instead of WebSocket.
   */
  WebSocket?: any;
}

/**
 * WebSocket Transport
 */
export default class WSTransport extends EventEmitter {
  /**
   * The current state of the WSTransport.
   */
  state: WSTransportState = WSTransportState.Closed;

  /**
   * The backoff instance used to schedule reconnection attempts.
   */
  private readonly _backoff: any;

  /**
   * The currently connected uri
   */
  private _connectedUri: string;

  /**
   * The current connection timeout. If it times out, we've failed to connect
   * and should try again.
   *
   * We use any here because NodeJS returns a Timer and browser returns a number
   * and one can't be cast to the other, despite their working interoperably.
   */
  private _connectTimeout?: any;

  /**
   * Time in milliseconds before websocket times out when attempting to connect
   */
  private _connectTimeoutMs?: number;

  /**
   * The current connection timeout. If it times out, we've failed to connect
   * and should try again.
   *
   * We use any here because NodeJS returns a Timer and browser returns a number
   * and one can't be cast to the other, despite their working interoperably.
   */
  private _heartbeatTimeout?: any;

  /**
   * An instance of Logger to use.
   */
  private _log: Log = Log.getInstance();

  /**
   * Max attempts on a preferred URI.
   */
  private _maxPreferredURIConnectAttempts: number;

  /**
   * Preferred URI endpoint to connect to.
   */
  private _preferredUri: string | null;

  /**
   * Previous state of the connection
   */
  private _previousState: WSTransportState;

  /**
   * Whether we should attempt to fallback if we receive an applicable error
   * when trying to connect to a signaling endpoint.
   */
  private _shouldFallback: boolean = false;

  /**
   * The currently connecting or open WebSocket.
   */
  private _socket?: WebSocket;

  /**
   * The time the active connection was opened.
   */
  private _timeOpened?: number;

  /**
   * The current uri index that the transport is connected to.
   */
  private _uriIndex: number = 0;

  /**
   * List of URI of the endpoints to connect to.
   */
  private _uris: string[];

  /**
   * The constructor to use for WebSocket
   */
  private readonly _WebSocket: typeof WebSocket;

  /**
   * @constructor
   * @param uris - List of URI of the endpoints to connect to.
   * @param [options] - Constructor options.
   */
  constructor(uris: string[], options: IWSTransportConstructorOptions = { }) {
    super();

    this._connectTimeoutMs = options.connectTimeoutMs || CONNECT_TIMEOUT;
    this._maxPreferredURIConnectAttempts =
      options.maxPreferredURIConnectAttempts || MAX_PREFERRED_URI_CONNECT_ATTEMPTS;

    let initialDelay = 100;
    if (uris && uris.length > 1) {
      // We only want a random initial delay if there are any fallback edges
      // Initial delay between 1s and 5s both inclusive
      initialDelay = Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000;
    }

    const backoffConfig = {
      factor: 2.0,
      initialDelay,
      maxDelay: typeof options.backoffMaxMs === 'number'
        ? Math.max(options.backoffMaxMs, 3000)
        : 20000,
      randomisationFactor: 0.40,
    };

    this._log.info('Initializing transport backoff using config: ', backoffConfig);
    this._backoff = Backoff.exponential(backoffConfig);

    this._uris = uris;
    this._connectedUri = uris[0];
    this._WebSocket = options.WebSocket || WebSocket;

    // Called when a backoff timer is started.
    this._backoff.on('backoff', (_: any, delay: number) => {
      if (this.state === WSTransportState.Closed) { return; }
      this._log.info(`Will attempt to reconnect WebSocket in ${delay}ms`);
    });

    // Called when a backoff timer ends. We want to try to reconnect
    // the WebSocket at this point.
    this._backoff.on('ready', (attempt: number) => {
      if (this.state === WSTransportState.Closed) { return; }
      this._connect(attempt + 1);
    });
  }

  /**
   * Close the WebSocket, and don't try to reconnect.
   */
  close(): void {
    this._log.info('WSTransport.close() called...');
    this._close();
  }

  /**
   * Attempt to open a WebSocket connection.
   */
  open(): void {
    this._log.info('WSTransport.open() called...');

    if (this._socket &&
        (this._socket.readyState === WebSocket.CONNECTING ||
        this._socket.readyState === WebSocket.OPEN)) {
      this._log.info('WebSocket already open.');
      return;
    }

    this._connect();
  }

  /**
   * Send a message through the WebSocket connection.
   * @param message - A message to send to the endpoint.
   * @returns Whether the message was sent.
   */
  send(message: string): boolean {
    // We can't send the message if the WebSocket isn't open
    if (!this._socket || this._socket.readyState !== WebSocket.OPEN) {
      return false;
    }

    try {
      this._socket.send(message);
    } catch (e) {
      // Some unknown error occurred. Reset the socket to get a fresh session.
      this._log.info('Error while sending message:', e.message);
      this._closeSocket();
      return false;
    }

    return true;
  }

  /**
   * Update the preferred URI to connect to. Useful for Call signaling
   * reconnection, which requires connecting on the same edge. If `null` is
   * passed, the preferred URI is unset and the original `uris` array and
   * `uriIndex` is used to determine the signaling URI to connect to.
   * @param uri
   */
  updatePreferredURI(uri: string | null) {
    this._preferredUri = uri;
  }

  /**
   * Update acceptable URIs to reconnect to. Resets the URI index to 0.
   */
  updateURIs(uris: string[] | string) {
    if (typeof uris === 'string') {
      uris = [uris];
    }

    this._uris = uris;
    this._uriIndex = 0;
  }

  /**
   * Close the WebSocket, and don't try to reconnect.
   */
  private _close(): void {
    this._setState(WSTransportState.Closed);
    this._closeSocket();
  }

  /**
   * Close the WebSocket and remove all event listeners.
   */
  private _closeSocket(): void {
    clearTimeout(this._connectTimeout);
    clearTimeout(this._heartbeatTimeout);

    this._log.info('Closing and cleaning up WebSocket...');

    if (!this._socket) {
      this._log.info('No WebSocket to clean up.');
      return;
    }

    this._socket.removeEventListener('close', this._onSocketClose as any);
    this._socket.removeEventListener('error', this._onSocketError as any);
    this._socket.removeEventListener('message', this._onSocketMessage as any);
    this._socket.removeEventListener('open', this._onSocketOpen as any);

    if (this._socket.readyState === WebSocket.CONNECTING ||
        this._socket.readyState === WebSocket.OPEN) {
      this._socket.close();
    }

    // Reset backoff counter if connection was open for long enough to be considered successful
    if (this._timeOpened && Date.now() - this._timeOpened > CONNECT_SUCCESS_TIMEOUT) {
      this._backoff.reset();
    }

    this._backoff.backoff();
    delete this._socket;

    this.emit('close');
  }

  /**
   * Attempt to connect to the endpoint via WebSocket.
   * @param [retryCount] - Retry number, if this is a retry. Undefined if
   *   first attempt, 1+ if a retry.
   */
  private _connect(retryCount?: number): void {
    if (retryCount) {
      this._log.info(`Attempting to reconnect (retry #${retryCount})...`);
      if (this._preferredUri && retryCount > this._maxPreferredURIConnectAttempts) {
        this._log.info(`Too many attempts on preferred URI, reverting to URI array...`);
        this.updatePreferredURI(null);
      }
    } else {
      this._log.info('Attempting to connect...');
    }

    this._closeSocket();

    this._setState(WSTransportState.Connecting);
    let socket = null;
    this._connectedUri = this._preferredUri || this._uris[this._uriIndex];
    try {
      socket = new this._WebSocket(this._connectedUri);
    } catch (e) {
      this._log.info('Could not connect to endpoint:', e.message);
      this._close();
      this.emit('error', {
        code: 31000,
        message: e.message || `Could not connect to ${this._connectedUri}`,
        twilioError: new SignalingErrors.ConnectionDisconnected(),
      });
      return;
    }

    delete this._timeOpened;
    this._connectTimeout = setTimeout(() => {
      this._log.info('WebSocket connection attempt timed out.');
      this._moveUriIndex();
      this._closeSocket();
    }, this._connectTimeoutMs);

    socket.addEventListener('close', this._onSocketClose as any);
    socket.addEventListener('error', this._onSocketError as any);
    socket.addEventListener('message', this._onSocketMessage as any);
    socket.addEventListener('open', this._onSocketOpen as any);
    this._socket = socket;
  }

  /**
   * Move the uri index to the next index
   * If the index is at the end, the index goes back to the first one.
   */
  private _moveUriIndex = (): void => {
    this._uriIndex++;
    if (this._uriIndex >= this._uris.length) {
      this._uriIndex = 0;
    }
  }

  /**
   * Called in response to WebSocket#close event.
   */
  private _onSocketClose = (event: CloseEvent): void => {
    this._log.info(`Received websocket close event code: ${event.code}. Reason: ${event.reason}`);
    // 1006: Abnormal close. When the server is unreacheable
    // 1015: TLS Handshake error
    if (event.code === 1006 || event.code === 1015) {
      this.emit('error', {
        code: 31005,
        message: event.reason ||
          'Websocket connection to Twilio\'s signaling servers were ' +
          'unexpectedly ended. If this is happening consistently, there may ' +
          'be an issue resolving the hostname provided. If a region or an ' +
          'edge is being specified in Device setup, ensure it is valid.',
        twilioError: new SignalingErrors.ConnectionError(),
      });

      const wasConnected = (
        // Only in Safari and certain Firefox versions, on network interruption, websocket drops right away with 1006
        // Let's check current state if it's open, meaning we should not fallback
        // because we're coming from a previously connected session
        this.state === WSTransportState.Open ||

        // But on other browsers, websocket doesn't drop
        // but our heartbeat catches it, setting the internal state to "Connecting".
        // With this, we should check the previous state instead.
        this._previousState === WSTransportState.Open
      );

      // Only fallback if this is not the first error
      // and if we were not connected previously
      if (this._shouldFallback || !wasConnected) {
        this._moveUriIndex();
      }

      this._shouldFallback = true;
    }
    this._closeSocket();
  }

  /**
   * Called in response to WebSocket#error event.
   */
  private _onSocketError = (err: Error): void => {
    this._log.info(`WebSocket received error: ${err.message}`);
    this.emit('error', {
      code: 31000,
      message: err.message || 'WSTransport socket error',
      twilioError: new SignalingErrors.ConnectionDisconnected(),
    });
  }

  /**
   * Called in response to WebSocket#message event.
   */
  private _onSocketMessage = (message: IMessageEvent): void => {
    // Clear heartbeat timeout on any incoming message, as they
    // all indicate an active connection.
    this._setHeartbeatTimeout();

    // Filter and respond to heartbeats
    if (this._socket && message.data === '\n') {
      this._socket.send('\n');
      return;
    }

    this.emit('message', message);
  }

  /**
   * Called in response to WebSocket#open event.
   */
  private _onSocketOpen = (): void => {
    this._log.info('WebSocket opened successfully.');
    this._timeOpened = Date.now();
    this._shouldFallback = false;
    this._setState(WSTransportState.Open);
    clearTimeout(this._connectTimeout);

    this._setHeartbeatTimeout();
    this.emit('open');
  }

  /**
   * Set a timeout to reconnect after HEARTBEAT_TIMEOUT milliseconds
   *   have passed without receiving a message over the WebSocket.
   */
  private _setHeartbeatTimeout(): void {
    clearTimeout(this._heartbeatTimeout);
    this._heartbeatTimeout = setTimeout(() => {
      this._log.info(`No messages received in ${HEARTBEAT_TIMEOUT / 1000} seconds. Reconnecting...`);
      this._shouldFallback = true;
      this._closeSocket();
    }, HEARTBEAT_TIMEOUT);
  }

  /**
   * Set the current and previous state
   */
  private _setState(state: WSTransportState): void {
    this._previousState = this.state;
    this.state = state;
  }

  /**
   * The uri the transport is currently connected to
   */
  get uri(): string {
    return this._connectedUri;
  }
}
