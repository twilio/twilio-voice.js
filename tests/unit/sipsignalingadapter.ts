import * as assert from 'assert';
import * as sinon from 'sinon';
import { SignalingAdapter } from '../../lib/twilio/signaling/signalingadapter';
import { SipSignalingAdapter } from '../../lib/twilio/signaling/sipsignalingadapter';
import { IPeerConnection, SipSessionDescriptionHandler } from '../../lib/twilio/signaling/sipsessiondescriptionhandler';

function createPeerConnectionStub(): IPeerConnection {
  return {
    onerror: () => { /* replaced by SDH constructor when used */ },
    makeOutgoingCall: sinon.stub(),
    answerIncomingCall: sinon.stub(),
    processAnswer: sinon.stub(),
    close: sinon.stub(),
  };
}

/**
 * Stub that mimics a SIP.js Registerer/Session stateChange emitter.
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

function createSessionStub(initialState: string = 'Initial') {
  const stateChange = new StateChangeEmitter();
  return {
    state: initialState,
    stateChange,
    delegate: undefined as any,
    bye: sinon.stub().resolves(),
    cancel: sinon.stub().resolves(),
    invite: sinon.stub().resolves(),
    info: sinon.stub().resolves(),
    message: sinon.stub().resolves(),
    _simulateState(state: string) {
      this.state = state;
      stateChange.notify(state);
    },
  };
}

function createInviterStub() {
  const stub = createSessionStub('Initial');
  let requestDelegate: any = null;
  stub.invite = sinon.stub().callsFake((opts?: any) => {
    requestDelegate = opts?.requestDelegate;
    return Promise.resolve();
  });
  return {
    ...stub,
    _getRequestDelegate() { return requestDelegate; },
  };
}

function createInvitationStub(headers?: Record<string, string>) {
  const defaultHeaders: Record<string, string> = {
    'X-Twilio-CallSid': 'CA-test-call-sid',
    ...headers,
  };
  const stub = createSessionStub('Initial');
  return {
    ...stub,
    id: 'inv-session-id-123',
    body: 'v=0\r\no=- 123 456 IN IP4 0.0.0.0\r\n',
    remoteIdentity: { uri: { toString: () => 'sip:bob@example.com' } },
    request: { getHeader: (name: string) => defaultHeaders[name] },
    accept: sinon.stub().resolves(),
    reject: sinon.stub().resolves(),
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
  const inviterStub = createInviterStub();
  let capturedSdhFactory: any = null;

  const adapter = new SipSignalingAdapter({
    sipDomain: 'sip.ashburn.dev.twilio.com',
    sipUri: 'sip:alice@sip.ashburn.dev.twilio.com',
    sipTransportServer: 'wss://sip.ashburn.dev.twilio.com',
    credentials: { username: 'alice', password: 'secret' },
    region: 'ashburn',
    createUserAgent(config: any) {
      uaStub._setDelegate(config.delegate);
      capturedSdhFactory = config.sessionDescriptionHandlerFactory;
      return uaStub as any;
    },
    createRegisterer() {
      return regStub as any;
    },
    createInviter() {
      return inviterStub as any;
    },
    ...overrides,
  });

  return {
    adapter: adapter as SignalingAdapter,
    uaStub,
    regStub,
    inviterStub,
    getSdhFactory: () => capturedSdhFactory,
  };
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

  describe('invite()', () => {
    it('should create an Inviter and call invite()', () => {
      const { adapter, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      assert(inviterStub.invite.calledOnce);
    });

    it('should emit "ringing" on requestDelegate.onProgress', (done) => {
      const { adapter, inviterStub } = createAdapter();
      adapter.on('ringing', (payload: any) => {
        assert.strictEqual(payload.callsid, 'call-1');
        done();
      });
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      const rd = inviterStub._getRequestDelegate();
      rd.onProgress({});
    });

    it('should emit "answer" on requestDelegate.onAccept', (done) => {
      const { adapter, inviterStub } = createAdapter();
      adapter.on('answer', (payload: any) => {
        assert.strictEqual(payload.callsid, 'call-1');
        done();
      });
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      const rd = inviterStub._getRequestDelegate();
      rd.onAccept({});
    });

    it('should emit "hangup" with error on requestDelegate.onReject', (done) => {
      const { adapter, inviterStub } = createAdapter();
      adapter.on('hangup', (payload: any) => {
        assert.strictEqual(payload.callsid, 'call-1');
        assert(payload.error);
        done();
      });
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      const rd = inviterStub._getRequestDelegate();
      rd.onReject({ message: { statusCode: 486, reasonPhrase: 'Busy Here' } });
    });

    it('should emit "error" if invite() promise rejects', (done) => {
      const failInviterStub = createInviterStub();
      failInviterStub.invite = sinon.stub().rejects(new Error('transport down'));
      const { adapter } = createAdapter({
        createInviter() { return failInviterStub as any; },
      });
      adapter.on('error', (payload: any) => {
        assert.strictEqual(payload.error.code, 31000);
        assert(payload.error.message.includes('transport down'));
        done();
      });
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
    });

    it('should clean up session on SessionState.Terminated', () => {
      const { adapter, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub._simulateState('Terminated');
      // Subsequent hangup should warn (no session found) — just verifying no crash
      assert.doesNotThrow(() => adapter.hangup('call-1', {}));
    });

    it('should rekey outbound session when 200 OK carries a server CallSid', () => {
      const { adapter, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      const rd = inviterStub._getRequestDelegate();
      rd.onAccept({ message: { getHeader: (name: string) => name === 'X-Twilio-CallSid' ? 'CA-server-123' : undefined } });
      // Original temp sid should no longer resolve; the server sid should.
      inviterStub.state = 'Established';
      adapter.hangup('CA-server-123', {});
      assert(inviterStub.bye.calledOnce, 'bye should be sent when hanging up with the server-assigned CallSid');
    });

    it('should update the SdhBinding callSid when the session is rekeyed', () => {
      // Binding must track the server CallSid so a later SDH construction
      // (e.g. re-INVITE where SIP.js lazily creates a fresh SDH) uses the
      // current identifier, not the stale temp sid.
      const { adapter, inviterStub, getSdhFactory } = createAdapter();
      const peerConnection = createPeerConnectionStub();
      adapter.invite('call-temp', { sdp: 'sdp', params: 'To=bob', peerConnection });
      const rd = inviterStub._getRequestDelegate();
      rd.onAccept({ message: { getHeader: (name: string) => name === 'X-Twilio-CallSid' ? 'CA-server-789' : undefined } });
      // Rebuild an SDH from the (now-rekeyed) binding and prove it drives
      // PeerConnection with the server CallSid, not 'call-temp'.
      const sdh = getSdhFactory()(inviterStub);
      sdh.getDescription();
      const makeOutgoingCall = peerConnection.makeOutgoingCall as sinon.SinonStub;
      assert.strictEqual(makeOutgoingCall.firstCall.args[0], 'CA-server-789');
    });

    it('should emit "answer" with server CallSid from X-Twilio-CallSid header', (done) => {
      const { adapter, inviterStub } = createAdapter();
      adapter.on('answer', (payload: any) => {
        assert.strictEqual(payload.callsid, 'CA-server-456');
        done();
      });
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      const rd = inviterStub._getRequestDelegate();
      rd.onAccept({ message: { getHeader: (name: string) => name === 'X-Twilio-CallSid' ? 'CA-server-456' : undefined } });
    });
  });

  describe('reconnect()', () => {
    it('should create an Inviter and call invite()', () => {
      const { adapter, inviterStub } = createAdapter();
      adapter.reconnect('call-1', { sdp: 'sdp', reconnectToken: 'rtoken', peerConnection: createPeerConnectionStub() });
      assert(inviterStub.invite.calledOnce);
    });

    it('should include reconnect token in answer payload', (done) => {
      const { adapter, inviterStub } = createAdapter();
      adapter.on('answer', (payload: any) => {
        assert.strictEqual(payload.reconnect, 'rtoken');
        done();
      });
      adapter.reconnect('call-1', { sdp: 'sdp', reconnectToken: 'rtoken', peerConnection: createPeerConnectionStub() });
      const rd = inviterStub._getRequestDelegate();
      rd.onAccept({});
    });
  });

  describe('incoming call (onInvite)', () => {
    it('should emit "invite" with callsid from X-Twilio-CallSid header', (done) => {
      const { adapter, uaStub } = createAdapter();
      const inv = createInvitationStub();
      adapter.on('invite', (payload: any) => {
        assert.strictEqual(payload.callsid, 'CA-test-call-sid');
        assert.strictEqual(payload.sdp, inv.body);
        assert.strictEqual(payload.parameters.CallSid, 'CA-test-call-sid');
        assert.strictEqual(payload.parameters.From, 'sip:bob@example.com');
        done();
      });
      uaStub._triggerInvite(inv);
    });

    it('should reject invitation when X-Twilio-CallSid header is missing', () => {
      const { adapter, uaStub } = createAdapter();
      const stub = createSessionStub('Initial');
      const inv = {
        ...stub,
        id: 'inv-session-id-123',
        body: '',
        remoteIdentity: { uri: { toString: () => 'sip:bob@example.com' } },
        request: { getHeader: () => undefined },
        accept: sinon.stub().resolves(),
        reject: sinon.stub().resolves(),
      };
      let inviteEmitted = false;
      adapter.on('invite', () => { inviteEmitted = true; });
      uaStub._triggerInvite(inv);
      assert.strictEqual(inviteEmitted, false);
      assert(inv.reject.calledOnce);
    });

    it('should emit "cancel" when invitation.delegate.onCancel fires', (done) => {
      const { adapter, uaStub } = createAdapter();
      const inv = createInvitationStub();
      adapter.on('cancel', (payload: any) => {
        assert.strictEqual(payload.callsid, 'CA-test-call-sid');
        done();
      });
      uaStub._triggerInvite(inv);
      inv.delegate.onCancel();
    });

    it('should emit "hangup" when session.delegate.onBye fires', (done) => {
      const { adapter, uaStub } = createAdapter();
      const inv = createInvitationStub();
      adapter.on('hangup', (payload: any) => {
        assert.strictEqual(payload.callsid, 'CA-test-call-sid');
        done();
      });
      uaStub._triggerInvite(inv);
      inv.delegate.onBye();
    });

    it('should emit "hangup" via onBye after answering an inbound call', (done) => {
      const { adapter, uaStub } = createAdapter();
      const inv = createInvitationStub();
      uaStub._triggerInvite(inv);
      adapter.answer('CA-test-call-sid', { sdp: 'sdp-answer', peerConnection: createPeerConnectionStub() });
      adapter.on('hangup', (payload: any) => {
        assert.strictEqual(payload.callsid, 'CA-test-call-sid');
        done();
      });
      inv.delegate.onBye();
    });
  });

  describe('answer()', () => {
    it('should call invitation.accept()', () => {
      const { adapter, uaStub } = createAdapter();
      const inv = createInvitationStub();
      uaStub._triggerInvite(inv);
      adapter.answer('CA-test-call-sid', { sdp: 'sdp-answer', peerConnection: createPeerConnectionStub() });
      assert(inv.accept.calledOnce);
    });

    it('should warn if no pending invitation', () => {
      const { adapter } = createAdapter();
      // Should not throw — just warns
      assert.doesNotThrow(() => adapter.answer('unknown-id', { sdp: 'sdp', peerConnection: createPeerConnectionStub() }));
    });

    it('should emit "error" if accept() fails', (done) => {
      const { adapter, uaStub } = createAdapter();
      const inv = createInvitationStub();
      inv.accept = sinon.stub().rejects(new Error('accept failed'));
      uaStub._triggerInvite(inv);
      adapter.on('error', (payload: any) => {
        assert.strictEqual(payload.error.code, 31000);
        assert.strictEqual(payload.error.message, 'accept failed');
        assert.strictEqual(payload.callsid, 'CA-test-call-sid');
        done();
      });
      adapter.answer('CA-test-call-sid', { sdp: 'sdp-answer', peerConnection: createPeerConnectionStub() });
    });

    it('should drop the inbound session when accept() fails, so a later hangup is a no-op', async () => {
      const { adapter, uaStub } = createAdapter();
      const inv = createInvitationStub();
      inv.accept = sinon.stub().rejects(new Error('accept failed'));
      uaStub._triggerInvite(inv);
      adapter.on('error', () => { /* swallow */ });
      adapter.answer('CA-test-call-sid', { sdp: 'sdp-answer', peerConnection: createPeerConnectionStub() });
      // Wait a tick so the rejected accept() promise resolves its catch handler.
      await new Promise((resolve) => setTimeout(resolve, 0));
      inv.bye = sinon.stub().resolves();
      inv.reject = sinon.stub().resolves();
      adapter.hangup('CA-test-call-sid', {});
      // Session was cleaned up — hangup should not dispatch bye/reject on the
      // half-bound invitation.
      assert.strictEqual((inv.bye as sinon.SinonStub).callCount, 0);
      assert.strictEqual((inv.reject as sinon.SinonStub).callCount, 0);
    });
  });

  describe('reject()', () => {
    it('should call invitation.reject()', () => {
      const { adapter, uaStub } = createAdapter();
      const inv = createInvitationStub();
      uaStub._triggerInvite(inv);
      adapter.reject('CA-test-call-sid');
      assert(inv.reject.calledOnce);
    });

    it('should warn if no pending invitation', () => {
      const { adapter } = createAdapter();
      assert.doesNotThrow(() => adapter.reject('unknown-id'));
    });

    it('should emit "error" if reject() fails', (done) => {
      const { adapter, uaStub } = createAdapter();
      const inv = createInvitationStub();
      inv.reject = sinon.stub().rejects(new Error('reject failed'));
      uaStub._triggerInvite(inv);
      adapter.on('error', (payload: any) => {
        assert.strictEqual(payload.error.code, 31000);
        assert.strictEqual(payload.error.message, 'reject failed');
        assert.strictEqual(payload.callsid, 'CA-test-call-sid');
        done();
      });
      adapter.reject('CA-test-call-sid');
    });
  });

  describe('hangup()', () => {
    it('should call session.bye() when state is Established', () => {
      const { adapter, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Established';
      adapter.hangup('call-1', {});
      assert(inviterStub.bye.calledOnce);
    });

    it('should call inviter.cancel() when state is Establishing', () => {
      const { adapter, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Establishing';
      adapter.hangup('call-1', {});
      assert(inviterStub.cancel.calledOnce);
    });

    it('should reject pending invitation during hangup', () => {
      const { adapter, uaStub } = createAdapter();
      const inv = createInvitationStub();
      uaStub._triggerInvite(inv);
      adapter.hangup('CA-test-call-sid', {});
      assert(inv.reject.calledOnce);
    });

    it('should not throw for unknown callSid', () => {
      const { adapter } = createAdapter();
      assert.doesNotThrow(() => adapter.hangup('unknown', {}));
    });
  });

  describe('reinvite()', () => {
    it('should call session.invite() for established sessions', () => {
      const { adapter, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Established';
      adapter.reinvite('call-1', { sdp: 'new-sdp' });
      // session.invite is the re-INVITE call (distinct from inviter.invite for initial INVITE)
      // inviterStub.invite is called once for initial, then once for reinvite = 2 total
      assert.strictEqual(inviterStub.invite.callCount, 2);
    });

    it('should not throw for non-established session', () => {
      const { adapter } = createAdapter();
      assert.doesNotThrow(() => adapter.reinvite('unknown', { sdp: 'sdp' }));
    });

    it('should emit "answer" on requestDelegate.onAccept', (done) => {
      const { adapter, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Established';
      adapter.on('answer', (payload: any) => {
        assert.strictEqual(payload.callsid, 'call-1');
        done();
      });
      adapter.reinvite('call-1', { sdp: 'new-sdp' });
      const rd = inviterStub.invite.lastCall.args[0]?.requestDelegate;
      rd.onAccept();
    });

    it('should warn but not throw on requestDelegate.onReject', () => {
      const { adapter, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Established';
      adapter.reinvite('call-1', { sdp: 'new-sdp' });
      const rd = inviterStub.invite.lastCall.args[0]?.requestDelegate;
      assert.doesNotThrow(() => rd.onReject({ message: { statusCode: 488 } }));
    });
  });

  describe('dtmf()', () => {
    it('should call session.info() for each digit', async () => {
      const { adapter, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Established';
      adapter.dtmf('call-1', { digits: '12' });
      // Allow async sends to complete
      await new Promise(resolve => setTimeout(resolve, 10));
      assert.strictEqual(inviterStub.info.callCount, 2);
    });

    it('should not throw for non-established session', () => {
      const { adapter } = createAdapter();
      assert.doesNotThrow(() => adapter.dtmf('unknown', { digits: '1' }));
    });
  });

  describe('sendMessage()', () => {
    it('should call session.message() and emit "ack"', (done) => {
      const { adapter, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Established';
      adapter.on('ack', (payload: any) => {
        assert.strictEqual(payload.acktype, 'message');
        assert.strictEqual(payload.callsid, 'call-1');
        assert.strictEqual(payload.voiceeventsid, 'evt-1');
        done();
      });
      adapter.sendMessage('call-1', { content: '{"hello":"world"}', contentType: 'application/json', messageType: 'user-msg', voiceEventSid: 'evt-1' });
    });

    it('should emit "error" if message() fails', (done) => {
      const failInviterStub = createInviterStub();
      failInviterStub.message = sinon.stub().rejects(new Error('send failed'));
      const { adapter } = createAdapter({
        createInviter() { return failInviterStub as any; },
      });
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      failInviterStub._simulateState('Established');
      adapter.on('error', (payload: any) => {
        assert.strictEqual(payload.voiceeventsid, 'evt-1');
        done();
      });
      adapter.sendMessage('call-1', { content: 'hi', contentType: 'text/plain', messageType: 'user-msg', voiceEventSid: 'evt-1' });
    });

    it('should not throw for unknown callSid', () => {
      const { adapter } = createAdapter();
      assert.doesNotThrow(() => adapter.sendMessage('unknown', { content: 'hi', contentType: 'text/plain', messageType: 'msg', voiceEventSid: 'evt' }));
    });
  });

  describe('lifecycle cleanup', () => {
    it('destroy() should bye established sessions and clear maps', () => {
      const { adapter, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Established';
      adapter.destroy();
      assert(inviterStub.bye.calledOnce);
    });

    it('transport disconnect should clear session maps', () => {
      const { adapter, uaStub, inviterStub } = createAdapter();
      uaStub._triggerConnect();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      uaStub._triggerDisconnect();
      // Session map cleared — hangup should not find session
      assert.doesNotThrow(() => adapter.hangup('call-1', {}));
    });
  });

  describe('sessionDescriptionHandlerFactory', () => {
    it('should construct a real SipSessionDescriptionHandler with the bound PeerConnection and callSid', () => {
      const { adapter, inviterStub, getSdhFactory } = createAdapter();
      const peerConnection = createPeerConnectionStub();
      adapter.invite('call-abc', { sdp: 'sdp', params: 'To=bob', peerConnection });
      const sdh = getSdhFactory()(inviterStub);
      assert(sdh instanceof SipSessionDescriptionHandler);
      // Drive the SDH through getDescription to prove it delegates to the bound PC.
      sdh.getDescription();
      const makeOutgoingCall = peerConnection.makeOutgoingCall as sinon.SinonStub;
      assert(makeOutgoingCall.calledOnce);
      assert.strictEqual(makeOutgoingCall.firstCall.args[0], 'call-abc');
    });

    it('should return a fail-safe SDH whose ops reject if no binding is registered', async () => {
      const { getSdhFactory, inviterStub } = createAdapter();
      // Factory must NOT throw — a throw would bubble synchronously through
      // SIP.js's setupSessionDescriptionHandler and corrupt session state.
      const sdh = getSdhFactory()(inviterStub);
      assert.strictEqual(sdh.hasDescription('application/sdp'), false);
      await assert.rejects(sdh.getDescription(), /no PeerConnection binding/);
      await assert.rejects(sdh.setDescription('v=0\r\n'), /no PeerConnection binding/);
    });

    it('should return the fail-safe SDH for an inbound invitation when answer() has not yet bound', async () => {
      // Guard against the H4 scenario the reviewer flagged: if SIP.js were
      // ever to invoke the factory before answer() registers the binding
      // (e.g. eager SDH construction on INVITE receipt), we must not throw.
      const { uaStub, getSdhFactory } = createAdapter();
      const invitation = createInvitationStub();
      uaStub._triggerInvite(invitation);
      // Note: no adapter.answer() call — binding intentionally absent.
      const sdh = getSdhFactory()(invitation);
      await assert.rejects(sdh.getDescription(), /no PeerConnection binding/);
    });

    it('preserves a pre-assigned pc.onerror handler when the SDH wraps it (end-to-end ordering)', async () => {
      // Ordering contract: Call assigns _mediaHandler.onerror in its
      // constructor, BEFORE accept() triggers the SIP.js factory that
      // constructs the SDH. The SDH wraps that handler so PC errors still
      // reach Call (which emits 'error'), while also rejecting any SDH
      // promise in flight. This test locks that contract in so a future
      // refactor that constructs the SDH earlier or reorders Call can't
      // silently break error propagation.
      const { adapter, uaStub, getSdhFactory } = createAdapter();
      const peerConnection = createPeerConnectionStub();
      // Simulate Call wiring its handler first — this is the pre-assigned
      // handler the SDH must preserve.
      const callLevelOnError = sinon.spy();
      peerConnection.onerror = callLevelOnError;

      const invitation = createInvitationStub();
      uaStub._triggerInvite(invitation);
      adapter.answer('CA-test-call-sid', { peerConnection });
      // SIP.js calls the factory inside accept(); simulate that order.
      const sdh = getSdhFactory()(invitation) as SipSessionDescriptionHandler;

      // With an SDH promise pending, fire an error on the PC: the SDH must
      // reject the pending promise AND invoke Call's original handler.
      const pending = sdh.getDescription();
      const errorPayload = { info: { code: 31000, message: 'media failure' } };
      peerConnection.onerror(errorPayload);
      await assert.rejects(pending, /media failure/);
      sinon.assert.calledOnceWithExactly(callLevelOnError, errorPayload);
    });

    it('should bind on answer() for inbound calls', () => {
      const { adapter, uaStub, getSdhFactory } = createAdapter();
      const invitation = createInvitationStub();
      uaStub._triggerInvite(invitation);
      const peerConnection = createPeerConnectionStub();
      adapter.answer('CA-test-call-sid', { sdp: 'sdp-offer', peerConnection });
      const sdh = getSdhFactory()(invitation);
      assert(sdh instanceof SipSessionDescriptionHandler);
      sdh.setDescription('v=0\r\no=remote\r\n');
      const answerIncomingCall = peerConnection.answerIncomingCall as sinon.SinonStub;
      assert(answerIncomingCall.calledOnce);
      assert.strictEqual(answerIncomingCall.firstCall.args[0], 'CA-test-call-sid');
    });
  });
});
