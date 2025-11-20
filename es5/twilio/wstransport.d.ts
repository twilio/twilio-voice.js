import { EventEmitter } from 'events';
declare const WebSocket: {
    new (url: string | URL, protocols?: string | string[]): WebSocket;
    prototype: WebSocket;
    readonly CONNECTING: 0;
    readonly OPEN: 1;
    readonly CLOSING: 2;
    readonly CLOSED: 3;
};
export interface IMessageEvent {
    data: string;
    target: WebSocket;
    type: string;
}
/**
 * All possible states of WSTransport.
 */
export declare enum WSTransportState {
    /**
     * The WebSocket is not open but is trying to connect.
     */
    Connecting = "connecting",
    /**
     * The WebSocket is not open and is not trying to connect.
     */
    Closed = "closed",
    /**
     * The underlying WebSocket is open and active.
     */
    Open = "open"
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
 * WebSocket Transport
 */
export default class WSTransport extends EventEmitter {
    private static defaultConstructorOptions;
    /**
     * The current state of the WSTransport.
     */
    state: WSTransportState;
    /**
     * The backoff instance used to schedule reconnection attempts.
     */
    private readonly _backoff;
    /**
     * Start timestamp values for backoffs.
     */
    private _backoffStartTime;
    /**
     * The URI that the transport is connecting or connected to. The value of this
     * property is `null` if a connection attempt has not been made yet.
     */
    private _connectedUri;
    /**
     * The current connection timeout. If it times out, we've failed to connect
     * and should try again.
     *
     * We use any here because NodeJS returns a Timer and browser returns a number
     * and one can't be cast to the other, despite their working interoperably.
     */
    private _connectTimeout?;
    /**
     * The current connection timeout. If it times out, we've failed to connect
     * and should try again.
     *
     * We use any here because NodeJS returns a Timer and browser returns a number
     * and one can't be cast to the other, despite their working interoperably.
     */
    private _heartbeatTimeout?;
    /**
     * An instance of Logger to use.
     */
    private _log;
    /**
     * Options after missing values are defaulted.
     */
    private _options;
    /**
     * Preferred URI endpoint to connect to.
     */
    private _preferredUri;
    /**
     * Previous state of the connection
     */
    private _previousState;
    /**
     * Whether we should attempt to fallback if we receive an applicable error
     * when trying to connect to a signaling endpoint.
     */
    private _shouldFallback;
    /**
     * The currently connecting or open WebSocket.
     */
    private _socket?;
    /**
     * The time the active connection was opened.
     */
    private _timeOpened?;
    /**
     * The current uri index that the transport is connected to.
     */
    private _uriIndex;
    /**
     * List of URI of the endpoints to connect to.
     */
    private _uris;
    /**
     * @constructor
     * @param uris - List of URI of the endpoints to connect to.
     * @param [options] - Constructor options.
     */
    constructor(uris: string[], options?: IWSTransportConstructorOptions);
    /**
     * Close the WebSocket, and don't try to reconnect.
     */
    close(): void;
    /**
     * Attempt to open a WebSocket connection.
     */
    open(): void;
    /**
     * Send a message through the WebSocket connection.
     * @param message - A message to send to the endpoint.
     * @returns Whether the message was sent.
     */
    send(message: string): boolean;
    /**
     * Update the preferred URI to connect to. Useful for Call signaling
     * reconnection, which requires connecting on the same edge. If `null` is
     * passed, the preferred URI is unset and the original `uris` array and
     * `uriIndex` is used to determine the signaling URI to connect to.
     * @param uri
     */
    updatePreferredURI(uri: string | null): void;
    /**
     * Update acceptable URIs to reconnect to. Resets the URI index to 0.
     */
    updateURIs(uris: string[] | string): void;
    /**
     * Close the WebSocket, and don't try to reconnect.
     */
    private _close;
    /**
     * Close the WebSocket and remove all event listeners.
     */
    private _closeSocket;
    /**
     * Attempt to connect to the endpoint via WebSocket.
     * @param [uri] - URI string to connect to.
     * @param [retryCount] - Retry number, if this is a retry. Undefined if
     *   first attempt, 1+ if a retry.
     */
    private _connect;
    /**
     * Move the uri index to the next index
     * If the index is at the end, the index goes back to the first one.
     */
    private _moveUriIndex;
    /**
     * Called in response to WebSocket#close event.
     */
    private _onSocketClose;
    /**
     * Called in response to WebSocket#error event.
     */
    private _onSocketError;
    /**
     * Called in response to WebSocket#message event.
     */
    private _onSocketMessage;
    /**
     * Called in response to WebSocket#open event.
     */
    private _onSocketOpen;
    /**
     * Perform a backoff. If a preferred URI is set (not null), then backoff
     * using the preferred mechanism. Otherwise, use the primary mechanism.
     */
    private _performBackoff;
    /**
     * Reset both primary and preferred backoff mechanisms.
     */
    private _resetBackoffs;
    /**
     * Set a timeout to reconnect after HEARTBEAT_TIMEOUT milliseconds
     *   have passed without receiving a message over the WebSocket.
     */
    private _setHeartbeatTimeout;
    /**
     * Set the current and previous state
     */
    private _setState;
    /**
     * Set up the primary and preferred backoff mechanisms.
     */
    private _setupBackoffs;
    /**
     * The uri the transport is currently connected to
     */
    get uri(): string | null;
}
export {};
