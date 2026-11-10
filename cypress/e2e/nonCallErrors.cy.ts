import * as assert from 'assert';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';

// VBLOCKS-7516: error-level Insights events are published without a Call.
// Device signaling errors are now published, and existing error events that
// pass no Call (for example `audio` / `ringtone-devices-set-failed`) are no
// longer dropped. Non-error events without a Call are still dropped.
//
// This spec runs against the SDK default hosts (prod) unless these optional
// Cypress env values override them (for example via CYPRESS_DEVICE_CHUNDERW /
// CYPRESS_DEVICE_EVENTGW, to run against stage):
//   DEVICE_CHUNDERW  signaling hostname, e.g. chunderw-vpc-gll.stage.twilio.com
//   DEVICE_EVENTGW   insights hostname, e.g. eventgw.stage.twilio.com
// Errors raised before the first `connected` are only posted when the Device
// has an `eventgw` option (the host is otherwise learned from `connected`), so
// the tests for those pass DEVICE_EVENTGW or, without it, the SDK's default
// gateway host.
//
// No call is placed. Every Device uses appName = RUN_ID and appVersion = the
// test's tag, so the events can be found in the Insights store afterwards. The
// last test logs RUN_ID and every event it observed.
//
// A call-through wrapper around window.fetch records each EndpointEvents post
// body and its HTTP status. Request headers (the access token) are not read.

const chunderw: string | undefined = Cypress.env('DEVICE_CHUNDERW');
const eventgw: string | undefined = Cypress.env('DEVICE_EVENTGW');
// Only the overrides that are set are passed, so the SDK defaults apply otherwise.
const hostOptions = { ...(chunderw ? { chunderw } : {}), ...(eventgw ? { eventgw } : {}) };
// The gateway the pre-`connected` tests set: the override, or the SDK default
// (defaultEventGatewayURI in lib/twilio/regions.ts).
const preConnectEventgw = eventgw || 'eventgw.twilio.com';

const RUN_ID = `vblocks-7516-e2e-${Date.now()}`;
const UNREACHABLE_HOST = 'voice-e2e-unreachable.invalid';
const CALL_ID_KEYS = ['call_sid', 'temp_call_sid', 'direction', 'audio_codec'];

interface Post {
  body: Record<string, any>;
  host: string;
  start: number;
  status?: number | 'network_error';
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function waitUntil(predicate: () => boolean, timeoutMs: number, what: string): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (!predicate()) {
    if (Date.now() > deadline) {
      throw new Error(`Timed out after ${timeoutMs} ms waiting for ${what}`);
    }
    await sleep(50);
  }
}

const posts: Post[] = [];
const originalFetch = window.fetch;

const waitForSettledPosts = () =>
  waitUntil(() => posts.every(p => p.status !== undefined), 15000, 'EndpointEvents posts to settle');

/** Posts made by Devices created with this appVersion tag. */
const postsFor = (tag: string) => posts.filter(p =>
  p.body.publisher_metadata && p.body.publisher_metadata.app_version === tag);

const errorPostsFor = (tag: string) => postsFor(tag).filter(p =>
  p.body.group === 'connection' && p.body.name === 'error');

function assertNoCallIds(body: Record<string, any>) {
  CALL_ID_KEYS.forEach(key =>
    assert(!(key in body.payload), `${key} present on an event outside a call: ${JSON.stringify(body)}`));
}

function assertNonCallError(body: Record<string, any>, code: number) {
  assert.strictEqual(body.group, 'connection');
  assert.strictEqual(body.name, 'error');
  assert.strictEqual(body.level, 'ERROR');
  assert.strictEqual(body.payload.code, code);
  assert.strictEqual(typeof body.payload.message, 'string');
  assertNoCallIds(body);
}

const isOk = (status: Post['status']) => typeof status === 'number' && status >= 200 && status < 300;

