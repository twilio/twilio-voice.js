import * as assert from 'assert';
import * as sinon from 'sinon';
import { RequestPendingError } from 'sip.js';
import { SignalingAdapter } from '../../lib/twilio/signaling/signalingadapter';
import { SipSignalingAdapter } from '../../lib/twilio/signaling/sipsignalingadapter';
import { IPeerConnection, SipSessionDescriptionHandler } from '../../lib/twilio/signaling/sipsessiondescriptionhandler';

function createPeerConnectionStub(): IPeerConnection {
  return {
    onerror: () => { /* replaced by SDH constructor when used */ },
    onfailed: () => { /* replaced by SDH constructor when used */ },
    makeOutgoingCall: sinon.stub(),
    answerIncomingCall: sinon.stub(),
    processAnswer: sinon.stub(),
    iceRestart: sinon.stub(),
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
  let reconnectImpl: () => Promise<void> = () => Promise.resolve();
  return {
    start: sinon.stub().resolves(),
    stop: sinon.stub().resolves(),
    reconnect: sinon.stub().callsFake(() => reconnectImpl()),
    _getDelegate() { return delegate; },
    _setDelegate(d: any) { delegate = d; },
    _setReconnectImpl(fn: () => Promise<void>) { reconnectImpl = fn; },
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

    it('should emit "offline" on transport disconnect (PStream parity)', () => {
      // Mirrors PStream: every transport close emits offline so Device flips
      // to Unregistered and sets _shouldReRegister.
      const { adapter, uaStub } = createAdapter();
      uaStub._triggerConnect();
      const offlineSpy = sinon.spy();
      adapter.on('offline', offlineSpy);
      uaStub._triggerDisconnect();
      assert.strictEqual(offlineSpy.callCount, 1);
    });

    it('should set status to "disconnected" when transport disconnects', () => {
      const { adapter, uaStub } = createAdapter();
      uaStub._triggerConnect();
      uaStub._triggerDisconnect();
      assert.strictEqual(adapter.status, 'disconnected');
    });

    it('should not emit "transportClose" if already disconnected', () => {
      const { adapter, uaStub } = createAdapter();
      // Status is already 'disconnected' (initial state, no prior connect)
      const closeSpy = sinon.spy();
      adapter.on('transportClose', closeSpy);
      uaStub._triggerDisconnect();
      assert.strictEqual(closeSpy.callCount, 0);
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

  describe('iceRestart()', () => {
    const mediaHandlerStub = () => ({ iceRestart: sinon.stub() });

    it('passes offerOptions.iceRestart:true to session.invite', () => {
      const { adapter, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Established';
      adapter.iceRestart('call-1', { mediaHandler: mediaHandlerStub() });
      const reinviteOpts = inviterStub.invite.lastCall.args[0];
      assert.strictEqual(reinviteOpts?.sessionDescriptionHandlerOptions?.offerOptions?.iceRestart, true);
    });

    it('does NOT consult the mediaHandler (SIP SDH generates the offer itself)', () => {
      const { adapter, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Established';
      const mediaHandler = mediaHandlerStub();
      adapter.iceRestart('call-1', { mediaHandler });
      sinon.assert.notCalled(mediaHandler.iceRestart);
    });

    it('emits "answer" on requestDelegate.onAccept', (done) => {
      const { adapter, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Established';
      adapter.on('answer', (payload: any) => {
        assert.strictEqual(payload.callsid, 'call-1');
        done();
      });
      adapter.iceRestart('call-1', { mediaHandler: mediaHandlerStub() });
      const rd = inviterStub.invite.lastCall.args[0]?.requestDelegate;
      rd.onAccept();
    });

    it('emits hangup WITHOUT an error field when session is not established (Call cleans up listeners silently)', (done) => {
      const { adapter } = createAdapter();
      adapter.on('hangup', (payload: any) => {
        assert.strictEqual(payload.callsid, 'nope');
        // No error field: Call._onHangup would translate `error` into an
        // emit('error', ConnectionError), which is not wanted for this
        // benign teardown race.
        assert.strictEqual(payload.error, undefined);
        done();
      });
      adapter.iceRestart('nope', { mediaHandler: mediaHandlerStub() });
    });

    it('emits hangup (with status code) on requestDelegate.onReject', (done) => {
      const { adapter, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Established';
      adapter.on('hangup', (payload: any) => {
        assert.strictEqual(payload.callsid, 'call-1');
        assert.strictEqual(payload.error.code, 488);
        done();
      });
      adapter.iceRestart('call-1', { mediaHandler: mediaHandlerStub() });
      const rd = inviterStub.invite.lastCall.args[0]?.requestDelegate;
      rd.onReject({ message: { statusCode: 488 } });
    });

    it('emits hangup when session.invite rejects asynchronously (via .catch)', (done) => {
      const { adapter, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Established';
      // Make session.invite return a rejected Promise on the next call.
      inviterStub.invite = sinon.stub().returns(Promise.reject(new Error('invite failed')));
      adapter.on('hangup', (payload: any) => {
        assert.strictEqual(payload.callsid, 'call-1');
        assert.ok(payload.error);
        done();
      });
      adapter.iceRestart('call-1', { mediaHandler: mediaHandlerStub() });
    });

    it('does not emit hangup when session.invite rejects with RequestPendingError', async () => {
      const { adapter, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Established';
      const reinvitePromise = Promise.reject(new RequestPendingError('Reinvite in progress'));
      inviterStub.invite = sinon.stub().returns(reinvitePromise);
      const onHangup = sinon.stub();
      adapter.on('hangup', onHangup);
      adapter.iceRestart('call-1', { mediaHandler: mediaHandlerStub() });
      // Await the same promise the adapter is awaiting so its .catch handler
      // runs before we assert. Robust under fake timers.
      await reinvitePromise.catch(() => undefined);
      sinon.assert.notCalled(onHangup);
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

    it('transport disconnect should preserve session maps so hangup can still route', () => {
      const { adapter, uaStub, inviterStub } = createAdapter();
      uaStub._triggerConnect();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      uaStub._triggerDisconnect();
      // Session is still addressable through the blip; hangup routes to cancel
      // (Inviter in Initial state issues cancel) and fails gracefully via
      // the existing .catch() path — does not throw to consumer.
      assert.doesNotThrow(() => adapter.hangup('call-1', {}));
      assert(inviterStub.cancel.calledOnce);
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

  describe('reconnect lifecycle', () => {
    let clock: sinon.SinonFakeTimers;
    let randomStub: sinon.SinonStub;

    beforeEach(() => {
      clock = sinon.useFakeTimers();
      // Pin Math.random so jitter resolves to exactly the computed delay
      // (deviation = floor(0 * jitter * ms) = 0; (0 & 1) === 0 path subtracts 0).
      randomStub = sinon.stub(Math, 'random').returns(0);
    });

    afterEach(() => {
      clock.restore();
      randomStub.restore();
    });

    it('emits transportClose and offline on transient disconnect (PStream parity)', () => {
      const { adapter, uaStub } = createAdapter();
      uaStub._triggerConnect();
      const closeSpy = sinon.spy();
      const offlineSpy = sinon.spy();
      adapter.on('transportClose', closeSpy);
      adapter.on('offline', offlineSpy);
      uaStub._triggerDisconnect();
      assert.strictEqual(closeSpy.callCount, 1);
      assert.strictEqual(offlineSpy.callCount, 1);
    });

    it('does NOT clear session maps on transient disconnect', async () => {
      const { adapter, uaStub, inviterStub } = createAdapter();
      uaStub._triggerConnect();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      uaStub._triggerDisconnect();
      // Sessions still addressable through the blip — hangup routes (does not warn-and-skip)
      adapter.hangup('call-1', {});
      assert(inviterStub.cancel.calledOnce);
    });

    it('schedules userAgent.reconnect after the backoff delay', async () => {
      const { uaStub } = createAdapter();
      uaStub._triggerConnect();
      uaStub._triggerDisconnect();
      assert.strictEqual(uaStub.reconnect.callCount, 0, 'should not reconnect synchronously');
      await clock.tickAsync(100);
      assert.strictEqual(uaStub.reconnect.callCount, 1);
    });

    it('retries with exponential backoff on reconnect failure', async () => {
      const { uaStub } = createAdapter();
      uaStub._setReconnectImpl(() => Promise.reject(new Error('still down')));
      uaStub._triggerConnect();
      uaStub._triggerDisconnect();
      await clock.tickAsync(100);   // attempt #0
      assert.strictEqual(uaStub.reconnect.callCount, 1);
      await clock.tickAsync(200);   // attempt #1: 100 * 2^1 = 200
      assert.strictEqual(uaStub.reconnect.callCount, 2);
      await clock.tickAsync(400);   // attempt #2: 100 * 2^2 = 400
      assert.strictEqual(uaStub.reconnect.callCount, 3);
    });

    it('emits connected then ready after successful reconnect when previously registered', async () => {
      // Make createRegisterer return a fresh stub on each call so we can drive
      // the post-reconnect Registerer's stateChange independently.
      const registerers: ReturnType<typeof createRegistererStub>[] = [];
      const uaStub = createUserAgentStub();
      const inviterStub = createInviterStub();
      const adapter = new SipSignalingAdapter({
        sipDomain: 'sip.ashburn.dev.twilio.com',
        sipUri: 'sip:alice@sip.ashburn.dev.twilio.com',
        sipTransportServer: 'wss://sip.ashburn.dev.twilio.com',
        credentials: { username: 'alice', password: 'secret' },
        region: 'ashburn',
        createUserAgent(config: any) { uaStub._setDelegate(config.delegate); return uaStub as any; },
        createRegisterer() { const r = createRegistererStub(); registerers.push(r); return r as any; },
        createInviter() { return inviterStub as any; },
      });

      uaStub._triggerConnect();
      adapter.register({ audio: true });
      registerers[0]._simulateState('Registered');

      const events: string[] = [];
      adapter.on('connected', () => events.push('connected'));
      adapter.on('ready', () => events.push('ready'));

      uaStub._triggerDisconnect();
      // Mock SIP.js's behavior: reconnect() resolves AND fires onConnect.
      uaStub._setReconnectImpl(() => {
        uaStub._triggerConnect();
        return Promise.resolve();
      });
      await clock.tickAsync(100);
      // _onReconnectSuccess creates a new registerer; drive it to Registered.
      assert.strictEqual(registerers.length, 2, 'a new Registerer should be created');
      registerers[1]._simulateState('Registered');

      assert.deepStrictEqual(events, ['connected', 'ready']);
    });

    it('emits connected exactly once when SIP.js fires onConnect async after reconnect() resolves', async () => {
      const uaStub = createUserAgentStub();
      const adapter = new SipSignalingAdapter({
        sipDomain: 'sip.ashburn.dev.twilio.com',
        sipUri: 'sip:alice@sip.ashburn.dev.twilio.com',
        sipTransportServer: 'wss://sip.ashburn.dev.twilio.com',
        credentials: { username: 'alice', password: 'secret' },
        region: 'ashburn',
        createUserAgent(config: any) { uaStub._setDelegate(config.delegate); return uaStub as any; },
        createRegisterer() { return createRegistererStub() as any; },
        createInviter() { return createInviterStub() as any; },
      });

      uaStub._triggerConnect();
      uaStub._triggerDisconnect();

      const onConnected = sinon.stub();
      adapter.on('connected', onConnected);

      // reconnect() resolves first; SIP.js's onConnect fires later as a
      // microtask. Without idempotent _onTransportConnect this would emit
      // 'connected' twice.
      uaStub._setReconnectImpl(() => {
        Promise.resolve().then(() => uaStub._triggerConnect());
        return Promise.resolve();
      });
      await clock.tickAsync(100);

      sinon.assert.calledOnce(onConnected);
    });

    it('does NOT re-register if consumer never registered before disconnect', async () => {
      const registerers: ReturnType<typeof createRegistererStub>[] = [];
      const uaStub = createUserAgentStub();
      const adapter = new SipSignalingAdapter({
        sipDomain: 'sip.ashburn.dev.twilio.com',
        sipUri: 'sip:alice@sip.ashburn.dev.twilio.com',
        sipTransportServer: 'wss://sip.ashburn.dev.twilio.com',
        credentials: { username: 'alice', password: 'secret' },
        region: 'ashburn',
        createUserAgent(config: any) { uaStub._setDelegate(config.delegate); return uaStub as any; },
        createRegisterer() { const r = createRegistererStub(); registerers.push(r); return r as any; },
        createInviter() { return createInviterStub() as any; },
      });

      uaStub._triggerConnect();
      // No register() call before disconnect.
      uaStub._triggerDisconnect();
      uaStub._setReconnectImpl(() => { uaStub._triggerConnect(); return Promise.resolve(); });
      await clock.tickAsync(100);
      assert.strictEqual(registerers.length, 0, 'no Registerer should be created post-reconnect');
      assert.strictEqual(adapter.status, 'connected');
    });

    it('disposes the old Registerer and creates a fresh one on reconnect', async () => {
      const registerers: ReturnType<typeof createRegistererStub>[] = [];
      const uaStub = createUserAgentStub();
      const adapter = new SipSignalingAdapter({
        sipDomain: 'sip.ashburn.dev.twilio.com',
        sipUri: 'sip:alice@sip.ashburn.dev.twilio.com',
        sipTransportServer: 'wss://sip.ashburn.dev.twilio.com',
        credentials: { username: 'alice', password: 'secret' },
        region: 'ashburn',
        createUserAgent(config: any) { uaStub._setDelegate(config.delegate); return uaStub as any; },
        createRegisterer() { const r = createRegistererStub(); registerers.push(r); return r as any; },
        createInviter() { return createInviterStub() as any; },
      });

      uaStub._triggerConnect();
      adapter.register({ audio: true });
      registerers[0]._simulateState('Registered');

      uaStub._triggerDisconnect();
      assert(registerers[0].dispose.calledOnce);

      uaStub._setReconnectImpl(() => { uaStub._triggerConnect(); return Promise.resolve(); });
      await clock.tickAsync(100);
      assert.strictEqual(registerers.length, 2);
      assert(registerers[1].register.calledOnce);
    });

    it('falls back from preferred to primary backoff after the preferred budget expires', async () => {
      // Mirrors WSTransport on the backoff side: preferred has a 15s budget;
      // on expiry, primary backoff kicks in (max 20s delay, infinite duration).
      // Adapter mirrors PStream on the offline side: emits offline on the
      // initial transport close (so Device flips to Unregistered) but does
      // not re-emit during ongoing backoff retries.
      const { adapter, uaStub } = createAdapter();
      uaStub._setReconnectImpl(() => Promise.reject(new Error('down')));
      uaStub._triggerConnect();

      const offlineSpy = sinon.spy();
      adapter.on('offline', offlineSpy);

      uaStub._triggerDisconnect();
      // offline fires once on the initial close (PStream parity).
      assert.strictEqual(offlineSpy.callCount, 1);

      // Drive past the 15s preferred budget. Reconnect is still being called
      // afterward (under primary backoff); offline should NOT re-fire.
      await clock.tickAsync(20000);
      const callCountAfterPreferred = uaStub.reconnect.callCount;
      assert(callCountAfterPreferred > 0, 'reconnect should have been attempted under preferred');
      assert.strictEqual(offlineSpy.callCount, 1, 'offline must not re-fire during ongoing backoff');

      // Advance well past the preferred budget into primary territory.
      // Primary's first delay is 100ms, then 200, 400, ..., capped at 20000.
      // After many seconds, additional reconnect attempts should keep firing.
      await clock.tickAsync(60000);
      assert(
        uaStub.reconnect.callCount > callCountAfterPreferred,
        'primary backoff should keep retrying after preferred expires',
      );
      assert.strictEqual(offlineSpy.callCount, 1);
      assert.strictEqual(adapter.status, 'disconnected');
    });

    it('grants a fresh 15s preferred budget on a second disconnect after a successful reconnect', async () => {
      // The Backoff instances are reused across cycles. The preferred budget
      // clock relies on the 'backoff' listener re-stamping _backoffStartTime
      // when attempt === 0. This test pins that contract.
      const { adapter, uaStub } = createAdapter();
      uaStub._triggerConnect();

      // First cycle: blow through the 15s preferred budget, then heal.
      uaStub._setReconnectImpl(() => Promise.reject(new Error('down')));
      uaStub._triggerDisconnect();
      await clock.tickAsync(20000);   // past preferred budget, into primary
      uaStub._setReconnectImpl(() => { uaStub._triggerConnect(); return Promise.resolve(); });
      await clock.tickAsync(20000);   // primary attempt eventually succeeds
      assert.strictEqual(adapter.status, 'connected');

      // Second disconnect: reconnect always fails. Track per-tier attempts via
      // log messages (preferred vs primary).
      const logSpy = sinon.spy((adapter as any)._log, 'info');
      uaStub._setReconnectImpl(() => Promise.reject(new Error('down')));
      uaStub._triggerDisconnect();

      // Within 14s the cycle should still be in preferred — never primary.
      await clock.tickAsync(14000);
      const primaryEntries = logSpy.getCalls().filter(c =>
        typeof c.args[0] === 'string' && c.args[0].includes('(primary)'),
      );
      assert.strictEqual(primaryEntries.length, 0, 'should still be in preferred tier within 15s');

      // Past 15s, the budget exhausts and primary kicks in.
      await clock.tickAsync(2000);
      const primaryEntriesAfter = logSpy.getCalls().filter(c =>
        typeof c.args[0] === 'string' && c.args[0].includes('(primary)'),
      );
      assert(primaryEntriesAfter.length > 0, 'primary should engage after fresh 15s budget expires');
      logSpy.restore();
    });

    it('resets backoff after a successful reconnect (subsequent disconnect retries from attempt 0)', async () => {
      const { uaStub } = createAdapter();
      uaStub._triggerConnect();
      uaStub._triggerDisconnect();
      uaStub._setReconnectImpl(() => { uaStub._triggerConnect(); return Promise.resolve(); });
      await clock.tickAsync(100);
      assert.strictEqual(uaStub.reconnect.callCount, 1);

      // Second disconnect — should retry at the min delay again, not at a higher attempt.
      uaStub._setReconnectImpl(() => Promise.resolve());
      uaStub._triggerDisconnect();
      await clock.tickAsync(99);
      assert.strictEqual(uaStub.reconnect.callCount, 1, 'no reconnect before min delay');
      await clock.tickAsync(1);
      assert.strictEqual(uaStub.reconnect.callCount, 2);
    });

    it('ignores duplicate disconnect events while already reconnecting', async () => {
      const { uaStub } = createAdapter();
      uaStub._triggerConnect();
      uaStub._triggerDisconnect();
      uaStub._triggerDisconnect();   // duplicate — should be ignored
      uaStub._triggerDisconnect();   // duplicate — should be ignored
      await clock.tickAsync(100);
      assert.strictEqual(uaStub.reconnect.callCount, 1);
    });

    it('destroy() cancels any in-flight reconnect', async () => {
      const { adapter, uaStub } = createAdapter();
      uaStub._triggerConnect();
      uaStub._triggerDisconnect();
      adapter.destroy();
      await clock.tickAsync(5000);
      assert.strictEqual(uaStub.reconnect.callCount, 0);
    });

    it('register() is a no-op while reconnecting', () => {
      const createRegisterer = sinon.stub().callsFake(() => createRegistererStub() as any);
      const { adapter, uaStub } = createAdapter({ createRegisterer });
      uaStub._setReconnectImpl(() => Promise.reject(new Error('down')));
      uaStub._triggerConnect();
      uaStub._triggerDisconnect();
      createRegisterer.resetHistory();
      assert.doesNotThrow(() => adapter.register({ audio: true }));
      assert.strictEqual(createRegisterer.callCount, 0);
    });

    it('suppresses hangup and emits iceRestartNeeded for an in-flight ICE-restart re-INVITE orphaned by a WS disconnect', async () => {
      const { adapter, uaStub, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Established';
      uaStub._triggerConnect();

      // Issue ICE restart while WS is up
      adapter.iceRestart('call-1', { mediaHandler: { iceRestart: sinon.stub() } });
      const rd = inviterStub.invite.lastCall.args[0]?.requestDelegate;

      const onHangup = sinon.stub();
      const onIceRestartNeeded = sinon.stub();
      adapter.on('hangup', onHangup);
      adapter.on('iceRestartNeeded', onIceRestartNeeded);

      // WS dies while re-INVITE is in flight
      uaStub._triggerDisconnect();
      // Late rejection arrives (e.g. a 408 from the dead socket)
      rd.onReject({ message: { statusCode: 408 } });
      sinon.assert.notCalled(onHangup);

      // WS reconnects successfully
      uaStub._setReconnectImpl(() => { uaStub._triggerConnect(); return Promise.resolve(); });
      await clock.tickAsync(100);

      sinon.assert.calledOnce(onIceRestartNeeded);
      assert.strictEqual(onIceRestartNeeded.firstCall.args[0].callsid, 'call-1');
    });

    it('still suppresses hangup if the orphaned re-INVITE rejection arrives AFTER reconnect succeeds', async () => {
      const { adapter, uaStub, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Established';
      uaStub._triggerConnect();

      adapter.iceRestart('call-1', { mediaHandler: { iceRestart: sinon.stub() } });
      const rd = inviterStub.invite.lastCall.args[0]?.requestDelegate;

      const onHangup = sinon.stub();
      const onIceRestartNeeded = sinon.stub();
      adapter.on('hangup', onHangup);
      adapter.on('iceRestartNeeded', onIceRestartNeeded);

      // WS dies — re-INVITE is now orphaned
      uaStub._triggerDisconnect();

      // WS recovers BEFORE Timer B fires the late rejection
      uaStub._setReconnectImpl(() => { uaStub._triggerConnect(); return Promise.resolve(); });
      await clock.tickAsync(100);
      sinon.assert.calledOnce(onIceRestartNeeded);

      // SIP.js Timer B finally times out the orphaned re-INVITE long after
      // recovery; the late 408 must not tear down the (now reconnected) call.
      rd.onReject({ message: { statusCode: 408 } });
      sinon.assert.notCalled(onHangup);
    });

    it('defers iceRestart while reconnecting: no re-INVITE sent', async () => {
      const { adapter, uaStub, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Established';
      uaStub._triggerConnect();
      // Reset to count only iceRestart-driven invite() calls below.
      inviterStub.invite.resetHistory();

      uaStub._triggerDisconnect();
      adapter.iceRestart('call-1', { mediaHandler: { iceRestart: sinon.stub() } });

      sinon.assert.notCalled(inviterStub.invite);
      assert.ok((adapter as any)._pendingIceRestartRecovery.has('call-1'));
    });

    it('emits iceRestartNeeded once after reconnect for a restart deferred during the outage', async () => {
      const { adapter, uaStub, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Established';
      uaStub._triggerConnect();

      const onIceRestartNeeded = sinon.stub();
      adapter.on('iceRestartNeeded', onIceRestartNeeded);

      uaStub._triggerDisconnect();
      adapter.iceRestart('call-1', { mediaHandler: { iceRestart: sinon.stub() } });

      uaStub._setReconnectImpl(() => { uaStub._triggerConnect(); return Promise.resolve(); });
      await clock.tickAsync(100);

      sinon.assert.calledOnce(onIceRestartNeeded);
      assert.strictEqual(onIceRestartNeeded.firstCall.args[0].callsid, 'call-1');
    });

    it('two iceRestart calls for the same callSid during one outage emit iceRestartNeeded once', async () => {
      const { adapter, uaStub, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Established';
      uaStub._triggerConnect();

      const onIceRestartNeeded = sinon.stub();
      adapter.on('iceRestartNeeded', onIceRestartNeeded);

      uaStub._triggerDisconnect();
      adapter.iceRestart('call-1', { mediaHandler: { iceRestart: sinon.stub() } });
      adapter.iceRestart('call-1', { mediaHandler: { iceRestart: sinon.stub() } });

      uaStub._setReconnectImpl(() => { uaStub._triggerConnect(); return Promise.resolve(); });
      await clock.tickAsync(100);

      sinon.assert.calledOnce(onIceRestartNeeded);
    });

    it('emits iceRestartNeeded for each distinct callSid deferred during the outage', async () => {
      const { adapter, uaStub, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      adapter.invite('call-2', { sdp: 'sdp', params: 'To=carol', peerConnection: createPeerConnectionStub() });
      // createAdapter() returns a single shared inviterStub backing both
      // sessions, so setting state once marks 'call-1' and 'call-2' Established.
      inviterStub.state = 'Established';
      uaStub._triggerConnect();

      const seen: string[] = [];
      adapter.on('iceRestartNeeded', (p: any) => seen.push(p.callsid));

      uaStub._triggerDisconnect();
      adapter.iceRestart('call-1', { mediaHandler: { iceRestart: sinon.stub() } });
      adapter.iceRestart('call-2', { mediaHandler: { iceRestart: sinon.stub() } });

      uaStub._setReconnectImpl(() => { uaStub._triggerConnect(); return Promise.resolve(); });
      await clock.tickAsync(100);

      assert.deepStrictEqual(seen.sort(), ['call-1', 'call-2']);
    });

    it('hangup() during reconnect clears the pending recovery so iceRestartNeeded is not re-emitted', async () => {
      const { adapter, uaStub, inviterStub } = createAdapter();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      inviterStub.state = 'Established';
      uaStub._triggerConnect();

      const onIceRestartNeeded = sinon.stub();
      adapter.on('iceRestartNeeded', onIceRestartNeeded);

      uaStub._triggerDisconnect();
      adapter.iceRestart('call-1', { mediaHandler: { iceRestart: sinon.stub() } });
      adapter.hangup('call-1', {});

      uaStub._setReconnectImpl(() => { uaStub._triggerConnect(); return Promise.resolve(); });
      await clock.tickAsync(100);

      sinon.assert.notCalled(onIceRestartNeeded);
    });

    it('hangup() during reconnect window does not throw to the consumer', async () => {
      const { adapter, uaStub, inviterStub } = createAdapter();
      uaStub._setReconnectImpl(() => Promise.reject(new Error('down')));
      uaStub._triggerConnect();
      adapter.invite('call-1', { sdp: 'sdp', params: 'To=bob', peerConnection: createPeerConnectionStub() });
      uaStub._triggerDisconnect();

      // Simulate the closed-WS error from SIP.js: cancel() rejects.
      inviterStub.cancel = sinon.stub().rejects(new Error('transport closed'));
      assert.doesNotThrow(() => adapter.hangup('call-1', {}));
    });
  });
});
