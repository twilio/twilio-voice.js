/**
 * @packageDocumentation
 * @module Tools
 * @internalapi
 */
/// <reference types="node" />
import { EventEmitter } from 'events';
import * as WebSocket from 'ws';
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
     * Maximum time to wait before attempting to reconnect the signaling websocket.
     * Default is 20000ms. Minimum is 3000ms.
     */
    backoffMaxMs?: number;
    /**
     * Time in milliseconds before websocket times out when attempting to connect
     */
    connectTimeoutMs?: number;
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
    state: WSTransportState;
    /**
     * The backoff instance used to schedule reconnection attempts.
     */
    private readonly _backoff;
    /**
     * The current connection timeout. If it times out, we've failed to connect
     * and should try again.
     *
     * We use any here because NodeJS returns a Timer and browser returns a number
     * and one can't be cast to the other, despite their working interoperably.
     */
    private _connectTimeout?;
    /**
     * Time in milliseconds before websocket times out when attempting to connect
     */
    private _connectTimeoutMs?;
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
    private readonly _uris;
    /**
     * The constructor to use for WebSocket
     */
    private readonly _WebSocket;
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
     * Close the WebSocket, and don't try to reconnect.
     */
    private _close;
    /**
     * Close the WebSocket and remove all event listeners.
     */
    private _closeSocket;
    /**
     * Attempt to connect to the endpoint via WebSocket.
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
     * Set a timeout to reconnect after HEARTBEAT_TIMEOUT milliseconds
     *   have passed without receiving a message over the WebSocket.
     */
    private _setHeartbeatTimeout;
    /**
     * Set the current and previous state
     */
    private _setState;
    /**
     * The uri the transport is currently connected to
     */
    get uri(): string;
}
