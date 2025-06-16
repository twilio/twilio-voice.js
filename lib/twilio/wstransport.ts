import { EventEmitter } from 'events';
import Backoff from './backoff';
import { SignalingErrors } from './errors';
import Log from './log';

const WebSocket = globalThis.WebSocket;

const CONNECT_SUCCESS_TIMEOUT = 10000;
const CONNECT_TIMEOUT = 5000;
const HEARTBEAT_TIMEOUT = 15000;
const MAX_PREFERRED_DURATION = 15000;
const MAX_PRIMARY_DURATION = Infinity;
const MAX_PREFERRED_DELAY = 1000;
const MAX_PRIMARY_DELAY = 20000;

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
   * Time in milliseconds before websocket times out when attempting to connect
   */
  connectTimeoutMs?: number;

  /**
   * The maximum delay for the preferred backoff to make a connection attempt.
   */
  maxPreferredDelayMs?: number;

  /**
   * Max duration to attempt connecting to a preferred URI.
   */
  maxPreferredDurationMs?: number;

  /**
   * The maximum delay for the rimary backoff to make a connection attempt.
   */
  maxPrimaryDelayMs?: number;

  /**
   * Max duration to attempt connecting to a preferred URI.
   */
  maxPrimaryDurationMs?: number;

  /**
   * A WebSocket factory to use instead of WebSocket.
   */
  WebSocket?: typeof WebSocket;
}

/**
 * Type of the stored options property internally used by the WSTransport class.
 */
type IInternalWSTransportConstructorOptions = Required<IWSTransportConstructorOptions>;

/**
 * WebSocket Transport
 */
export default class WSTransport extends EventEmitter {
  private static defaultConstructorOptions: IInternalWSTransportConstructorOptions = {
    WebSocket,
    connectTimeoutMs: CONNECT_TIMEOUT,
    maxPreferredDelayMs: MAX_PREFERRED_DELAY,
    maxPreferredDurationMs: MAX_PREFERRED_DURATION,
    maxPrimaryDelayMs: MAX_PRIMARY_DELAY,
    maxPrimaryDurationMs: MAX_PRIMARY_DURATION,
  };

  /**
   * The current state of the WSTransport.
   */
  state: WSTransportState = WSTransportState.Closed;

  /**
   * The backoff instance used to schedule reconnection attempts.
   */
  private readonly _backoff: {
    preferred: any;
    primary: any;
  };

  /**
   * Start timestamp values for backoffs.
   */
  private _backoffStartTime: {
    preferred: number | null;
    primary: number | null;
  } = {
    preferred: null,
    primary: null,
  };

  /**
   * The URI that the transport is connecting or connected to. The value of this
   * property is `null` if a connection attempt has not been made yet.
   */
  private _connectedUri: string | null = null;

  /**
   * The current connection timeout. If it times out, we've failed to connect
   * and should try again.
   *
   * We use any here because NodeJS returns a Timer and browser returns a number
   * and one can't be cast to the other, despite their working interoperably.
   */
  private _connectTimeout?: any;

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
  private _log: Log = new Log('WSTransport');

  /**
   * Options after missing values are defaulted.
   */
  private _options: IInternalWSTransportConstructorOptions;

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
   * @constructor
   * @param uris - List of URI of the endpoints to connect to.
   * @param [options] - Constructor options.
   */
  constructor(uris: string[], options: IWSTransportConstructorOptions = { }) {
    super();

    this._options = { ...WSTransport.defaultConstructorOptions, ...options };

    this._uris = uris;

    this._backoff = this._setupBackoffs();
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

    if (this._preferredUri) {
      this._connect(this._preferredUri);
    } else {
      this._connect(this._uris[this._uriIndex]);
    }
  }

  /**
   * Send a message through the WebSocket connection.
   * @param message - A message to send to the endpoint.
   * @returns Whether the message was sent.
   */
  send(message: string): boolean {
    this._log.debug(`Sending: ${message}`);
    // We can't send the message if the WebSocket isn't open
    if (!this._socket || this._socket.readyState !== WebSocket.OPEN) {
      this._log.debug('Cannot send message. WebSocket is not open.');
      return false;
    }

    try {
      this._socket.send(message);
    } catch (e) {
      // Some unknown error occurred. Reset the socket to get a fresh session.
      this._log.error('Error while sending message:', e.message);
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
      this._resetBackoffs();
    }

    if (this.state !== WSTransportState.Closed) {
      this._performBackoff();
    }
    delete this._socket;

    this.emit('close');
  }

  /**
   * Attempt to connect to the endpoint via WebSocket.
   * @param [uri] - URI string to connect to.
   * @param [retryCount] - Retry number, if this is a retry. Undefined if
   *   first attempt, 1+ if a retry.
   */
  private _connect(uri: string, retryCount?: number): void {
    this._log.info(
      typeof retryCount === 'number'
        ? `Attempting to reconnect (retry #${retryCount})...`
        : 'Attempting to connect...',
    );

    this._closeSocket();

    this._setState(WSTransportState.Connecting);
    this._connectedUri = uri;

    try {
      this._socket = new this._options.WebSocket(this._connectedUri);
    } catch (e) {
      this._log.error('Could not connect to endpoint:', e.message);
      this._close();
      this.emit('error', {
        code: 31000,
        message: e.message || `Could not connect to ${this._connectedUri}`,
        twilioError: new SignalingErrors.ConnectionDisconnected(),
      });
      return;
    }

    this._socket.addEventListener('close', this._onSocketClose as any);
    this._socket.addEventListener('error', this._onSocketError as any);
    this._socket.addEventListener('message', this._onSocketMessage as any);
    this._socket.addEventListener('open', this._onSocketOpen as any);

    delete this._timeOpened;

    this._connectTimeout = setTimeout(() => {
      this._log.info('WebSocket connection attempt timed out.');
      this._moveUriIndex();
      this._closeSocket();
    }, this._options.connectTimeoutMs);
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
    this._log.error(`Received websocket close event code: ${event.code}. Reason: ${event.reason}`);
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
    this._log.error(`WebSocket received error: ${err.message}`);
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
      this._log.debug('heartbeat');
      return;
    }

