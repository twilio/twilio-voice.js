// VBLOCKS-7468: bounded in-memory Insights event buffer with retry.
// Written from CONTRACTS.md C3/C4 and the ticket, not from the implementation.
// The global `fetch` is stubbed, so the real request.ts and the real
// EventPublisher are exercised end to end. Assertions are on what reaches
// fetch (URL, X-Twilio-Token header, JSON body) and on timers, so they do not
// depend on internal property names of the buffer.
import * as assert from 'assert';
import { EventEmitter } from 'events';
import * as sinon from 'sinon';
import Device from '../../lib/twilio/device';
import EventPublisher from '../../lib/twilio/eventpublisher';
import Log from '../../lib/twilio/log';
import request from '../../lib/twilio/request';

// tslint:disable max-classes-per-file only-arrow-functions no-empty max-line-length

const root = global as any;

// Captured at module load, before any suite installs fake timers.
const realSetImmediate: (cb: () => void) => any = setImmediate;

const ClientCapability = require('twilio').jwt.ClientCapability;
const CallClass = require('../../lib/twilio/call').default;

const T0 = Date.UTC(2026, 10, 4, 12, 0, 0);
const GROUP = 'test-group';
const NAME = 'test-event';
const HOST = 'eventgw.test.twilio.com';
const EVENTS_URL = `https://${HOST}/v4/EndpointEvents`;
const MAX_EVENTS = 200;
const MAX_AGE_MS = 5 * 60 * 1000;
const BACKOFF_MIN = 100;
const BACKOFF_MAX = 1000;
const BACKOFF_JITTER = 0.4;

type Reply = number | 'network' | 'hold' | 'text-error';

interface FetchCall {
  at: number;
  body: any;
  reply: Reply;
  token: any;
  url: string;
}

const fakeResponse = (status: number, textFails?: boolean): any => ({
  headers: { get: () => null },
  json: () => Promise.resolve({}),
  ok: status >= 200 && status < 300,
  status,
  statusText: `HTTP ${status}`,
  text: () => textFails
    ? Promise.reject(new TypeError('body read failed'))
    : Promise.resolve(status < 300 ? '{}' : 'error'),
});

const readHeader = (headers: any, name: string): any => {
  if (!headers) { return undefined; }
  if (typeof headers.get === 'function') { return headers.get(name); }
  return headers[name];
};

const parseBody = (body: any): any => {
  try {
    return typeof body === 'string' ? JSON.parse(body) : body;
  } catch (e) {
    return body;
  }
};

/**
 * Shared harness: fake timers, stubbed global fetch, unhandled rejection
 * capture, Log stubs. Everything installed here is restored in `teardown`,
 * which always runs its restores in `finally` blocks.
 */
function createHarness() {
  const h: any = {
    calls: [] as FetchCall[],
    defaultReply: 200 as Reply,
    held: [] as Array<{ resolve: (status?: number) => void, reject: (e: any) => void }>,
    replies: [] as Reply[],
    unhandled: [] as any[],
  };

  const onUnhandled = (reason: any) => { h.unhandled.push(reason); };

  h.setup = () => {
    h.sandbox = sinon.createSandbox();
    h.clock = h.sandbox.useFakeTimers({
      now: T0,
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'setImmediate', 'clearImmediate', 'Date'],
    });
    h.calls = [];
    h.held = [];
    h.replies = [];
    h.defaultReply = 200;
    h.unhandled = [];
    h.originalFetch = root.fetch;
    h.fetch = sinon.spy((url: string, init: any) => {
      const reply: Reply = h.replies.length ? h.replies.shift() : h.defaultReply;
      h.calls.push({
        at: h.clock.now,
        body: parseBody(init && init.body),
        reply,
        token: readHeader(init && init.headers, 'X-Twilio-Token'),
        url,
      });
      if (reply === 'network') {
        return Promise.reject(new TypeError('fetch failed'));
      }
      if (reply === 'text-error') {
        return Promise.resolve(fakeResponse(200, true));
      }
      if (reply === 'hold') {
        return new Promise((resolve, reject) => {
          h.held.push({ resolve: (status: number = 200) => resolve(fakeResponse(status)), reject });
        });
      }
      return Promise.resolve(fakeResponse(reply as number));
    });
    root.fetch = h.fetch;
    process.on('unhandledRejection', onUnhandled);
    // Stubbed (not spied) to keep the console quiet; calls are still recorded.
    h.logSpies = ['debug', 'info', 'warn', 'error'].map(level => h.sandbox.stub(Log.prototype, level as any));
  };

  h.teardown = async (extra?: () => void) => {
    try {
      try {
        if (extra) { extra(); }
      } finally {
        // Let pending rejections surface before checking.
        await h.drain();
      }
      assert.deepStrictEqual(h.unhandled.map(String), [], 'expected no unhandled promise rejections');
    } finally {
      process.removeListener('unhandledRejection', onUnhandled);
      root.fetch = h.originalFetch;
      // Restores the fake clock (pending fake timers are discarded), Log stubs and Math.random stubs.
      h.sandbox.restore();
    }
  };

  // Run real macrotasks (without advancing the fake clock) until fetch activity settles.
  h.drain = async () => {
    let last = -1;
    let stable = 0;
    for (let i = 0; i < 5000 && stable < 4; i++) {
      await new Promise<void>(resolve => realSetImmediate(resolve));
      const n = h.fetch ? h.fetch.callCount : 0;
      if (n === last) { stable++; } else { stable = 0; last = n; }
    }
  };

  h.nextTimerAt = (): number | undefined => {
    const timers = (h.clock as any).timers || {};
    let min: number | undefined;
    Object.keys(timers).forEach(id => {
      const t = timers[id];
      if (min === undefined || t.callAt < min) { min = t.callAt; }
    });
    return min;
  };

  // Advance the fake clock to `end`, firing each timer at its exact time and
  // draining real async work after each one, so a timer scheduled from a
  // response handler is scheduled relative to the time the request was made.
  h.runUntil = async (end: number) => {
    await h.drain();
    for (let guard = 0; guard < 20000; guard++) {
      const next = h.nextTimerAt();
      if (next === undefined || next > end) { break; }
      await h.clock.tickAsync(Math.max(0, next - h.clock.now));
      await h.drain();
    }
    if (h.clock.now < end) {
      await h.clock.tickAsync(end - h.clock.now);
      await h.drain();
    }
  };

  h.runFor = (ms: number) => h.runUntil(h.clock.now + ms);

  h.eventCalls = (): FetchCall[] => h.calls.filter((c: FetchCall) =>
    /\/v4\/EndpointEvents$/.test(c.url) && c.body && c.body.group === GROUP);

  h.metricsCalls = (): FetchCall[] => h.calls.filter((c: FetchCall) => /\/v4\/EndpointMetrics$/.test(c.url));

  h.seqs = (): any[] => h.eventCalls().map((c: FetchCall) => c.body.payload.seq);

  h.isSuccess = (c: FetchCall) => typeof c.reply === 'number' && c.reply >= 200 && c.reply < 300;

  h.dropLogged = (): boolean => h.logSpies.some((spy: sinon.SinonSpy) => spy.getCalls().some((call: sinon.SinonSpyCall) =>
    call.args.some((arg: any) => typeof arg === 'string' && /drop|discard|evict|expire|overflow/i.test(arg))));

  return h;
}

