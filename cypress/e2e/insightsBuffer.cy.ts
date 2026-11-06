import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent } from '../../tests/lib/util';

// VBLOCKS-7468: Insights EndpointEvents are buffered in memory while the event
// gateway host is unknown or a post fails with a retryable error (network
// error, HTTP 5xx, HTTP 429), retried with the same-edge signaling backoff
// (100 ms doubling, 40% jitter, max 1000 ms) and flushed in creation order.
// Other HTTP 4xx responses drop the event.
//
// This spec runs against a real backend and is skipped unless both of these
// Cypress env values are set (for example via CYPRESS_DEVICE_CHUNDERW /
// CYPRESS_DEVICE_EVENTGW):
//   DEVICE_CHUNDERW  signaling hostname, e.g. chunderw-vpc-gll.stage.twilio.com
//   DEVICE_EVENTGW   insights hostname, e.g. eventgw.stage.twilio.com
// The token's TwiML app must dial `<Client>` with either the `To` param (README
// "Integration Tests" app) or the `recepient` param; both are sent.
//
// Faults are injected at the SDK's network boundary by a wrapper around
// window.fetch: for `/v4/EndpointEvents` it either rejects like a network
// failure (TypeError, nothing is sent) or resolves with a stubbed HTTP status
// (nothing is sent). Without a fault it calls through to the real gateway. The
// same wrapper records every attempt the SDK makes and its outcome, and a
// call-through wrapper around the Device outbox `add` records every event at
// creation. Request headers (the access token) are never recorded.
//
// cy.intercept was tried first and is not used: in this harness its routes
// intermittently did not match the SDK's eventgw posts (an active route saw
// none of a test's requests, which then reached the real gateway), so faults
// could not be applied reliably.

const chunderw: string | undefined = Cypress.env('DEVICE_CHUNDERW');
const eventgw: string | undefined = Cypress.env('DEVICE_EVENTGW');
const isConfigured = !!(chunderw && eventgw);
const suiteTitle = isConfigured
  ? 'Insights event buffer'
  : 'Insights event buffer (skipped: set CYPRESS_DEVICE_CHUNDERW and CYPRESS_DEVICE_EVENTGW, e.g. to stage)';

// Same-edge signaling backoff used for Insights retries.
const BACKOFF_MIN_MS = 100;
const BACKOFF_FACTOR = 2;
const BACKOFF_JITTER = 0.4;
const BACKOFF_MAX_MS = 1000;
// Allowance for timer and event loop latency on top of the backoff delay.
const DELAY_SLACK_MS = 250;

type Fault = 'none' | 'network' | number;

interface Attempt {
  body: string;
  endpoint: string;
  end?: number;
  host: string;
  outcome?: number | 'network_error';
  start: number;
  url: string;
}

interface Created {
  at: number;
  body: string;
  connectionId?: string;
  group: string;
  name: string;
  tempCallSid?: string;
  timestamp: string;
}

interface Tracker {
  created: Created[];
  outbox: any;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withTimeout = <T>(promise: Promise<T>, ms: number, what: string): Promise<T> =>
  Promise.race([promise, new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms} ms waiting for ${what}`)), ms))]);

async function waitUntil(condition: () => boolean, timeoutMs: number, what: string,
                         detail?: () => string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!condition()) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out after ${timeoutMs} ms waiting for ${what}${detail ? `; ${detail()}` : ''}`);
    }
    await sleep(50);
  }
}

// Every EndpointEvents / EndpointMetrics fetch the SDK makes, in start order.
const attempts: Attempt[] = [];
const originalFetch = window.fetch;
let fault: Fault = 'none';
// Latency of an injected failure, so it settles asynchronously like a real one.
const FAULT_LATENCY_MS = 5;

const explain = (list: Attempt[]) => list.map(a => `${keyOf(a)} outcome=${a.outcome} start=${a.start}`);

/** The SDK-visible result of a post while a fault is active. */
function injectFault(current: Fault): Promise<Response> {
  return new Promise((resolve, reject) => setTimeout(() => {
    if (current === 'network') {
      reject(new TypeError('Failed to fetch (injected by insightsBuffer.cy.ts)'));
    } else {
      resolve(new Response(`stubbed HTTP ${current} (insightsBuffer.cy.ts)`, { status: current as number }));
    }
  }, FAULT_LATENCY_MS));
}

