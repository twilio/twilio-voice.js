/**
 * Bounded in-memory buffer and retry loop for Insights `EndpointEvents`
 * (VBLOCKS-7468).
 *
 * One outbox is owned by a {@link Device} for its whole lifetime and shared by
 * every EventPublisher that Device creates, including the publishers replaced
 * by `Device.updateOptions`. Calls that still hold a replaced publisher keep
 * posting into the same outbox, so there is exactly one buffer, one retry
 * timer and one flush loop per Device.
 *
 * - Events are built (payload, timestamp) by the publisher when they are
 *   created and stored here already built.
 * - Sends use the host, token and request function of the publisher attached
 *   most recently (the Device's current publisher) at send time.
 * - Only `EndpointEvents` go through the outbox. Metrics are not buffered.
 * @module
 */
import Backoff from './backoff';
import Log from './log';
import {
  MAX_PREFERRED_DELAY,
  PREFERRED_BACKOFF_FACTOR,
  PREFERRED_BACKOFF_JITTER,
  PREFERRED_BACKOFF_MIN_DELAY,
} from './wstransport';

/**
 * Maximum number of buffered events. On overflow the oldest is dropped.
 */
export const INSIGHTS_BUFFER_MAX_EVENTS = 200;

/**
 * Maximum age of a buffered event, measured from its creation. Older events
 * are dropped when a flush runs.
 */
export const INSIGHTS_BUFFER_MAX_AGE_MS = 5 * 60 * 1000;

/**
 * The Insights endpoint whose events are buffered.
 */
export const INSIGHTS_EVENTS_ENDPOINT = 'EndpointEvents';

/**
 * Callback signature of the request function used by the publisher.
 */
export type InsightsRequestCallback = (error?: any, responseText?: string) => void;

/**
 * The subset of an EventPublisher that the outbox uses.
 */
export interface IInsightsPublisher {
  readonly isEnabled: boolean;
  readonly token: string;
  _host?: string | null;
  _request: {
    post(params: IInsightsRequestParams, callback: InsightsRequestCallback): any;
  };
  emit?(event: string, ...args: any[]): boolean;
  listenerCount?(event: string): number;
}

/**
 * Parameters passed to the request function.
 */
export interface IInsightsRequestParams {
  body: Record<string, any>;
  headers: Record<string, string>;
  url: string;
}

/**
 * A buffered event.
 */
interface IInsightsEntry {
  /**
   * `Date.now()` when the event was created.
   */
  createdAt: number;

  /**
   * The built event body.
   */
  event: Record<string, any>;

  /**
   * The publisher the event was posted on. Its `error` listeners are notified
   * when the event fails to send.
   */
  origin: IInsightsPublisher;

  /**
   * Creation order within this outbox.
   */
  seq: number;
}

/**
 * Whether a failed Insights request should be retried. Network-level failures
 * (no numeric `status`), HTTP 5xx and HTTP 429 are retryable. Any other HTTP
 * status (other 4xx, or an unexpected non-2xx such as 3xx) is not.
 * @param error - The error passed to the request callback.
 */
export function isRetryableInsightsError(error: any): boolean {
  const status = error && typeof error.status === 'number' ? error.status : null;
  if (status === null) {
    return true;
  }
  return status === 429 || (status >= 500 && status <= 599);
}

/**
 * Post one event with the sender's current host, token and request function.
 * `done` is called exactly once, with `null` on success or with the error.
 * @param sender - The publisher whose host, token and request are used.
 * @param endpointName - `EndpointEvents` or `EndpointMetrics`.
 * @param event - The built event body.
 * @param done - Completion callback.
 */
export function postInsightsRequest(
  sender: IInsightsPublisher,
  endpointName: string,
  event: Record<string, any>,
  done: (error: any | null) => void,
): void {
  const params: IInsightsRequestParams = {
    body: event,
    headers: {
      'Content-Type': 'application/json',
      'X-Twilio-Token': sender.token,
    },
    url: `https://${sender._host}/v4/${endpointName}`,
  };

  let isSettled = false;
  const settle = (error: any) => {
    if (isSettled) { return; }
    isSettled = true;
    done(error || null);
  };

  try {
    sender._request.post(params, (error?: any) => settle(error));
  } catch (error) {
    settle(error || new Error('Insights request threw'));
  }
}