const createConnection = (callSid: string = 'CA1111', tempCallSid: string = 'TJ1111'): any => ({
  _mediaHandler: { _onInputDevicesChanged() { } },
  codec: 'opus',
  direction: 'OUTGOING',
  disconnect: sinon.stub(),
  outboundConnectionId: tempCallSid,
  parameters: { CallSid: callSid },
  reject: sinon.stub(),
});

const countBy = (values: any[]): Record<string, number> => values.reduce((acc: Record<string, number>, v: any) => {
  acc[String(v)] = (acc[String(v)] || 0) + 1;
  return acc;
}, {});

const range = (from: number, to: number): number[] => {
  const out: number[] = [];
  for (let i = from; i < to; i++) { out.push(i); }
  return out;
};

describe('Insights event buffer (VBLOCKS-7468)', () => {
  const h = createHarness();
  let errorSpy: sinon.SinonSpy;
  let state: Record<string, any>;
  let connection: any;

  const createPublisher = (options: Record<string, any> = {}, withErrorListener: boolean = true): any => {
    const publisher: any = new (EventPublisher as any)('twilio-js-sdk', 'token-1', Object.assign({
      defaultPayload: (conn: any) => {
        const payload: Record<string, any> = { sdk_version: 'test' };
        if (state.sci) { payload.signaling_connection_id = state.sci; }
        if (conn && conn.parameters && conn.parameters.CallSid) { payload.call_sid = conn.parameters.CallSid; }
        if (conn && conn.outboundConnectionId) { payload.temp_call_sid = conn.outboundConnectionId; }
        return payload;
      },
      metadata: { app_name: 'app', app_version: '1.0.0' },
    }, options));
    if (withErrorListener) {
      publisher.on('error', errorSpy);
    }
    return publisher;
  };

  const postSeq = (publisher: any, seq: any, conn: any = connection) =>
    publisher.info(GROUP, NAME, { seq }, conn);

  // Make the backoff jitter deterministic: with Math.random() === 0 the
  // deviation is 0, so delays are exactly min * factor^attempt capped at max.
  const noJitter = () => h.sandbox.stub(Math, 'random').returns(0);

  beforeEach(() => {
    h.setup();
    errorSpy = sinon.spy();
    state = { sci: 'CONN-A' };
    connection = createConnection();
  });

  afterEach(() => h.teardown());

  describe('host unknown', () => {
    it('should buffer events and send nothing until the host is known', async () => {
      const publisher = createPublisher();
      [0, 1, 2].forEach(seq => postSeq(publisher, seq));
      await h.runFor(60000);
      sinon.assert.notCalled(h.fetch);
    });

    it('should flush buffered events in creation order on setHost', async () => {
      const publisher = createPublisher();
      [0, 1, 2, 3, 4].forEach(seq => postSeq(publisher, seq));
      await h.runFor(1000);
      publisher.setHost(HOST);
      await h.runFor(1000);
      assert.deepStrictEqual(h.seqs(), [0, 1, 2, 3, 4]);
      h.eventCalls().forEach((c: FetchCall) => assert.strictEqual(c.url, EVENTS_URL));
    });

    it('should keep payload, call ids, signaling_connection_id and timestamp from creation time (C3)', async () => {
      const publisher = createPublisher();
      const conn = createConnection('CA-FIRST', 'TJ-FIRST');
      postSeq(publisher, 0, conn);

      await h.runFor(60000);
      state.sci = 'CONN-B';
      conn.parameters.CallSid = 'CA-SECOND';
      postSeq(publisher, 1, conn);

      await h.runFor(30000);
      publisher.setHost(HOST);
      await h.runFor(1000);

      const [first, second] = h.eventCalls().map((c: FetchCall) => c.body);
      assert.strictEqual(first.payload.signaling_connection_id, 'CONN-A');
      assert.strictEqual(first.payload.call_sid, 'CA-FIRST');
      assert.strictEqual(first.payload.temp_call_sid, 'TJ-FIRST');
      assert.strictEqual(first.timestamp, new Date(T0).toISOString());
      assert.strictEqual(second.payload.signaling_connection_id, 'CONN-B');
      assert.strictEqual(second.payload.call_sid, 'CA-SECOND');
      assert.strictEqual(second.timestamp, new Date(T0 + 60000).toISOString());
      assert.strictEqual(first.level, 'INFO');
      assert.strictEqual(first.group, GROUP);
      assert.strictEqual(first.name, NAME);
    });

    it('should not let a payload object mutated after creation change the buffered event', async () => {
      const publisher = createPublisher();
      const payload: Record<string, any> = { seq: 0, value: 'original' };
      publisher.info(GROUP, NAME, payload, connection);
      payload.value = 'mutated';
      publisher.setHost(HOST);
      await h.runFor(1000);
      assert.strictEqual(h.eventCalls()[0].body.payload.value, 'original');
    });

    it('should send buffered events with the token current at send time', async () => {
      const publisher = createPublisher();
      postSeq(publisher, 0);
      publisher.setToken('token-2');
      publisher.setHost(HOST);
      await h.runFor(1000);
      assert.strictEqual(h.eventCalls().length, 1);
      assert.strictEqual(h.eventCalls()[0].token, 'token-2');
    });

    it('should send immediately when the host is known at construction', async () => {
      const publisher = createPublisher({ host: HOST });
      postSeq(publisher, 0);
      await h.drain();
      assert.deepStrictEqual(h.seqs(), [0]);
      assert.strictEqual(h.eventCalls()[0].at, T0);
    });
  });

  describe('isolation', () => {
    it('should keep separate buffers for publishers that do not share an owner', async () => {
      const first = createPublisher();
      const second = createPublisher();
      postSeq(first, 'first');
      postSeq(second, 'second');
      first.setHost(HOST);
      await h.runFor(1000);
      assert.deepStrictEqual(h.seqs(), ['first']);
      second.setToken('token-second');
      second.setHost(HOST);
      await h.runFor(1000);
      assert.deepStrictEqual(h.seqs(), ['first', 'second']);
      assert.strictEqual(h.eventCalls()[1].token, 'token-second');
    });
  });

  describe('retryable failures', () => {
    const retryable: Reply[] = ['network', 500, 502, 503, 504, 429];

    retryable.forEach(kind => {
      it(`should buffer and retry after ${kind === 'network' ? 'a network rejection' : `HTTP ${kind}`}`, async () => {
        const publisher = createPublisher({ host: HOST });
        h.replies = [kind, 200];
        postSeq(publisher, 0);
        await h.runFor(5000);
        assert.deepStrictEqual(h.seqs(), [0, 0]);
        assert.strictEqual(h.eventCalls()[1].reply, 200);
        const delay = h.eventCalls()[1].at - h.eventCalls()[0].at;
        assert(delay >= BACKOFF_MIN * (1 - BACKOFF_JITTER) - 1 && delay <= BACKOFF_MAX,
          `first retry delay ${delay}ms outside [${BACKOFF_MIN * (1 - BACKOFF_JITTER)}, ${BACKOFF_MAX}]`);
        // Delivered: no further attempts.
        await h.runFor(30000);
        assert.strictEqual(h.eventCalls().length, 2);
      });
    });

    it('should resend the identical body on retry (C3)', async () => {
      const publisher = createPublisher({ host: HOST });
      h.replies = [503, 200];
      postSeq(publisher, 0);
      await h.drain();
      state.sci = 'CONN-B';
      await h.runFor(5000);
      const [first, retry] = h.eventCalls().map((c: FetchCall) => c.body);
      assert.deepStrictEqual(retry, first);
      assert.strictEqual(retry.payload.signaling_connection_id, 'CONN-A');
      assert.strictEqual(retry.timestamp, new Date(T0).toISOString());
    });

    it('should retry with the same-edge backoff schedule (factor 2, min 100, max 1000)', async () => {
      noJitter();
      const publisher = createPublisher({ host: HOST });
      h.replies = [503, 503, 503, 503, 503, 503, 503, 503, 200];
      postSeq(publisher, 0);
      await h.runFor(10000);
      const times = h.eventCalls().map((c: FetchCall) => c.at - T0);
      const intervals = times.slice(1).map((t: number, i: number) => t - times[i]);
      assert.deepStrictEqual(intervals, [100, 200, 400, 800, 1000, 1000, 1000, 1000]);
    });

    it('should keep every retry delay within the jittered [min, max] bounds', async () => {
      const publisher = createPublisher({ host: HOST });
      h.defaultReply = 503;
      postSeq(publisher, 0);
      await h.runFor(15000);
      const times = h.eventCalls().map((c: FetchCall) => c.at);
      const intervals = times.slice(1).map((t: number, i: number) => t - times[i]);
      assert(intervals.length >= 10, `expected at least 10 retries in 15s, got ${intervals.length}`);
      intervals.forEach((delay: number, attempt: number) => {
        const base = BACKOFF_MIN * Math.pow(2, attempt);
        const lo = Math.min(Math.floor(base * (1 - BACKOFF_JITTER)), BACKOFF_MAX) - 1;
        const hi = Math.min(Math.ceil(base * (1 + BACKOFF_JITTER)), BACKOFF_MAX);
        assert(delay >= lo && delay <= hi, `retry #${attempt} delay ${delay}ms outside [${lo}, ${hi}]`);
      });
    });

    it('should not apply the 15s max backoff duration (keeps retrying past 15s)', async () => {
      const publisher = createPublisher({ host: HOST });
      h.defaultReply = 503;
      postSeq(publisher, 0);
      await h.runFor(40000);
      const late = h.eventCalls().filter((c: FetchCall) => c.at >= T0 + 20000);
      assert(late.length >= 18, `expected retries between 20s and 40s, got ${late.length}`);
    });

    it('should stop retrying once the event is older than 5 minutes', async () => {
      const publisher = createPublisher({ host: HOST });
      h.defaultReply = 503;
      postSeq(publisher, 0);
      await h.runUntil(T0 + MAX_AGE_MS + 5000);
      const attempts = h.eventCalls();
      assert(attempts.length > 1);
      attempts.forEach((c: FetchCall) => assert(c.at <= T0 + MAX_AGE_MS + BACKOFF_MAX,
        `attempt at +${c.at - T0}ms is after the 5 minute age bound`));
      const count = attempts.length;
      await h.runFor(10 * 60 * 1000);
      assert.strictEqual(h.eventCalls().length, count);
      assert(h.dropLogged(), 'expected the expired drop to be logged');
    });

    it('should reset the backoff after a success and flush the remaining events', async () => {
      noJitter();
      const publisher = createPublisher();
      [0, 1, 2].forEach(seq => postSeq(publisher, seq));
      h.replies = [503, 200, 200, 200];
      publisher.setHost(HOST);
      await h.runFor(5000);
      const firstRound = h.eventCalls().map((c: FetchCall) => [c.body.payload.seq, c.at - T0]);
      assert.deepStrictEqual(firstRound, [[0, 0], [0, 100], [1, 100], [2, 100]]);

      // A later failure starts again from the minimum delay.
      const t1 = h.clock.now;
      h.replies = [503, 503, 200];
      postSeq(publisher, 3);
      await h.runFor(5000);
      const secondRound = h.eventCalls().slice(4).map((c: FetchCall) => [c.body.payload.seq, c.at - t1]);
      assert.deepStrictEqual(secondRound, [[3, 0], [3, 100], [3, 300]]);
    });

    it('should retry a network rejection and deliver the event exactly once (callback settles once)', async () => {
      const publisher = createPublisher({ host: HOST });
      h.replies = ['network', 200];
      postSeq(publisher, 0);
      await h.runFor(5000);
      const attempts = h.eventCalls();
      assert.deepStrictEqual(attempts.map((c: FetchCall) => c.reply), ['network', 200]);
      assert.strictEqual(attempts.filter(h.isSuccess).length, 1);
    });

    it('should resolve the promise returned to callers even when the post fails', async () => {
      const publisher = createPublisher({ host: HOST });
      h.defaultReply = 503;
      let settled = '';
      postSeq(publisher, 0).then(() => { settled = 'resolved'; }, () => { settled = 'rejected'; });
      await h.runFor(1000);
      assert.notStrictEqual(settled, 'rejected');
    });

    it('should emit publisher "error" on an HTTP 5xx (documented behavior change)', async () => {
      const publisher = createPublisher({ host: HOST });
      h.replies = [503, 200];
      postSeq(publisher, 0);
      await h.runFor(5000);
      assert(errorSpy.called, 'expected publisher "error" on HTTP 503');
    });
  });

  describe('non-retryable failures', () => {
    [400, 401, 403, 404].forEach(status => {
      it(`should drop the event on HTTP ${status} without retrying`, async () => {
        const publisher = createPublisher({ host: HOST });
        h.replies = [status];
        postSeq(publisher, 0);
        await h.runFor(60000);
        assert.deepStrictEqual(h.seqs(), [0]);
      });

      it(`should continue flushing later events after dropping one on HTTP ${status}`, async () => {
        const publisher = createPublisher();
        [0, 1, 2].forEach(seq => postSeq(publisher, seq));
        h.replies = [200, status, 200];
        publisher.setHost(HOST);
        await h.runFor(60000);
        assert.deepStrictEqual(h.seqs(), [0, 1, 2]);
      });
    });

    it('should emit publisher "error" on an HTTP 4xx (documented behavior change)', async () => {
      const publisher = createPublisher({ host: HOST });
      h.replies = [400];
      postSeq(publisher, 0);
      await h.runFor(1000);
      sinon.assert.calledOnce(errorSpy);
    });
  });

  describe('bounds', () => {
    it(`should keep at most ${MAX_EVENTS} events and drop the oldest on overflow`, async () => {
      const publisher = createPublisher();
      range(0, MAX_EVENTS + 1).forEach(seq => postSeq(publisher, seq));
      publisher.setHost(HOST);
      await h.runFor(5000);
      assert.deepStrictEqual(h.seqs(), range(1, MAX_EVENTS + 1));
    });

    it('should drop the oldest events repeatedly when far over the limit', async () => {
      const publisher = createPublisher();
      range(0, MAX_EVENTS + 50).forEach(seq => postSeq(publisher, seq));
      publisher.setHost(HOST);
      await h.runFor(5000);
      assert.deepStrictEqual(h.seqs(), range(50, MAX_EVENTS + 50));
    });

    it('should log overflow drops and never report them through Insights', async () => {
      const publisher = createPublisher();
      range(0, MAX_EVENTS + 1).forEach(seq => postSeq(publisher, seq));
      assert(h.dropLogged(), 'expected the overflow drop to be logged');
      publisher.setHost(HOST);
      await h.runFor(5000);
      assert.strictEqual(h.calls.length, MAX_EVENTS, 'only the buffered events themselves may be posted');
      h.calls.forEach((c: FetchCall) => {
        assert.strictEqual(c.url, EVENTS_URL);
        assert.strictEqual(c.body.group, GROUP);
        assert.strictEqual(c.body.name, NAME);
      });
    });

    it('should drop events older than 5 minutes at flush time and keep younger ones', async () => {
      const publisher = createPublisher();
      postSeq(publisher, 0);
      await h.runUntil(T0 + 4 * 60 * 1000);
      postSeq(publisher, 1);
      await h.runUntil(T0 + MAX_AGE_MS + 1);
      publisher.setHost(HOST);
      await h.runFor(1000);
      assert.deepStrictEqual(h.seqs(), [1]);
      assert(h.dropLogged(), 'expected the expired drop to be logged');
      assert.strictEqual(h.calls.length, 1, 'no Insights event about the drop');
    });

    it('should still send an event younger than 5 minutes', async () => {
      const publisher = createPublisher();
      postSeq(publisher, 0);
      await h.runUntil(T0 + MAX_AGE_MS - 1);
      publisher.setHost(HOST);
      await h.drain();
      assert.deepStrictEqual(h.seqs(), [0]);
    });
  });

  describe('single in-flight flush', () => {
    it('should not double-send when flush triggers arrive while a flush is in progress', async () => {
      const publisher = createPublisher();
      [0, 1, 2].forEach(seq => postSeq(publisher, seq));
      h.replies = ['hold'];
      publisher.setHost(HOST);
      await h.drain();
      assert(h.held.length >= 1, 'expected a request in flight');

      // Concurrent triggers while the first request is still in flight.
      publisher.setHost(HOST);
      publisher.setHost(HOST);
      postSeq(publisher, 3);
      await h.drain();

      h.held.splice(0).forEach((held: any) => held.resolve(200));
      await h.runFor(5000);
      h.held.splice(0).forEach((held: any) => held.resolve(200));
      await h.runFor(5000);

      assert.deepStrictEqual(countBy(h.seqs()), { 0: 1, 1: 1, 2: 1, 3: 1 });
      // An event created during the flush goes out after the ones already buffered.
      assert.deepStrictEqual(h.seqs(), [0, 1, 2, 3]);
    });

    it('should not resend already delivered events after a failure mid-flush', async () => {
      noJitter();
      const publisher = createPublisher();
      [0, 1, 2, 3].forEach(seq => postSeq(publisher, seq));
      h.replies = [200, 200, 503, 200, 200];
      publisher.setHost(HOST);
      await h.runFor(5000);
      assert.deepStrictEqual(h.seqs(), [0, 1, 2, 2, 3]);
      assert.deepStrictEqual(h.eventCalls().filter(h.isSuccess).map((c: FetchCall) => c.body.payload.seq), [0, 1, 2, 3]);
    });

    it('should retry concurrent sends that both failed in creation order', async () => {
      const publisher = createPublisher({ host: HOST });
      h.replies = ['hold', 'hold'];
      postSeq(publisher, 0);
      postSeq(publisher, 1);
      await h.drain();
      const inFlight = h.held.splice(0);
      // Fail them in reverse order.
      if (inFlight.length === 2) {
        inFlight[1].resolve(503);
        await h.drain();
        inFlight[0].resolve(503);
      } else {
        inFlight.forEach((held: any) => held.resolve(503));
      }
      await h.runFor(10000);
      h.held.splice(0).forEach((held: any) => held.resolve(200));
      await h.runFor(10000);
      const delivered = h.eventCalls().filter(h.isSuccess).map((c: FetchCall) => c.body.payload.seq);
      assert.deepStrictEqual(delivered, [0, 1]);
    });

    it('should deliver an event posted during backoff exactly once, after the earlier event (creation order)', async () => {
      const publisher = createPublisher({ host: HOST });
      h.replies = [503];
      postSeq(publisher, 0);
      await h.drain();
      postSeq(publisher, 1);
      await h.runFor(5000);
      const delivered = h.eventCalls().filter(h.isSuccess).map((c: FetchCall) => c.body.payload.seq);
      assert.deepStrictEqual(countBy(delivered), { 0: 1, 1: 1 });
      // Not sent ahead of the event that is waiting to be retried.
      assert.deepStrictEqual(h.seqs(), [0, 0, 1]);
    });
  });

  describe('publishEvents: false (publisher disabled)', () => {
    it('should neither buffer nor send while the host is unknown', async () => {
      const publisher = createPublisher();
      publisher.disable();
      [0, 1].forEach(seq => postSeq(publisher, seq));
      publisher.setHost(HOST);
      await h.runFor(60000);
      sinon.assert.notCalled(h.fetch);
    });

    it('should not send when the host is known', async () => {
      const publisher = createPublisher({ host: HOST });
      publisher.disable();
      postSeq(publisher, 0);
      await h.runFor(60000);
      sinon.assert.notCalled(h.fetch);
    });

    it('should still send a forced post once (feedback path unchanged)', async () => {
      const publisher = createPublisher({ host: HOST });
      publisher.disable();
      publisher.post('info', GROUP, NAME, { seq: 'forced' }, connection, true);
      await h.runFor(60000);
      assert.deepStrictEqual(h.seqs(), ['forced']);
    });

    [503, 400, 'network'].forEach((kind: Reply) => {
      it(`should not throw, retry or leave an unhandled rejection when a forced post fails (${kind}) and there is no "error" listener`, async () => {
        const publisher = createPublisher({ host: HOST }, false);
        publisher.disable();
        h.defaultReply = kind;
        let result: any;
        assert.doesNotThrow(() => {
          result = publisher.post('info', GROUP, NAME, { seq: 'forced' }, connection, true);
        });
        let settled = '';
        Promise.resolve(result).then(() => { settled = 'resolved'; }, () => { settled = 'rejected'; });
        await h.runFor(60000);
        assert.notStrictEqual(settled, 'rejected');
        assert.deepStrictEqual(h.seqs(), ['forced'], 'forced posts keep today\'s single attempt');
        assert.deepStrictEqual(h.unhandled.map(String), []);
      });
    });

    it('should emit "error" exactly once for a single failed forced post', async () => {
      const publisher = createPublisher({ host: HOST });
      publisher.disable();
      h.defaultReply = 'network';
      publisher.post('info', GROUP, NAME, { seq: 'forced' }, connection, true);
      await h.runFor(60000);
      sinon.assert.calledOnce(errorSpy);
    });
  });

  describe('metrics', () => {
    const sample = {
      audioInputLevel: 1,
      audioOutputLevel: 1,
      codecName: 'opus',
      timestamp: T0,
      totals: { },
    };

    it('should not buffer metrics while the host is unknown', async () => {
      const publisher = createPublisher();
      publisher.postMetrics('quality-metrics-samples', 'metrics-sample', [sample], { }, connection);
      await h.drain();
      publisher.setHost(HOST);
      await h.runFor(60000);
      assert.strictEqual(h.metricsCalls().length, 0);
    });

    it('should not retry a failed metrics post', async () => {
      const publisher = createPublisher({ host: HOST });
      h.defaultReply = 503;
      publisher.postMetrics('quality-metrics-samples', 'metrics-sample', [sample], { }, connection);
      await h.runFor(60000);
      assert.strictEqual(h.metricsCalls().length, 1);
    });

    it('should not hold back events when a metrics post fails', async () => {
      const publisher = createPublisher({ host: HOST });
      h.replies = [503];
      publisher.postMetrics('quality-metrics-samples', 'metrics-sample', [sample], { }, connection);
      await h.drain();
      postSeq(publisher, 0);
      await h.drain();
      assert.deepStrictEqual(h.seqs(), [0]);
      await h.runFor(60000);
      assert.strictEqual(h.metricsCalls().length, 1);
      assert.deepStrictEqual(h.seqs(), [0]);
    });
  });

  describe('no recursion', () => {
    ['network', 500, 400].forEach((kind: Reply) => {
      it(`should never post an Insights event about a failed Insights post (${kind})`, async () => {
        const publisher = createPublisher({ host: HOST });
        h.defaultReply = kind;
        postSeq(publisher, 0);
        await h.runFor(10000);
        assert(h.calls.length >= 1);
        h.calls.forEach((c: FetchCall) => {
          assert.strictEqual(c.url, EVENTS_URL);
          assert.strictEqual(c.body.group, GROUP);
          assert.strictEqual(c.body.name, NAME);
          assert.strictEqual(c.body.payload.seq, 0);
        });
      });
    });
  });
});