describe('Errors outside a call (Insights)', function() {
  this.timeout(120000);
  Cypress.config('defaultCommandTimeout', 120000);

  const devices: Device[] = [];
  const report: Record<string, any> = { runId: RUN_ID, tests: {} };

  const createDevice = (token: string, tag: string, options: Record<string, any> = {}) => {
    const device = new Device(token, { appName: RUN_ID, appVersion: tag, ...hostOptions, ...options });
    devices.push(device);
    const errors: number[] = [];
    device.on(Device.EventName.Error, (error: any) => { errors.push(error && error.code); });
    return { device, errors };
  };

  const mintToken = (prefix: string, ttl: number = 600) =>
    generateAccessToken(`${prefix}-${Date.now()}`, ttl);

  const destroy = (device: Device) => {
    if (device.state !== Device.State.Destroyed) {
      device.destroy();
    }
  };

  const record = (tag: string, extra: Record<string, any> = {}) => {
    report.tests[tag] = {
      ...extra,
      posts: postsFor(tag).map(p => ({
        code: p.body.payload.code,
        group: p.body.group,
        level: p.body.level,
        message: p.body.payload.message,
        name: p.body.name,
        signaling_connection_id: p.body.payload.signaling_connection_id,
        status: p.status,
        timestamp: p.body.timestamp,
      })),
    };
  };

  before(() => {
    (window as any).fetch = (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input && input.url;
      const p = originalFetch.call(window, input, init);
      if (typeof url === 'string' && /\/v4\/EndpointEvents$/.test(url)) {
        let body: Record<string, any> = {};
        try { body = JSON.parse(init && typeof init.body === 'string' ? init.body : '{}'); } catch (e) { /* empty */ }
        const post: Post = { body, host: new URL(url).host, start: Date.now() };
        posts.push(post);
        p.then((res: Response) => { post.status = res.status; }, () => { post.status = 'network_error'; });
      }
      return p;
    };
  });

  after(() => {
    devices.forEach(destroy);
    (window as any).fetch = originalFetch;
  });

  it('should publish a token error before connect (invalid token)', async () => {
    const tag = 'invalid-token';
    const { device, errors } = createDevice('invalid-token-voice-e2e', tag, { eventgw: preConnectEventgw });
    device.register().catch(() => { /* rejected when the server closes the stream */ });
    await waitUntil(() => errors.length >= 1, 20000, 'a Device error');
    await sleep(1000);
    await waitForSettledPosts();

    assert.deepStrictEqual(errors, [20101]);
    const sent = errorPostsFor(tag);
    assert.strictEqual(sent.length, 1);
    assertNonCallError(sent[0].body, 20101);
    assert.strictEqual(sent[0].host, preConnectEventgw);
    // The post carries the same invalid token; the gateway may reject it.
    record(tag);
    destroy(device);
  });

  it('should publish a token error before connect (expired token)', async () => {
    const tag = 'expired-token';
    const token = await mintToken('noncall-expired', 1);
    await sleep(2500);
    const { device, errors } = createDevice(token, tag, { eventgw: preConnectEventgw });
    device.register().catch(() => { /* rejected when the server closes the stream */ });
    await waitUntil(() => errors.length >= 1, 20000, 'a Device error');
    await sleep(1000);
    await waitForSettledPosts();

    assert.deepStrictEqual(errors, [20104]);
    const sent = errorPostsFor(tag);
    assert.strictEqual(sent.length, 1);
    assertNonCallError(sent[0].body, 20104);
    record(tag);
    destroy(device);
  });

  it('should publish a server error frame after connect with the signaling connection id', async () => {
    const tag = 'server-error-frame';
    const { device, errors } = createDevice(await mintToken('noncall-frame'), tag);
    await device.register();
    const connectionId = (device as any)._stream.signalingConnectionId;
    assert.strictEqual(typeof connectionId, 'string');

    // The server answers an unknown message type with an error frame (no callsid).
    (device as any)._stream.transport.send(JSON.stringify({ payload: {}, type: 'voice-e2e-unknown', version: '1.6' }));
    await waitUntil(() => errors.length >= 1, 20000, 'a Device error');
    await sleep(1000);
    await waitForSettledPosts();

    const sent = errorPostsFor(tag);
    assert.strictEqual(sent.length, 1);
    assertNonCallError(sent[0].body, errors[0]);
    assert.strictEqual(sent[0].body.payload.signaling_connection_id, connectionId);
    assert(isOk(sent[0].status), `post status ${sent[0].status}`);
    record(tag, { connectionId });
    destroy(device);
  });

  it('should publish one transport error while signaling is unreachable', async () => {
    const tag = 'transport-unreachable';
    const { device, errors } = createDevice(await mintToken('noncall-unreach'), tag,
      { chunderw: UNREACHABLE_HOST, eventgw: preConnectEventgw });
    const start = Date.now();
    device.register().catch(() => { /* never connects */ });
    await sleep(10000);
    destroy(device);
    const elapsedMs = Date.now() - start;
    await sleep(1000);
    await waitForSettledPosts();

    assert(errors.length > 1, `expected repeated Device errors, got ${errors.length}`);
    const sent = errorPostsFor(tag);
    // The connection never comes up, so only the first transport error is
    // published. Device error is still emitted for every attempt.
    assert.deepStrictEqual(sent.map(p => p.body.payload.code), [errors[0]]);
    assertNonCallError(sent[0].body, errors[0]);
    assert.strictEqual(sent[0].host, preConnectEventgw);
    record(tag, { deviceErrors: errors.length, elapsedMs });
  });

  it('should publish the dropped connection id after a silent drop (heartbeat timeout path)', async () => {
    const tag = 'silent-drop';
    const { device, errors } = createDevice(await mintToken('noncall-drop'), tag);
    await device.register();
    const transport = (device as any)._stream.transport;
    const connectionId = (device as any)._stream.signalingConnectionId;
    assert.strictEqual(typeof connectionId, 'string');

    // Make every reconnect attempt fail, then close the socket the way the
    // heartbeat timeout does: no error is raised for the drop itself.
    transport.updatePreferredURI(null);
    transport.updateURIs([`wss://${UNREACHABLE_HOST}/signal`]);
    transport._shouldFallback = true;
    transport._closeSocket();
    await waitUntil(() => errors.length >= 2, 20000, 'repeated Device errors after the drop');
    destroy(device);
    await sleep(1000);
    await waitForSettledPosts();

    const sent = errorPostsFor(tag);
    // One transport error for the lost connection, naming that connection.
    assert.deepStrictEqual(sent.map(p => p.body.payload.code), [errors[0]]);
    assertNonCallError(sent[0].body, errors[0]);
    assert.strictEqual(sent[0].body.payload.signaling_connection_id, connectionId);
    assert(isOk(sent[0].status), `post status ${sent[0].status}`);
    record(tag, { connectionId, deviceErrors: errors.length });
  });

  it('should publish ringtone-devices-set-failed without a Call or a code', async () => {
    const tag = 'ringtone-sink-failed';
    const { device } = createDevice(await mintToken('noncall-sink'), tag);
    await device.register();

    // Fail setSinkId on the ringtone sound, then run the same path
    // device.audio.ringtoneDevices.set() takes.
    const incoming = (device as any)._soundcache.get(Device.SoundName.Incoming);
    incoming.setSinkIds = () => Promise.reject(new Error('voice-e2e setSinkId failure'));
    await (device as any)._updateSinkIds('ringtone', ['default']).then(
      () => { throw new Error('expected a rejection'); },
      () => { /* expected */ });
    await sleep(1000);
    await waitForSettledPosts();

    const sent = postsFor(tag).filter(p => p.body.group === 'audio');
    assert.strictEqual(sent.length, 1);
    const body = sent[0].body;
    assert.strictEqual(body.name, 'ringtone-devices-set-failed');
    assert.strictEqual(body.level, 'ERROR');
    assert.deepStrictEqual(body.payload.audio_device_ids, ['default']);
    assert.strictEqual(body.payload.message, 'voice-e2e setSinkId failure');
    assert(!('code' in body.payload));
    assertNoCallIds(body);
    assert(isOk(sent[0].status), `post status ${sent[0].status}`);
    record(tag);
    destroy(device);
  });

  it('should post only error-level events, none with call ids, while no call exists', async () => {
    await waitForSettledPosts();
    const mine = posts.filter(p => p.body.publisher_metadata && p.body.publisher_metadata.app_name === RUN_ID);
    assert(mine.length > 0);
    mine.forEach(p => {
      assert.strictEqual(p.body.level, 'ERROR', `non-error event posted: ${p.body.group}/${p.body.name}`);
      assertNoCallIds(p.body);
    });
    report.totalPosts = mine.length;
    report.statuses = mine.reduce((acc: Record<string, number>, p) => {
      acc[String(p.status)] = (acc[String(p.status)] || 0) + 1;
      return acc;
    }, {});
  });

  // Informational: cy.task is avoided in these e2e specs (Cypress privileged
  // command verification can reject it), so the data goes in this title.
  it('should report the observed data', function() {
    (this as any).test.title = `should report the observed data NONCALL_REPORT ${JSON.stringify(report)}`;
  });
});
