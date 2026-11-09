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
 * - Delivery is at least once: a request that fails after the gateway has
 *   already accepted it (a 5xx after processing, a reset or timeout after the
 *   body was sent, a 2xx whose body cannot be read) is resent with the same
 *   body, so the backend can receive duplicates.
 * - Buffered events are kept in memory only. They are lost when the page is
 *   closed. When the Device is destroyed they are sent once, without retries,
 *   and dropped if that fails or the host is unknown.
 * - Retries use their own schedule, not the signaling reconnect backoff:
 *   exponential from {@link INSIGHTS_RETRY_BASE_DELAY_MS} up to
 *   {@link INSIGHTS_RETRY_MAX_DELAY_MS} with full jitter, so clients that
 *   lost the gateway at the same time do not retry in step. A `Retry-After`
 *   on HTTP 429 or 503 is honored when the response exposes it.
 * - After the gateway recovers, buffered events are sent one at a time with
 *   {@link INSIGHTS_DRAIN_INTERVAL_MS} between requests, not back to back.
 * - A deterministic network-level block (ad blocker, CSP, firewall) looks like
 *   a network error, so while new events keep arriving the outbox keeps
 *   retrying at the retry cap (about one request every 15 seconds on
 *   average).
 * @module
 */
import Log from './log';

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
 * Per-attempt deadline for an outbox send. An attempt that has not completed
 * by then is treated as a retryable failure (and aborted where
 * `AbortController` is available), so one hung request cannot stall the
 * buffer. A late response to a timed-out attempt is ignored.
 */
export const INSIGHTS_REQUEST_TIMEOUT_MS = 10000;

/**
 * Retry delay ceiling for the first retry of a backlog. Doubles with each
 * further retry, up to {@link INSIGHTS_RETRY_MAX_DELAY_MS}.
 */
export const INSIGHTS_RETRY_BASE_DELAY_MS = 1000;

/**
 * Upper bound for the retry delay ceiling.
 */
export const INSIGHTS_RETRY_MAX_DELAY_MS = 30000;

/**
 * Lower bound for a retry delay, so a jittered delay is never 0ms.
 */
export const INSIGHTS_RETRY_MIN_DELAY_MS = 100;

/**
 * Upper bound for the retry attempt counter used as the exponent. From this
 * attempt on, `INSIGHTS_RETRY_BASE_DELAY_MS * 2 ^ attempt` (32000ms) is
 * already above {@link INSIGHTS_RETRY_MAX_DELAY_MS}, so capping the counter
 * here does not change any delay and keeps the exponent bounded during a long
 * outage.
 */
export const INSIGHTS_RETRY_MAX_EXPONENT = 5;

/**
 * Time between the end of one request of the flush loop and the start of the
 * next, while buffered events are sent one after another. Spreads the backlog
 * sent after the gateway recovers instead of sending it back to back.
 */
export const INSIGHTS_DRAIN_INTERVAL_MS = 200;

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

  /**
   * Abort signal for the attempt timeout. Defined as a non-enumerable property
   * so the enumerable shape seen by custom request functions stays
   * `{ body, headers, url }`. request.ts passes it to `fetch`.
   */
  signal?: AbortSignal;
  url: string;
}

/**
 * A request started by {@link postInsightsRequest}.
 */
export interface IInsightsRequestHandle {
  /**
   * Whether `done` has been called.
   */
  readonly isSettled: boolean;