/**
 * Emit `error` on a publisher without throwing. Skipped when the publisher has
 * no `error` listener, because an EventEmitter throws on an unhandled `error`.
 * A throwing listener is logged and ignored. Never posts to Insights.
 * @param target - The publisher to emit on.
 * @param error - The request error.
 * @param log - Logger used when a listener throws.
 */
export function emitInsightsError(target: IInsightsPublisher | null | undefined, error: any, log?: Log): void {
  if (!target || typeof target.emit !== 'function') {
    return;
  }
  if (typeof target.listenerCount === 'function' && target.listenerCount('error') === 0) {
    return;
  }
  try {
    target.emit('error', error);
  } catch (e) {
    if (log) {
      log.warn('An Insights error listener threw an error', e);
    }
  }
}

/**
 * Describe an event for log lines, without its payload.
 * @param entry
 */
function describe(entry: IInsightsEntry): string {
  return `${entry.event.group} ${entry.event.name}`;
}

/**
 * Describe a request error for log lines.
 * @param error
 */
function describeError(error: any): string {
  if (error && typeof error.status === 'number') {
    return `HTTP ${error.status}`;
  }
  return `${error}`;
}

/**
 * The buffer, retry timer and flush loop for Insights events.
 */
export default class InsightsOutbox {
  /**
   * Retry schedule: the same-edge (preferred URI) signaling reconnect backoff.
   */
  private _backoff: Backoff;

  /**
   * Whether {@link InsightsOutbox.destroy} was called.
   */
  private _destroyed: boolean = false;

  /**
   * Buffered events, in creation order.
   */
  private _entries: IInsightsEntry[] = [];

  /**
   * Whether the last request failed with a retryable error and no request has
   * succeeded since. Used to notify `error` listeners once per failure streak.
   */
  private _isFailing: boolean = false;

  /**
   * Whether the flush loop has a request in flight.
   */
  private _isFlushing: boolean = false;

  /**
   * Whether a retry is scheduled on the backoff.
   */
  private _isRetryScheduled: boolean = false;

  /**
   * Logger. Drops and retries are logged here only, never sent to Insights.
   */
  private _log: Log = new Log('InsightsOutbox');

  /**
   * The publisher attached most recently. Its host, token and request
   * function are used for every send.
   */
  private _publisher: IInsightsPublisher | null = null;

  /**
   * Whether the backoff must be reset again before the next retry. See
   * {@link InsightsOutbox._onSuccess}.
   */
  private _resetBeforeNextRetry: boolean = false;

  /**
   * Next creation sequence number.
   */
  private _seq: number = 0;

  constructor() {
    this._backoff = new Backoff({
      factor: PREFERRED_BACKOFF_FACTOR,
      jitter: PREFERRED_BACKOFF_JITTER,
      max: MAX_PREFERRED_DELAY,
      min: PREFERRED_BACKOFF_MIN_DELAY,
    });

    this._backoff.on('backoff', (attempt: number, delay: number) => {
      this._log.debug(`Retrying buffered Insights events in ${delay}ms (attempt ${attempt + 1})`);
    });

    this._backoff.on('ready', () => {
      this._isRetryScheduled = false;
      this.flush();
    });
  }

  /**
   * Whether {@link InsightsOutbox.destroy} was called.
   */
  get isDestroyed(): boolean {
    return this._destroyed;
  }

  /**
   * The number of buffered events.
   */
  get size(): number {
    return this._entries.length;
  }

  /**
   * Accept a built event. Sends it right away when the host is known and
   * nothing is buffered, retrying, or flushing; otherwise buffers it behind the
   * events already waiting so creation order is kept.
   * @param event - The built event body.
   * @param origin - The publisher the event was posted on.
   * @returns A Promise that always resolves: after the first send attempt when
   *   sent right away, or immediately when buffered or dropped.
   */
  add(event: Record<string, any>, origin: IInsightsPublisher): Promise<void> {
    const publisher = this._publisher;
    if (this._destroyed || !publisher) {
      this._log.debug('Publishing cancelled; the Insights outbox is not available');
      return Promise.resolve();
    }

    if (!publisher.isEnabled) {
      this._log.debug('Publishing cancelled; publishing is disabled');
      return Promise.resolve();
    }

    const entry: IInsightsEntry = { createdAt: Date.now(), event, origin, seq: this._seq++ };

    if (!publisher._host || this._entries.length || this._isFlushing || this._isRetryScheduled) {
      this._log.debug(`Buffering Insights event ${describe(entry)}`, JSON.stringify({
        bufferedEvents: this._entries.length,
        host: publisher._host,
        isFlushing: this._isFlushing,
        isRetryScheduled: this._isRetryScheduled,
      }));
      this._entries.push(entry);
      this._enforceMaxEvents();
      if (publisher._host && !this._isRetryScheduled) {
        this.flush();
      }
      return Promise.resolve();
    }

    return new Promise<void>(resolve => this._sendNow(entry, publisher, resolve));
  }

