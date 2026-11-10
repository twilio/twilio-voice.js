const assert = require('assert');
const sinon = require('sinon');

const PStream = require('../lib/twilio/pstream').default;
const { isTransportErrorPayload } = require('../lib/twilio/pstream');
const { RELEASE_VERSION } = require('../lib/twilio/constants');
const TransportFactory = require('./mock/WSTransport');

const EXPECTED_PSTREAM_VERSION = '1.6';

describe('PStream', () => {
  const maxPreferredDurationMs = 20000;
  let WSTransportFactorySpy;
  let token;
  let uris;
  let options;
  let pstream;

  beforeEach(() => {
    WSTransportFactorySpy = sinon.spy(TransportFactory);
    options = {
      TransportFactory: WSTransportFactorySpy,
      maxPreferredDurationMs,
    };
    token = 'foo';
    uris = ['wss://foo.bar/signal'];
    pstream = new PStream(token, uris, options);
  });

  describe('options', () => {
    function setupPStream(overrideOptions) {
      WSTransportFactorySpy.resetHistory();
      pstream = new PStream(token, uris, {
        ...options,
        ...overrideOptions,
      });
      return pstream;
    }

    Object.entries({
      backoffMaxMs: 42,
      maxPreferredDurationMs: 42,
    }).forEach(([optionKey, optionValue]) => {
      it(`should propagate ${optionKey} to wstransport`, () => {
        setupPStream({ [optionKey]: optionValue });
        const transportOptions = WSTransportFactorySpy.getCall(0).args[1];
        assert(typeof transportOptions === 'object' && transportOptions !== null);
        assert(transportOptions[optionKey] === optionValue);
      });
    });

    describe('reconnectTimeout', () => {
      [{
        maxPreferredDurationMs: 30000,
        reconnectTimeout: 30,
      },{
        maxPreferredDurationMs: 10000,
        reconnectTimeout: 10,
      },{
        maxPreferredDurationMs: 0,
        reconnectTimeout: 0,
      },{
        maxPreferredDurationMs: 'foo',
        reconnectTimeout: 0,
      },{
        maxPreferredDurationMs: undefined,
        reconnectTimeout: 0,
      },{
        maxPreferredDurationMs: -123,
        reconnectTimeout: 0,
      },{
        maxPreferredDurationMs: 40000,
        reconnectTimeout: 30,
      }].forEach(({maxPreferredDurationMs, reconnectTimeout}) => {
        it(`should set reconnectTimeout to ${reconnectTimeout} if maxPreferredDurationMs is ${maxPreferredDurationMs}`, () => {
          setupPStream({ maxPreferredDurationMs });
          pstream.setToken('foobar');
          assert.strictEqual(JSON.parse(pstream.transport.send.args[0][0]).payload.reconnectTimeout, reconnectTimeout);
        });
      });
    });
  });

  describe('constructor', () => {
    it('returns an instance of PStream', () => {
      assert(pstream instanceof PStream);
    });

    it('should begin in disconnected status', () => {
      assert.equal(pstream.status, 'disconnected');
    });
  });

  describe('when transport fires onopen', () => {
    it('should set status to connected', () => {
      pstream.transport.emit('open');
      assert.equal(pstream.status, 'connected');
      assert.equal(pstream.uri, 'foo');
    });

    it('should send a LISTEN with the token', () => {
      pstream.transport.emit('open');
      assert.equal(pstream.transport.send.callCount, 1);
      assert.deepEqual(JSON.parse(pstream.transport.send.args[0][0]), {
        payload: {
          browserinfo: {
            browser: {
              platform: navigator.platform,
              userAgent: navigator.userAgent,
            },
            p: 'browser',
            plugin: 'rtc',
            v: RELEASE_VERSION,
          },
          reconnectTimeout: 20,
          token: 'foo',
        },
        type: 'listen',
        version: EXPECTED_PSTREAM_VERSION
      });
    });


    it('should call transport.send for any queued messages', () => {
      pstream.transport.send = () => false;
      pstream.publish('foo', { });
      pstream.publish('foo', { });
      pstream.publish('foo', { });
      pstream.transport.send = sinon.spy();
      pstream.transport.emit('open');
      assert.equal(pstream.transport.send.callCount, 4);
    });

    it('should remove successfully sent queued messages and retain any failed', () => {
      pstream.transport.send = message => JSON.parse(message).type === 'foo';
      pstream.publish('foo', { });
      pstream.publish('foo', { });
      pstream.publish('bar', { });
      pstream.publish('bar', { });
      pstream.publish('bar', { });

      pstream.transport.send = sinon.spy(() => true);
      pstream.transport.emit('open');
      assert.equal(pstream.transport.send.callCount, 4);
    });
  });

  describe('when transport fires onclose', () => {
    it('should set status to disconnected regardless of status', () => {
      ['disconnected', 'connected', 'offline'].forEach(status => {
        pstream.status = status;
        pstream.transport.emit('close');
        assert.equal(pstream.status, 'disconnected');
      });
    });

    context('when status is connected', () => {
      it('should fire offline', (done) => {
        pstream.status = 'connected';
        pstream.on('offline', () => done());
        pstream.transport.emit('close');
      });
    });
  });

  describe('when transport fires onerror', () => {
    it('should fire error with the right format when only error is sent', (done) => {
      const err = { code: 1234, message: 'foo' };

      pstream.on('error', ({ error }) => {
        if (error === err) {
          done();
        } else {
          done(new Error('Error payload not correct format'));
        }
      });
      pstream.transport.emit('error', err);
    });

    it('should fire error with the right format when only error is sent', (done) => {
      const err = { code: 1234, message: 'foo' };

      pstream.on('error', ({ error }) => {
        if (error === err) {
          done();
        } else {
          done(new Error('Error payload not correct format'));
        }
      });
      pstream.transport.emit('error', { error: err, callSid: 'CA000' });
    });

    it('should not affect status', () => {
      ['disconnected', 'connected', 'offline'].forEach(status => {
        pstream.status = status;
        pstream.transport.emit('error');
        assert.equal(pstream.status, status);
      });
    });

    [
      ['only an error', { code: 31005, message: 'foo' }],
      ['an error payload', { error: { code: 31000, message: 'foo' }, callSid: 'CA000' }],
      ['no error', undefined],
    ].forEach(([scenario, err]) => {
      it(`should mark the payload as a transport error when the transport fires ${scenario}`, () => {
        const payloads = [];
        pstream.on('error', payload => payloads.push(payload));
        pstream.transport.emit('error', err);
        assert.equal(payloads.length, 1);
        assert.equal(isTransportErrorPayload(payloads[0]), true);
      });
    });

    it('should not add an enumerable property to the payload', () => {
      const payloads = [];
      pstream.on('error', payload => payloads.push(payload));
      pstream.transport.emit('error', { code: 31005, message: 'foo' });
      assert.deepEqual(Object.keys(payloads[0]), ['error']);
    });
  });

  describe('isTransportErrorPayload', () => {
    it('should be false for an error message from the server', () => {
      const payloads = [];
      pstream.on('error', payload => payloads.push(payload));
      pstream.transport.emit('message', { data: JSON.stringify({
        type: 'error', payload: { error: { code: 31100, message: 'foo' } },
      }) });
      assert.equal(payloads.length, 1);
      assert.equal(isTransportErrorPayload(payloads[0]), false);
    });

    [undefined, null, 'foo', {}, { error: {} }].forEach(payload => {
      it(`should be false for ${JSON.stringify(payload)}`, () => {
        assert.equal(isTransportErrorPayload(payload), false);
      });
    });
  });

  describe('when transport fires onmessage', () => {
    it('should emit an event matching the message type', () => {
      return Promise.all(['foo', 'bar'].map(type => {
        return new Promise(resolve => {
          pstream.on(type, resolve);
          pstream.transport.emit('message', { data: JSON.stringify({ type })});
        });
      }));
    });

    it('should set status to offline if it receives a close message', () => {
      return new Promise((resolve, reject) => {
        pstream.on('close', () => {
          pstream.status === 'offline' ? resolve() : reject();
        });
        pstream.transport.emit('message', { data: JSON.stringify({ type: 'close' })});
      });
    });

    it('should only emit offline once if it receives multiple close messages', () => {
      let count = 0;
      pstream.on('offline', () => { count++; });
      pstream.transport.emit('message', { data: JSON.stringify({ type: 'close' })});
      pstream.transport.emit('message', { data: JSON.stringify({ type: 'close' })});
      pstream.transport.emit('message', { data: JSON.stringify({ type: 'close' })});
      assert.equal(count, 1);
    });
  });

  // VBLOCKS-7513: the VSP `connected` message carries `payload.connectionId`
  // (the backend WebSocket sessionId). PStream keeps it at signaling
  // connection scope so Device can add it to every Insights event.
  describe('signalingConnectionId (VBLOCKS-7513)', () => {
    const receive = (type, payload) => {
      pstream.transport.emit('message', {
        data: JSON.stringify({ payload, type, version: EXPECTED_PSTREAM_VERSION }),
      });
    };

    const connectedPayload = (connectionId) => {
      const payload = {
        edge: 'ashburn',
        home: 'stage-us1',
        region: 'US_EAST_VIRGINIA',
        token: { identity: 'alice', ttl: 3600 },
      };
      if (connectionId !== undefined) {
        payload.connectionId = connectionId;
      }
      return payload;
    };

    const openAndConnect = (connectionId) => {
      pstream.transport.emit('open');
      receive('connected', connectedPayload(connectionId));
    };

    it('should not have a signalingConnectionId before any connected message', () => {
      assert.equal(pstream.signalingConnectionId, null);
    });

    it('should not have a signalingConnectionId after transport open but before connected', () => {
      pstream.transport.emit('open');
      assert.equal(pstream.signalingConnectionId, null);
    });

    it('should store the exact signalingConnectionId from a connected message', () => {
      openAndConnect('6ee01b38-0000-4000-8000-00000000000a');
      assert.strictEqual(pstream.signalingConnectionId, '6ee01b38-0000-4000-8000-00000000000a');
    });

    it('should treat the signalingConnectionId as an opaque string (no format validation)', () => {
      openAndConnect('not-a-uuid:42');
      assert.strictEqual(pstream.signalingConnectionId, 'not-a-uuid:42');
    });

    it('should still emit connected with the unmodified payload', () => {
      const listener = sinon.spy();
      pstream.on('connected', listener);
      openAndConnect('CONN-A');
      sinon.assert.calledOnce(listener);
      assert.deepStrictEqual(listener.args[0][0], connectedPayload('CONN-A'));
    });

    it('should be readable by connected listeners when connected is emitted', () => {
      let seen;
      pstream.on('connected', () => { seen = pstream.signalingConnectionId; });
      openAndConnect('CONN-A');
      assert.strictEqual(seen, 'CONN-A');
    });

    it('should leave signalingConnectionId absent when connected has no connectionId (older backend)', () => {
      const listener = sinon.spy();
      pstream.on('connected', listener);
      openAndConnect(undefined);
      assert.equal(pstream.signalingConnectionId, null);
      sinon.assert.calledOnce(listener);
    });

    it('should not read the signalingConnectionId key in the connected payload (VSP sends connectionId)', () => {
      pstream.transport.emit('open');
      receive('connected', { ...connectedPayload(undefined), signalingConnectionId: 'LEGACY-NAME' });
      assert.equal(pstream.signalingConnectionId, null);
    });

    [
      ['a number', 12345],
      ['a boolean', true],
      ['an object', { id: 'CONN-A' }],
      ['an array', ['CONN-A']],
      ['null', null],
    ].forEach(([label, value]) => {
      it(`should ignore a connectionId that is ${label}`, () => {
        openAndConnect(value);
        assert.equal(pstream.signalingConnectionId, null);
      });
    });

    ['ready', 'offline', 'invite', 'answer', 'hangup', 'cancel', 'error', 'message', 'ringing', 'foo'].forEach(type => {
      it(`should not set signalingConnectionId from a "${type}" message`, () => {
        pstream.transport.emit('open');
        const payload = { callsid: 'CA123', connectionId: `FROM-${type}` };
        if (type === 'error') {
          payload.error = { code: 31000, message: 'foo' };
        }
        receive(type, payload);
        assert.equal(pstream.signalingConnectionId, null);
      });

      // A server `offline` message (unregister response) leaves the socket open;
      // whether it clears the id is not fixed by the contract, so it is not asserted.
      if (type === 'offline') {
        return;
      }

      it(`should not overwrite an existing signalingConnectionId from a "${type}" message`, () => {
        openAndConnect('CONN-A');
        const payload = { callsid: 'CA123', connectionId: `FROM-${type}` };
        if (type === 'error') {
          payload.error = { code: 31000, message: 'foo' };
        }
        receive(type, payload);
        assert.strictEqual(pstream.signalingConnectionId, 'CONN-A');
      });
    });

    it('should keep the same signalingConnectionId when connected repeats the same id (e.g. after setToken)', () => {
      openAndConnect('CONN-A');
      pstream.setToken('new-token');
      receive('connected', connectedPayload('CONN-A'));
      assert.strictEqual(pstream.signalingConnectionId, 'CONN-A');
    });

    it('should replace the signalingConnectionId when connected carries a different id', () => {
      openAndConnect('CONN-A');
      receive('connected', connectedPayload('CONN-B'));
      assert.strictEqual(pstream.signalingConnectionId, 'CONN-B');
    });

    context('when the transport closes', () => {
      it('should clear the signalingConnectionId', () => {
        openAndConnect('CONN-A');
        pstream.transport.emit('close');
        assert.equal(pstream.signalingConnectionId, null);
      });

      // 'transportClose' listeners describe the connection that just dropped
      // (e.g. Call publishes `connection/reconnecting` and signaling errors
      // there), so they still see its id. It is cleared before 'offline'.
      it('should expose the old id to transportClose listeners and clear it before offline', () => {
        openAndConnect('CONN-A');
        const seen = [];
        pstream.on('transportClose', () => { seen.push(['transportClose', pstream.signalingConnectionId]); });
        pstream.on('offline', () => { seen.push(['offline', pstream.signalingConnectionId]); });
        pstream.transport.emit('close');
        assert.deepStrictEqual(seen, [
          ['transportClose', 'CONN-A'],
          ['offline', null],
        ]);
      });

      it('should clear the signalingConnectionId even if a transportClose listener throws', () => {
        openAndConnect('CONN-A');
        pstream.on('transportClose', () => { throw new Error('listener failure'); });
        assert.throws(() => pstream.transport.emit('close'), /listener failure/);
        assert.equal(pstream.signalingConnectionId, null);
      });

      it('should not let the next connection see the old id after a throwing transportClose listener', () => {
        openAndConnect('CONN-A');
        const failing = () => { throw new Error('listener failure'); };
        pstream.on('transportClose', failing);
        assert.throws(() => pstream.transport.emit('close'));
        pstream.removeListener('transportClose', failing);
        pstream.transport.emit('open');
        assert.equal(pstream.signalingConnectionId, null);
        receive('connected', connectedPayload('CONN-B'));
        assert.strictEqual(pstream.signalingConnectionId, 'CONN-B');
      });

      it('should not restore the old signalingConnectionId when the transport reopens', () => {
        openAndConnect('CONN-A');
        pstream.transport.emit('close');
        pstream.transport.emit('open');
        assert.equal(pstream.signalingConnectionId, null);
      });

      it('should use the new signalingConnectionId after reopen and a new connected', () => {
        openAndConnect('CONN-A');
        pstream.transport.emit('close');
        openAndConnect('CONN-B');
        assert.strictEqual(pstream.signalingConnectionId, 'CONN-B');
      });

      it('should never bring back the old signalingConnectionId when the new connected has none', () => {
        openAndConnect('CONN-A');
        pstream.transport.emit('close');
        openAndConnect(undefined);
        assert.equal(pstream.signalingConnectionId, null);
      });

      it('should track each connection across several reconnects', () => {
        ['CONN-1', 'CONN-2', 'CONN-3'].forEach(id => {
          openAndConnect(id);
          assert.strictEqual(pstream.signalingConnectionId, id);
          pstream.transport.emit('close');
          assert.equal(pstream.signalingConnectionId, null);
        });
      });
    });

    context('when the PStream is destroyed', () => {
      it('should clear the signalingConnectionId on destroy()', () => {
        openAndConnect('CONN-A');
        pstream.destroy();
        assert.equal(pstream.signalingConnectionId, null);
      });

      it('should clear the signalingConnectionId when the server sends close', () => {
        openAndConnect('CONN-A');
        receive('close', {});
        assert.equal(pstream.signalingConnectionId, null);
      });

      it('should ignore a connected message delivered after destroy()', () => {
        openAndConnect('CONN-A');
        pstream.destroy();
        receive('connected', connectedPayload('CONN-LATE'));
        assert.equal(pstream.signalingConnectionId, null);
      });
    });

    it('should not share the signalingConnectionId between PStream instances', () => {
      openAndConnect('CONN-A');
      const other = new PStream(token, uris, options);
      assert.equal(other.signalingConnectionId, null);
      assert.strictEqual(pstream.signalingConnectionId, 'CONN-A');
    });

    describe('lastClosedSignalingConnectionId', () => {
      it('should be null before any connection closes', () => {
        assert.equal(pstream.lastClosedSignalingConnectionId, null);
        openAndConnect('CONN-A');
        assert.equal(pstream.lastClosedSignalingConnectionId, null);
      });

      it('should hold the id of the connection that closed', () => {
        openAndConnect('CONN-A');
        pstream.transport.emit('close');
        assert.equal(pstream.signalingConnectionId, null);
        assert.strictEqual(pstream.lastClosedSignalingConnectionId, 'CONN-A');
      });

      it('should not be set yet while transportClose listeners run', () => {
        let seen;
        openAndConnect('CONN-A');
        pstream.on('transportClose', () => { seen = pstream.lastClosedSignalingConnectionId; });
        pstream.transport.emit('close');
        assert.equal(seen, null);
      });

      it('should be kept across reconnect attempts that never reach connected', () => {
        openAndConnect('CONN-A');
        pstream.transport.emit('close');
        pstream.transport.emit('open');
        pstream.transport.emit('close');
        pstream.transport.emit('close');
        assert.strictEqual(pstream.lastClosedSignalingConnectionId, 'CONN-A');
      });

      it('should be cleared by the next connected message', () => {
        openAndConnect('CONN-A');
        pstream.transport.emit('close');
        openAndConnect('CONN-B');
        assert.equal(pstream.lastClosedSignalingConnectionId, null);
        assert.strictEqual(pstream.signalingConnectionId, 'CONN-B');
      });

      it('should be cleared by a connected message without a connectionId', () => {
        openAndConnect('CONN-A');
        pstream.transport.emit('close');
        openAndConnect(undefined);
        assert.equal(pstream.lastClosedSignalingConnectionId, null);
      });

      it('should not be set by a close on a connection that never had an id', () => {
        openAndConnect(undefined);
        pstream.transport.emit('close');
        assert.equal(pstream.lastClosedSignalingConnectionId, null);
      });

      it('should be cleared on destroy', () => {
        openAndConnect('CONN-A');
        pstream.transport.emit('close');
        pstream.destroy();
        assert.equal(pstream.lastClosedSignalingConnectionId, null);
      });
    });
  });

  describe('updatePreferredURI', () => {
    it('should update the preferred uri', () => {
      pstream.updatePreferredURI('foo');
      assert.equal(pstream._preferredUri, 'foo');
    });

    it('should update the wstransport preferred uri', () => {
      pstream.updatePreferredURI('foo');
      sinon.assert.calledOnce(pstream.transport.updatePreferredURI);
    });
  });

  describe('updateURIs', () => {
    it('should update the uris', () => {
      pstream.updateURIs(['foo', 'bar']);
      assert.deepEqual(pstream._uris, ['foo', 'bar']);
    });

    it('should update the wstransport uris', () => {
      pstream.updateURIs(['foo', 'bar']);
      sinon.assert.calledOnce(pstream.transport.updateURIs);
    });
  });

  describe('setToken', () => {
    it('should return undefined', () => {
      assert.equal(pstream.setToken(), undefined);
    });

    it('should update .token', () => {
      pstream.setToken('foobar');
      assert.equal(pstream.token, 'foobar');
    });

    it('should send a LISTEN with the new token', () => {
      pstream.setToken('foobar');
      assert.equal(pstream.transport.send.callCount, 1);
      assert.deepEqual(JSON.parse(pstream.transport.send.args[0][0]), {
        payload: {
          browserinfo: {
            browser: {
              platform: navigator.platform,
              userAgent: navigator.userAgent,
            },
            p: 'browser',
            plugin: 'rtc',
            v: RELEASE_VERSION,
          },
          reconnectTimeout: 20,
          token: 'foobar',
        },
        type: 'listen',
        version: EXPECTED_PSTREAM_VERSION
      });
    });
  });

  describe('sendMessage', () => {
    const callsid = 'testcallsid';
    const content = { foo: 'content' };
    const messagetype = 'user-defined-message';
    const voiceeventsid = 'testvoiceeventsid';

    it('should send a message with the provided info', () => {
      pstream.sendMessage(callsid, content, undefined, messagetype, voiceeventsid);
      assert.equal(pstream.transport.send.callCount, 1);
      console.log(pstream.transport.send.args[0][0])
      assert.deepEqual(JSON.parse(pstream.transport.send.args[0][0]), {
        type: 'message',
        version:EXPECTED_PSTREAM_VERSION,
        payload: {
          callsid,
          content,
          contenttype: 'application/json',
          messagetype,
          voiceeventsid,
        }
      });
    });

    it('should override contenttype', () => {
      pstream.sendMessage(callsid, content, 'text/plain', messagetype, voiceeventsid);
      assert.equal(pstream.transport.send.callCount, 1);
      console.log(pstream.transport.send.args[0][0])
      assert.deepEqual(JSON.parse(pstream.transport.send.args[0][0]), {
        type: 'message',
        version:EXPECTED_PSTREAM_VERSION,
        payload: {
          callsid,
          content,
          contenttype: 'text/plain',
          messagetype,
          voiceeventsid,
        }
      });
    });
  });

  describe('destroy', () => {
    it('should return this', () => {
      assert.equal(pstream.destroy(), pstream);
    });

    it('should close the transport', () => {
      pstream.destroy();
      assert.equal(pstream.transport.close.callCount, 1);
    });
  });

  describe('publish', () => {
    it('should return undefined', () => {
      assert.equal(pstream.publish(), undefined);
    });

    it('should call transport.send', () => {
      pstream.publish();
      assert.equal(pstream.transport.send.callCount, 1);
    });
  });

  describe('_publish', () => {
    context('when transport.send fails', () => {
      beforeEach(() => {
        pstream.transport.send = sinon.spy(() => false);
      });

      it('should queue the message to send on reconnect if shouldRetry is true', () => {
        pstream._publish('foo', { }, true);
        assert.equal(pstream._messageQueue.length, 1);
      });

      it('should not queue the message to send on reconnect if shouldRetry is false', () => {
        pstream._publish('foo', { }, false);
        assert.equal(pstream._messageQueue.length, 0);
      });

      it('should emit 31009 marked as a transport error', () => {
        const payloads = [];
        pstream.on('error', payload => payloads.push(payload));
        pstream._publish('foo', { }, false);
        assert.equal(payloads.length, 1);
        assert.equal(payloads[0].error.code, 31009);
        assert.equal(isTransportErrorPayload(payloads[0]), true);
      });
    });

    context('when transport.send succeeds', () => {
      beforeEach(() => {
        pstream.transport.send = sinon.spy(() => true);
      });

      it('should not queue the message to send on reconnect if shouldRetry is true', () => {
        pstream._publish('foo', { }, true);
        assert.equal(pstream._messageQueue.length, 0);
      });

      it('should not queue the message to send on reconnect if shouldRetry is false', () => {
        pstream._publish('foo', { }, false);
        assert.equal(pstream._messageQueue.length, 0);
      });
    });

    context('when a register fails to send', () => {
      beforeEach(() => {
        pstream.transport.send = sinon.spy(() => false);
      });

      it('should not queue the register', () => {
        pstream.register({ audio: true });
        assert.equal(pstream._messageQueue.length, 0);
      });

      it('should only send a listen when the transport reopens', () => {
        pstream.register({ audio: true });
        pstream.transport.send = sinon.spy(() => true);
        pstream.transport.emit('open');
        assert.equal(pstream.transport.send.callCount, 1);
        assert.equal(JSON.parse(pstream.transport.send.args[0][0]).type, 'listen');
      });
    });
  });

  [
    ['register', 'register', [
      {
        args: [{ audio: true }],
        payload: { media: { audio: true } },
        scenario: 'called with media capabilities'
      }
    ]],
    ['invite', 'invite', [
      {
        args: ['bar', 'foo', ''],
        payload: { callsid: 'foo', sdp: 'bar', twilio: {} },
        scenario: 'called with empty params'
      },
      {
        args: ['bar', 'foo', 'baz=zee&foo=2'],
        payload: { callsid: 'foo', sdp: 'bar', twilio: { params: 'baz=zee&foo=2' } },
        scenario: 'called with non-empty params'
      },
    ]],
    ['reconnect', 'invite', [
      {
        args: ['bar', 'foo', 'foobar-reconn-tok'],
        payload: {
          callsid: 'foo',
          sdp: 'bar',
          reconnect: 'foobar-reconn-tok',
          twilio: {},
        },
        scenario: 'called with sdp, callsid, and reconnect token'
      },
    ]],
    ['answer', 'answer', [
      {
        args: ['bar', 'foo'],
        payload: { callsid: 'foo', sdp: 'bar' },
        scenario: 'called with sdp and callsid'
      }
    ]],
    ['dtmf', 'dtmf', [
      {
        args: ['foo', '123'],
        payload: { callsid: 'foo', dtmf: '123' },
        scenario: 'called without callsid and dtmf digits'
      }
    ]],
    ['hangup', 'hangup', [
      {
        args: ['foo'],
        payload: { callsid: 'foo' },
        scenario: 'called without a message'
      },
      {
        args: ['foo', 'bar'],
        payload: { callsid: 'foo', message: 'bar' },
        scenario: 'called with a message'
      }
    ]],
    ['reject', 'reject', [
      {
        args: ['foo'],
        payload: { callsid: 'foo' },
        scenario: 'called with callsid'
      }
    ]],
    ['reinvite', 'reinvite', [
      {
        args: ['bar', 'foo'],
        payload: { callsid: 'foo', sdp: 'bar' },
        scenario: 'called with sdp and callsid'
      }
    ]],
  ].forEach(([method, type, scenarios]) => {
    describe(method, () => {
      const shouldRetry = !['register', 'reinvite'].includes(method);
      scenarios.forEach(({ args, payload, scenario }) => {
        context(scenario, () => {
          it('should return undefined', () => {
            assert.equal(pstream[method](...args), undefined);
          });

          it(`should publish with${shouldRetry ? '' : 'out'} retry`, () => {
            const stub = sinon.stub(pstream, '_publish');
            pstream[method](...args);
            assert(stub.calledWithExactly(type, payload, shouldRetry));
            stub.restore();
          });

          it(`should send a ${method.toUpperCase()}`, () => {
            pstream[method](...args);
            assert.equal(pstream.transport.send.callCount, 1);
            assert.deepEqual(JSON.parse(pstream.transport.send.args[0][0]), {
              payload,
              type,
              version: EXPECTED_PSTREAM_VERSION
            });
          });
        });
      });
    });
  });
});