  /**
   * Stop the attempt timer without settling or aborting the request. Used on
   * destroy so no timer outlives the outbox; the request completes best effort
   * and its result is ignored.
   */
  cancelTimeout(): void;
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
   * The outbox's clear count when the event was created. See
   * {@link InsightsOutbox._generation}.
   */
  generation: number;

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
 * (no numeric `status`), attempt timeouts, HTTP 5xx and HTTP 429 are
 * retryable. Any other HTTP status (other 4xx, or an unexpected non-2xx such
 * as 3xx) is not.
 *
 * In browsers an error response without CORS headers (for example a 403 or 502
 * from a WAF or proxy) makes `fetch` reject without a status, so it is
 * classified as a network error and retried until the age bound drops it.
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
 * The delay before a retry, with full jitter applied after the cap: a random
 * value between {@link INSIGHTS_RETRY_MIN_DELAY_MS} and
 * `min(INSIGHTS_RETRY_MAX_DELAY_MS, INSIGHTS_RETRY_BASE_DELAY_MS * 2 ^ attempt)`.
 * @param attempt - The 0-based retry attempt.
 * @returns The delay in milliseconds.
 */
export function getInsightsRetryDelay(attempt: number): number {
  const exponent = Math.min(Math.max(attempt, 0), INSIGHTS_RETRY_MAX_EXPONENT);
  const ceiling = Math.min(INSIGHTS_RETRY_MAX_DELAY_MS, INSIGHTS_RETRY_BASE_DELAY_MS * Math.pow(2, exponent));
  return Math.max(INSIGHTS_RETRY_MIN_DELAY_MS, Math.floor(Math.random() * ceiling));
}

/**
 * The delay a failed request asks for with `Retry-After`, honored on HTTP 429
 * and 503 only. Accepts delta-seconds or an HTTP-date. A missing, malformed,
 * negative or past value is ignored. The result is capped at
 * {@link INSIGHTS_BUFFER_MAX_AGE_MS}, past which the event would be dropped
 * anyway.
 *
 * request.ts reads the header into `error.retryAfter`. In browsers a
 * cross-origin response exposes `Retry-After` only when the gateway sends
 * `Access-Control-Expose-Headers: Retry-After`; eventgw.twilio.com did not
 * send it when this was written (checked 2026-11-09), so in browsers the
 * header is honored only once the gateway exposes it. Custom request
 * functions may not provide it either.
 * @param error - The error passed to the request callback.
 * @param now - The current time, `Date.now()`.
 * @returns The delay in milliseconds, or `null`.
 */
export function getInsightsRetryAfterDelay(error: any, now: number): number | null {
  const status = error && typeof error.status === 'number' ? error.status : null;
  if (status !== 429 && status !== 503) {
    return null;
  }
  const value = typeof error.retryAfter === 'string' ? error.retryAfter.trim() : '';
  if (!value) {
    return null;
  }

  let delay: number;
  if (/^\d+$/.test(value)) {
    delay = parseInt(value, 10) * 1000;
  } else if (/^[-+]?[\d.]+$/.test(value)) {
    // Negative or fractional seconds, which `Date.parse` could read as a year.
    return null;
  } else {
    const date = Date.parse(value);
    if (isNaN(date)) {
      return null;
    }
    delay = date - now;
  }

  if (!(delay > 0)) {
    return null;
  }
  return Math.min(delay, INSIGHTS_BUFFER_MAX_AGE_MS);
}

/**
 * Let a timer not keep a Node.js process alive (no-op in browsers, where
 * timers are numbers). Insights retries are background work; a test runner or
 * other Node host must still be able to exit while a retry is pending.
 * @param timer - A value returned by `setTimeout`.
 */
function unrefTimer(timer: any): void {
  if (timer && typeof timer.unref === 'function') {
    timer.unref();
  }
}

/**
 * Post one event with the sender's current host, token and request function.
 * `done` is called exactly once, with `null` on success or with the error.
 * With `timeoutMs`, an attempt still pending after that long settles with a
 * retryable timeout error and is aborted where `AbortController` exists; a
 * late response is then ignored.
 * @param sender - The publisher whose host, token and request are used.
 * @param endpointName - `EndpointEvents` or `EndpointMetrics`.
 * @param event - The built event body.
 * @param done - Completion callback.
 * @param timeoutMs - Optional per-attempt deadline in milliseconds.
 * @returns A handle for the attempt.
 */
export function postInsightsRequest(
  sender: IInsightsPublisher,
  endpointName: string,
  event: Record<string, any>,
  done: (error: any | null) => void,
  timeoutMs?: number,
): IInsightsRequestHandle {
  const params: IInsightsRequestParams = {
    body: event,
    headers: {
      'Content-Type': 'application/json',
      'X-Twilio-Token': sender.token,
    },
    url: `https://${sender._host}/v4/${endpointName}`,
  };

  let isSettled = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let controller: AbortController | null = null;

  const cancelTimeout = () => {
    if (timer !== null) {
      clearTimeout(timer);
      timer = null;
    }
  };

  const settle = (error: any) => {
    if (isSettled) { return; }
    isSettled = true;
    cancelTimeout();
    done(error || null);
  };

  if (typeof timeoutMs === 'number' && timeoutMs > 0) {
    if (typeof AbortController === 'function') {
      try {
        controller = new AbortController();
        Object.defineProperty(params, 'signal', { value: controller.signal });
      } catch (e) {
        controller = null;
      }
    }

    // Started before the request so a synchronous callback clears it.
    timer = setTimeout(() => {
      timer = null;
      const error: any = new Error(`Insights request timed out after ${timeoutMs}ms`);
      error.name = 'TimeoutError';
      // Settle first, so the rejection caused by abort() is ignored.
      settle(error);
      if (controller) {
        try { controller.abort(); } catch (e) { /* the attempt is already settled */ }
      }
    }, timeoutMs);
    unrefTimer(timer);
  }

  try {
    sender._request.post(params, (error?: any) => settle(error));
  } catch (error) {
    settle(error || new Error('Insights request threw'));
  }

  return {
    cancelTimeout,
    get isSettled() { return isSettled; },
  };
}

/**
 * Emit `error` on a publisher without throwing into the caller. Skipped when
 * the publisher has no `error` listener, because an EventEmitter throws on an
 * unhandled `error`. Never posts to Insights.
 *
 * An exception thrown by a listener is logged at error level and then raised
 * as a rejected Promise that nothing handles, so the application sees it as an
 * unhandled rejection, the same channel as before the outbox existed (the
 * listener used to run inside the `fetch` promise chain). The rejection is
 * created outside the caller's own promise chain, so the outbox still retries
 * or drops the event and still settles the Promise returned by `add()`.
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
      log.error('An Insights error listener threw an error', e);
    }
    // Deliberately unhandled; see above.
    Promise.reject(e);
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
 *
 * Retries do not use the signaling reconnect backoff (backoff.ts): that
 * schedule (100ms to 1s) applies jitter before its cap, so after a few
 * attempts every client would retry at exactly 1s, in step. They are
 * scheduled with {@link getInsightsRetryDelay} instead.
 */
export default class InsightsOutbox {
  /**
   * The retry attempt used for the next retry delay (see
   * {@link getInsightsRetryDelay}). Kept across failure streaks and successes
   * while a backlog remains, so a gateway that keeps failing between
   * successes does not get retried at the shortest delays again; reset only
   * once the buffer has drained.
   */
  private _attempts: number = 0;