  /**
   * Attach a publisher. It becomes the publisher whose host, token and
   * request function are used for all later sends, including buffered events
   * created on previously attached publishers.
   * @param publisher
   */
  attach(publisher: IInsightsPublisher): void {
    if (this._destroyed) { return; }
    this._publisher = publisher;
  }

  /**
   * Drop every buffered event and cancel a scheduled retry.
   * @param reason - Logged with the number of dropped events.
   */
  clear(reason: string): void {
    const count = this._entries.length;
    this._entries = [];
    this._isFailing = false;
    this._cancelRetry();
    if (count) {
      this._log.warn(`Dropped ${count} buffered Insights event(s): ${reason}`);
    }
  }

  /**
   * Drop the buffer, stop the retry timer and stop accepting events. Requests
   * already in flight complete, but their results are ignored.
   */
  destroy(): void {
    if (this._destroyed) { return; }
    this.clear('the Device was destroyed');
    this._backoff.removeAllListeners();
    this._destroyed = true;
    this._publisher = null;
  }

  /**
   * Whether the given publisher is the one attached most recently.
   * @param publisher
   */
  isAttached(publisher: IInsightsPublisher): boolean {
    return !this._destroyed && this._publisher === publisher;
  }

  /**
   * Send buffered events, oldest first, one request at a time. No-op while a
   * flush is in flight, or when the host is unknown or publishing is disabled.
   * Expired events are dropped first.
   */
  flush(): void {
    if (this._destroyed || this._isFlushing) { return; }
    const publisher = this._publisher;
    if (!publisher || !publisher.isEnabled || !publisher._host) { return; }
    this._isFlushing = true;
    this._flushNext();
  }

  /**
   * Cancel a scheduled retry.
   */
  private _cancelRetry(): void {
    this._backoff.reset();
    this._isRetryScheduled = false;
  }

  /**
   * Drop expired events (older than {@link INSIGHTS_BUFFER_MAX_AGE_MS}).
   */
  private _dropExpired(): void {
    const now = Date.now();
    const kept = this._entries.filter(entry => now - entry.createdAt <= INSIGHTS_BUFFER_MAX_AGE_MS);
    const dropped = this._entries.length - kept.length;
    if (dropped) {
      this._entries = kept;
      this._log.warn(`Dropped ${dropped} buffered Insights event(s) older than ${INSIGHTS_BUFFER_MAX_AGE_MS}ms`);
    }
  }

  /**
   * Drop the oldest events while the buffer is over {@link INSIGHTS_BUFFER_MAX_EVENTS}.
   */
  private _enforceMaxEvents(): void {
    while (this._entries.length > INSIGHTS_BUFFER_MAX_EVENTS) {
      const dropped = this._entries.shift() as IInsightsEntry;
      this._log.warn(`Dropped buffered Insights event ${describe(dropped)}: the buffer is full (max ${INSIGHTS_BUFFER_MAX_EVENTS})`);
    }
  }

  /**
   * Send the oldest buffered event, then continue with the next one until the
   * buffer is empty or a retryable failure stops the loop.
   */
  private _flushNext(): void {
    const publisher = this._publisher;
    if (this._destroyed || !publisher || !publisher.isEnabled || !publisher._host) {
      this._isFlushing = false;
      return;
    }

    this._dropExpired();
    const entry = this._entries[0];
    if (!entry) {
      this._isFlushing = false;
      return;
    }

    postInsightsRequest(publisher, INSIGHTS_EVENTS_ENDPOINT, entry.event, (error: any) => {
      if (this._destroyed) { return; }

      if (!error) {
        this._remove(entry);
        this._onSuccess();
        this._flushNext();
        return;
      }

      if (!isRetryableInsightsError(error)) {
        this._remove(entry);
        this._onDropped(entry, error);
        this._flushNext();
        return;
      }

      this._isFlushing = false;
      this._onRetryableFailure(entry, error, true);
    });
  }

