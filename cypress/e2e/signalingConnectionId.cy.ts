import * as assert from 'assert';
import Call from '../../lib/twilio/call';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';
import { expectEvent } from '../../tests/lib/util';

// VBLOCKS-7513: the signaling `connected` message carries `payload.connectionId`
// and the SDK copies it into every Insights event as
// `payload.signaling_connection_id`.
//
// This spec only runs against a backend that sends `connectionId` (chundergateway
// 2.2.5+, stage today). It is skipped unless both of these Cypress env values are
// set (for example via CYPRESS_DEVICE_CHUNDERW / CYPRESS_DEVICE_EVENTGW):
//   DEVICE_CHUNDERW  signaling hostname, e.g. chunderw-vpc-gll.stage.twilio.com
//   DEVICE_EVENTGW   insights hostname, e.g. eventgw.stage.twilio.com
// The token's TwiML app must dial `<Client>` with either the `To` param (README
// "Integration Tests" app) or the `recepient` param; both are sent.
//
// Insights posts are observed by wrapping the publisher's `_request.post` and
// calling through, so real posts still reach eventgw.

const chunderw: string | undefined = Cypress.env('DEVICE_CHUNDERW');
const eventgw: string | undefined = Cypress.env('DEVICE_EVENTGW');
const isConfigured = !!(chunderw && eventgw);
const suiteTitle = isConfigured
  ? 'Signaling connection id'
  : 'Signaling connection id (skipped: set CYPRESS_DEVICE_CHUNDERW and CYPRESS_DEVICE_EVENTGW '
    + 'to a backend that sends connected.payload.connectionId, e.g. stage)';

interface CapturedEvent {
  index: number;
  group: string;
  name: string;
  payload: Record<string, any>;
}

interface Observer {
  connected: Array<Record<string, any>>;
  events: CapturedEvent[];
  waitForConnected: (count: number, timeoutMs: number) => Promise<Record<string, any>>;
}

const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

const withTimeout = <T>(promise: Promise<T>, ms: number, what: string): Promise<T> =>
  Promise.race([promise, new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(`Timed out after ${ms} ms waiting for ${what}`)), ms))]);

/**
 * Records every raw `connected` payload received on the Device's signaling
 * transport (including after reconnects) and every Insights event the Device's
 * publisher posts. Must be called before register() / connect().
 */
function observe(device: Device): Observer {
  const connected: Array<Record<string, any>> = [];
  const events: CapturedEvent[] = [];
  const connectedWaiters: Array<() => void> = [];

  const publisher = (device as any)._publisher;
  assert(publisher, 'Device has no publisher after construction');
  const originalRequest = publisher._request;
  publisher._request = {
    post: (params: any, callback: Function) => {
      if (/\/v4\/EndpointEvents$/.test(params.url)) {
        // Snapshot the body as it is at post time. Never record headers (token).
        const body = JSON.parse(JSON.stringify(params.body));
        events.push({ index: events.length, group: body.group, name: body.name, payload: body.payload });
      }
      return originalRequest.post(params, callback);
    },
  };

  // The stream is created lazily by register()/connect(). Hook its transport as
  // soon as it exists; the WebSocket opens asynchronously, so no message is missed.
  const originalSetupStream = (device as any)._setupStream;
  (device as any)._setupStream = function(...args: any[]) {
    const result = originalSetupStream.apply(this, args);
    const stream = (device as any)._stream;
    stream.transport.on('message', (msg: any) => {
      if (!msg || typeof msg.data !== 'string') { return; }
      let parsed: any;
      try { parsed = JSON.parse(msg.data); } catch (e) { return; }
      if (parsed.type === 'connected') {
        connected.push(parsed.payload || {});
        connectedWaiters.splice(0).forEach(fn => fn());
      }
    });
    return result;
  };

  const waitForConnected = (count: number, timeoutMs: number) => withTimeout(new Promise<Record<string, any>>(resolve => {
    const check = () => {
      if (connected.length >= count) {
        resolve(connected[connected.length - 1]);
      } else {
        connectedWaiters.push(check);
      }
    };
    check();
  }), timeoutMs, `connected message #${count}`);

  return { connected, events, waitForConnected };
}

// HTTP status of every EndpointEvents fetch (the SDK itself ignores it).
// Filled by a call-through wrapper around window.fetch.
const eventgwStatuses: Record<string, number> = {};
const originalFetch = window.fetch;
let pendingEventgw = 0;