describe('request.ts HTTP status handling (VBLOCKS-7468)', () => {
  const h = createHarness();

  beforeEach(() => h.setup());
  afterEach(() => h.teardown());

  const post = async (reply: Reply) => {
    h.replies = [reply];
    const callback = sinon.spy();
    (request as any).post({ body: { a: 1 }, headers: { 'X-Twilio-Token': 'tok' }, url: EVENTS_URL }, callback);
    await h.drain();
    return callback;
  };

  [200, 201, 204].forEach(status => {
    it(`should call back once with no error on HTTP ${status}`, async () => {
      const callback = await post(status);
      sinon.assert.calledOnce(callback);
      assert(!callback.args[0][0], `expected no error, got ${callback.args[0][0]}`);
    });
  });

  [400, 401, 403, 404, 429, 500, 502, 503].forEach(status => {
    it(`should call back once with an error on HTTP ${status}`, async () => {
      const callback = await post(status);
      sinon.assert.calledOnce(callback);
      assert(callback.args[0][0], `expected an error for HTTP ${status}`);
      // request.ts surfaces the HTTP status on the error (used to classify retryable vs not).
      assert.strictEqual(callback.args[0][0].status, status);
    });
  });

  it('should call back exactly once with an error on a network rejection', async () => {
    const callback = await post('network');
    sinon.assert.calledOnce(callback);
    assert(callback.args[0][0], 'expected an error for a network rejection');
    assert.notStrictEqual(typeof callback.args[0][0].status, 'number', 'a network rejection has no HTTP status');
  });

  it('should call back exactly once with an error when reading the body fails', async () => {
    const callback = await post('text-error');
    sinon.assert.calledOnce(callback);
    assert(callback.args[0][0], 'expected an error when the body read fails');
  });

  it('should still POST the JSON body with the given headers', async () => {
    await post(200);
    assert.strictEqual(h.calls.length, 1);
    assert.strictEqual(h.calls[0].url, EVENTS_URL);
    assert.deepStrictEqual(h.calls[0].body, { a: 1 });
    assert.strictEqual(h.calls[0].token, 'tok');
    assert.strictEqual(h.fetch.args[0][1].method, 'POST');
  });

  it('should not leave an unhandled rejection when the callback throws', async () => {
    h.replies = [503];
    (request as any).post({ body: {}, headers: {}, url: EVENTS_URL }, () => { throw new Error('callback threw'); });
    await h.drain();
    // teardown asserts that no unhandled rejection was observed.
  });
});

