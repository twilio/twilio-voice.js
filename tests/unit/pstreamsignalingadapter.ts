import * as assert from 'assert';
import { EventEmitter } from 'events';
import * as sinon from 'sinon';
import { PStreamSignalingAdapter } from '../../lib/twilio/signaling/pstreamsignalingadapter';

function createPStreamStub() {
  const emitter = new EventEmitter();
  return Object.assign(emitter, {
    status: 'connected',
    uri: 'wss://test.twilio.com',
    setToken: sinon.stub(),
    destroy: sinon.stub(),
    updatePreferredURI: sinon.stub(),
    updateURIs: sinon.stub(),
    invite: sinon.stub(),
    answer: sinon.stub(),
    hangup: sinon.stub(),
    reject: sinon.stub(),
    reinvite: sinon.stub(),
    reconnect: sinon.stub(),
    dtmf: sinon.stub(),
    sendMessage: sinon.stub(),
    register: sinon.stub(),
  });
}

describe('PStreamSignalingAdapter', () => {
  let pstream: any;
  let adapter: PStreamSignalingAdapter;

  beforeEach(() => {
    pstream = createPStreamStub();
    adapter = new PStreamSignalingAdapter(pstream);
  });

  it('should delegate invite() to pstream', () => {
    adapter.invite('sdp', 'callSid', 'params');
    assert(pstream.invite.calledWith('sdp', 'callSid', 'params'));
  });

  it('should delegate answer() to pstream', () => {
    adapter.answer('sdp', 'callSid');
    assert(pstream.answer.calledWith('sdp', 'callSid'));
  });

  it('should delegate hangup() to pstream', () => {
    adapter.hangup('callSid', 'msg');
    assert(pstream.hangup.calledWith('callSid', 'msg'));
  });

  it('should delegate reject() to pstream', () => {
    adapter.reject('callSid');
    assert(pstream.reject.calledWith('callSid'));
  });

  it('should delegate reinvite() to pstream', () => {
    adapter.reinvite('sdp', 'callSid');
    assert(pstream.reinvite.calledWith('sdp', 'callSid'));
  });

  it('should delegate reconnect() to pstream', () => {
    adapter.reconnect('sdp', 'callSid', 'token');
    assert(pstream.reconnect.calledWith('sdp', 'callSid', 'token'));
  });

  it('should delegate dtmf() to pstream', () => {
    adapter.dtmf('callSid', '123');
    assert(pstream.dtmf.calledWith('callSid', '123'));
  });

  it('should delegate sendMessage() to pstream', () => {
    adapter.sendMessage('callSid', 'hi', 'text/plain', 'user-msg', 'evt1');
    assert(pstream.sendMessage.calledWith('callSid', 'hi', 'text/plain', 'user-msg', 'evt1'));
  });

  it('should delegate register() to pstream', () => {
    adapter.register({ audio: true });
    assert(pstream.register.calledWith({ audio: true }));
  });

  it('should delegate setToken() to pstream', () => {
    adapter.setToken('newToken');
    assert(pstream.setToken.calledWith('newToken'));
  });

  it('should delegate destroy() to pstream', () => {
    adapter.destroy();
    assert(pstream.destroy.calledOnce);
  });

  it('should delegate updatePreferredURI() to pstream', () => {
    adapter.updatePreferredURI('wss://new.uri');
    assert(pstream.updatePreferredURI.calledWith('wss://new.uri'));
  });

  it('should delegate updateURIs() to pstream', () => {
    adapter.updateURIs(['wss://a', 'wss://b']);
    assert(pstream.updateURIs.calledWith(['wss://a', 'wss://b']));
  });

  it('should expose pstream status', () => {
    pstream.status = 'ready';
    assert.equal(adapter.status, 'ready');
  });

  it('should expose pstream uri', () => {
    assert.equal(adapter.uri, 'wss://test.twilio.com');
  });

  it('should re-emit pstream events', (done) => {
    adapter.on('answer', (payload: any) => {
      assert.deepEqual(payload, { sdp: 'test' });
      done();
    });
    pstream.emit('answer', { sdp: 'test' });
  });

  it('should re-emit invite event', (done) => {
    adapter.on('invite', (payload: any) => {
      assert.equal(payload.callSid, 'abc');
      done();
    });
    pstream.emit('invite', { callSid: 'abc' });
  });

  it('should re-emit hangup event', (done) => {
    adapter.on('hangup', (payload: any) => {
      assert.equal(payload.callSid, 'abc');
      done();
    });
    pstream.emit('hangup', { callSid: 'abc' });
  });
});