    if (message && typeof message.data === 'string') {
      this._log.debug(`Received: ${message.data}`);
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

    this._resetBackoffs();

    this._setHeartbeatTimeout();
    this.emit('open');
  }

  /**
   * Perform a backoff. If a preferred URI is set (not null), then backoff
   * using the preferred mechanism. Otherwise, use the primary mechanism.
   */
  private _performBackoff(): void {
    if (this._preferredUri) {
      this._log.info('Preferred URI set; backing off.');
      this._backoff.preferred.backoff();
    } else {
      this._log.info('Preferred URI not set; backing off.');
      this._backoff.primary.backoff();
    }
  }

  /**
   * Reset both primary and preferred backoff mechanisms.
   */
  private _resetBackoffs() {
    this._backoff.preferred.reset();
    this._backoff.primary.reset();

    this._backoffStartTime.preferred = null;
    this._backoffStartTime.primary = null;
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
   * Set up the primary and preferred backoff mechanisms.
   */
  private _setupBackoffs(): typeof WSTransport.prototype._backoff {
    const preferredBackoffConfig = {
      factor: 2.0,
      jitter: 0.40,
      max: this._options.maxPreferredDelayMs,
      min: 100,
    };
    this._log.info('Initializing preferred transport backoff using config: ', preferredBackoffConfig);
    const preferredBackoff = new Backoff(preferredBackoffConfig);

    preferredBackoff.on('backoff', (attempt: number, delay: number) => {
      if (this.state === WSTransportState.Closed) {
        this._log.info('Preferred backoff initiated but transport state is closed; not attempting a connection.');
        return;
      }
      this._log.info(`Will attempt to reconnect Websocket to preferred URI in ${delay}ms`);
      if (attempt === 0) {
        this._backoffStartTime.preferred = Date.now();
        this._log.info(`Preferred backoff start; ${this._backoffStartTime.preferred}`);
      }
    });

    preferredBackoff.on('ready', (attempt: number, _delay: number) => {
      if (this.state === WSTransportState.Closed) {
        this._log.info('Preferred backoff ready but transport state is closed; not attempting a connection.');
        return;
      }
      if (this._backoffStartTime.preferred === null) {
        this._log.info('Preferred backoff start time invalid; not attempting a connection.');
        return;
      }
      if (Date.now() - this._backoffStartTime.preferred > this._options.maxPreferredDurationMs) {
        this._log.info('Max preferred backoff attempt time exceeded; falling back to primary backoff.');
        this._preferredUri = null;
        this._backoff.primary.backoff();
        return;
      }
      if (typeof this._preferredUri !== 'string') {
        this._log.info('Preferred URI cleared; falling back to primary backoff.');
        this._preferredUri = null;
        this._backoff.primary.backoff();
        return;
      }
      this._connect(this._preferredUri, attempt + 1);
    });

    const primaryBackoffConfig = {
      factor: 2.0,
      jitter: 0.40,
      max: this._options.maxPrimaryDelayMs,
      // We only want a random initial delay if there are any fallback edges
      // Initial delay between 1s and 5s both inclusive
      min: this._uris && this._uris.length > 1
        ? Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000
        : 100,
    };
    this._log.info('Initializing primary transport backoff using config: ', primaryBackoffConfig);
    const primaryBackoff = new Backoff(primaryBackoffConfig);

    primaryBackoff.on('backoff', (attempt: number, delay: number) => {
      if (this.state === WSTransportState.Closed) {
        this._log.info('Primary backoff initiated but transport state is closed; not attempting a connection.');
        return;
      }
      this._log.info(`Will attempt to reconnect WebSocket in ${delay}ms`);
      if (attempt === 0) {
        this._backoffStartTime.primary = Date.now();
        this._log.info(`Primary backoff start; ${this._backoffStartTime.primary}`);
      }
    });

    primaryBackoff.on('ready', (attempt: number, _delay: number) => {
      if (this.state === WSTransportState.Closed) {
        this._log.info('Primary backoff ready but transport state is closed; not attempting a connection.');
        return;
      }
      if (this._backoffStartTime.primary === null) {
        this._log.info('Primary backoff start time invalid; not attempting a connection.');
        return;
      }
      if (Date.now() - this._backoffStartTime.primary > this._options.maxPrimaryDurationMs) {
        this._log.info('Max primary backoff attempt time exceeded; not attempting a connection.');
        return;
      }
      this._connect(this._uris[this._uriIndex], attempt + 1);
    });

    return {
      preferred: preferredBackoff,
      primary: primaryBackoff,
    };
  }

  /**
   * The uri the transport is currently connected to
   */
  get uri(): string | null {
    return this._connectedUri;
  }
}