describe('Insights buffer with Device (VBLOCKS-7468)', () => {
  const h = createHarness();
  let device: any;
  let pstream: any;
  let token: string;

  const AudioHelper = () => {
    const audioHelper = createEmitterStub(require('../../lib/twilio/audiohelper').default);
    const enabledSounds = {
      [Device.SoundName.Disconnect]: true,
      [Device.SoundName.Incoming]: true,
      [Device.SoundName.Outgoing]: true,
    };
    audioHelper._enabledSounds = enabledSounds;
    audioHelper._getEnabledSounds = () => enabledSounds;
    audioHelper._updateAvailableDevices = sinon.stub().returns(Promise.resolve());
    audioHelper.disconnect = () => true;
    audioHelper.incoming = () => true;
    audioHelper.outgoing = () => true;
    return audioHelper;
  };
  const Call = () => createEmitterStub(CallClass);
  const PStream = () => (pstream = createEmitterStub(require('../../lib/twilio/pstream').default));
  const Sound = () => sinon.createStubInstance(require('../../lib/twilio/sound').default);

  const createDevice = (options: Record<string, any> = {}) => {
    device = new Device(token, { AudioHelper, Call, PStream, Sound, ...options } as any);
    device.on('error', () => { });
    return device;
  };

  const connectSignaling = async (home: string = 'us1') => {
    const setupPromise = device._setupStream();
    pstream.emit('connected', { home, region: 'US_EAST_VIRGINIA' });
    await setupPromise;
  };

  const postSeq = (publisher: any, seq: any) =>
    publisher.info(GROUP, NAME, { seq }, createConnection());

  beforeEach(() => {
    h.setup();
    pstream = null;
    token = createToken('alice');
  });

  afterEach(() => h.teardown(() => {
    if (device && device.state !== Device.State.Destroyed) {
      device.destroy();
    }
    device = null;
    root.resetEvents();
  }));

  describe('publisher recreated by updateOptions', () => {
    it('should deliver events buffered in the previous publisher exactly once', async () => {
      createDevice();
      const oldPublisher = device._publisher;
      postSeq(oldPublisher, 0);

      device.updateOptions({ appName: 'recreated' });
      postSeq(device._publisher, 1);
      await h.drain();
      sinon.assert.notCalled(h.fetch);

      await connectSignaling('us1');
      await h.runFor(5000);

      assert.deepStrictEqual(h.seqs(), [0, 1]);
      h.eventCalls().forEach((c: FetchCall) => assert.strictEqual(c.url, 'https://eventgw.us1.twilio.com/v4/EndpointEvents'));
    });

    it('should not strand events posted by a Call that holds the previous publisher', async () => {
      createDevice();
      const oldPublisher = device._publisher;
      device.updateOptions({ appName: 'recreated' });

      // A Call created before updateOptions keeps posting through the old reference.
      postSeq(oldPublisher, 0);
      postSeq(device._publisher, 1);
      postSeq(oldPublisher, 2);

      await connectSignaling('us1');
      await h.runFor(5000);
      assert.deepStrictEqual(countBy(h.seqs()), { 0: 1, 1: 1, 2: 1 });
      assert.deepStrictEqual(h.seqs(), [0, 1, 2]);

      // After the host is known, the old reference still delivers to the current host.
      postSeq(oldPublisher, 3);
      await h.runFor(5000);
      assert.deepStrictEqual(countBy(h.seqs()), { 0: 1, 1: 1, 2: 1, 3: 1 });
      h.eventCalls().forEach((c: FetchCall) => assert.strictEqual(c.url, 'https://eventgw.us1.twilio.com/v4/EndpointEvents'));
    });

    it('should send pending events with the token current at send time, including from the old publisher', async () => {
      createDevice();
      const oldPublisher = device._publisher;
      postSeq(oldPublisher, 0);
      device.updateOptions({ appName: 'recreated' });
      postSeq(oldPublisher, 1);

      const newToken = createToken('bob');
      device.updateToken(newToken);
      await connectSignaling('us1');
      await h.runFor(5000);

      assert.deepStrictEqual(h.seqs(), [0, 1]);
      h.eventCalls().forEach((c: FetchCall) => assert.strictEqual(c.token, newToken));
    });

    it('should deliver an event that was being retried when the publisher was recreated exactly once', async () => {
      createDevice({ eventgw: HOST });
      h.replies = [503];
      postSeq(device._publisher, 0);
      await h.drain();
      device.updateOptions({ appName: 'recreated' });
      await h.runFor(10000);
      const delivered = h.eventCalls().filter(h.isSuccess);
      assert.strictEqual(delivered.length, 1);
      assert.deepStrictEqual(h.seqs(), [0, 0]);
    });
  });

  describe('publishEvents: false', () => {
    it('should drop events buffered before updateOptions disabled publishing', async () => {
      createDevice();
      postSeq(device._publisher, 0);
      const oldPublisher = device._publisher;
      device.updateOptions({ publishEvents: false });
      postSeq(oldPublisher, 1);
      postSeq(device._publisher, 2);
      await connectSignaling('us1');
      await h.runFor(10000);
      assert.strictEqual(h.eventCalls().length, 0);
    });

    it('should not buffer or send events and should not throw on a failed forced post', async () => {
      createDevice({ eventgw: HOST, publishEvents: false });
      postSeq(device._publisher, 0);
      await connectSignaling('us1');
      await h.runFor(10000);
      assert.strictEqual(h.eventCalls().length, 0);

      h.defaultReply = 503;
      assert.doesNotThrow(() => device._publisher.post('info', GROUP, NAME, { seq: 'forced' }, createConnection(), true));
      await h.runFor(60000);
      assert.deepStrictEqual(h.seqs(), ['forced']);
      assert.deepStrictEqual(h.unhandled.map(String), []);
    });
  });

  describe('destroy', () => {
    it('should stop retrying and leave no pending timers', async () => {
      createDevice({ eventgw: HOST });
      h.defaultReply = 503;
      postSeq(device._publisher, 0);
      await h.runFor(500);
      const attempts = h.eventCalls().length;
      assert(attempts >= 1);

      device.destroy();
      await h.drain();
      assert.strictEqual(h.clock.countTimers(), 0, 'expected no pending timers after destroy');
      await h.runFor(60000);
      assert.strictEqual(h.eventCalls().length, attempts);
    });

    it('should drop the buffer so a late setHost on the old publisher sends nothing', async () => {
      createDevice();
      const publisher = device._publisher;
      postSeq(publisher, 0);
      postSeq(publisher, 1);
      device.destroy();
      publisher.setHost(HOST);
      await h.runFor(60000);
      assert.strictEqual(h.eventCalls().length, 0);
      assert.strictEqual(h.clock.countTimers(), 0, 'expected no pending timers after destroy');
    });
  });

  describe('no recursion', () => {
    ['network', 503].forEach((kind: Reply) => {
      it(`should only ever post the original event when Insights fails (${kind})`, async () => {
        createDevice({ eventgw: HOST });
        h.defaultReply = kind;
        postSeq(device._publisher, 0);
        await h.runFor(10000);
        const posted = h.calls.filter((c: FetchCall) => /\/v4\/EndpointEvents$/.test(c.url));
        assert(posted.length >= 2, 'expected retries');
        posted.forEach((c: FetchCall) => {
          assert.strictEqual(c.body.group, GROUP);
          assert.strictEqual(c.body.payload.seq, 0);
        });
      });
    });
  });
});

/**
 * Create a stub and mixin the EventEmitter functions (same helper as tests/unit/device.ts).
 */
function createEmitterStub(BaseClass: any): sinon.SinonStubbedInstance<any> {
  const stub: sinon.SinonStubbedInstance<any> = sinon.createStubInstance(BaseClass);

  Object.getOwnPropertyNames(EventEmitter.prototype).forEach((name: string) => {
    const property = (EventEmitter.prototype as any)[name];
    if (typeof property !== 'function') { return; }
    stub[name] = property.bind(stub);
  });

  EventEmitter.constructor.call(stub);
  return stub;
}

/**
 * Create a Capability Token (same helper as tests/unit/device.ts).
 */
function createToken(identity: string): string {
  const capability = new ClientCapability({
    accountSid: 'AC1234567890123456789012',
    authToken: 'authToken',
  });

  capability.addScope(new ClientCapability.OutgoingClientScope({
    applicationSid: 'AP123',
    clientName: identity,
  }));

  capability.addScope(new ClientCapability.IncomingClientScope(identity));
  return capability.toJwt();
}
