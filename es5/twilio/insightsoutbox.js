'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var log = require('./log.js');

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
var INSIGHTS_BUFFER_MAX_EVENTS = 200;
/**
 * Maximum age of a buffered event, measured from its creation. Older events
 * are dropped when a flush runs.
 */
var INSIGHTS_BUFFER_MAX_AGE_MS = 5 * 60 * 1000;
/**
 * The Insights endpoint whose events are buffered.
 */
var INSIGHTS_EVENTS_ENDPOINT = 'EndpointEvents';
/**
 * Per-attempt deadline for an outbox send. An attempt that has not completed
 * by then is treated as a retryable failure (and aborted where
 * `AbortController` is available), so one hung request cannot stall the
 * buffer. A late response to a timed-out attempt is ignored.
 */
var INSIGHTS_REQUEST_TIMEOUT_MS = 10000;
/**
 * Retry delay ceiling for the first retry of a backlog. Doubles with each
 * further retry, up to {@link INSIGHTS_RETRY_MAX_DELAY_MS}.
 */
var INSIGHTS_RETRY_BASE_DELAY_MS = 1000;
/**
 * Upper bound for the retry delay ceiling.
 */
var INSIGHTS_RETRY_MAX_DELAY_MS = 30000;
/**
 * Lower bound for a retry delay, so a jittered delay is never 0ms.
 */
var INSIGHTS_RETRY_MIN_DELAY_MS = 100;
/**
 * Upper bound for the retry attempt counter used as the exponent. From this
 * attempt on, `INSIGHTS_RETRY_BASE_DELAY_MS * 2 ^ attempt` (32000ms) is
 * already above {@link INSIGHTS_RETRY_MAX_DELAY_MS}, so capping the counter
 * here does not change any delay and keeps the exponent bounded during a long
 * outage.
 */
var INSIGHTS_RETRY_MAX_EXPONENT = 5;
/**
 * Time between the end of one request of the flush loop and the start of the
 * next, while buffered events are sent one after another. Spreads the backlog
 * sent after the gateway recovers instead of sending it back to back.
 */
