const assert = require('assert');
const sinon = require('sinon');

const WebSocketManager = require('../mock/WebSocketManager');
import WSTransport, { WSTransportState } from '../../lib/twilio/wstransport';

describe('WSTransport', () => {
  const wsManager = new WebSocketManager();
  const WebSocket = wsManager.MockWebSocket;

  const URIS = [
    'wss://foo.com/signal',
    'wss://bar.com/signal',
    'wss://baz.com/signal'
  ];

  let socket: any;
  let transport: WSTransport;

  beforeEach(() => {
    wsManager.reset();
    transport = new WSTransport(URIS, { WebSocket });
  });

  afterEach(() => {
    clearTimeout(transport['_connectTimeout']);
    clearTimeout(transport['_heartbeatTimeout']);
  });

  describe('constructor', () => {
    it('returns an instance of WSTransport', () => {
      assert(transport instanceof WSTransport);
    });

    it('does not construct a WebSocket', () => {
      assert.equal(wsManager.instances.length, 0);
    });
  });

  describe('#close', () => {
    describe('before anything else', () => {
      it('returns undefined', () => {
        assert.equal(transport.close(), undefined);
      });

      it('sets state to closed', () => {
        transport.close();
        assert.equal(transport.state, WSTransportState.Closed);
      });
    });

    describe('after calling #open', () => {
      beforeEach(() => {
        transport.open();
        socket = wsManager.instances[0];
      });

      it('sets previous state', () => {
        assert.equal(transport['_previousState'], WSTransportState.Closed);
      });

      it('returns undefined', () => {
        assert.equal(transport.close(), undefined);
      });

      it('releases the socket', () => {
        const sock = wsManager.instances[0];
        transport.close();
        assert.equal(sock.readyState, WebSocket.CLOSING);
      });

      it('sets state to closed', () => {
        transport.close();
        assert.equal(transport.state, WSTransportState.Closed);
      });
    });

    describe('after calling #open and then #close', () => {
      beforeEach(() => {
        transport.open();
        transport.close();
      });

      it('returns undefined', () => {
        assert.equal(transport.close(), undefined);
      });
    });
  });

  describe('#open, called', () => {
    describe('before anything else', () => {
      afterEach(() => {
        transport.close();
      });

      it('returns undefined', () => {
        assert.equal(transport.open(), undefined);
      });

      it('resets state to connecting', () => {
        transport.open();
        assert.equal(transport.state, WSTransportState.Connecting);
      });

      it('constructs a WebSocket', () => {
        transport.open();
        assert.equal(wsManager.instances.length, 1);
      });

      context('if WebSocket construction fails', () => {
        const BadWebSocket = () => { throw new Error('Die'); }

        it('should close the WSTransport', () => {
          transport = new WSTransport(['wss://foo.bar/signal'], { WebSocket: BadWebSocket });
          transport.on('error', () => { });
          transport.open();
          assert.equal(transport.state, WSTransportState.Closed);
        });

        it('should call onerror', (done) => {
          transport = new WSTransport(['wss://foo.bar/signal'], { WebSocket: BadWebSocket });
          transport.on('error', () => done());
          transport.open();
        });
      });
    });

    describe('after calling #open', () => {
      beforeEach(() => {
        transport.open();
        socket = wsManager.instances[0];
      });

      afterEach(() => {
        transport.close();
      });

      it('returns undefined', () => {
        assert.equal(transport.open(), undefined);
      });

      it('does not construct another WebSocket', () => {
        transport.open();
        assert.equal(wsManager.instances.length, 1);
      });
    });

    describe('after calling #open and then #close', () => {
      beforeEach(() => {
        transport.open();
        transport.close();
      });

      afterEach(() => {
        (transport as any)._backoff.reset();
        transport.close();
      });

      it('returns undefined', () => {
        assert.equal(transport.open(), undefined);
      });

      it('does construct another WebSocket', () => {
        transport.open();
        assert.equal(wsManager.instances.length, 2);
      });
    });
  });

  describe('#send, called', () => {
    describe('before anything else', () => {
      it('returns false', () => {
        assert.equal(transport.send('foo'), false);
      });
    });

    describe('called after calling #open', () => {
      beforeEach(() => {
        transport.open();
        socket = wsManager.instances[0];
      });

      afterEach(() => {
        transport.close();
      });

      it('returns false', () => {
        assert.equal(transport.send('foo'), false);
      });

      context('before the socket has connected', () => {
        it('should return false', () => {
          socket._readyState = WebSocket.CONNECTING;
          assert.equal(transport.send('foo'), false);
        });
      });

      context('after the socket has connected', () => {
        beforeEach(() => {
          socket._readyState = WebSocket.OPEN;
          socket.send = sinon.spy(socket.send.bind(socket));
        });

        it('should return true', () => {
          assert.equal(transport.send('foo'), true);
        });

        it('should send the message', () => {
          transport.send('foo');
          assert.equal((socket as any).send.callCount, 1);
        });
      });

      context('if the WebSocket fails to send', () => {
        beforeEach(() => {
          socket._readyState = WebSocket.OPEN;
          socket.close = sinon.spy(socket.close.bind(socket));
          socket.send = () => { throw new Error('Expected'); };
        });

        it('should return false', () => {
          assert.equal(transport.send('foo'), false);
        });

        it('should close the socket', () => {
          transport.send('foo');
          assert.equal(socket.close.callCount, 1);
        });
      });
    });

    describe('called after calling #open and then #close', () => {
      beforeEach(() => {
        transport.open();
        transport.close();
      });

      it('returns false', () => {
        assert.equal(transport.send('foo'), false);
      });
    });
  });

  describe('#updateURIs', () => {
    it('should update the URIs', () => {
      transport.updateURIs(['foo', 'bar']);
      assert.deepEqual(transport['_uris'], ['foo', 'bar']);
    });

    it('should reset the URI index', () => {
      transport.updateURIs(['foo', 'bar']);
      assert.equal(transport['_uriIndex'], 0);
    });
  });

  describe('onSocketMessage', () => {
    beforeEach(() => {
      transport.open();
      socket = wsManager.instances[0];
    });

    afterEach(() => {
      transport.close();
    });

    context('when receiving a heartbeat', () => {
      it('should respond', () => {
        socket._readyState = WebSocket.OPEN;
        socket.dispatchEvent({ type: 'message', data: '\n' });
        assert.equal(socket.send.args[0][0], '\n');
      });

      it('should not emit', () => {
        transport.emit = sinon.spy();
        socket._readyState = WebSocket.OPEN;
        socket.dispatchEvent({ type: 'message', data: '\n' });
        assert.equal((transport as any).emit.callCount, 0);
      });
    });

    context('when receiving a message', () => {
      it('should not respond with a heartbeat', () => {
        socket._readyState = WebSocket.OPEN;
        socket.dispatchEvent({ type: 'message', data: 'foo' });
        assert.equal((socket as any).send.callCount, 0);
      });

      it('should emit the message', () => {
        transport.emit = sinon.spy();
        socket._readyState = WebSocket.OPEN;
        socket.dispatchEvent({ type: 'message', data: 'foo' });
        assert.equal((transport as any).emit.callCount, 1);
        assert.equal((transport as any).emit.args[0][1].data, 'foo');
      });
    });
  });

  describe('onSocketOpen', () => {
    beforeEach(() => {
      transport.open();
      socket = wsManager.instances[0];
    });

    afterEach(() => {
      transport.close();
    });

    it('should set state to open', () => {
      socket.dispatchEvent({ type: WSTransportState.Open });
      assert.equal(transport.state, WSTransportState.Open);
    });

    it('sets previous state to connecting', () => {
      transport.open();
      socket.dispatchEvent({ type: WSTransportState.Open });
      assert.equal(transport['_previousState'], WSTransportState.Connecting);
    });

    it('should emit open', () => {
      transport.emit = sinon.spy();
      socket.dispatchEvent({ type: WSTransportState.Open });
      assert.equal((transport as any).emit.callCount, 1);
      assert.equal((transport as any).emit.args[0][0], WSTransportState.Open);
    });
  });

  describe('onSocketError', () => {
    it('should emit error', () => {
      transport.open();
      socket = wsManager.instances[0];

      transport.emit = sinon.spy();
      socket.dispatchEvent({ type: 'error' });
      assert.equal((transport as any).emit.callCount, 1);
      assert.equal((transport as any).emit.args[0][0], 'error');

      transport.close();
    });
  });

  describe('onSocketClose', () => {
    beforeEach(() => {
      transport.open();
      socket = wsManager.instances[0];
    });

    afterEach(() => {
      transport.close();
    });

    it('should set state to connecting', () => {
      socket.dispatchEvent({ type: 'close' });
      assert.equal(transport.state, WSTransportState.Connecting);
    });

    it('sets previous state to open', () => {
      transport.open();
      socket.dispatchEvent({ type: WSTransportState.Open });
      transport.close();
      assert.equal(transport['_previousState'], WSTransportState.Open);
    });

    it('should attempt to reconnect by setting a backoff', () => {
      (transport as any)._backoff.backoff = sinon.spy();
      socket.dispatchEvent({ type: 'close' });
      assert.equal((transport as any)._backoff.backoff.callCount, 1);
    });

    it('should reset the backoff timer if the websocket was open longer than 10 seconds', () => {
      (transport as any)._timeOpened = Date.now() - 11000;
      (transport as any)._backoff.reset = sinon.spy();
      socket.dispatchEvent({ type: 'close' });
      assert.equal((transport as any)._backoff.reset.callCount, 1);
    });

    it('should reset the backoff timer if the websocket was open less than 10 seconds', () => {
      (transport as any)._timeOpened = Date.now() - 9000;
      (transport as any)._backoff.reset = sinon.spy();
      socket.dispatchEvent({ type: 'close' });
      assert.equal((transport as any)._backoff.reset.callCount, 0);
    });

    it('should emit close', () => {
      transport.emit = sinon.spy();
      socket.dispatchEvent({ type: 'close' });
      assert.equal((transport as any).emit.callCount, 1);
      assert.equal((transport as any).emit.args[0][0], 'close');
    });

    it('should unbind all listeners', () => {
      const ee = socket._eventEmitter;
      socket.dispatchEvent({ type: 'close' });

      assert.equal(ee.listenerCount('close'), 0);
      assert.equal(ee.listenerCount('error'), 0);
      assert.equal(ee.listenerCount('message'), 0);
      assert.equal(ee.listenerCount('open'), 0);
    });

    it('should emit an error if the socket was closed abnormally (with code 1006)', async () => {
      transport.emit = sinon.spy();
      socket.dispatchEvent({ type: 'close', code: 1006 });
      assert.equal((transport as any).emit.callCount, 2);
      assert.equal((transport as any).emit.args[0][0], 'error');
      assert.equal((transport as any).emit.args[0][1].code, 31005);
      assert.equal((transport as any).emit.args[1][0], 'close');
    });

    it('should emit an error if the socket was closed abnormally (with code 1015)', async () => {
      transport.emit = sinon.spy();
      socket.dispatchEvent({ type: 'close', code: 1015 });
      assert.equal((transport as any).emit.callCount, 2);
      assert.equal((transport as any).emit.args[0][0], 'error');
      assert.equal((transport as any).emit.args[0][1].code, 31005);
      assert.equal((transport as any).emit.args[1][0], 'close');
    });

    it('should not move uri index if error is not fallback-able', async () => {
      transport.emit = sinon.spy();
      assert.equal(transport.uri, URIS[0]);
      socket.dispatchEvent({ type: 'close', code: 123 });
      assert.equal(transport.uri, URIS[0]);
    });

    it('should move uri to next index if error is 1006', async () => {
      transport.emit = sinon.spy();
      assert.equal(transport.uri, URIS[0]);
      socket.dispatchEvent({ type: 'close', code: 1006 });
      assert.equal(transport.uri, URIS[1]);
    });

    it('should move uri to next index if error is 1015', async () => {
      transport.emit = sinon.spy();
      assert.equal(transport.uri, URIS[0]);
      socket.dispatchEvent({ type: 'close', code: 1015 });
      assert.equal(transport.uri, URIS[1]);
    });

    it('should loop through all uris', async () => {
      transport.emit = sinon.spy();
      assert.equal(transport.uri, URIS[0]);
      transport['_uriIndex'] = 1;
      socket.dispatchEvent({ type: 'close', code: 1015 });
      assert.equal(transport.uri, URIS[2]);
    });

    it('should loop back to the first element', async () => {
      transport.emit = sinon.spy();
      assert.equal(transport.uri, URIS[0]);
      transport['_uriIndex'] = 2;
      socket.dispatchEvent({ type: 'close', code: 1015 });
      assert.equal(transport.uri, URIS[0]);
    });

    describe('when transitioning to the next state with fallback counter', () => {
      const closeEvent = { type: 'close', code: 1006 };

      beforeEach(() => {
        transport.emit = sinon.spy();
        transport['_closeSocket'] = sinon.spy();
      });

      ['connecting', 'closed', 'open'].forEach((prevState: WSTransportState) => {
        it(`should not move uri to next index if error is fallback-able, state is open, and previous state is ${prevState}`, async () => {
          transport.state = WSTransportState.Open;
          transport['_previousState'] = prevState;
          assert.equal(transport.uri, URIS[0]);
          socket.dispatchEvent(closeEvent);
          assert.equal(transport.uri, URIS[0]);
          socket.dispatchEvent(closeEvent);
          assert.equal(transport.uri, URIS[1]);
        });
      });

      ['connecting', 'closed', 'open'].forEach((currentState: WSTransportState) => {
        it(`should not move uri to next index if error is fallback-able, previous state is open, and current state is ${currentState}`, async () => {
          transport.state = currentState;
          transport['_previousState'] = WSTransportState.Open;
          assert.equal(transport.uri, URIS[0]);
          socket.dispatchEvent(closeEvent);
          assert.equal(transport.uri, URIS[0]);
          socket.dispatchEvent(closeEvent);
          assert.equal(transport.uri, URIS[1]);
        });
      });

      context('negative states', () => {
        [
          [WSTransportState.Connecting, WSTransportState.Connecting],
          [WSTransportState.Connecting, WSTransportState.Closed],
          [WSTransportState.Closed, WSTransportState.Connecting],
          [WSTransportState.Closed, WSTransportState.Closed],
        ].forEach(([prevState, currentState]) => {
          it(`should move uri to next index if error is fallback-able, previous state is ${prevState}, and current state is ${currentState}`, async () => {
            transport.state = currentState;
            transport['_previousState'] = prevState;
            assert.equal(transport.uri, URIS[0]);
            socket.dispatchEvent(closeEvent);
            assert.equal(transport.uri, URIS[1]);
            socket.dispatchEvent(closeEvent);
            assert.equal(transport.uri, URIS[2]);
          });
        })
      });
    });
  });

  describe('after backoff', () => {
    beforeEach(() => {
      (transport as any)._connect = sinon.spy();
    });

    it('should not attempt to reconnect if the state is closed', () => {
      transport.state = WSTransportState.Closed;
      (transport as any)._backoff.emit('ready');
      assert.equal((transport as any)._connect.callCount, 0);
    });

    it('should attempt to reconnect if the state is open', () => {
      transport.state = WSTransportState.Open;
      (transport as any)._backoff.emit('ready');
      assert.equal((transport as any)._connect.callCount, 1);
    });

    it('should attempt to reconnect if the state is connecting', () => {
      transport.state = WSTransportState.Connecting;
      (transport as any)._backoff.emit('ready');
      assert.equal((transport as any)._connect.callCount, 1);
    });
  });

  describe('on timed out', () => {
    let clock: any;

    beforeEach(() => {
      clock = sinon.useFakeTimers(Date.now());
      wsManager.reset();
      transport = new WSTransport(URIS, { WebSocket });
    });

    afterEach(() => {
      clock.restore();
    });

    it('should not move uri index before timing out', () => {
      transport.open();
      clock.tick(3000);
      assert.equal(transport.uri, URIS[0]);
    });

    it('should move uri index after timing out', () => {
      transport.open();
      clock.tick(5000);
      assert.equal(transport.uri, URIS[1]);
    });

    it('should use connectTimeoutMs parameter', () => {
      wsManager.reset();
      transport = new WSTransport(URIS, { WebSocket, connectTimeoutMs: 20000 });
      transport.open();
      clock.tick(3000);
      assert.equal(transport.uri, URIS[0]);
      clock.tick(2000);
      assert.equal(transport.uri, URIS[0]);
      clock.tick(15000);
      assert.equal(transport.uri, URIS[1]);
    });
  });
});