(isConfigured ? describe : describe.skip)(suiteTitle, { retries: 0 }, function() {
  this.timeout(90000);

  let device1: Device;
  let device2: Device;
  let identity2: string;
  let observer1: Observer;
  let observer2: Observer;
  let connectionId1: string;
  let connectionId2: string;
  let reconnectedId: string;
  let socket1: any;
  const callTempSids: string[] = [];

  const idsOf = (events: CapturedEvent[]) =>
    Array.from(new Set(events.map(e => e.payload.signaling_connection_id)));

  const eventsForCall = (tempSid: string) =>
    observer1.events.filter(e => e.payload.temp_call_sid === tempSid);

  const placeAnsweredCall = async (): Promise<string> => {
    const incoming = expectEvent(Device.EventName.Incoming, device2) as Promise<Call>;
    const call = await device1.connect({ params: { To: identity2, recepient: identity2 } });
    const tempSid = call.outboundConnectionId as string;
    assert(tempSid, 'outbound call has no temp call sid');
    const answered = expectEvent('accept', call);
    const call2 = await withTimeout(incoming, 30000, 'incoming call on device2');
    call2.accept();
    await withTimeout(answered, 30000, 'accept on the outbound call');
    // Let ice/pc/codec events post while the call is up.
    await sleep(2000);
    const disconnected = expectEvent('disconnect', call);
    call.disconnect();
    await withTimeout(disconnected, 15000, 'disconnect');
    await sleep(500);
    callTempSids.push(tempSid);
    return tempSid;
  };

  before(async () => {
    (window as any).fetch = (input: any, init?: any) => {
      const url = typeof input === 'string' ? input : input && input.url;
      const p = originalFetch.call(window, input, init);
      if (typeof url === 'string' && /\/v4\/EndpointEvents$/.test(url)) {
        pendingEventgw++;
        p.finally(() => { pendingEventgw--; });
        p.then((res: Response) => {
          const key = String(res.status);
          eventgwStatuses[key] = (eventgwStatuses[key] || 0) + 1;
        }, () => {
          eventgwStatuses.network_error = (eventgwStatuses.network_error || 0) + 1;
        });
      }
      return p;
    };

    const identity1 = 'sigconn1-' + Date.now();
    identity2 = 'sigconn2-' + Date.now();
    const [token1, token2] = await Promise.all([
      generateAccessToken(identity1, 900),
      generateAccessToken(identity2, 900),
    ]);
    const options = { chunderw, eventgw };
    device1 = new Device(token1, options);
    device2 = new Device(token2, options);
    [device1, device2].forEach(d => d.on(Device.EventName.Error, () => { /* recorded by assertions */ }));
    observer1 = observe(device1);
    observer2 = observe(device2);
    await Promise.all([device1.register(), device2.register()]);
  });

  after(() => {
    [device1, device2].forEach(device => {
      if (device) {
        device.disconnectAll();
        device.destroy();
      }
    });
    (window as any).fetch = originalFetch;
  });

  it('should receive a non-empty connectionId in the connected payload', () => {
    assert(observer1.connected.length >= 1, 'device1 received no connected message');
    assert(observer2.connected.length >= 1, 'device2 received no connected message');
    const payload1 = observer1.connected[observer1.connected.length - 1];
    const payload2 = observer2.connected[observer2.connected.length - 1];
    assert.strictEqual(typeof payload1.connectionId, 'string', 'connected.payload.connectionId is not a string');
    assert(payload1.connectionId.length > 0, 'connected.payload.connectionId is empty');
    assert.strictEqual(typeof payload2.connectionId, 'string');
    connectionId1 = payload1.connectionId;
    connectionId2 = payload2.connectionId;
    // Repeated connected messages on one socket (e.g. listen re-sent) keep the id.
    observer1.connected.forEach(p => assert.strictEqual(p.connectionId, connectionId1));
    assert.strictEqual((device1 as any)._stream.connectionId, connectionId1);
    assert.notStrictEqual(connectionId1, connectionId2, 'two WebSockets share one connectionId');
    socket1 = (device1 as any)._stream.transport._socket;
    assert(socket1, 'no WebSocket on device1');
  });

  it('should include signaling_connection_id equal to connectionId in call events', async () => {
    const tempSid = await placeAnsweredCall();
    const callEvents = eventsForCall(tempSid);
    assert(callEvents.length > 0, 'no Insights events were posted for the call');
    const bad = callEvents.filter(e => e.payload.signaling_connection_id !== connectionId1);
    assert.deepStrictEqual(bad.map(e => `${e.group}/${e.name}:${e.payload.signaling_connection_id}`), []);
    // Every event device1 posted so far was on this connection.
    assert.deepStrictEqual(idsOf(observer1.events), [connectionId1]);
    // The callee side uses its own connection's id.
    assert(observer2.events.length > 0, 'device2 posted no Insights events');
    assert.deepStrictEqual(idsOf(observer2.events), [connectionId2]);
  });

  it('should use the same id for a second call over the same WebSocket', async () => {
    assert.strictEqual((device1 as any)._stream.transport._socket, socket1, 'device1 WebSocket changed');
    const tempSid = await placeAnsweredCall();
    assert.notStrictEqual(tempSid, callTempSids[0]);
    const callEvents = eventsForCall(tempSid);
    assert(callEvents.length > 0, 'no Insights events were posted for the second call');
    assert.deepStrictEqual(idsOf(callEvents), [connectionId1]);
    assert.deepStrictEqual(idsOf(eventsForCall(callTempSids[0])), idsOf(callEvents));
    assert.strictEqual((device1 as any)._stream.transport._socket, socket1, 'device1 WebSocket changed');
  });

  it('should use a new id after a signaling reconnect and never the old one', async () => {
    const stream = (device1 as any)._stream;
    const connectedBefore = observer1.connected.length;
    const eventsBefore = observer1.events.length;

    // A clean close takes the same transportClose path as a network drop
    // (transportClose.cy.ts); WSTransport reconnects and PStream re-sends listen.
    stream.transport._socket.close();
    const payload = await observer1.waitForConnected(connectedBefore + 1, 30000);
    const eventsAtReconnect = observer1.events.length;

    reconnectedId = payload.connectionId;
    assert.strictEqual(typeof reconnectedId, 'string', 'reconnect connected.payload.connectionId is not a string');
    assert(reconnectedId.length > 0, 'reconnect connectionId is empty');
    assert.notStrictEqual(reconnectedId, connectionId1, 'reconnect reused the previous connectionId');
    assert.notStrictEqual(stream.transport._socket, socket1, 'WebSocket was not replaced');
    assert.strictEqual((device1 as any)._stream, stream, 'PStream was replaced; expected a transport reconnect');
    assert.strictEqual(stream.connectionId, reconnectedId);

    // Nothing posted between close and the new connected may use the new id
    // (it did not exist yet); none were expected because no call was active.
    const gapEvents = observer1.events.slice(eventsBefore, eventsAtReconnect);
    gapEvents.forEach(e => assert.notStrictEqual(e.payload.signaling_connection_id, reconnectedId));

    const tempSid = await placeAnsweredCall();
    const callEvents = eventsForCall(tempSid);
    assert(callEvents.length > 0, 'no Insights events were posted after reconnect');
    assert.deepStrictEqual(idsOf(callEvents), [reconnectedId]);
    const afterReconnect = observer1.events.slice(eventsAtReconnect);
    assert.deepStrictEqual(afterReconnect.filter(e => e.payload.signaling_connection_id === connectionId1)
      .map(e => `${e.group}/${e.name}`), [], 'events after reconnect carried the old id');
    assert.deepStrictEqual(idsOf(afterReconnect), [reconnectedId]);
  });

  it('should keep the Device working (registered, no unexpected state) after the checks', async () => {
    // Tolerance for a missing field is unit-tested; here only check nothing broke.
    if (device1.state !== Device.State.Registered) {
      await withTimeout(expectEvent(Device.EventName.Registered, device1), 30000, 'device1 re-register');
    }
    assert.strictEqual(device1.state, Device.State.Registered);
    assert.strictEqual(device2.state, Device.State.Registered);
    assert.strictEqual(device1.calls.length, 0);
  });

  it('should have every Insights event post accepted by eventgw (HTTP 2xx)', async () => {
    const deadline = Date.now() + 10000;
    while (pendingEventgw > 0 && Date.now() < deadline) {
      await sleep(100);
    }
    assert.strictEqual(pendingEventgw, 0, 'EndpointEvents posts still pending');
    const statuses = Object.keys(eventgwStatuses);
    assert(statuses.length > 0, 'no EndpointEvents responses were observed');
    assert.deepStrictEqual(statuses.filter(code => !/^2\d\d$/.test(code)), [],
      `non-2xx EndpointEvents responses: ${JSON.stringify(eventgwStatuses)}`);
  });

  // Informational. cy.task('log') is rejected by Cypress 14 privileged-command
  // verification once a call has run in this spec frame (root cause not found;
  // see logs/S3-e2e.md), so the observed ids are reported through this test's
  // title, which the spec reporter prints. Use them to look up the backend
  // WebSocket sessionId and the Insights records.
  it('should report the observed connection ids', function() {
    const summary = {
      device1: observer1.connected.map(p => p.connectionId),
      device2: observer2.connected.map(p => p.connectionId),
      events: { device1: observer1.events.length, device2: observer2.events.length },
      perCall: callTempSids.map(sid => ({ temp_call_sid: sid, events: eventsForCall(sid).length,
        ids: idsOf(eventsForCall(sid)) })),
      eventgwStatuses,
    };
    (this as any).test.title = `should report the observed connection ids ${JSON.stringify(summary)}`;
  });
});
