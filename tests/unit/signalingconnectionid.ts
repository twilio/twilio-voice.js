// VBLOCKS-7513: signaling_connection_id end to end inside the SDK.
// Real PStream (with the mock WSTransport) + real EventPublisher (with a
// request stub) + Device. Only the VSP wire format and the Insights request
// body are asserted, so these tests do not depend on internal property names.
import * as assert from 'assert';
import { EventEmitter } from 'events';
import * as sinon from 'sinon';
import Device from '../../lib/twilio/device';
import PStream from '../../lib/twilio/pstream';

// tslint:disable only-arrow-functions no-empty

const root = global as any;

const ClientCapability = require('twilio').jwt.ClientCapability;
const CallClass = require('../../lib/twilio/call').default;
const MockWSTransport = require('../mock/WSTransport');

describe('signaling_connection_id (VBLOCKS-7513)', () => {
  let clock: sinon.SinonFakeTimers;
  let device: any;
  let pstream: any;
  let pstreams: any[];
  let posts: any[];
  let postStub: sinon.SinonSpy;
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
    audioHelper._updateAvailableDevices = sinon.stub().returns(Promise.reject());
    audioHelper.disconnect = () => true;
    audioHelper.incoming = () => true;
    audioHelper.outgoing = () => true;
    return audioHelper;
  };

  const Call = () => createEmitterStub(CallClass);

  const Sound = () => sinon.createStubInstance(require('../../lib/twilio/sound').default);

  // Device constructs `new options.PStream(token, uris, options)`. Wrap the real
  // PStream so it uses the mock transport.
  const PStreamFactory = function(t: string, uris: string[], opts: any) {
    pstream = new (PStream as any)(t, uris, { ...opts, TransportFactory: MockWSTransport });
    pstream.transport.send = sinon.stub().returns(true);
    pstreams.push(pstream);
    return pstream;
  };

  const createFakeCall = (callSid: string, tempCallSid: string): any => ({
    _mediaHandler: { _onInputDevicesChanged() { } },
    codec: 'opus',
    direction: 'OUTGOING',
    disconnect: sinon.stub(),
    outboundConnectionId: tempCallSid,
    parameters: { CallSid: callSid },
    reject: sinon.stub(),
  });

  const receive = (stream: any, type: string, payload: any) => {
    stream.transport.emit('message', {
      data: JSON.stringify({ payload, type, version: '1.6' }),
    });
  };

  // Shape of the chundergateway 2.2.5 `connected` message: `payload.connectionId`
  // is an opaque string (the backend WebSocket sessionId).
  const receiveConnected = (connectionId?: any, stream: any = pstream) => {
    const payload: any = {
      edge: 'ashburn',
      home: 'stage-us1',
      region: 'US_EAST_VIRGINIA',
      token: { identity: 'alice' },
    };
    if (connectionId !== undefined) {
      payload.connectionId = connectionId;
    }
    receive(stream, 'connected', payload);
  };

  const connectSignaling = async (connectionId?: any) => {
    const setupPromise = device._setupStream();
    pstream.transport.emit('open');
    receiveConnected(connectionId);
    await setupPromise;
  };

  const installRequestStub = () => {
    postStub = sinon.spy((params: any, cb: Function) => {
      posts.push(params);
      cb();
    });
    device._publisher._request = { post: postStub };
  };

  const eventBodies = () => posts
    .filter(params => /\/v4\/EndpointEvents$/.test(params.url))
    .map(params => params.body);

  const lastEventBody = () => {
    const bodies = eventBodies();
    assert(bodies.length > 0, 'expected at least one EndpointEvents post');
    return bodies[bodies.length - 1];
  };

  beforeEach(() => {
    clock = sinon.useFakeTimers(Date.now());
    pstream = null;
    pstreams = [];
    posts = [];
    token = createToken('alice');
    device = new Device(token, { AudioHelper, Call, PStream: PStreamFactory, Sound } as any);
    device.on('error', () => { });
    installRequestStub();
  });

  afterEach(() => {
    try {
      if (device.state !== Device.State.Destroyed) {
        device.destroy();
      }
    } finally {
      // Always restore timers so a failure here cannot hang later suites.
      clock.restore();
      root.resetEvents();
    }
  });

  describe('initial connection', () => {
    it('should carry the exact connectionId on info, warning and error events', async () => {
      await connectSignaling('6ee01b38-0000-4000-8000-00000000000a');
      const call = createFakeCall('CA1111', 'TJ1111');

      [['info', 'INFO'], ['warn', 'WARNING'], ['error', 'ERROR']].forEach(([method, level]) => {
        device._publisher[method]('test-group', `test-${method}`, { foo: 'bar' }, call);
        const body = lastEventBody();
        assert.strictEqual(body.level, level);
        assert.strictEqual(body.name, `test-${method}`);
        assert.strictEqual(body.payload.signaling_connection_id, '6ee01b38-0000-4000-8000-00000000000a');
        assert.strictEqual(body.payload.call_sid, 'CA1111');
        assert.strictEqual(body.payload.foo, 'bar');
      });

      assert.strictEqual(eventBodies().length, 3);
    });

    it('should carry the connectionId on events posted through post()', async () => {
      await connectSignaling('CONN-A');
      device._publisher.post('debug', 'test-group', 'test-post', null, createFakeCall('CA1111', 'TJ1111'));
      assert.strictEqual(lastEventBody().payload.signaling_connection_id, 'CONN-A');
    });

    it('should carry the connectionId on a Device-published event (audio device-change)', async () => {
      await connectSignaling('CONN-A');
      device._activeCall = createFakeCall('CA1111', 'TJ1111');
      device.audio.emit('deviceChange', [{ deviceId: 'foo' }]);
      const body = lastEventBody();
      assert.strictEqual(body.group, 'audio');
      assert.strictEqual(body.name, 'device-change');
      assert.strictEqual(body.payload.signaling_connection_id, 'CONN-A');
    });

    it('should include the connectionId in the default payload without a call', async () => {
      await connectSignaling('CONN-A');
      const payload = device._createDefaultPayload();
      assert.strictEqual(payload.signaling_connection_id, 'CONN-A');
      assert(!('call_sid' in payload));
      assert(!('temp_call_sid' in payload));
      assert(!('direction' in payload));
    });

    it('should carry the connectionId when the event payload is null', async () => {
      await connectSignaling('CONN-A');
      device._publisher.info('test-group', 'test-null-payload', null, createFakeCall('CA1111', 'TJ1111'));
      assert.strictEqual(lastEventBody().payload.signaling_connection_id, 'CONN-A');
    });
  });

  describe('older backend without connectionId', () => {
    it('should omit the field and keep publishing events', async () => {
      await connectSignaling(undefined);
      device._publisher.info('test-group', 'test-info', { foo: 'bar' }, createFakeCall('CA1111', 'TJ1111'));
      const body = lastEventBody();
      assert(!('signaling_connection_id' in body.payload));
      assert.strictEqual(body.payload.call_sid, 'CA1111');
      assert.strictEqual(body.payload.foo, 'bar');
      assert.strictEqual(device.edge, 'ashburn');
    });

    it('should omit the field from the default payload without a call', async () => {
      await connectSignaling(undefined);
      assert(!('signaling_connection_id' in device._createDefaultPayload()));
    });

    it('should omit the field when connectionId is not a string', async () => {
      await connectSignaling(12345);
      device._publisher.info('test-group', 'test-info', null, createFakeCall('CA1111', 'TJ1111'));
      assert(!('signaling_connection_id' in lastEventBody().payload));
    });
  });

  describe('multiple calls on one connection', () => {
    it('should give events from two calls the same connectionId', async () => {
      await connectSignaling('CONN-A');
      device._publisher.info('connection', 'outgoing', null, createFakeCall('CA1111', 'TJ1111'));
      device._publisher.info('connection', 'outgoing', null, createFakeCall('CA2222', 'TJ2222'));
      const [first, second] = eventBodies();
      assert.strictEqual(first.payload.call_sid, 'CA1111');
      assert.strictEqual(second.payload.call_sid, 'CA2222');
      assert.strictEqual(first.payload.signaling_connection_id, 'CONN-A');
      assert.strictEqual(second.payload.signaling_connection_id, 'CONN-A');
    });

    it('should give the same connectionId before, during and after a call', async () => {
      await connectSignaling('CONN-A');
      const before = device._createDefaultPayload();
      device._publisher.info('connection', 'outgoing', null, createFakeCall('CA1111', 'TJ1111'));
      const after = device._createDefaultPayload();
      assert.strictEqual(before.signaling_connection_id, 'CONN-A');
      assert.strictEqual(lastEventBody().payload.signaling_connection_id, 'CONN-A');
      assert.strictEqual(after.signaling_connection_id, 'CONN-A');
    });
  });

  describe('reconnect on the same PStream', () => {
    it('should drop the old id on transport close and use the new id after reconnect', async () => {
      await connectSignaling('CONN-A');
      const call = createFakeCall('CA1111', 'TJ1111');

      device._publisher.info('test-group', 'on-a', null, call);
      pstream.transport.emit('close');
      device._publisher.info('test-group', 'after-close', null, call);
      assert(!('signaling_connection_id' in device._createDefaultPayload()));

      pstream.transport.emit('open');
      device._publisher.info('test-group', 'after-open', null, call);

      receiveConnected('CONN-B');
      device._publisher.info('test-group', 'on-b', null, call);

      const byName: Record<string, any> = {};
      eventBodies().forEach(body => { byName[body.name] = body.payload; });
      assert.strictEqual(byName['on-a'].signaling_connection_id, 'CONN-A');
      assert(!('signaling_connection_id' in byName['after-close']));
      assert(!('signaling_connection_id' in byName['after-open']));
      assert.strictEqual(byName['on-b'].signaling_connection_id, 'CONN-B');
      assert.strictEqual(pstreams.length, 1);
    });

    it('should stamp the old id on events published from transportClose listeners only', async () => {
      await connectSignaling('CONN-A');
      const call = createFakeCall('CA1111', 'TJ1111');
      // Same timing as Call `connection/reconnecting`, which describes the dropped connection.
      pstream.on('transportClose', () => {
        device._publisher.info('connection', 'reconnecting', null, call);
      });
      pstream.on('offline', () => {
        device._publisher.info('test-group', 'on-offline', null, call);
      });
      pstream.transport.emit('close');

      const byName: Record<string, any> = {};
      eventBodies().forEach(body => { byName[body.name] = body.payload; });
      assert.strictEqual(byName.reconnecting.signaling_connection_id, 'CONN-A');
      assert(!('signaling_connection_id' in byName['on-offline']));
      assert(!('signaling_connection_id' in device._createDefaultPayload()));
    });

    it('should never reuse the old id if the reconnected backend sends none', async () => {
      await connectSignaling('CONN-A');
      pstream.transport.emit('close');
      pstream.transport.emit('open');
      receiveConnected(undefined);
      device._publisher.info('test-group', 'after-reconnect', null, createFakeCall('CA1111', 'TJ1111'));
      assert(!('signaling_connection_id' in lastEventBody().payload));
      assert(!('signaling_connection_id' in device._createDefaultPayload()));
    });

    it('should keep the id when updateToken leads to a repeated connected with the same id', async () => {
      await connectSignaling('CONN-A');
      device.updateToken(createToken('alice'));
      receiveConnected('CONN-A');
      device._publisher.info('test-group', 'after-update-token', null, createFakeCall('CA1111', 'TJ1111'));
      assert.strictEqual(lastEventBody().payload.signaling_connection_id, 'CONN-A');
    });
  });

  describe('replacement PStream', () => {
    it('should not inherit the id from the previous PStream', async () => {
      await connectSignaling('CONN-A');
      const oldStream = pstream;

      const setupPromise = device._setupStream();
      assert.notStrictEqual(pstream, oldStream);
      assert(!('signaling_connection_id' in device._createDefaultPayload()));

      // A late message on the destroyed stream must not leak into the new one.
      receiveConnected('CONN-OLD', oldStream);
      assert(!('signaling_connection_id' in device._createDefaultPayload()));

      pstream.transport.emit('open');
      receiveConnected('CONN-C');
      await setupPromise;
      device._publisher.info('test-group', 'on-c', null, createFakeCall('CA1111', 'TJ1111'));
      assert.strictEqual(lastEventBody().payload.signaling_connection_id, 'CONN-C');
    });

    it('should omit the id after the server closes the stream', async () => {
      await connectSignaling('CONN-A');
      receive(pstream, 'close', {});
      assert(!('signaling_connection_id' in device._createDefaultPayload()));
    });
  });

  describe('publisher recreated by updateOptions', () => {
    it('should still carry the current id', async () => {
      await connectSignaling('CONN-A');
      device.updateOptions({ appName: 'foobar' });
      installRequestStub();
      device._publisher.info('test-group', 'after-update-options', null, createFakeCall('CA1111', 'TJ1111'));
      assert.strictEqual(lastEventBody().payload.signaling_connection_id, 'CONN-A');
    });
  });

  // The event, including its default payload and timestamp, is built when it is
  // created, never when it is sent.
  describe('snapshot timing', () => {
    it('should keep the id and timestamp the event had when it was created', async () => {
      await connectSignaling('CONN-A');
      const createdAt = new Date(Date.now()).toISOString();

      // Hold the request open so the body can be checked after a reconnect.
      const pending: Function[] = [];
      device._publisher._request = {
        post: (params: any, cb: Function) => {
          posts.push(params);
          pending.push(cb);
        },
      };

      device._publisher.info('test-group', 'created-on-a', null, createFakeCall('CA1111', 'TJ1111'));
      const heldBody = lastEventBody();

      clock.tick(5000);
      pstream.transport.emit('close');
      pstream.transport.emit('open');
      receiveConnected('CONN-B');

      device._publisher.info('test-group', 'created-on-b', null, createFakeCall('CA1111', 'TJ1111'));
      const laterBody = lastEventBody();

      assert.strictEqual(heldBody.payload.signaling_connection_id, 'CONN-A');
      assert.strictEqual(heldBody.timestamp, createdAt);
      assert.strictEqual(laterBody.payload.signaling_connection_id, 'CONN-B');
      assert.notStrictEqual(laterBody.timestamp, createdAt);
      assert.notStrictEqual(heldBody.payload, laterBody.payload);

      pending.forEach(cb => cb());
      await clock.tickAsync(0);
    });

    it('should return a new default payload object on every call', async () => {
      await connectSignaling('CONN-A');
      const first = device._createDefaultPayload();
      first.signaling_connection_id = 'MUTATED';
      assert.strictEqual(device._createDefaultPayload().signaling_connection_id, 'CONN-A');
    });
  });

  // Metrics samples are array payloads and do not get the default payload.
  describe('metrics samples', () => {
    it('should not add signaling_connection_id to EndpointMetrics samples', async () => {
      await connectSignaling('CONN-A');
      const sample = {
        audioInputLevel: 1,
        audioOutputLevel: 1,
        codecName: 'opus',
        timestamp: Date.now(),
        totals: { },
      };
      await device._publisher.postMetrics('quality-metrics-samples', 'metrics-sample',
        [sample], { }, createFakeCall('CA1111', 'TJ1111'));

      const metricsPosts = posts.filter(params => /\/v4\/EndpointMetrics$/.test(params.url));
      assert.strictEqual(metricsPosts.length, 1);
      const samples = metricsPosts[0].body.payload;
      assert(Array.isArray(samples));
      samples.forEach((s: any) => assert(!('signaling_connection_id' in s)));
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