var INSIGHTS_DRAIN_INTERVAL_MS = 200;
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
    var status = error && typeof error.status === 'number' ? error.status : null;
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
    var exponent = Math.min(Math.max(attempt, 0), INSIGHTS_RETRY_MAX_EXPONENT);
    var ceiling = Math.min(INSIGHTS_RETRY_MAX_DELAY_MS, INSIGHTS_RETRY_BASE_DELAY_MS * Math.pow(2, exponent));
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
    var status = error && typeof error.status === 'number' ? error.status : null;
    if (status !== 429 && status !== 503) {
        return null;
    }
    var value = typeof error.retryAfter === 'string' ? error.retryAfter.trim() : '';
    if (!value) {
        return null;
    }
    var delay;
    if (/^\d+$/.test(value)) {
        delay = parseInt(value, 10) * 1000;
    }
    else if (/^[-+]?[\d.]+$/.test(value)) {
        // Negative or fractional seconds, which `Date.parse` could read as a year.
        return null;
    }
    else {
        var date = Date.parse(value);
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
    var params = {
        body: event,
        headers: {
            'Content-Type': 'application/json',
            'X-Twilio-Token': sender.token,
        },
        url: "https://".concat(sender._host, "/v4/").concat(endpointName),
    };
    var isSettled = false;
    var timer = null;
    var controller = null;
    var cancelTimeout = function () {
        if (timer !== null) {
            clearTimeout(timer);
            timer = null;
        }
    };
    var settle = function (error) {
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
        timer = setTimeout(function () {
            timer = null;
            var error = new Error("Insights request timed out after ".concat(timeoutMs, "ms"));
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
        sender._request.post(params, function (error) { return settle(error); });
    }
    catch (error) {
        settle(error || new Error('Insights request threw'));
    }
    return {
        cancelTimeout: cancelTimeout,
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
    return "".concat(entry.event.group, " ").concat(entry.event.name);
}
/**
 * Describe a request error for log lines.
 * @param error
 */
function describeError(error) {
    if (error && typeof error.status === 'number') {
        return "HTTP ".concat(error.status);
    }
    return "".concat(error);
}
/**
 * The buffer, retry timer and flush loop for Insights events.
 *
 * Retries do not use the signaling reconnect backoff (backoff.ts): that
 * schedule (100ms to 1s) applies jitter before its cap, so after a few
 * attempts every client would retry at exactly 1s, in step. They are
 * scheduled with {@link getInsightsRetryDelay} instead.
 */
var InsightsOutbox = /** @class */ (function () {
    function InsightsOutbox() {
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
        this._log = new log.default('InsightsOutbox');
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
    Object.defineProperty(InsightsOutbox.prototype, "isDestroyed", {
        /**
         * Whether {@link InsightsOutbox.destroy} was called.
         */
        get: function () {
            return this._destroyed;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(InsightsOutbox.prototype, "size", {
        /**
         * The number of buffered events.
         */
        get: function () {
            return this._entries.length;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Accept a built event. Sends it right away when the host is known and
     * nothing is buffered, retrying, or flushing; otherwise buffers it behind the
     * events already waiting so creation order is kept.
     * @param event - The built event body.
     * @param origin - The publisher the event was posted on.
     * @returns A Promise that always resolves: after the first send attempt when
     *   sent right away, or immediately when buffered or dropped.
     */
    InsightsOutbox.prototype.add = function (event, origin) {
        var _this = this;
        var publisher = this._publisher;
        if (this._destroyed || !publisher) {
            this._log.debug('Publishing cancelled; the Insights outbox is not available');
            return Promise.resolve();
        }
        if (!publisher.isEnabled) {
            this._log.debug('Publishing cancelled; publishing is disabled');
            return Promise.resolve();
        }
        var entry = { createdAt: Date.now(), event: event, generation: this._generation, origin: origin, seq: this._seq++ };
        if (!publisher._host || this._entries.length || this._isFlushing || this._isRetryScheduled) {
            this._log.debug("Buffering Insights event ".concat(describe(entry)), JSON.stringify({
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
        return new Promise(function (resolve) { return _this._sendNow(entry, publisher, resolve); });
    };
    /**
     * Attach a publisher. It becomes the publisher whose host, token and
     * request function are used for all later sends, including buffered events
     * created on previously attached publishers.
     * @param publisher
     */
    InsightsOutbox.prototype.attach = function (publisher) {
        if (this._destroyed) {
            return;
        }
        this._publisher = publisher;
    };
    /**
     * Drop every buffered event and cancel a scheduled retry or a waiting
     * flush loop.
     * @param reason - Logged with the number of dropped events.
     */
    InsightsOutbox.prototype.clear = function (reason) {
        var count = this._entries.length;
        this._entries = [];
        this._generation++;
        this._isFailing = false;
        this._cancelRetry();
        this._cancelDrain();
        if (count) {
            this._log.warn("Dropped ".concat(count, " buffered Insights event(s): ").concat(reason));
        }
    };
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
    InsightsOutbox.prototype.destroy = function () {
        var _this = this;
        if (this._destroyed) {
            return;
        }
        this._dropExpired();
        var remaining = this._entries.filter(function (entry) { return entry !== _this._flushingEntry; });
        var publisher = this._publisher;
        this._entries = [];
        this._isFailing = false;
        this._cancelRetry();
        this._cancelDrain();
        this._inFlight.forEach(function (handle) { return handle.cancelTimeout(); });
        this._inFlight.clear();
        this._destroyed = true;
        this._flushingEntry = null;
        this._publisher = null;
        if (remaining.length) {
            this._sendOnce(remaining, publisher);
        }
    };
    /**
     * Whether the given publisher is the one attached most recently.
     * @param publisher
     */
    InsightsOutbox.prototype.isAttached = function (publisher) {
        return !this._destroyed && this._publisher === publisher;
    };
    /**
     * Send buffered events, oldest first, one request at a time, waiting
     * {@link INSIGHTS_DRAIN_INTERVAL_MS} between requests. No-op while a flush
     * is in flight or waiting, or when the host is unknown or publishing is
     * disabled. Expired events are dropped first.
     */
    InsightsOutbox.prototype.flush = function () {
        if (this._destroyed || this._isFlushing) {
            return;
        }
        var publisher = this._publisher;
        if (!publisher || !publisher.isEnabled || !publisher._host) {
            return;
        }
        this._isFlushing = true;
        this._flushNext();
    };
    /**
     * Stop the flush loop while it waits between buffered events. A flush
     * request already in flight is not affected.
     */
    InsightsOutbox.prototype._cancelDrain = function () {
        if (this._drainTimer === null) {
            return;
        }
        clearTimeout(this._drainTimer);
        this._drainTimer = null;
        this._isFlushing = false;
    };
    /**
     * Cancel a scheduled retry. The retry attempt is kept; see
     * {@link InsightsOutbox._attempts}.
     */
    InsightsOutbox.prototype._cancelRetry = function () {
        if (this._retryTimer !== null) {
            clearTimeout(this._retryTimer);
            this._retryTimer = null;
        }
        this._isRetryScheduled = false;
    };
    /**
     * Drop expired events (older than {@link INSIGHTS_BUFFER_MAX_AGE_MS}).
     */
    InsightsOutbox.prototype._dropExpired = function () {
        var now = Date.now();
        var kept = this._entries.filter(function (entry) { return now - entry.createdAt <= INSIGHTS_BUFFER_MAX_AGE_MS; });
        var dropped = this._entries.length - kept.length;
        if (dropped) {
            this._entries = kept;
            this._log.warn("Dropped ".concat(dropped, " buffered Insights event(s) older than ").concat(INSIGHTS_BUFFER_MAX_AGE_MS, "ms"));
        }
    };
    /**
     * Drop the oldest events while the buffer is over {@link INSIGHTS_BUFFER_MAX_EVENTS}.
     */
    InsightsOutbox.prototype._enforceMaxEvents = function () {
        while (this._entries.length > INSIGHTS_BUFFER_MAX_EVENTS) {
            var dropped = this._entries.shift();
            if (dropped === this._flushingEntry) {
                this._log.warn("Removed buffered Insights event ".concat(describe(dropped), " from the full buffer (max ").concat(INSIGHTS_BUFFER_MAX_EVENTS, ") ")
                    + 'while its request is in flight; it is delivered if that request succeeds and dropped otherwise');
            }
            else {
                this._log.warn("Dropped buffered Insights event ".concat(describe(dropped), ": the buffer is full (max ").concat(INSIGHTS_BUFFER_MAX_EVENTS, ")"));
            }
        }
    };
    /**
     * Continue the flush loop: wait {@link INSIGHTS_DRAIN_INTERVAL_MS} when more
     * events are buffered, so a backlog is not sent back to back once the
     * gateway recovers. Otherwise end the loop right away.
     */
    InsightsOutbox.prototype._flushAfterInterval = function () {
        var _this = this;
        if (!this._entries.length) {
            this._flushNext();
            return;
        }
        this._drainTimer = setTimeout(function () {
            _this._drainTimer = null;
            _this._flushNext();
        }, INSIGHTS_DRAIN_INTERVAL_MS);
        unrefTimer(this._drainTimer);
    };
    /**
     * Send the oldest buffered event, then continue with the next one until the
     * buffer is empty or a retryable failure stops the loop.
     */
    InsightsOutbox.prototype._flushNext = function () {
        var _this = this;
        var publisher = this._publisher;
        if (this._destroyed || !publisher || !publisher.isEnabled || !publisher._host) {
            this._isFlushing = false;
            return;
        }
        this._dropExpired();
        var entry = this._entries[0];
        if (!entry) {
            this._isFlushing = false;
            return;
        }
        this._flushingEntry = entry;
        this._send(publisher, entry, function (error) {
            _this._flushingEntry = null;
            if (_this._destroyed) {
                return;
            }
            if (!error) {
                _this._remove(entry);
                _this._onSuccess();
                _this._flushAfterInterval();
                return;
            }
            if (!isRetryableInsightsError(error)) {
                _this._remove(entry);
                _this._onDropped(entry, error);
                _this._flushAfterInterval();
                return;
            }
            _this._isFlushing = false;
            _this._onRetryableFailure(entry, error, true);
        });
    };
    /**
     * Insert an event into the buffer in creation order.
     * @param entry
     */
    InsightsOutbox.prototype._insert = function (entry) {
        var index = this._entries.length;
        while (index > 0 && this._entries[index - 1].seq > entry.seq) {
            index--;
        }
        this._entries.splice(index, 0, entry);
        this._enforceMaxEvents();
    };
    /**
     * Handle a non-retryable failure: the event is dropped.
     * @param entry
     * @param error
     */
    InsightsOutbox.prototype._onDropped = function (entry, error) {
        this._log.warn("Dropped Insights event ".concat(describe(entry), ": non-retryable error (").concat(describeError(error), ")"));
        emitInsightsError(entry.origin, error, this._log);
    };
    /**
     * Handle a retryable failure: keep (or put back) the event and schedule a
     * retry. `error` listeners are notified on the first failure of a streak
     * only, so a long outage does not produce one notification per retry.
     * @param entry
     * @param error
     * @param isBuffered - Whether the entry is already in the buffer.
     */
    InsightsOutbox.prototype._onRetryableFailure = function (entry, error, isBuffered) {
        if (!this._isFailing) {
            this._isFailing = true;
            // The retry attempt is not reset here: a new streak while a backlog
            // remains continues the schedule. See InsightsOutbox._attempts.
            this._log.warn("Unable to post Insights event ".concat(describe(entry), " (").concat(describeError(error), "); buffering and retrying"));
            emitInsightsError(entry.origin, error, this._log);
        }
        else {
            this._log.debug("Unable to post Insights event ".concat(describe(entry), " (").concat(describeError(error), "); will retry"));
        }
        if (!isBuffered) {
            var publisher = this._publisher;
            if (!publisher || !publisher.isEnabled) {
                this._log.debug("Dropped Insights event ".concat(describe(entry), ": publishing is disabled"));
            }
            else if (entry.generation !== this._generation) {
                this._log.debug("Dropped Insights event ".concat(describe(entry), ": the buffer was cleared while it was being sent"));
            }
            else if (Date.now() - entry.createdAt > INSIGHTS_BUFFER_MAX_AGE_MS) {
                this._log.warn("Dropped Insights event ".concat(describe(entry), ": older than ").concat(INSIGHTS_BUFFER_MAX_AGE_MS, "ms"));
            }
            else {
                this._insert(entry);
            }
        }
        if (this._entries.length) {
            this._scheduleRetry(error);
        }
    };
    /**
     * Handle a successful request: end the failure streak and cancel a
     * scheduled retry, since the gateway is reachable again (the caller flushes
     * right away). The retry attempt is reset only once nothing is buffered or
     * in flight, so a gateway that fails again while a backlog remains is
     * retried with the delays the backlog had reached.
     */
    InsightsOutbox.prototype._onSuccess = function () {
        this._isFailing = false;
        this._cancelRetry();
        if (!this._entries.length && !this._inFlight.size) {
            this._attempts = 0;
        }
    };
    /**
     * Remove an event from the buffer, if it is still there.
     * @param entry
     */
    InsightsOutbox.prototype._remove = function (entry) {
        var index = this._entries.indexOf(entry);
        if (index !== -1) {
            this._entries.splice(index, 1);
        }
    };
    /**
     * Schedule one retry, unless one is already scheduled. The delay is the
     * jittered delay for the current attempt, or the failed response's
     * `Retry-After` when that is longer (see {@link getInsightsRetryAfterDelay}).
     * @param error - The error of the failed request.
     */
    InsightsOutbox.prototype._scheduleRetry = function (error) {
        var _this = this;
        if (this._destroyed || this._isRetryScheduled) {
            return;
        }
        var attempt = this._attempts;
        var retryAfter = getInsightsRetryAfterDelay(error, Date.now());
        var delay = Math.max(getInsightsRetryDelay(attempt), retryAfter || 0);
        this._attempts = Math.min(attempt + 1, INSIGHTS_RETRY_MAX_EXPONENT);
        this._isRetryScheduled = true;
        this._log.debug("Retrying buffered Insights events in ".concat(delay, "ms (attempt ").concat(attempt + 1)
            + "".concat(retryAfter === null ? '' : ", Retry-After ".concat(retryAfter, "ms"), ")"));
        this._retryTimer = setTimeout(function () {
            _this._retryTimer = null;
            _this._isRetryScheduled = false;
            _this.flush();
        }, delay);
        unrefTimer(this._retryTimer);
    };
    /**
     * Send events once, without retries, after the outbox is destroyed. See
     * {@link InsightsOutbox.destroy}.
     * @param entries - The events, in creation order.
     * @param publisher - The publisher that was attached at destroy.
     */
    InsightsOutbox.prototype._sendOnce = function (entries, publisher) {
        var _this = this;
        if (!publisher || !publisher.isEnabled || !publisher._host) {
            var reason = publisher && publisher.isEnabled ? 'the Insights host is not known' : 'publishing is disabled';
            this._log.warn("Dropped ".concat(entries.length, " buffered Insights event(s): the Device was destroyed and ").concat(reason));
            return;
        }
        this._log.debug("Sending ".concat(entries.length, " buffered Insights event(s) once because the Device was destroyed"));
        entries.forEach(function (entry) {
            postInsightsRequest(publisher, INSIGHTS_EVENTS_ENDPOINT, entry.event, function (error) {
                if (error) {
                    _this._log.warn("Dropped Insights event ".concat(describe(entry), ": its final send after the Device was destroyed failed (").concat(describeError(error), ")"));
                }
            }, INSIGHTS_REQUEST_TIMEOUT_MS);
        });
    };
    /**
     * Start one attempt for an entry with the per-attempt timeout, tracking it
     * until it settles.
     * @param publisher - The attached publisher (host, token, request).
     * @param entry
     * @param done - Called once with `null` or the error.
     */
    InsightsOutbox.prototype._send = function (publisher, entry, done) {
        var _this = this;
        var handle = null;
        handle = postInsightsRequest(publisher, INSIGHTS_EVENTS_ENDPOINT, entry.event, function (error) {
            if (handle) {
                _this._inFlight.delete(handle);
            }
            done(error);
        }, INSIGHTS_REQUEST_TIMEOUT_MS);
        // A synchronous callback has already settled it; nothing to track.
        if (!handle.isSettled) {
            this._inFlight.add(handle);
        }
    };
    /**
     * Send an event right away (nothing buffered or in flight).
     * @param entry
     * @param publisher - The attached publisher.
     * @param resolve - Resolves the Promise returned by {@link InsightsOutbox.add}.
     */
    InsightsOutbox.prototype._sendNow = function (entry, publisher, resolve) {
        var _this = this;
        this._send(publisher, entry, function (error) {
            if (_this._destroyed) {
                resolve();
                return;
            }
            if (!error) {
                _this._onSuccess();
                _this.flush();
            }
            else if (!isRetryableInsightsError(error)) {
                _this._onDropped(entry, error);
            }
            else {
                _this._onRetryableFailure(entry, error, false);
            }
            resolve();
        });
    };
    return InsightsOutbox;
}());

exports.INSIGHTS_BUFFER_MAX_AGE_MS = INSIGHTS_BUFFER_MAX_AGE_MS;
exports.INSIGHTS_BUFFER_MAX_EVENTS = INSIGHTS_BUFFER_MAX_EVENTS;
exports.INSIGHTS_DRAIN_INTERVAL_MS = INSIGHTS_DRAIN_INTERVAL_MS;
exports.INSIGHTS_EVENTS_ENDPOINT = INSIGHTS_EVENTS_ENDPOINT;
exports.INSIGHTS_REQUEST_TIMEOUT_MS = INSIGHTS_REQUEST_TIMEOUT_MS;
exports.INSIGHTS_RETRY_BASE_DELAY_MS = INSIGHTS_RETRY_BASE_DELAY_MS;
exports.INSIGHTS_RETRY_MAX_DELAY_MS = INSIGHTS_RETRY_MAX_DELAY_MS;
exports.INSIGHTS_RETRY_MAX_EXPONENT = INSIGHTS_RETRY_MAX_EXPONENT;
exports.INSIGHTS_RETRY_MIN_DELAY_MS = INSIGHTS_RETRY_MIN_DELAY_MS;
exports.default = InsightsOutbox;
exports.emitInsightsError = emitInsightsError;
exports.getInsightsRetryAfterDelay = getInsightsRetryAfterDelay;
exports.getInsightsRetryDelay = getInsightsRetryDelay;
exports.isRetryableInsightsError = isRetryableInsightsError;
exports.postInsightsRequest = postInsightsRequest;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5zaWdodHNvdXRib3guanMiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vaW5zaWdodHNvdXRib3gudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOlsiTG9nIl0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFBQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQWtDRztBQUdIOztBQUVHO0FBQ0ksSUFBTSwwQkFBMEIsR0FBRztBQUUxQzs7O0FBR0c7SUFDVSwwQkFBMEIsR0FBRyxDQUFDLEdBQUcsRUFBRSxHQUFHO0FBRW5EOztBQUVHO0FBQ0ksSUFBTSx3QkFBd0IsR0FBRztBQUV4Qzs7Ozs7QUFLRztBQUNJLElBQU0sMkJBQTJCLEdBQUc7QUFFM0M7OztBQUdHO0FBQ0ksSUFBTSw0QkFBNEIsR0FBRztBQUU1Qzs7QUFFRztBQUNJLElBQU0sMkJBQTJCLEdBQUc7QUFFM0M7O0FBRUc7QUFDSSxJQUFNLDJCQUEyQixHQUFHO0FBRTNDOzs7Ozs7QUFNRztBQUNJLElBQU0sMkJBQTJCLEdBQUc7QUFFM0M7Ozs7QUFJRztBQUNJLElBQU0sMEJBQTBCLEdBQUc7QUFzRjFDOzs7Ozs7Ozs7O0FBVUc7QUFDRyxTQUFVLHdCQUF3QixDQUFDLEtBQVUsRUFBQTtJQUNqRCxJQUFNLE1BQU0sR0FBRyxLQUFLLElBQUksT0FBTyxLQUFLLENBQUMsTUFBTSxLQUFLLFFBQVEsR0FBRyxLQUFLLENBQUMsTUFBTSxHQUFHLElBQUk7QUFDOUUsSUFBQSxJQUFJLE1BQU0sS0FBSyxJQUFJLEVBQUU7QUFDbkIsUUFBQSxPQUFPLElBQUk7SUFDYjtBQUNBLElBQUEsT0FBTyxNQUFNLEtBQUssR0FBRyxLQUFLLE1BQU0sSUFBSSxHQUFHLElBQUksTUFBTSxJQUFJLEdBQUcsQ0FBQztBQUMzRDtBQUVBOzs7Ozs7QUFNRztBQUNHLFNBQVUscUJBQXFCLENBQUMsT0FBZSxFQUFBO0FBQ25ELElBQUEsSUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FB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
