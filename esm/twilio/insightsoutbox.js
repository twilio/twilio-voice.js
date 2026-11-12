import Log from './log.js';

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
/**
 * Maximum number of buffered events. On overflow the oldest is dropped.
 */
const INSIGHTS_BUFFER_MAX_EVENTS = 200;
/**
 * Maximum age of a buffered event, measured from its creation. Older events
 * are dropped when a flush runs.
 */
const INSIGHTS_BUFFER_MAX_AGE_MS = 5 * 60 * 1000;
/**
 * The Insights endpoint whose events are buffered.
 */
const INSIGHTS_EVENTS_ENDPOINT = 'EndpointEvents';
/**
 * Per-attempt deadline for an outbox send. An attempt that has not completed
 * by then is treated as a retryable failure (and aborted where
 * `AbortController` is available), so one hung request cannot stall the
 * buffer. A late response to a timed-out attempt is ignored.
 */
const INSIGHTS_REQUEST_TIMEOUT_MS = 10000;
/**
 * Retry delay ceiling for the first retry of a backlog. Doubles with each
 * further retry, up to {@link INSIGHTS_RETRY_MAX_DELAY_MS}.
 */
const INSIGHTS_RETRY_BASE_DELAY_MS = 1000;
/**
 * Upper bound for the retry delay ceiling.
 */
const INSIGHTS_RETRY_MAX_DELAY_MS = 30000;
/**
 * Lower bound for a retry delay, so a jittered delay is never 0ms.
 */
const INSIGHTS_RETRY_MIN_DELAY_MS = 100;
/**
 * Upper bound for the retry attempt counter used as the exponent. From this
 * attempt on, `INSIGHTS_RETRY_BASE_DELAY_MS * 2 ^ attempt` (32000ms) is
 * already above {@link INSIGHTS_RETRY_MAX_DELAY_MS}, so capping the counter
 * here does not change any delay and keeps the exponent bounded during a long
 * outage.
 */
const INSIGHTS_RETRY_MAX_EXPONENT = 5;
/**
 * Time between the end of one request of the flush loop and the start of the
 * next, while buffered events are sent one after another. Spreads the backlog
 * sent after the gateway recovers instead of sending it back to back.
 */
