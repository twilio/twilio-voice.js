import * as assert from 'assert';
import * as sinon from 'sinon';
import {
  IPeerConnection,
  SipSessionDescriptionHandler,
} from '../../lib/twilio/signaling/sipsessiondescriptionhandler';

const APPLICATION_SDP = 'application/sdp';
const CALL_SID = 'CA1234567890';
const OFFER_SDP = 'v=0\r\no=offerer\r\n';
const ANSWER_SDP = 'v=0\r\no=answerer\r\n';

interface PcStub extends IPeerConnection {
  makeOutgoingCall: sinon.SinonStub;
  answerIncomingCall: sinon.SinonStub;
  processAnswer: sinon.SinonStub;
  close: sinon.SinonStub;
}

function createPeerConnectionStub(overrides: Partial<PcStub> = {}): PcStub {
  const stub: PcStub = {
    onerror: () => { /* replaced by SDH constructor */ },
    makeOutgoingCall: sinon.stub(),
    answerIncomingCall: sinon.stub(),
    processAnswer: sinon.stub(),
    close: sinon.stub(),
    ...overrides,
  };
  return stub;
}

function createHandler(pc?: PcStub, rtcConfig: RTCConfiguration = {}) {
  const pcStub = pc || createPeerConnectionStub();
  const handler = new SipSessionDescriptionHandler(pcStub, CALL_SID, rtcConfig);
  return { handler, pc: pcStub };
}

