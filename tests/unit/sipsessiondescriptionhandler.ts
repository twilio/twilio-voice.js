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
  onerror: (error: any) => void;
  onfailed: (message: string) => void;
  makeOutgoingCall: sinon.SinonStub;
  answerIncomingCall: sinon.SinonStub;
  processAnswer: sinon.SinonStub;
  iceRestart: sinon.SinonStub;
  close: sinon.SinonStub;
}

function createPeerConnectionStub(overrides: Partial<PcStub> = {}): PcStub {
  const stub: PcStub = {
    onerror: () => { /* replaced by SDH constructor */ },
    onfailed: () => { /* replaced by SDH constructor */ },
    makeOutgoingCall: sinon.stub(),
    answerIncomingCall: sinon.stub(),
    processAnswer: sinon.stub(),
    iceRestart: sinon.stub(),
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

  describe('getDescription with ICE restart', () => {
    const ICE_RESTART_OFFER_SDP = 'v=0\r\no=ice-restart\r\n';
    const ICE_RESTART_OPTS = { offerOptions: { iceRestart: true } };

    it('routes through pc.iceRestart when options.offerOptions.iceRestart is true', async () => {
      const pc = createPeerConnectionStub({
        iceRestart: sinon.stub().callsFake(
          (cb: (sdp: string) => void) => cb(ICE_RESTART_OFFER_SDP),
        ) as sinon.SinonStub,
      });
      const { handler } = createHandler(pc);
      const description = await (handler.getDescription as any)(ICE_RESTART_OPTS);
      assert.deepStrictEqual(description, { body: ICE_RESTART_OFFER_SDP, contentType: APPLICATION_SDP });
      sinon.assert.calledOnce(pc.iceRestart);
      sinon.assert.notCalled(pc.makeOutgoingCall);
    });

    it('falls back to makeOutgoingCall when options does NOT include iceRestart', async () => {
      const pc = createPeerConnectionStub({
        makeOutgoingCall: sinon.stub().callsFake(
          (_sid: string, _cfg: RTCConfiguration, cb: (sdp: string) => void) => cb(OFFER_SDP),
        ) as sinon.SinonStub,
      });
      const { handler } = createHandler(pc);
      await handler.getDescription();
      sinon.assert.calledOnce(pc.makeOutgoingCall);
      sinon.assert.notCalled(pc.iceRestart);
    });

    it('does NOT leak iceRestart routing across calls (each getDescription reads options independently)', async () => {
      const pc = createPeerConnectionStub({
        makeOutgoingCall: sinon.stub().callsFake(
          (_sid: string, _cfg: RTCConfiguration, cb: (sdp: string) => void) => cb(OFFER_SDP),
        ) as sinon.SinonStub,
        iceRestart: sinon.stub().callsFake(
          (cb: (sdp: string) => void) => cb(ICE_RESTART_OFFER_SDP),
        ) as sinon.SinonStub,
        processAnswer: sinon.stub().callsFake(
          (_sdp: string, cb: (pc: RTCPeerConnection) => void) => cb({} as RTCPeerConnection),
        ) as sinon.SinonStub,
      });
      const { handler } = createHandler(pc);
      await (handler.getDescription as any)(ICE_RESTART_OPTS);
      await handler.setDescription(ANSWER_SDP);
      // No options this time: must fall back to makeOutgoingCall.
      await handler.getDescription();
      sinon.assert.calledOnce(pc.iceRestart);
      sinon.assert.calledOnce(pc.makeOutgoingCall);
    });

    it('routes the subsequent setDescription through processAnswer (ICE restart has outbound-offer semantics)', async () => {
      const pc = createPeerConnectionStub({
        iceRestart: sinon.stub().callsFake(
          (cb: (sdp: string) => void) => cb(ICE_RESTART_OFFER_SDP),
        ) as sinon.SinonStub,
        processAnswer: sinon.stub().callsFake(
          (_sdp: string, cb: (pc: RTCPeerConnection) => void) => cb({} as RTCPeerConnection),
        ) as sinon.SinonStub,
      });
      const { handler } = createHandler(pc);
      await (handler.getDescription as any)(ICE_RESTART_OPTS);
      await handler.setDescription(ANSWER_SDP);
      sinon.assert.calledOnce(pc.processAnswer);
      sinon.assert.notCalled(pc.answerIncomingCall);
    });

    it('rejects the pending getDescription if pc.onerror fires during ICE restart', async () => {
      const pc = createPeerConnectionStub(); // iceRestart stub never calls back
      const { handler } = createHandler(pc);
      const pending = (handler.getDescription as any)(ICE_RESTART_OPTS);
      pc.onerror({ info: { code: 31000, message: 'ice restart failure' } });
      await assert.rejects(pending, /ice restart failure/);
    });

    it('rejects the pending getDescription if pc.onfailed fires during ICE restart (createOffer rejection path)', async () => {
      const pc = createPeerConnectionStub(); // iceRestart stub never calls back
      const { handler } = createHandler(pc);
      const pending = (handler.getDescription as any)(ICE_RESTART_OPTS);
      pc.onfailed('createOffer rejected');
      await assert.rejects(pending, /createOffer rejected/);
    });

    it('still invokes the previous onfailed handler when pc.onfailed fires', () => {
      const previousOnFailed = sinon.spy();
      const pc = createPeerConnectionStub({ onfailed: previousOnFailed });
      createHandler(pc);
      pc.onfailed('network down');
      sinon.assert.calledOnceWithExactly(previousOnFailed, 'network down');
    });

    it('does NOT invoke previousOnFailed when onfailed fires DURING an ICE restart (avoids double-dispatch with session.invite rejection)', async () => {
      const previousOnFailed = sinon.spy();
      const pc = createPeerConnectionStub({ onfailed: previousOnFailed }); // iceRestart stub never calls back
      const { handler } = createHandler(pc);
      const pending = (handler.getDescription as any)(ICE_RESTART_OPTS);
      pc.onfailed('createOffer rejected');
      await assert.rejects(pending, /createOffer rejected/);
      sinon.assert.notCalled(previousOnFailed);
    });

    it('does NOT reject a pending setDescription when pc.onfailed fires outside of an ICE restart (runtime ICE failure)', async () => {
      const pc = createPeerConnectionStub(); // answerIncomingCall never calls back
      const { handler } = createHandler(pc);
      let settled = false;
      const pending = handler.setDescription(OFFER_SDP).then(
        () => { settled = true; },
        () => { settled = true; },
      );
      // Simulate runtime ICE failure (no ICE restart requested).
      pc.onfailed('ICE connection failed');
      // Yield a microtask or two to let any spurious reject propagate.
      await Promise.resolve();
      await Promise.resolve();
      assert.strictEqual(settled, false);
      // Closing the SDH must drain _pendingRejects so the Promise actually
      // settles — exercises the close() reject path and ensures no Promise
      // leaks across tests.
      handler.close();
      await pending;
      assert.strictEqual(settled, true);
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

    it('routes a subsequent inbound re-INVITE through answerIncomingCall (hasSentOffer resets after exchange)', async () => {
      // SIP.js memoizes the SDH on the Session, so the same SDH may see a
      // follow-up inbound re-INVITE after an outbound exchange completes.
      const pc = createPeerConnectionStub({
        makeOutgoingCall: sinon.stub().callsFake(
          (_sid: string, _cfg: RTCConfiguration, cb: (sdp: string) => void) => cb(OFFER_SDP),
        ) as sinon.SinonStub,
        processAnswer: sinon.stub().callsFake(
          (_sdp: string, cb: (pc: RTCPeerConnection) => void) => cb({} as RTCPeerConnection),
        ) as sinon.SinonStub,
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
      // Outbound exchange: offer -> answer.
      await handler.getDescription();
      await handler.setDescription(ANSWER_SDP);
      // Simulated inbound re-INVITE: remote sends us an offer.
      await handler.setDescription(OFFER_SDP);
      sinon.assert.calledOnce(pc.answerIncomingCall);
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
    it('does not close the PeerConnection (Call owns its lifecycle)', () => {
      const pc = createPeerConnectionStub();
      const { handler } = createHandler(pc);
      handler.close();
      sinon.assert.notCalled(pc.close);
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

    it('rejects every concurrently-pending operation when pc.onerror fires', async () => {
      // SIP.js can issue overlapping setDescription calls (PRACK/UPDATE
      // during early media); all pending Promises must settle on error.
      const pc = createPeerConnectionStub(); // no callbacks fire — both ops stay pending
      const { handler } = createHandler(pc);
      const first = handler.getDescription();
      const second = handler.setDescription(OFFER_SDP);
      pc.onerror({ info: { code: 31000, message: 'bulk failure' } });
      await Promise.all([
        assert.rejects(first, /bulk failure/),
        assert.rejects(second, /bulk failure/),
      ]);
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