function installFetchRecorder() {
  (window as any).fetch = (input: any, init?: any) => {
    const url = typeof input === 'string' ? input : input && input.url;
    const match = typeof url === 'string' && /^https:\/\/([^/]+)\/v4\/(EndpointEvents|EndpointMetrics)$/.exec(url);
    const p: Promise<Response> = match && match[2] === 'EndpointEvents' && fault !== 'none'
      ? injectFault(fault)
      : originalFetch.call(window, input, init);
    if (match) {
      // Only the body is kept. Headers carry the access token and are not read.
      const attempt: Attempt = {
        body: init && typeof init.body === 'string' ? init.body : '',
        endpoint: match[2],
        host: match[1],
        start: Date.now(),
        url,
      };
      attempts.push(attempt);
      p.then(res => {
        attempt.end = Date.now();
        attempt.outcome = res.status;
      }, () => {
        attempt.end = Date.now();
        attempt.outcome = 'network_error';
      });
    }
    return p;
  };
}

/**
 * Record every event handed to the Device's Insights outbox, serialized the
 * same way request.ts serializes the body, at creation time.
 */
function track(device: Device): Tracker {
  const outbox = (device as any)._insightsOutbox;
  assert(outbox, 'Device has no Insights outbox after construction');
  const created: Created[] = [];
  const originalAdd = outbox.add;
  outbox.add = function(event: any, origin: any) {
    created.push({
      at: Date.now(),
      body: JSON.stringify(event),
      connectionId: event.payload && event.payload.signaling_connection_id,
      group: event.group,
      name: event.name,
      tempCallSid: event.payload && event.payload.temp_call_sid,
      timestamp: event.timestamp,
    });
    return originalAdd.call(this, event, origin);
  };
  return { created, outbox };
}

const attemptsFor = (events: Created[]): Attempt[] => {
  const bodies = new Set(events.map(e => e.body));
  return attempts.filter(a => a.endpoint === 'EndpointEvents' && bodies.has(a.body));
};

const isDelivered = (a: Attempt) => typeof a.outcome === 'number' && a.outcome >= 200 && a.outcome < 300;

const isIdle = (tracker: Tracker, events: Created[] = tracker.created) =>
  tracker.outbox.size === 0 && !tracker.outbox._isFlushing && !tracker.outbox._isRetryScheduled
  && attemptsFor(events).every(a => a.end !== undefined);

/**
 * Retry attempts of the events created in a window: attempts whose body was
 * already attempted before. While the gateway keeps failing, each backoff
 * `ready` sends only the oldest buffered event.
 */
const retriesFor = (events: Created[]): Attempt[] => {
  const seen = new Set<string>();
  return attemptsFor(events).filter(a => {
    const isRetry = seen.has(a.body);
    seen.add(a.body);
    return isRetry;
  });
};

/**
 * Delay before each retry: from the first failure of the streak to the first
 * retry, then from each retry's failure to the next retry.
 */
function retryDelays(events: Created[]): number[] {
  const all = attemptsFor(events);
  const retries = retriesFor(events);
  if (!retries.length) { return []; }
  const firstFailure = Math.min(...all.filter(a => a.end !== undefined).map(a => a.end as number));
  return retries.map((r, i) => r.start - (i === 0 ? firstFailure : retries[i - 1].end as number));
}

/** Accepted range of the k-th backoff delay (0-based), before slack. */
function backoffRange(k: number): [number, number] {
  const raw = BACKOFF_MIN_MS * Math.pow(BACKOFF_FACTOR, k);
  return [Math.min(Math.floor(raw * (1 - BACKOFF_JITTER)), BACKOFF_MAX_MS),
    Math.min(Math.ceil(raw * (1 + BACKOFF_JITTER)), BACKOFF_MAX_MS)];
}

const keyOf = (e: { body: string }) => {
  const parsed = JSON.parse(e.body);
  return `${parsed.group}/${parsed.name}@${parsed.timestamp}`;
};

