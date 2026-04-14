import * as assert from 'assert';
import { EventEmitter } from 'events';
import * as sinon from 'sinon';
import { SipSignalingAdapter } from '../../lib/twilio/signaling/sipsignalingadapter';

/**
 * Stub that mimics a SIP.js Registerer's stateChange emitter.
 */
class StateChangeEmitter {
  private _listeners: Function[] = [];
  addListener(fn: Function) { this._listeners.push(fn); }
  notify(state: string) { this._listeners.forEach(fn => fn(state)); }
}

function createRegistererStub() {
  const stateChange = new StateChangeEmitter();
  return {
    state: 'Initial',
    stateChange,
    register: sinon.stub().resolves(),
    unregister: sinon.stub().resolves(),
    dispose: sinon.stub().resolves(),
    _simulateState(state: string) {
      this.state = state;
      stateChange.notify(state);
    },
  };
}

function createUserAgentStub() {
  let delegate: any = {};
  return {
    start: sinon.stub().resolves(),
    stop: sinon.stub().resolves(),
    reconnect: sinon.stub().resolves(),
    _getDelegate() { return delegate; },
    _setDelegate(d: any) { delegate = d; },
    _triggerConnect() { delegate.onConnect?.(); },
    _triggerDisconnect(err?: Error) { delegate.onDisconnect?.(err); },
    _triggerInvite(inv?: any) { delegate.onInvite?.(inv); },
  };
}

function createAdapter(overrides?: Partial<any>) {
  const uaStub = createUserAgentStub();
  const regStub = createRegistererStub();

  const adapter = new SipSignalingAdapter({
    sipDomain: 'sip.ashburn.dev.twilio.com',
    sipUri: 'sip:alice@sip.ashburn.dev.twilio.com',
    sipTransportServer: 'wss://sip.ashburn.dev.twilio.com',
    credentials: { username: 'alice', password: 'secret' },
    region: 'ashburn',
    createUserAgent(config: any) {
      // Capture the delegate so our stub can trigger events
      uaStub._setDelegate(config.delegate);
      return uaStub as any;
    },
    createRegisterer() {
      return regStub as any;
    },
    ...overrides,
  });

  return { adapter, uaStub, regStub };
}