  /**
   * Insert an event into the buffer in creation order.
   * @param entry
   */
  private _insert(entry: IInsightsEntry): void {
    let index = this._entries.length;
    while (index > 0 && this._entries[index - 1].seq > entry.seq) {
      index--;
    }
    this._entries.splice(index, 0, entry);
    this._enforceMaxEvents();
  }

  /**
   * Handle a non-retryable failure: the event is dropped.
   * @param entry
   * @param error
   */
  private _onDropped(entry: IInsightsEntry, error: any): void {
    this._log.warn(`Dropped Insights event ${describe(entry)}: non-retryable error (${describeError(error)})`);
    emitInsightsError(entry.origin, error, this._log);
  }

  /**
   * Handle a retryable failure: keep (or put back) the event and schedule a
   * retry. `error` listeners are notified on the first failure of a streak
   * only, so a long outage does not produce one notification per retry.
   * @param entry
   * @param error
   * @param isBuffered - Whether the entry is already in the buffer.
   */
  private _onRetryableFailure(entry: IInsightsEntry, error: any, isBuffered: boolean): void {
    if (!this._isFailing) {
      this._isFailing = true;
      this._log.warn(`Unable to post Insights event ${describe(entry)} (${describeError(error)}); buffering and retrying`);
      emitInsightsError(entry.origin, error, this._log);
    } else {
      this._log.debug(`Unable to post Insights event ${describe(entry)} (${describeError(error)}); will retry`);
    }

    if (!isBuffered) {
      const publisher = this._publisher;
      if (!publisher || !publisher.isEnabled) {
        this._log.debug(`Dropped Insights event ${describe(entry)}: publishing is disabled`);
      } else if (Date.now() - entry.createdAt > INSIGHTS_BUFFER_MAX_AGE_MS) {
        this._log.warn(`Dropped Insights event ${describe(entry)}: older than ${INSIGHTS_BUFFER_MAX_AGE_MS}ms`);
      } else {
        this._insert(entry);
      }
    }

    if (this._entries.length) {
      this._scheduleRetry();
    }
  }

  /**
   * Handle a successful request: reset the backoff and cancel a scheduled
   * retry, since the gateway is reachable again.
   */
  private _onSuccess(): void {
    this._isFailing = false;
    this._cancelRetry();
    // When the success happens synchronously inside the backoff 'ready'
    // handler, Backoff increments its attempt counter after this reset. Reset
    // again before the next retry so a new failure streak starts at the
    // minimum delay.
    this._resetBeforeNextRetry = true;
  }

  /**
   * Remove an event from the buffer, if it is still there.
   * @param entry
   */
  private _remove(entry: IInsightsEntry): void {
    const index = this._entries.indexOf(entry);
    if (index !== -1) {
      this._entries.splice(index, 1);
    }
  }

  /**
   * Schedule one retry on the backoff, unless one is already scheduled.
   */
  private _scheduleRetry(): void {
    if (this._destroyed || this._isRetryScheduled) { return; }
    if (this._resetBeforeNextRetry) {
      this._backoff.reset();
      this._resetBeforeNextRetry = false;
    }
    this._isRetryScheduled = true;
    this._backoff.backoff();
  }

  /**
   * Send an event right away (nothing buffered or in flight).
   * @param entry
   * @param publisher - The attached publisher.
   * @param resolve - Resolves the Promise returned by {@link InsightsOutbox.add}.
   */
  private _sendNow(entry: IInsightsEntry, publisher: IInsightsPublisher, resolve: () => void): void {
    postInsightsRequest(publisher, INSIGHTS_EVENTS_ENDPOINT, entry.event, (error: any) => {
      if (this._destroyed) {
        resolve();
        return;
      }

      if (!error) {
        this._onSuccess();
        this.flush();
      } else if (!isRetryableInsightsError(error)) {
        this._onDropped(entry, error);
      } else {
        this._onRetryableFailure(entry, error, false);
      }
      resolve();
    });
  }
}
