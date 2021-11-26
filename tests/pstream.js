const assert = require('assert');
const sinon = require('sinon');

const PStream = require('../lib/twilio/pstream');
const { RELEASE_VERSION } = require('../lib/twilio/constants');
const TransportFactory = require('./mock/WSTransport');

const EXPECTED_PSTREAM_VERSION = '1.6';

describe('PStream', () => {
  let WSTransportFactorySpy;
  let token;
  let uris;
  let options;
  let pstream;

  beforeEach(() => {
    WSTransportFactorySpy = sinon.spy(TransportFactory);
    options = {
      TransportFactory: WSTransportFactorySpy,
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
          token: 'foobar',
        },
        type: 'listen',
        version: EXPECTED_PSTREAM_VERSION
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
  });

  [
    ['register', [
      {
        args: [{ audio: true }],
        payload: { media: { audio: true } },
        scenario: 'called with media capabilities'
      }
    ]],
    ['invite', [
      {
        args: ['bar', 'foo', true, ''],
        payload: { callsid: 'foo', sdp: 'bar', preflight: true, twilio: {} },
        scenario: 'called with empty params'
      },
      {
        args: ['bar', 'foo', true, 'baz=zee&foo=2'],
        payload: { callsid: 'foo', sdp: 'bar', preflight: true,  twilio: { params: 'baz=zee&foo=2' } },
        scenario: 'called with non-empty params'
      },
      {
        args: ['bar', 'foo', false, ''],
        payload: { callsid: 'foo', sdp: 'bar', preflight: false,  twilio: {} },
        scenario: 'called with preflight = false'
      }
    ]],
    ['answer', [
      {
        args: ['bar', 'foo'],
        payload: { callsid: 'foo', sdp: 'bar' },
        scenario: 'called with sdp and callsid'
      }
    ]],
    ['dtmf', [
      {
        args: ['foo', '123'],
        payload: { callsid: 'foo', dtmf: '123' },
        scenario: 'called without callsid and dtmf digits'
      }
    ]],
    ['hangup', [
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
    ['reject', [
      {
        args: ['foo'],
        payload: { callsid: 'foo' },
        scenario: 'called with callsid'
      }
    ]],
    ['reinvite', [
      {
        args: ['bar', 'foo'],
        payload: { callsid: 'foo', sdp: 'bar' },
        scenario: 'called with sdp and callsid'
      }
    ]]
  ].forEach(([method, scenarios]) => {
    describe(method, () => {
      const shouldRetry = method !== 'reinvite';
      scenarios.forEach(({ args, payload, scenario }) => {
        context(scenario, () => {
          it('should return undefined', () => {
            assert.equal(pstream[method](...args), undefined);
          });

          it(`should publish with${shouldRetry ? '' : 'out'} retry`, () => {
            const stub = sinon.stub(pstream, '_publish');
            pstream[method](...args);
            assert(stub.calledWithExactly(method, payload, shouldRetry));
            stub.restore();
          });

          it(`should send a ${method.toUpperCase()}`, () => {
            pstream[method](...args);
            assert.equal(pstream.transport.send.callCount, 1);
            assert.deepEqual(JSON.parse(pstream.transport.send.args[0][0]), {
              payload,
              type: method,
              version: EXPECTED_PSTREAM_VERSION
            });
          });
        });
      });
    });
  });
});