describe('SipSignalingAdapter', () => {
  describe('constructor', () => {
    it('should start the UserAgent', () => {
      const { uaStub } = createAdapter();
      assert(uaStub.start.calledOnce);
    });

    it('should have initial status "disconnected"', () => {
      const { adapter } = createAdapter();
      assert.strictEqual(adapter.status, 'disconnected');
    });

    it('should set uri to sipTransportServer', () => {
      const { adapter } = createAdapter();
      assert.strictEqual(adapter.uri, 'wss://sip.ashburn.dev.twilio.com');
    });

    it('should set region from options', () => {
      const { adapter } = createAdapter();
      assert.strictEqual(adapter.region, 'ashburn');
    });

    it('should set region to undefined if not provided', () => {
      const { adapter } = createAdapter({ region: undefined });
      assert.strictEqual(adapter.region, undefined);
    });

    it('should return undefined for gateway', () => {
      const { adapter } = createAdapter();
      assert.strictEqual(adapter.gateway, undefined);
    });
  });

  describe('connection lifecycle', () => {
    it('should emit "connected" with region payload when transport connects', (done) => {
      const { adapter, uaStub } = createAdapter();
      adapter.on('connected', (payload: any) => {
        assert.strictEqual(payload.region, 'ashburn');
        assert.strictEqual(payload.token.identity, 'alice');
        done();
      });
      uaStub._triggerConnect();
    });

    it('should set status to "connected" when transport connects', () => {
      const { adapter, uaStub } = createAdapter();
      uaStub._triggerConnect();
      assert.strictEqual(adapter.status, 'connected');
    });

    it('should emit "transportClose" when transport disconnects', (done) => {
      const { adapter, uaStub } = createAdapter();
      uaStub._triggerConnect();
      adapter.on('transportClose', () => done());
      uaStub._triggerDisconnect();
    });

    it('should emit "offline" when transport disconnects', (done) => {
      const { adapter, uaStub } = createAdapter();
      uaStub._triggerConnect();
      adapter.on('offline', () => done());
      uaStub._triggerDisconnect();
    });

    it('should set status to "disconnected" when transport disconnects', () => {
      const { adapter, uaStub } = createAdapter();
      uaStub._triggerConnect();
      uaStub._triggerDisconnect();
      assert.strictEqual(adapter.status, 'disconnected');
    });

    it('should not emit "offline" if already disconnected', () => {
      const { adapter, uaStub } = createAdapter();
      // Status is already 'disconnected' (initial state), so disconnect should not emit 'offline'
      const offlineSpy = sinon.spy();
      adapter.on('offline', offlineSpy);
      uaStub._triggerDisconnect();
      assert.strictEqual(offlineSpy.callCount, 0);
    });

    it('should dispose registerer on transport disconnect', () => {
      const { adapter, uaStub, regStub } = createAdapter();
      uaStub._triggerConnect();
      adapter.register({ audio: true });
      uaStub._triggerDisconnect();
      assert(regStub.dispose.calledOnce);
    });
  });

  describe('register()', () => {
    it('should create a Registerer and call register when audio: true', () => {
      const { adapter, uaStub, regStub } = createAdapter();
      uaStub._triggerConnect();
      adapter.register({ audio: true });
      assert(regStub.register.calledOnce);
    });

    it('should emit "ready" when registration succeeds', (done) => {
      const { adapter, uaStub, regStub } = createAdapter();
      uaStub._triggerConnect();
      adapter.on('ready', () => {
        assert.strictEqual(adapter.status, 'ready');
        done();
      });
      adapter.register({ audio: true });
      regStub._simulateState('Registered');
    });

    it('should set status to "ready" when registration succeeds', () => {
      const { adapter, uaStub, regStub } = createAdapter();
      uaStub._triggerConnect();
      adapter.register({ audio: true });
      regStub._simulateState('Registered');
      assert.strictEqual(adapter.status, 'ready');
    });

    it('should emit "error" and "offline" when registration fails', (done) => {
      const failRegStub = createRegistererStub();
      failRegStub.register = sinon.stub().rejects(new Error('auth failed'));

      const { adapter, uaStub } = createAdapter({
        createRegisterer() { return failRegStub as any; },
      });

      uaStub._triggerConnect();
      let errorEmitted = false;
      adapter.on('error', (payload: any) => {
        assert.strictEqual(payload.error.code, 31201);
        assert(payload.error.message.includes('auth failed'));
        errorEmitted = true;
      });
      adapter.on('offline', () => {
        assert(errorEmitted, 'error should be emitted before offline');
        assert.strictEqual(adapter.status, 'offline');
        assert(failRegStub.dispose.calledOnce);
        done();
      });
      adapter.register({ audio: true });
    });

    it('should call unregister when audio: false', () => {
      const { adapter, uaStub, regStub } = createAdapter();
      uaStub._triggerConnect();
      adapter.register({ audio: true });
      regStub._simulateState('Registered');
      adapter.register({ audio: false });
      assert(regStub.unregister.calledOnce);
    });

    it('should emit "offline" when unregistration completes', (done) => {
      const { adapter, uaStub, regStub } = createAdapter();
      uaStub._triggerConnect();
      adapter.register({ audio: true });
      regStub._simulateState('Registered');
      adapter.on('offline', () => done());
      adapter.register({ audio: false });
      regStub._simulateState('Unregistered');
    });

    it('should emit "offline" when unregister fails', (done) => {
      const { adapter, uaStub, regStub } = createAdapter();
      uaStub._triggerConnect();
      adapter.register({ audio: true });
      regStub._simulateState('Registered');
      regStub.unregister = sinon.stub().rejects(new Error('unregister failed'));
      adapter.on('offline', () => {
        assert.strictEqual(adapter.status, 'offline');
        done();
      });
      adapter.register({ audio: false });
    });

    it('should skip if registerer already exists', () => {
      const { adapter, uaStub, regStub } = createAdapter();
      uaStub._triggerConnect();
      adapter.register({ audio: true });
      // Second register call should be a no-op — SIP.js handles refresh internally
      adapter.register({ audio: true });
      assert.strictEqual(regStub.register.callCount, 1);
    });

    it('should not throw if register is called before connect', () => {
      const { adapter } = createAdapter();
      // Should not throw — just creates registerer and attempts register
      assert.doesNotThrow(() => adapter.register({ audio: true }));
    });
  });

  describe('setToken()', () => {
    it('should store the token without error', () => {
      const { adapter } = createAdapter();
      assert.doesNotThrow(() => adapter.setToken('new-jwt-token'));
    });
  });

  describe('destroy()', () => {
    it('should stop the UserAgent', () => {
      const { adapter, uaStub } = createAdapter();
      adapter.destroy();
      assert(uaStub.stop.calledOnce);
    });

    it('should dispose the registerer', () => {
      const { adapter, uaStub, regStub } = createAdapter();
      uaStub._triggerConnect();
      adapter.register({ audio: true });
      adapter.destroy();
      assert(regStub.dispose.calledOnce);
    });

    it('should set status to "disconnected"', () => {
      const { adapter, uaStub } = createAdapter();
      uaStub._triggerConnect();
      adapter.destroy();
      assert.strictEqual(adapter.status, 'disconnected');
    });

    it('should emit "close"', (done) => {
      const { adapter } = createAdapter();
      adapter.on('close', () => done());
      adapter.destroy();
    });
  });

  describe('no-op methods', () => {
    it('updatePreferredURI should not throw', () => {
      const { adapter } = createAdapter();
      assert.doesNotThrow(() => adapter.updatePreferredURI('wss://new.uri'));
    });

    it('updateURIs should not throw', () => {
      const { adapter } = createAdapter();
      assert.doesNotThrow(() => adapter.updateURIs(['wss://a', 'wss://b']));
    });
  });

  describe('call signaling stubs', () => {
    it('invite() should throw NotSupportedError', () => {
      const { adapter } = createAdapter();
      assert.throws(() => adapter.invite('sdp', 'sid', 'params'), /not yet implemented/);
    });

    it('answer() should throw NotSupportedError', () => {
      const { adapter } = createAdapter();
      assert.throws(() => adapter.answer('sdp', 'sid'), /not yet implemented/);
    });

    it('hangup() should throw NotSupportedError', () => {
      const { adapter } = createAdapter();
      assert.throws(() => adapter.hangup('sid'), /not yet implemented/);
    });

    it('reject() should throw NotSupportedError', () => {
      const { adapter } = createAdapter();
      assert.throws(() => adapter.reject('sid'), /not yet implemented/);
    });

    it('reinvite() should throw NotSupportedError', () => {
      const { adapter } = createAdapter();
      assert.throws(() => adapter.reinvite('sdp', 'sid'), /not yet implemented/);
    });

    it('reconnect() should throw NotSupportedError', () => {
      const { adapter } = createAdapter();
      assert.throws(() => adapter.reconnect('sdp', 'sid', 'token'), /not yet implemented/);
    });

    it('dtmf() should throw NotSupportedError', () => {
      const { adapter } = createAdapter();
      assert.throws(() => adapter.dtmf('sid', '123'), /not yet implemented/);
    });

    it('sendMessage() should throw NotSupportedError', () => {
      const { adapter } = createAdapter();
      assert.throws(
        () => adapter.sendMessage('sid', 'hi', 'text/plain', 'user-msg', 'evt1'),
        /not yet implemented/,
      );
    });
  });
});