  /**
   * Whether {@link InsightsOutbox.destroy} was called.
   */
  private _destroyed: boolean = false;

  /**
   * The timer that starts the flush loop's next request, while the loop
   * waits {@link INSIGHTS_DRAIN_INTERVAL_MS} between buffered events.
   */
  private _drainTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Buffered events, in creation order.
   */
  private _entries: IInsightsEntry[] = [];

  /**
   * The buffered entry whose request the flush loop has in flight, if any.
   */
  private _flushingEntry: IInsightsEntry | null = null;

  /**
   * Incremented by {@link InsightsOutbox.clear}. An event whose direct send
   * was in flight when the buffer was cleared is not put back into the buffer
   * if that send fails, so it is not retried later (for example with a token
   * for another identity).
   */
  private _generation: number = 0;

  /**
   * Attempts in flight (direct sends and the flush loop's request), so their
   * timeout timers can be stopped on destroy.
   */
  private _inFlight: Set<IInsightsRequestHandle> = new Set();

  /**
   * Whether the last request failed with a retryable error and no request has
   * succeeded since. Used to notify `error` listeners once per failure streak.
   */
  private _isFailing: boolean = false;

  /**
   * Whether the flush loop has a request in flight or is waiting
   * {@link INSIGHTS_DRAIN_INTERVAL_MS} before its next request.
   */
  private _isFlushing: boolean = false;

  /**
   * Whether a retry is scheduled.
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
   * The scheduled retry, if any.
   */
  private _retryTimer: ReturnType<typeof setTimeout> | null = null;

  /**
   * Next creation sequence number.
   */
  private _seq: number = 0;

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

    const entry: IInsightsEntry = { createdAt: Date.now(), event, generation: this._generation, origin, seq: this._seq++ };

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
   * Drop every buffered event and cancel a scheduled retry or a waiting
   * flush loop.
   * @param reason - Logged with the number of dropped events.
   */
  clear(reason: string): void {
    const count = this._entries.length;
    this._entries = [];
    this._generation++;
    this._isFailing = false;
    this._cancelRetry();
    this._cancelDrain();
    if (count) {
      this._log.warn(`Dropped ${count} buffered Insights event(s): ${reason}`);
    }
  }