describe('SipSessionDescriptionHandler', () => {
  describe('hasDescription', () => {
    it('returns true for application/sdp', () => {
      const { handler } = createHandler();
      assert.strictEqual(handler.hasDescription(APPLICATION_SDP), true);
    });

    it('returns false for other content types', () => {
      const { handler } = createHandler();
      assert.strictEqual(handler.hasDescription('text/plain'), false);
      assert.strictEqual(handler.hasDescription(''), false);
      assert.strictEqual(handler.hasDescription('application/json'), false);
    });
  });

  describe('getDescription (outbound)', () => {
    it('delegates to pc.makeOutgoingCall with the callSid and rtcConfig', () => {
      const rtcConfig: RTCConfiguration = { iceServers: [{ urls: 'stun:example.com' }] };
      const pc = createPeerConnectionStub();
      const { handler } = createHandler(pc, rtcConfig);
      handler.getDescription();
      sinon.assert.calledOnce(pc.makeOutgoingCall);
      const [callSid, config] = pc.makeOutgoingCall.firstCall.args;
      assert.strictEqual(callSid, CALL_SID);
      assert.deepStrictEqual(config, rtcConfig);
    });

    it('resolves with {body, contentType: application/sdp} when the offer callback fires', async () => {
      const pc = createPeerConnectionStub({
        makeOutgoingCall: sinon.stub().callsFake(
          (_sid: string, _cfg: RTCConfiguration, cb: (sdp: string) => void) => cb(OFFER_SDP),
        ) as sinon.SinonStub,
      });
      const { handler } = createHandler(pc);
      const description = await handler.getDescription();
      assert.deepStrictEqual(description, { body: OFFER_SDP, contentType: APPLICATION_SDP });
    });

  });

  describe('setDescription after offer (outbound answer)', () => {
    it('delegates to pc.processAnswer with the remote sdp', async () => {
      const pc = createPeerConnectionStub({
        makeOutgoingCall: sinon.stub().callsFake(
          (_sid: string, _cfg: RTCConfiguration, cb: (sdp: string) => void) => cb(OFFER_SDP),
        ) as sinon.SinonStub,
        processAnswer: sinon.stub().callsFake(
          (_sdp: string, cb: (pc: RTCPeerConnection) => void) => cb({} as RTCPeerConnection),
        ) as sinon.SinonStub,
      });
      const { handler } = createHandler(pc);
      await handler.getDescription();
      await handler.setDescription(ANSWER_SDP);
      sinon.assert.calledOnce(pc.processAnswer);
      assert.strictEqual(pc.processAnswer.firstCall.args[0], ANSWER_SDP);
      sinon.assert.notCalled(pc.answerIncomingCall);
    });
  });

  describe('setDescription without prior offer (inbound)', () => {
    it('delegates to pc.answerIncomingCall with the remote sdp and resolves when media starts', async () => {
      const pc = createPeerConnectionStub({
        answerIncomingCall: sinon.stub().callsFake(
          (
            _sid: string,
            _sdp: string,
            _cfg: RTCConfiguration,
            onAnswerReady: (answer: string) => void,
            onMediaStarted: (pc: RTCPeerConnection) => void,
          ) => {
            onAnswerReady(ANSWER_SDP);
            onMediaStarted({} as RTCPeerConnection);
          },
        ) as sinon.SinonStub,
      });
      const { handler } = createHandler(pc);
      await handler.setDescription(OFFER_SDP);
      sinon.assert.calledOnce(pc.answerIncomingCall);
      const [sid, sdp] = pc.answerIncomingCall.firstCall.args;
      assert.strictEqual(sid, CALL_SID);
      assert.strictEqual(sdp, OFFER_SDP);
      sinon.assert.notCalled(pc.processAnswer);
    });

    it('caches the local answer so the next getDescription returns it synchronously', async () => {
      const pc = createPeerConnectionStub({
        answerIncomingCall: sinon.stub().callsFake(
          (
            _sid: string,
            _sdp: string,
            _cfg: RTCConfiguration,
            onAnswerReady: (answer: string) => void,
            onMediaStarted: (pc: RTCPeerConnection) => void,
          ) => {
            onAnswerReady(ANSWER_SDP);
            onMediaStarted({} as RTCPeerConnection);
          },
        ) as sinon.SinonStub,
      });
      const { handler } = createHandler(pc);
      await handler.setDescription(OFFER_SDP);
      const description = await handler.getDescription();
      assert.deepStrictEqual(description, { body: ANSWER_SDP, contentType: APPLICATION_SDP });
      sinon.assert.notCalled(pc.makeOutgoingCall);
    });
  });

  describe('close', () => {
    it('delegates to pc.close', () => {
      const pc = createPeerConnectionStub();
      const { handler } = createHandler(pc);
      handler.close();
      sinon.assert.calledOnce(pc.close);
    });

    it('rejects any pending operation promises', async () => {
      const pc = createPeerConnectionStub(); // makeOutgoingCall never calls back
      const { handler } = createHandler(pc);
      const pending = handler.getDescription();
      handler.close();
      await assert.rejects(pending, /closed/);
    });
  });

  describe('error propagation', () => {
    it('rejects getDescription if pc.onerror fires before the callback', async () => {
      const pc = createPeerConnectionStub();
      const { handler } = createHandler(pc);
      const pending = handler.getDescription();
      const twilioError = new Error('media failure');
      pc.onerror({ info: { code: 31000, message: 'media failure', twilioError } });
      await assert.rejects(pending, /media failure/);
    });

    it('rejects with the twilioError instance when one is provided', async () => {
      class FakeTwilioError extends Error { constructor() { super('twilio-flavored'); } }
      const twilioError = new FakeTwilioError();
      const pc = createPeerConnectionStub();
      const { handler } = createHandler(pc);
      const pending = handler.getDescription();
      pc.onerror({ info: { code: 31000, message: 'ignored', twilioError } });
      await assert.rejects(pending, (err: Error) => err === twilioError);
    });

    it('rejects setDescription (processAnswer path) if pc.onerror fires', async () => {
      const pc = createPeerConnectionStub({
        makeOutgoingCall: sinon.stub().callsFake(
          (_sid: string, _cfg: RTCConfiguration, cb: (sdp: string) => void) => cb(OFFER_SDP),
        ) as sinon.SinonStub,
      });
      const { handler } = createHandler(pc);
      await handler.getDescription();
      const pending = handler.setDescription(ANSWER_SDP);
      pc.onerror({ info: { code: 31000, message: 'answer failed' } });
      await assert.rejects(pending, /answer failed/);
    });

    it('rejects setDescription (answerIncomingCall path) if pc.onerror fires', async () => {
      const pc = createPeerConnectionStub();
      const { handler } = createHandler(pc);
      const pending = handler.setDescription(OFFER_SDP);
      pc.onerror({ info: { code: 31000, message: 'answer creation failed' } });
      await assert.rejects(pending, /answer creation failed/);
    });

    it('still invokes the previous onerror handler (so Call can emit error)', () => {
      const previousOnError = sinon.spy();
      const pc = createPeerConnectionStub({ onerror: previousOnError });
      createHandler(pc);
      const errorPayload = { info: { code: 31000, message: 'boom' } };
      pc.onerror(errorPayload);
      sinon.assert.calledOnceWithExactly(previousOnError, errorPayload);
    });

    it('does not reject after the operation resolves', async () => {
      const pc = createPeerConnectionStub({
        makeOutgoingCall: sinon.stub().callsFake(
          (_sid: string, _cfg: RTCConfiguration, cb: (sdp: string) => void) => cb(OFFER_SDP),
        ) as sinon.SinonStub,
      });
      const { handler } = createHandler(pc);
      const description = await handler.getDescription();
      assert.strictEqual(description.body, OFFER_SDP);
      // Firing onerror after the Promise resolved must not throw or cause issues.
      assert.doesNotThrow(() => pc.onerror({ info: { code: 31000, message: 'late error' } }));
    });
  });

  describe('sendDtmf', () => {
    it('returns false (DTMF is routed outside the SDH)', () => {
      const { handler } = createHandler();
      assert.strictEqual(handler.sendDtmf('1'), false);
    });
  });
});