const INSIGHTS_DRAIN_INTERVAL_MS = 200;
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
function isRetryableInsightsError(error) {
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
function getInsightsRetryDelay(attempt) {
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
function getInsightsRetryAfterDelay(error, now) {
    const status = error && typeof error.status === 'number' ? error.status : null;
    if (status !== 429 && status !== 503) {
        return null;
    }
    const value = typeof error.retryAfter === 'string' ? error.retryAfter.trim() : '';
    if (!value) {
        return null;
    }
    let delay;
    if (/^\d+$/.test(value)) {
        delay = parseInt(value, 10) * 1000;
    }
    else if (/^[-+]?[\d.]+$/.test(value)) {
        // Negative or fractional seconds, which `Date.parse` could read as a year.
        return null;
    }
    else {
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
function unrefTimer(timer) {
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
function postInsightsRequest(sender, endpointName, event, done, timeoutMs) {
    const params = {
        body: event,
        headers: {
            'Content-Type': 'application/json',
            'X-Twilio-Token': sender.token,
        },
        url: `https://${sender._host}/v4/${endpointName}`,
    };
    let isSettled = false;
    let timer = null;
    let controller = null;
    const cancelTimeout = () => {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
    };
    const settle = (error) => {
        if (isSettled) {
            return;
        }
        isSettled = true;
        cancelTimeout();
        done(error || null);
    };
    if (typeof timeoutMs === 'number' && timeoutMs > 0) {
        if (typeof AbortController === 'function') {
            try {
                controller = new AbortController();
                Object.defineProperty(params, 'signal', { value: controller.signal });
            }
            catch (e) {
                controller = null;
            }
        }
        // Started before the request so a synchronous callback clears it.
        timer = setTimeout(() => {
            timer = null;
            const error = new Error(`Insights request timed out after ${timeoutMs}ms`);
            error.name = 'TimeoutError';
            // Settle first, so the rejection caused by abort() is ignored.
            settle(error);
            if (controller) {
                try {
                    controller.abort();
                }
                catch (e) { /* the attempt is already settled */ }
            }
        }, timeoutMs);
        unrefTimer(timer);
    }
    try {
        sender._request.post(params, (error) => settle(error));
    }
    catch (error) {
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
function emitInsightsError(target, error, log) {
    if (!target || typeof target.emit !== 'function') {
        return;
    }
    if (typeof target.listenerCount === 'function' && target.listenerCount('error') === 0) {
        return;
    }
    try {
        target.emit('error', error);
    }
    catch (e) {
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
function describe(entry) {
    return `${entry.event.group} ${entry.event.name}`;
}
/**
 * Describe a request error for log lines.
 * @param error
 */
function describeError(error) {
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
class InsightsOutbox {
    constructor() {
        /**
         * The retry attempt used for the next retry delay (see
         * {@link getInsightsRetryDelay}). Kept across failure streaks and successes
         * while a backlog remains, so a gateway that keeps failing between
         * successes does not get retried at the shortest delays again; reset only
         * once the buffer has drained.
         */
        this._attempts = 0;
        /**
         * Whether {@link InsightsOutbox.destroy} was called.
         */
        this._destroyed = false;
        /**
         * The timer that starts the flush loop's next request, while the loop
         * waits {@link INSIGHTS_DRAIN_INTERVAL_MS} between buffered events.
         */
        this._drainTimer = null;
        /**
         * Buffered events, in creation order.
         */
        this._entries = [];
        /**
         * The buffered entry whose request the flush loop has in flight, if any.
         */
        this._flushingEntry = null;
        /**
         * Incremented by {@link InsightsOutbox.clear}. An event whose direct send
         * was in flight when the buffer was cleared is not put back into the buffer
         * if that send fails, so it is not retried later (for example with a token
         * for another identity).
         */
        this._generation = 0;
        /**
         * Attempts in flight (direct sends and the flush loop's request), so their
         * timeout timers can be stopped on destroy.
         */
        this._inFlight = new Set();
        /**
         * Whether the last request failed with a retryable error and no request has
         * succeeded since. Used to notify `error` listeners once per failure streak.
         */
        this._isFailing = false;
        /**
         * Whether the flush loop has a request in flight or is waiting
         * {@link INSIGHTS_DRAIN_INTERVAL_MS} before its next request.
         */
        this._isFlushing = false;
        /**
         * Whether a retry is scheduled.
         */
        this._isRetryScheduled = false;
        /**
         * Logger. Drops and retries are logged here only, never sent to Insights.
         */
        this._log = new Log('InsightsOutbox');
        /**
         * The publisher attached most recently. Its host, token and request
         * function are used for every send.
         */
        this._publisher = null;
        /**
         * The scheduled retry, if any.
         */
        this._retryTimer = null;
        /**
         * Next creation sequence number.
         */
        this._seq = 0;
    }
    /**
     * Whether {@link InsightsOutbox.destroy} was called.
     */
    get isDestroyed() {
        return this._destroyed;
    }
    /**
     * The number of buffered events.
     */
    get size() {
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
    add(event, origin) {
        const publisher = this._publisher;
        if (this._destroyed || !publisher) {
            this._log.debug('Publishing cancelled; the Insights outbox is not available');
            return Promise.resolve();
        }
        if (!publisher.isEnabled) {
            this._log.debug('Publishing cancelled; publishing is disabled');
            return Promise.resolve();
        }
        const entry = { createdAt: Date.now(), event, generation: this._generation, origin, seq: this._seq++ };
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
        return new Promise(resolve => this._sendNow(entry, publisher, resolve));
    }
    /**
     * Attach a publisher. It becomes the publisher whose host, token and
     * request function are used for all later sends, including buffered events
     * created on previously attached publishers.
     * @param publisher
     */
    attach(publisher) {
        if (this._destroyed) {
            return;
        }
        this._publisher = publisher;
    }
    /**
     * Drop every buffered event and cancel a scheduled retry or a waiting
     * flush loop.
     * @param reason - Logged with the number of dropped events.
     */
    clear(reason) {
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
    destroy() {
        if (this._destroyed) {
            return;
        }
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
    isAttached(publisher) {
        return !this._destroyed && this._publisher === publisher;
    }
    /**
     * Send buffered events, oldest first, one request at a time, waiting
     * {@link INSIGHTS_DRAIN_INTERVAL_MS} between requests. No-op while a flush
     * is in flight or waiting, or when the host is unknown or publishing is
     * disabled. Expired events are dropped first.
     */
    flush() {
        if (this._destroyed || this._isFlushing) {
            return;
        }
        const publisher = this._publisher;
        if (!publisher || !publisher.isEnabled || !publisher._host) {
            return;
        }
        this._isFlushing = true;
        this._flushNext();
    }
    /**
     * Stop the flush loop while it waits between buffered events. A flush
     * request already in flight is not affected.
     */
    _cancelDrain() {
        if (this._drainTimer === null) {
            return;
        }
        clearTimeout(this._drainTimer);
        this._drainTimer = null;
        this._isFlushing = false;
    }
    /**
     * Cancel a scheduled retry. The retry attempt is kept; see
     * {@link InsightsOutbox._attempts}.
     */
    _cancelRetry() {
        if (this._retryTimer !== null) {
            clearTimeout(this._retryTimer);
            this._retryTimer = null;
        }
        this._isRetryScheduled = false;
    }
    /**
     * Drop expired events (older than {@link INSIGHTS_BUFFER_MAX_AGE_MS}).
     */
    _dropExpired() {
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
    _enforceMaxEvents() {
        while (this._entries.length > INSIGHTS_BUFFER_MAX_EVENTS) {
            const dropped = this._entries.shift();
            if (dropped === this._flushingEntry) {
                this._log.warn(`Removed buffered Insights event ${describe(dropped)} from the full buffer (max ${INSIGHTS_BUFFER_MAX_EVENTS}) `
                    + 'while its request is in flight; it is delivered if that request succeeds and dropped otherwise');
            }
            else {
                this._log.warn(`Dropped buffered Insights event ${describe(dropped)}: the buffer is full (max ${INSIGHTS_BUFFER_MAX_EVENTS})`);
            }
        }
    }
    /**
     * Continue the flush loop: wait {@link INSIGHTS_DRAIN_INTERVAL_MS} when more
     * events are buffered, so a backlog is not sent back to back once the
     * gateway recovers. Otherwise end the loop right away.
     */
    _flushAfterInterval() {
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
    _flushNext() {
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
        this._send(publisher, entry, (error) => {
            this._flushingEntry = null;
            if (this._destroyed) {
                return;
            }
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
    _insert(entry) {
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
    _onDropped(entry, error) {
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
    _onRetryableFailure(entry, error, isBuffered) {
        if (!this._isFailing) {
            this._isFailing = true;
            // The retry attempt is not reset here: a new streak while a backlog
            // remains continues the schedule. See InsightsOutbox._attempts.
            this._log.warn(`Unable to post Insights event ${describe(entry)} (${describeError(error)}); buffering and retrying`);
            emitInsightsError(entry.origin, error, this._log);
        }
        else {
            this._log.debug(`Unable to post Insights event ${describe(entry)} (${describeError(error)}); will retry`);
        }
        if (!isBuffered) {
            const publisher = this._publisher;
            if (!publisher || !publisher.isEnabled) {
                this._log.debug(`Dropped Insights event ${describe(entry)}: publishing is disabled`);
            }
            else if (entry.generation !== this._generation) {
                this._log.debug(`Dropped Insights event ${describe(entry)}: the buffer was cleared while it was being sent`);
            }
            else if (Date.now() - entry.createdAt > INSIGHTS_BUFFER_MAX_AGE_MS) {
                this._log.warn(`Dropped Insights event ${describe(entry)}: older than ${INSIGHTS_BUFFER_MAX_AGE_MS}ms`);
            }
            else {
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
    _onSuccess() {
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
    _remove(entry) {
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
    _scheduleRetry(error) {
        if (this._destroyed || this._isRetryScheduled) {
            return;
        }
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
    _sendOnce(entries, publisher) {
        if (!publisher || !publisher.isEnabled || !publisher._host) {
            const reason = publisher && publisher.isEnabled ? 'the Insights host is not known' : 'publishing is disabled';
            this._log.warn(`Dropped ${entries.length} buffered Insights event(s): the Device was destroyed and ${reason}`);
            return;
        }
        this._log.debug(`Sending ${entries.length} buffered Insights event(s) once because the Device was destroyed`);
        entries.forEach(entry => {
            postInsightsRequest(publisher, INSIGHTS_EVENTS_ENDPOINT, entry.event, (error) => {
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
    _send(publisher, entry, done) {
        let handle = null;
        handle = postInsightsRequest(publisher, INSIGHTS_EVENTS_ENDPOINT, entry.event, (error) => {
            if (handle) {
                this._inFlight.delete(handle);
            }
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
    _sendNow(entry, publisher, resolve) {
        this._send(publisher, entry, (error) => {
            if (this._destroyed) {
                resolve();
                return;
            }
            if (!error) {
                this._onSuccess();
                this.flush();
            }
            else if (!isRetryableInsightsError(error)) {
                this._onDropped(entry, error);
            }
            else {
                this._onRetryableFailure(entry, error, false);
            }
            resolve();
        });
    }
}

export { INSIGHTS_BUFFER_MAX_AGE_MS, INSIGHTS_BUFFER_MAX_EVENTS, INSIGHTS_DRAIN_INTERVAL_MS, INSIGHTS_EVENTS_ENDPOINT, INSIGHTS_REQUEST_TIMEOUT_MS, INSIGHTS_RETRY_BASE_DELAY_MS, INSIGHTS_RETRY_MAX_DELAY_MS, INSIGHTS_RETRY_MAX_EXPONENT, INSIGHTS_RETRY_MIN_DELAY_MS, InsightsOutbox as default, emitInsightsError, getInsightsRetryAfterDelay, getInsightsRetryDelay, isRetryableInsightsError, postInsightsRequest };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zaWdodHNvdXRib3guanMiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vaW5zaWdodHNvdXRib3gudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQWtDRztBQUdIOztBQUVHO0FBQ0ksTUFBTSwwQkFBMEIsR0FBRztBQUUxQzs7O0FBR0c7TUFDVSwwQkFBMEIsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHO0FBRW5EOztBQUVHO0FBQ0ksTUFBTSx3QkFBd0IsR0FBRztBQUV4Qzs7Ozs7QUFLRztBQUNJLE1BQU0sMkJBQTJCLEdBQUc7QUFFM0M7OztBQUdHO0FBQ0ksTUFBTSw0QkFBNEIsR0FBRztBQUU1Qzs7QUFFRztBQUNJLE1BQU0sMkJBQTJCLEdBQUc7QUFFM0M7O0FBRUc7QUFDSSxNQUFNLDJCQUEyQixHQUFHO0FBRTNDOzs7Ozs7QUFNRztBQUNJLE1BQU0sMkJBQTJCLEdBQUc7QUFFM0M7Ozs7QUFJRztBQUNJLE1BQU0sMEJBQTBCLEdBQUc7QUFzRjFDOzs7Ozs7Ozs7O0FBVUc7QUFDRyxTQUFVLHdCQUF3QixDQUFDLEtBQVUsRUFBQTtJQUNqRCxNQUFNLE1BQU0sR0FBRyxLQUFLLElBQUksT0FBTyxLQUFLLENBQUMsTUFBTSxLQUFLLFFBQVEsR0FBRyxLQUFLLENBQUMsTUFBTSxHQUFHLElBQUk7QUFDOUUsSUFBQSxJQUFJLE1BQU0sS0FBSyxJQUFJLEVBQUU7QUFDbkIsUUFBQSxPQUFPLElBQUk7SUFDYjtBQUNBLElBQUEsT0FBTyxNQUFNLEtBQUssR0FBRyxLQUFLLE1BQU0sSUFBSSxHQUFHLElBQUksTUFBTSxJQUFJLEdBQUcsQ0FBQztBQUMzRDtBQUVBOzs7Ozs7QUFNRztBQUNHLFNBQVUscUJBQXFCLENBQUMsT0FBZSxFQUFBO0FBQ25ELElBQUEsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENB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