  /**
   * Send each buffered event once, then stop the retry timer and stop
   * accepting events. Called when the Device is destroyed, after its calls
   * were disconnected, so their teardown events queued behind a backlog are
   * not discarded unsent.
   *
   * Each remaining event is sent once, in creation order, with the attached
   * publisher's host and token. The requests are started right away, not one
   * after another, and are not retried; each has the usual per-attempt
   * timeout ({@link INSIGHTS_REQUEST_TIMEOUT_MS}), so none outlives the
   * destroy by more than that. A failed event is dropped and logged. Without a
   * known host (or with publishing disabled) nothing is sent and the events
   * are dropped with a log line. Expired events are dropped first. The event
   * whose flush request is already in flight is not sent again. Requests
   * already in flight complete, but their results are ignored.
   */
  destroy(): void {
    if (this._destroyed) { return; }
    this._dropExpired();
    const remaining = this._entries.filter(entry => entry !== this._flushingEntry);
    const publisher = this._publisher;

    this._entries = [];
    this._isFailing = false;
    this._cancelRetry();
    this._cancelDrain();
    this._inFlight.forEach(handle => handle.cancelTimeout());
    this._inFlight.clear();
    this._destroyed = true;
    this._flushingEntry = null;
    this._publisher = null;

    if (remaining.length) {
      this._sendOnce(remaining, publisher);
    }
  }

  /**
   * Whether the given publisher is the one attached most recently.
   * @param publisher
   */
  isAttached(publisher: IInsightsPublisher): boolean {
    return !this._destroyed && this._publisher === publisher;
  }

  /**
   * Send buffered events, oldest first, one request at a time, waiting
   * {@link INSIGHTS_DRAIN_INTERVAL_MS} between requests. No-op while a flush
   * is in flight or waiting, or when the host is unknown or publishing is
   * disabled. Expired events are dropped first.
   */
  flush(): void {
    if (this._destroyed || this._isFlushing) { return; }
    const publisher = this._publisher;
    if (!publisher || !publisher.isEnabled || !publisher._host) { return; }
    this._isFlushing = true;
    this._flushNext();
  }

  /**
   * Stop the flush loop while it waits between buffered events. A flush
   * request already in flight is not affected.
   */
  private _cancelDrain(): void {
    if (this._drainTimer === null) { return; }
    clearTimeout(this._drainTimer);
    this._drainTimer = null;
    this._isFlushing = false;
  }

  /**
   * Cancel a scheduled retry. The retry attempt is kept; see
   * {@link InsightsOutbox._attempts}.
   */
  private _cancelRetry(): void {
    if (this._retryTimer !== null) {
      clearTimeout(this._retryTimer);
      this._retryTimer = null;
    }
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
      if (dropped === this._flushingEntry) {
        this._log.warn(`Removed buffered Insights event ${describe(dropped)} from the full buffer (max ${INSIGHTS_BUFFER_MAX_EVENTS}) `
          + 'while its request is in flight; it is delivered if that request succeeds and dropped otherwise');
      } else {
        this._log.warn(`Dropped buffered Insights event ${describe(dropped)}: the buffer is full (max ${INSIGHTS_BUFFER_MAX_EVENTS})`);
      }
    }
  }