(isConfigured ? describe : describe.skip)(suiteTitle, { retries: 0 }, function() {
  this.timeout(120000);

  let device1: Device;
  let device2: Device;
  let device3: Device | undefined;
  let device4: Device | undefined;
  let identity2: string;
  let tracker1: Tracker;
  let tracker2: Tracker;
  const report: Record<string, any> = {};

  const noop = () => { /* errors are asserted through Insights attempts */ };

  const statusCounts = (list: Attempt[]) => list.reduce((acc: Record<string, number>, a) => {
    const key = String(a.outcome === undefined ? 'pending' : a.outcome);
    acc[key] = (acc[key] || 0) + 1;
    return acc;
  }, {});

  const waitIdle = (what: string) =>
    waitUntil(() => isIdle(tracker1) && isIdle(tracker2), 30000, `idle Insights outboxes (${what})`);

  const placeAnsweredCall = async (caller: Device = device1): Promise<string> => {
    const incoming = expectEvent(Device.EventName.Incoming, device2) as Promise<Call>;
    const call = await caller.connect({ params: { To: identity2, recepient: identity2 } });
    const tempSid = call.outboundConnectionId as string;
    assert(tempSid, 'outbound call has no temp call sid');
    const answered = expectEvent('accept', call);
    const call2 = await withTimeout(incoming, 30000, 'incoming call on device2');
    call2.accept();
    await withTimeout(answered, 30000, 'accept on the outbound call');
    await sleep(1000);
    const disconnected = expectEvent('disconnect', call);
    call.disconnect();
    await withTimeout(disconnected, 15000, 'disconnect');
    await sleep(500);
    return tempSid;
  };

  /** Asserts the events were delivered exactly once each, in creation order. */
  const assertDeliveredOnceInOrder = (events: Created[], since: number) => {
    const all = attemptsFor(events);
    const delivered = all.filter(isDelivered);
    assert.deepStrictEqual(delivered.map(keyOf), events.map(keyOf),
      'delivered events (group/name@timestamp) differ from the created events, or are out of order');
    assert.deepStrictEqual(delivered.map(a => a.body), events.map(e => e.body),
      'delivered bodies differ from the bodies built at creation');
    const failedAfter = all.filter(a => a.start >= since && !isDelivered(a));
    assert.deepStrictEqual(failedAfter.map(a => `${keyOf(a)}:${a.outcome}`), [],
      'attempts after recovery that were not 2xx');
    return delivered;
  };

  before(async () => {
    installFetchRecorder();
    const identity1 = 'insbuf1-' + Date.now();
    identity2 = 'insbuf2-' + Date.now();
    const [token1, token2] = await Promise.all([
      generateAccessToken(identity1, 900),
      generateAccessToken(identity2, 900),
    ]);
    device1 = new Device(token1, { chunderw, eventgw });
    device2 = new Device(token2, { chunderw, eventgw });
    [device1, device2].forEach(d => d.on(Device.EventName.Error, noop));
    tracker1 = track(device1);
    tracker2 = track(device2);
    await Promise.all([device1.register(), device2.register()]);
  });

  beforeEach(() => {
    fault = 'none';
  });

  afterEach(() => {
    fault = 'none';
  });

  after(() => {
    fault = 'none';
    [device1, device2, device3, device4].forEach(device => {
      if (device) {
        device.disconnectAll();
        device.destroy();
      }
    });
    (window as any).fetch = originalFetch;
  });

  it('should buffer events and retry them with backoff while eventgw is unreachable (network error)', () => {
    cy.then({ timeout: 90000 }, async () => {
      await waitIdle('before');
      fault = 'network';
      const faultAt = Date.now();
      const start = tracker1.created.length;
      await placeAnsweredCall();
      await waitUntil(() => retriesFor(tracker1.created.slice(start)).length >= 6, 20000, '6 retries');
      const events = tracker1.created.slice(start);
      assert(events.length > 0, 'the call created no Insights events');

      const all = attemptsFor(events);
      assert.deepStrictEqual(explain(all.filter(isDelivered)), [], `events were delivered during the outage; fault set at ${faultAt}`);
      assert.deepStrictEqual(all.filter(a => a.outcome !== undefined && a.outcome !== 'network_error')
        .map(a => `${keyOf(a)}:${a.outcome}`), [], 'unexpected outcomes during the outage');
      // Every event was attempted (directly, or via the buffer) and is still buffered.
      assert.strictEqual(tracker1.outbox.size, events.length, 'not every created event is buffered');
      assert.deepStrictEqual(tracker1.outbox._entries.map((e: any) => JSON.stringify(e.event)),
        events.map(e => e.body), 'buffer is not in creation order');

      // Each backoff ready resends only the oldest buffered event.
      const retries = retriesFor(events);
      assert.deepStrictEqual(Array.from(new Set(retries.map(keyOf))), [keyOf(events[0])],
        'retries did not target the oldest buffered event');

      const delays = retryDelays(events);
      const outOfRange = delays.map((d, k) => {
        const [lo, hi] = backoffRange(k);
        return (d < lo - 5 || d > hi + DELAY_SLACK_MS) ? `retry ${k}: ${d} ms not in [${lo}, ${hi}]` : null;
      }).filter(Boolean);
      assert.deepStrictEqual(outOfRange, [], `retry delays ${JSON.stringify(delays)}`);
      assert(Math.max(...delays) <= BACKOFF_MAX_MS + DELAY_SLACK_MS, `a delay exceeded ~1s: ${delays}`);
      assert(delays[delays.length - 1] > 3 * delays[0], `delays did not grow: ${delays}`);

      report.networkError = { events: events.length, retries: retries.length, delays };

      // Leave nothing buffered for the next test.
      fault = 'none';
      await waitIdle('after recovery');
    });
  });

  it('should deliver every buffered event exactly once, in creation order, with creation-time ids and timestamps, after recovery', () => {
    cy.then({ timeout: 90000 }, async () => {
      await waitIdle('before');
      const idAtCreation = (device1 as any)._stream.signalingConnectionId;
      assert.strictEqual(typeof idAtCreation, 'string', 'device1 has no signaling connection id');

      fault = 'network';
      const start = tracker1.created.length;
      await placeAnsweredCall();
      await waitUntil(() => retriesFor(tracker1.created.slice(start)).length >= 2
        && tracker1.outbox.size === tracker1.created.length - start, 15000, 'every event buffered and 2 retries');
      const events = tracker1.created.slice(start);
      assert(events.length > 0, 'the call created no Insights events');
      assert.deepStrictEqual(tracker1.outbox._entries.map((e: any) => JSON.stringify(e.event)),
        events.map(e => e.body), 'buffer is not in creation order');
      events.forEach(e => {
        assert.strictEqual(e.connectionId, idAtCreation, `${e.group}/${e.name} created without the current id`);
        assert(Math.abs(Date.parse(e.timestamp) - e.at) <= 50, `${e.group}/${e.name} timestamp is not its creation time`);
      });

      // Replace the signaling connection while the events are still buffered,
      // so a payload rebuilt at send time would carry the new id.
      (device1 as any)._stream.transport._socket.close();
      await waitUntil(() => {
        const stream = (device1 as any)._stream;
        return !!stream && typeof stream.signalingConnectionId === 'string' && stream.signalingConnectionId !== idAtCreation;
      }, 30000, 'a new signaling connection id after reconnect');
      const idAfterReconnect = (device1 as any)._stream.signalingConnectionId;
      const retriesBeforeRecovery = retriesFor(events).length;
      assert(tracker1.created.slice(start).length === events.length, 'events were created during the reconnect');

      const recoveredAt = Date.now();
      fault = 'none';
      await waitUntil(() => isIdle(tracker1, events), 30000, 'device1 outbox to drain');

      const delivered = assertDeliveredOnceInOrder(events, recoveredAt);
      delivered.forEach(a => {
        const body = JSON.parse(a.body);
        assert.strictEqual(body.payload.signaling_connection_id, idAtCreation,
          `${body.group}/${body.name} was sent with id ${body.payload.signaling_connection_id}`);
        assert(Date.parse(body.timestamp) < recoveredAt, `${body.group}/${body.name} was re-stamped at send time`);
      });

      // No late duplicates.
      const countAfterDrain = attemptsFor(events).length;
      await sleep(1500);
      assert.strictEqual(attemptsFor(events).length, countAfterDrain, 'events were sent again after the drain');

      report.recovery = {
        delivered: delivered.length,
        events: events.length,
        idAfterReconnect,
        idAtCreation,
        retriesBeforeRecovery,
        statuses: statusCounts(attemptsFor(events)),
      };
      await waitIdle('after');
    });
  });

  [500, 429].forEach(status => {
    it(`should retry HTTP ${status} responses and deliver the events once the gateway accepts them`, () => {
      cy.then({ timeout: 90000 }, async () => {
        await waitIdle('before');
        fault = status;
        const start = tracker1.created.length;
        await placeAnsweredCall();
        await waitUntil(() => retriesFor(tracker1.created.slice(start)).length >= 3
          && tracker1.outbox.size === tracker1.created.length - start, 15000, `3 retries after HTTP ${status}`,
          () => JSON.stringify({ size: tracker1.outbox.size, created: tracker1.created.length - start,
            retries: retriesFor(tracker1.created.slice(start)).length,
            notFaulted: explain(attemptsFor(tracker1.created.slice(start)).filter(a => a.outcome !== status)).slice(0, 4),
          }));
        const events = tracker1.created.slice(start);
        assert(events.length > 0, 'the call created no Insights events');

        const all = attemptsFor(events);
        assert.deepStrictEqual(all.filter(a => a.outcome !== undefined && a.outcome !== status)
          .map(a => `${keyOf(a)}:${a.outcome}`), [], `outcomes other than the stubbed HTTP ${status}`);
        assert.strictEqual(tracker1.outbox.size, events.length, `events were dropped after HTTP ${status}`);
        const retries = retriesFor(events);
        assert.deepStrictEqual(Array.from(new Set(retries.map(keyOf))), [keyOf(events[0])],
          'retries did not target the oldest buffered event');

        // Retry delays before recovery (deliveries after it are repeats too).
        const delays = retryDelays(events);
        const recoveredAt = Date.now();
        fault = 'none';
        await waitUntil(() => isIdle(tracker1, events), 30000, 'device1 outbox to drain');
        const delivered = assertDeliveredOnceInOrder(events, recoveredAt);

        report[`http${status}`] = {
          delays,
          delivered: delivered.length,
          events: events.length,
          retries: retries.length,
          statuses: statusCounts(attemptsFor(events)),
        };
        await waitIdle('after');
      });
    });
  });

  it('should drop events on HTTP 400 without retrying them', () => {
    cy.then({ timeout: 90000 }, async () => {
      await waitIdle('before');
      fault = 400;
      const start = tracker1.created.length;
      await placeAnsweredCall();
      await waitUntil(() => {
        const created = tracker1.created.slice(start);
        const tried = attemptsFor(created);
        return created.length > 0 && tried.length >= created.length && tried.every(a => a.end !== undefined);
      }, 15000, 'every event attempted once');
      // Longer than the first several backoff delays (100 + 200 + 400 + 800 ms).
      await sleep(2500);
      const events = tracker1.created.slice(start);
      const all = attemptsFor(events);

      assert.deepStrictEqual(all.map(keyOf).sort(), events.map(keyOf).sort(),
        'each event should be attempted exactly once');
      assert.deepStrictEqual(all.filter(a => a.outcome !== 400).map(a => `${keyOf(a)}:${a.outcome}`), []);
      assert.strictEqual(tracker1.outbox.size, 0, 'events were kept after HTTP 400');
      assert.strictEqual(tracker1.outbox._isRetryScheduled, false, 'a retry was scheduled after HTTP 400');

      // Removing the fault must not bring them back.
      fault = 'none';
      await sleep(1000);
      assert.strictEqual(attemptsFor(events).length, events.length, 'dropped events were sent again');

      report.http400 = { attempts: all.length, events: events.length, statuses: statusCounts(all) };
      await waitIdle('after');
    });
  });

  it('should buffer events created before the first connected (no eventgw option) and flush them once the host is known', () => {
    cy.then({ timeout: 60000 }, async () => {
      const token3 = await generateAccessToken('insbuf3-' + Date.now(), 600);
      // No eventgw option: the publisher host comes from connected.payload.home.
      device3 = new Device(token3, { chunderw });
      device3.on(Device.EventName.Error, noop);
      const tracker3 = track(device3);
      const publisher = (device3 as any)._publisher;
      assert(!publisher._host, 'publisher host is known before connected');

      // Calls need a connected stream, so these events are posted on the
      // Device publisher with a stand-in call context.
      const fakeCall = { direction: 'OUTGOING', outboundConnectionId: 'TJSe2einsbuf' + Date.now(), parameters: {} };
      [0, 1, 2].forEach(i => publisher.info('e2e-insights-buffer', `before-connected-${i}`, { probe_index: i }, fakeCall));
      const events = tracker3.created.slice();
      assert.strictEqual(events.length, 3);

      await sleep(1000);
      assert.strictEqual(attemptsFor(events).length, 0, 'events were sent before the host was known');
      assert.strictEqual(tracker3.outbox.size, 3, 'events were not buffered');
      events.forEach(e => assert.strictEqual(e.connectionId, undefined, 'created before connected but has an id'));

      const registerAt = Date.now();
      await device3.register();
      const home = (device3 as any)._home;
      assert(typeof home === 'string' && home.length > 0, 'connected payload had no home');
      const expectedHost = `eventgw.${home}.twilio.com`;
      assert.strictEqual(publisher._host, expectedHost);

      await waitUntil(() => isIdle(tracker3, events), 15000, 'device3 outbox to drain');
      const all = attemptsFor(events);
      assert.deepStrictEqual(all.map(a => a.body), events.map(e => e.body),
        'buffered events were not flushed exactly once each, in creation order');
      all.forEach(a => {
        assert.strictEqual(a.host, expectedHost, `flushed to ${a.host}`);
        assert(a.start >= registerAt, 'flushed before register');
      });
      assert.deepStrictEqual(all.filter(a => !isDelivered(a)).map(a => `${keyOf(a)}:${a.outcome}`), [],
        'flushed events were not accepted');

      report.beforeConnected = { home, host: expectedHost, statuses: statusCounts(all) };
      device3.destroy();
      device3 = undefined;
    });
  });

  it('should send nothing when publishEvents is false', () => {
    cy.then({ timeout: 60000 }, async () => {
      await waitIdle('before');
      const token4 = await generateAccessToken('insbuf4-' + Date.now(), 600);
      device4 = new Device(token4, { chunderw, eventgw, publishEvents: false });
      device4.on(Device.EventName.Error, noop);
      const tracker4 = track(device4);
      const publisher = (device4 as any)._publisher;
      assert.strictEqual(publisher.isEnabled, false);

      let requestPosts = 0;
      const originalRequest = publisher._request;
      publisher._request = {
        post: (params: any, callback: Function) => {
          requestPosts++;
          return originalRequest.post(params, callback);
        },
      };

      const fakeCall = { direction: 'OUTGOING', outboundConnectionId: 'TJSe2einsbuf' + Date.now(), parameters: {} };
      publisher.info('e2e-insights-buffer', 'publish-events-false', {}, fakeCall);

      const attemptsBefore = attempts.length;
      await device4.register();
      const id4 = (device4 as any)._stream.signalingConnectionId;
      assert.strictEqual(typeof id4, 'string');
      const tempSid = await placeAnsweredCall(device4);
      await sleep(1500);

      assert.strictEqual(requestPosts, 0, 'the publisher sent requests');
      assert.strictEqual(tracker4.created.length, 0, 'events reached the outbox');
      assert.strictEqual(tracker4.outbox.size, 0, 'events were buffered');
      const leaked = attempts.slice(attemptsBefore).filter(a =>
        a.body.includes(id4) || a.body.includes(tempSid) || a.body.includes(fakeCall.outboundConnectionId));
      assert.deepStrictEqual(leaked.map(a => `${a.endpoint}:${a.body.length}`), [], 'device4 events were sent');

      report.publishEventsFalse = { requestPosts, created: tracker4.created.length };
      device4.destroy();
      device4 = undefined;
      await waitIdle('after');
    });
  });

  // Informational: cy.task is not used (see signalingConnectionId.cy.ts), so
  // the measured data is reported through this test's title.
  it('should report the measured retry data', function() {
    (this as any).test.title = `should report the measured retry data ${JSON.stringify(report)}`;
  });
});