  /**
   * Continue the flush loop: wait {@link INSIGHTS_DRAIN_INTERVAL_MS} when more
   * events are buffered, so a backlog is not sent back to back once the
   * gateway recovers. Otherwise end the loop right away.
   */
  private _flushAfterInterval(): void {
    if (!this._entries.length) {
      this._flushNext();
      return;
    }
    this._drainTimer = setTimeout(() => {
      this._drainTimer = null;
      this._flushNext();
    }, INSIGHTS_DRAIN_INTERVAL_MS);
    unrefTimer(this._drainTimer);
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

    this._flushingEntry = entry;
    this._send(publisher, entry, (error: any) => {
      this._flushingEntry = null;
      if (this._destroyed) { return; }

      if (!error) {
        this._remove(entry);
        this._onSuccess();
        this._flushAfterInterval();
        return;
      }

      if (!isRetryableInsightsError(error)) {
        this._remove(entry);
        this._onDropped(entry, error);
        this._flushAfterInterval();
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
      // The retry attempt is not reset here: a new streak while a backlog
      // remains continues the schedule. See InsightsOutbox._attempts.
      this._log.warn(`Unable to post Insights event ${describe(entry)} (${describeError(error)}); buffering and retrying`);
      emitInsightsError(entry.origin, error, this._log);
    } else {
      this._log.debug(`Unable to post Insights event ${describe(entry)} (${describeError(error)}); will retry`);
    }

    if (!isBuffered) {
      const publisher = this._publisher;
      if (!publisher || !publisher.isEnabled) {
        this._log.debug(`Dropped Insights event ${describe(entry)}: publishing is disabled`);
      } else if (entry.generation !== this._generation) {
        this._log.debug(`Dropped Insights event ${describe(entry)}: the buffer was cleared while it was being sent`);
      } else if (Date.now() - entry.createdAt > INSIGHTS_BUFFER_MAX_AGE_MS) {
        this._log.warn(`Dropped Insights event ${describe(entry)}: older than ${INSIGHTS_BUFFER_MAX_AGE_MS}ms`);
      } else {
        this._insert(entry);
      }
    }

    if (this._entries.length) {
      this._scheduleRetry(error);
    }
  }

  /**
   * Handle a successful request: end the failure streak and cancel a
   * scheduled retry, since the gateway is reachable again (the caller flushes
   * right away). The retry attempt is reset only once nothing is buffered or
   * in flight, so a gateway that fails again while a backlog remains is
   * retried with the delays the backlog had reached.
   */
  private _onSuccess(): void {
    this._isFailing = false;
    this._cancelRetry();
    if (!this._entries.length && !this._inFlight.size) {
      this._attempts = 0;
    }
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
   * Schedule one retry, unless one is already scheduled. The delay is the
   * jittered delay for the current attempt, or the failed response's
   * `Retry-After` when that is longer (see {@link getInsightsRetryAfterDelay}).
   * @param error - The error of the failed request.
   */
  private _scheduleRetry(error: any): void {
    if (this._destroyed || this._isRetryScheduled) { return; }
    const attempt = this._attempts;
    const retryAfter = getInsightsRetryAfterDelay(error, Date.now());
    const delay = Math.max(getInsightsRetryDelay(attempt), retryAfter || 0);
    this._attempts = Math.min(attempt + 1, INSIGHTS_RETRY_MAX_EXPONENT);
    this._isRetryScheduled = true;
    this._log.debug(`Retrying buffered Insights events in ${delay}ms (attempt ${attempt + 1}`
      + `${retryAfter === null ? '' : `, Retry-After ${retryAfter}ms`})`);
    this._retryTimer = setTimeout(() => {
      this._retryTimer = null;
      this._isRetryScheduled = false;
      this.flush();
    }, delay);
    unrefTimer(this._retryTimer);
  }

  /**
   * Send events once, without retries, after the outbox is destroyed. See
   * {@link InsightsOutbox.destroy}.
   * @param entries - The events, in creation order.
   * @param publisher - The publisher that was attached at destroy.
   */
  private _sendOnce(entries: IInsightsEntry[], publisher: IInsightsPublisher | null): void {
    if (!publisher || !publisher.isEnabled || !publisher._host) {
      const reason = publisher && publisher.isEnabled ? 'the Insights host is not known' : 'publishing is disabled';
      this._log.warn(`Dropped ${entries.length} buffered Insights event(s): the Device was destroyed and ${reason}`);
      return;
    }

    this._log.debug(`Sending ${entries.length} buffered Insights event(s) once because the Device was destroyed`);
    entries.forEach(entry => {
      postInsightsRequest(publisher, INSIGHTS_EVENTS_ENDPOINT, entry.event, (error: any) => {
        if (error) {
          this._log.warn(`Dropped Insights event ${describe(entry)}: its final send after the Device was destroyed failed (${describeError(error)})`);
        }
      }, INSIGHTS_REQUEST_TIMEOUT_MS);
    });
  }

  /**
   * Start one attempt for an entry with the per-attempt timeout, tracking it
   * until it settles.
   * @param publisher - The attached publisher (host, token, request).
   * @param entry
   * @param done - Called once with `null` or the error.
   */
  private _send(publisher: IInsightsPublisher, entry: IInsightsEntry, done: (error: any) => void): void {
    let handle: IInsightsRequestHandle | null = null;
    handle = postInsightsRequest(publisher, INSIGHTS_EVENTS_ENDPOINT, entry.event, (error: any) => {
      if (handle) { this._inFlight.delete(handle); }
      done(error);
    }, INSIGHTS_REQUEST_TIMEOUT_MS);
    // A synchronous callback has already settled it; nothing to track.
    if (!handle.isSettled) {
      this._inFlight.add(handle);
    }
  }

  /**
   * Send an event right away (nothing buffered or in flight).
   * @param entry
   * @param publisher - The attached publisher.
   * @param resolve - Resolves the Promise returned by {@link InsightsOutbox.add}.
   */
  private _sendNow(entry: IInsightsEntry, publisher: IInsightsPublisher, resolve: () => void): void {
    this._send(publisher, entry, (error: any) => {
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
