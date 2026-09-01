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
const REOFFER_SDP = 'v=0\r\no=reofferer\r\n';
const REANSWER_SDP = 'v=0\r\no=reanswerer\r\n';

interface PcStub extends IPeerConnection {
  onerror: (error: any) => void;
  onfailed: (message: string) => void;
  makeOutgoingCall: sinon.SinonStub;
  answerIncomingCall: sinon.SinonStub;
  processAnswer: sinon.SinonStub;
  processOffer: sinon.SinonStub;
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
    processOffer: sinon.stub(),
    iceRestart: sinon.stub(),
    close: sinon.stub(),
    ...overrides,
  };
  return stub;
}

/** makeOutgoingCall that immediately hands back OFFER_SDP. */
function stubMakeOutgoingCall(offer: string = OFFER_SDP): sinon.SinonStub {
  return sinon.stub().callsFake(
    (_sid: string, _cfg: RTCConfiguration, cb: (sdp: string) => void) => cb(offer),
  );
}

/** processAnswer that immediately reports media started. */
function stubProcessAnswer(): sinon.SinonStub {
  return sinon.stub().callsFake(
    (_sdp: string, cb: (pc: RTCPeerConnection) => void) => cb({} as RTCPeerConnection),
  );
}

/** answerIncomingCall that immediately produces an answer and starts media. */
function stubAnswerIncomingCall(answer: string = ANSWER_SDP): sinon.SinonStub {
  return sinon.stub().callsFake(
    (
      _sid: string,
      _sdp: string,
      _cfg: RTCConfiguration,
      onAnswerReady: (a: string) => void,
      onMediaStarted: (pc: RTCPeerConnection) => void,
    ) => {
      onAnswerReady(answer);
      onMediaStarted({} as RTCPeerConnection);
    },
  );
}

/** processOffer that immediately produces an answer and starts media. */
function stubProcessOffer(answer: string = REANSWER_SDP): sinon.SinonStub {
  return sinon.stub().callsFake(
    (
      _sdp: string,
      onAnswerReady: (a: string) => void,
      onMediaStarted: (pc: RTCPeerConnection) => void,
    ) => {
      onAnswerReady(answer);
      onMediaStarted({} as RTCPeerConnection);
    },
  );
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
    it('routes through pc.iceRestart after requestIceRestart()', async () => {
      const pc = createPeerConnectionStub({
        iceRestart: sinon.stub().callsFake(
          (cb: (sdp: string) => void) => cb(ICE_RESTART_OFFER_SDP),
        ) as sinon.SinonStub,
      });
      const { handler } = createHandler(pc);
      handler.requestIceRestart();
      const description = await handler.getDescription();
      assert.deepStrictEqual(description, { body: ICE_RESTART_OFFER_SDP, contentType: APPLICATION_SDP });
      sinon.assert.calledOnce(pc.iceRestart);
      sinon.assert.notCalled(pc.makeOutgoingCall);
    });

    it('falls back to makeOutgoingCall when no restart was requested', async () => {
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

    it('does NOT leak iceRestart routing across calls (the request is one shot)', async () => {
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
      // No options: the initial offer must go through makeOutgoingCall.
      await handler.getDescription();
      await handler.setDescription(ANSWER_SDP);
      // Options present: must route to iceRestart, not makeOutgoingCall again.
      handler.requestIceRestart();
      await handler.getDescription();
      sinon.assert.calledOnce(pc.makeOutgoingCall);
      sinon.assert.calledOnce(pc.iceRestart);

      // And the routing does not stick: a later no-options getDescription is an
      // offerless re-INVITE, which is rejected rather than re-run as an ICE
      // restart or a (hanging) makeOutgoingCall on the open PC.
      await handler.setDescription(ANSWER_SDP);
      await assert.rejects(handler.getDescription(), /Offerless re-INVITE is not supported/);
      sinon.assert.calledOnce(pc.makeOutgoingCall);
      sinon.assert.calledOnce(pc.iceRestart);
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
      handler.requestIceRestart();
      await handler.getDescription();
      await handler.setDescription(ANSWER_SDP);
      sinon.assert.calledOnce(pc.processAnswer);
      sinon.assert.notCalled(pc.answerIncomingCall);
    });

    it('rejects the pending getDescription if pc.onerror fires during ICE restart', async () => {
      const pc = createPeerConnectionStub(); // iceRestart stub never calls back
      const { handler } = createHandler(pc);
      handler.requestIceRestart();
      const pending = handler.getDescription();
      pc.onerror({ info: { code: 31000, message: 'ice restart failure' } });
      await assert.rejects(pending, /ice restart failure/);
    });

    it('rejects the pending getDescription if pc.onfailed fires during ICE restart (createOffer rejection path)', async () => {
      const pc = createPeerConnectionStub(); // iceRestart stub never calls back
      const { handler } = createHandler(pc);
      handler.requestIceRestart();
      const pending = handler.getDescription();
      pc.onfailed('createOffer rejected');
      await assert.rejects(pending, /createOffer rejected/);
    });

    it('still invokes the previous onfailed handler when pc.onfailed fires', () => {
      const previousOnFailed = sinon.spy();
      const pc = createPeerConnectionStub({ onfailed: previousOnFailed });
      createHandler(pc);
      // _iceRestartPending is false here (no ICE restart in flight), so the
      // wrap falls through to previousOnFailed. See the next test for the
      // ICE-restart branch where previousOnFailed is intentionally skipped.
      pc.onfailed('network down');
      sinon.assert.calledOnceWithExactly(previousOnFailed, 'network down');
    });

    it('does NOT invoke previousOnFailed when onfailed fires DURING an ICE restart (avoids double-dispatch with session.invite rejection)', async () => {
      const previousOnFailed = sinon.spy();
      const pc = createPeerConnectionStub({ onfailed: previousOnFailed }); // iceRestart stub never calls back
      const { handler } = createHandler(pc);
      handler.requestIceRestart();
      const pending = handler.getDescription();
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

  describe('remote re-INVITE (renegotiation)', () => {
    // SIP.js memoizes the SDH on the Session, so the same SDH sees any
    // follow-up in-dialog INVITE. Session.onInviteRequest drives
    // setOfferAndGetAnswer: setDescription(remote offer) then getDescription().

    it('routes a re-INVITE after an outbound call through pc.processOffer', async () => {
      const pc = createPeerConnectionStub({
        makeOutgoingCall: stubMakeOutgoingCall(),
        processAnswer: stubProcessAnswer(),
        processOffer: stubProcessOffer(),
      });
      const { handler } = createHandler(pc);
      await handler.getDescription();
      await handler.setDescription(ANSWER_SDP);

      await handler.setDescription(REOFFER_SDP);

      sinon.assert.calledOnce(pc.processOffer);
      assert.strictEqual(pc.processOffer.firstCall.args[0], REOFFER_SDP);
      // The live PeerConnection must not be re-initialized.
      sinon.assert.notCalled(pc.answerIncomingCall);
    });

    it('routes a re-INVITE after an inbound call through pc.processOffer', async () => {
      const pc = createPeerConnectionStub({
        answerIncomingCall: stubAnswerIncomingCall(),
        processOffer: stubProcessOffer(),
      });
      const { handler } = createHandler(pc);
      await handler.setDescription(OFFER_SDP);
      await handler.getDescription();

      await handler.setDescription(REOFFER_SDP);

      sinon.assert.calledOnce(pc.processOffer);
      sinon.assert.calledOnce(pc.answerIncomingCall);
    });

    it('serves the renegotiated answer to the getDescription that follows', async () => {
      const pc = createPeerConnectionStub({
        makeOutgoingCall: stubMakeOutgoingCall(),
        processAnswer: stubProcessAnswer(),
        processOffer: stubProcessOffer(),
      });
      const { handler } = createHandler(pc);
      await handler.getDescription();
      await handler.setDescription(ANSWER_SDP);

      // Full setOfferAndGetAnswer sequence.
      await handler.setDescription(REOFFER_SDP);
      const description = await handler.getDescription();

      assert.deepStrictEqual(description, { body: REANSWER_SDP, contentType: APPLICATION_SDP });
      sinon.assert.calledOnce(pc.makeOutgoingCall);
    });

    it('rejects the pending setDescription if pc.onerror fires during processOffer', async () => {
      const pc = createPeerConnectionStub({
        answerIncomingCall: stubAnswerIncomingCall(),
        // processOffer never calls back
      });
      const { handler } = createHandler(pc);
      await handler.setDescription(OFFER_SDP);
      await handler.getDescription();

      const pending = handler.setDescription(REOFFER_SDP);
      pc.onerror({ info: { code: 31000, message: 'Error processing offer: boom' } });

      await assert.rejects(pending, /Error processing offer: boom/);
    });

    it('cancelIceRestart() disarms the request', async () => {
      const pc = createPeerConnectionStub({
        makeOutgoingCall: stubMakeOutgoingCall(),
        processAnswer: stubProcessAnswer(),
        iceRestart: sinon.stub().callsFake(
          (cb: (sdp: string) => void) => cb(REOFFER_SDP),
        ) as sinon.SinonStub,
      });
      const { handler } = createHandler(pc);
      await handler.getDescription();
      await handler.setDescription(ANSWER_SDP);

      handler.requestIceRestart();
      handler.cancelIceRestart();

      await assert.rejects(handler.getDescription(), /Offerless re-INVITE is not supported/);
      sinon.assert.notCalled(pc.iceRestart);
    });

    it('rejects an offerless re-INVITE that follows an ICE restart', async () => {
      // SIP.js persists session.invite()'s sessionDescriptionHandlerOptions into
      // sessionDescriptionHandlerOptionsReInvite and replays it on every later
      // in-dialog request, so the restart intent must not be read back from it.
      const pc = createPeerConnectionStub({
        makeOutgoingCall: stubMakeOutgoingCall(),
        processAnswer: stubProcessAnswer(),
        iceRestart: sinon.stub().callsFake(
          (cb: (sdp: string) => void) => cb(REOFFER_SDP),
        ) as sinon.SinonStub,
      });
      const { handler } = createHandler(pc);
      await handler.getDescription();
      await handler.setDescription(ANSWER_SDP);

      handler.requestIceRestart();
      await handler.getDescription();
      await handler.setDescription(ANSWER_SDP);

      await assert.rejects(handler.getDescription(), /Offerless re-INVITE is not supported/);
      sinon.assert.calledOnce(pc.iceRestart);
      sinon.assert.calledOnce(pc.makeOutgoingCall);
    });

    it('rejects an offerless re-INVITE instead of hanging on makeOutgoingCall', async () => {
      // Stable dialog + no SDP body: SIP.js asks for a fresh local offer.
      // makeOutgoingCall would no-op on the open PC and never call back.
      const pc = createPeerConnectionStub({
        answerIncomingCall: stubAnswerIncomingCall(),
        makeOutgoingCall: stubMakeOutgoingCall(),
      });
      const { handler } = createHandler(pc);
      await handler.setDescription(OFFER_SDP);
      await handler.getDescription();

      await assert.rejects(handler.getDescription(), /Offerless re-INVITE is not supported/);
      sinon.assert.notCalled(pc.makeOutgoingCall);
    });

    it('still routes an ICE-restart getDescription through pc.iceRestart after establishment', async () => {
      const pc = createPeerConnectionStub({
        makeOutgoingCall: stubMakeOutgoingCall(),
        processAnswer: stubProcessAnswer(),
        iceRestart: sinon.stub().callsFake(
          (cb: (sdp: string) => void) => cb(REOFFER_SDP),
        ) as sinon.SinonStub,
      });
      const { handler } = createHandler(pc);
      await handler.getDescription();
      await handler.setDescription(ANSWER_SDP);

      handler.requestIceRestart();
      const description = await handler.getDescription();

      sinon.assert.calledOnce(pc.iceRestart);
      assert.deepStrictEqual(description, { body: REOFFER_SDP, contentType: APPLICATION_SDP });
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

    it('restores the original pc.onerror and pc.onfailed', () => {
      const originalOnError = () => { /* Call's handler */ };
      const originalOnFailed = () => { /* Call's handler */ };
      const pc = createPeerConnectionStub({
        onerror: originalOnError,
        onfailed: originalOnFailed,
      });
      const { handler } = createHandler(pc);
      // Constructor wrapped both.
      assert.notStrictEqual(pc.onerror, originalOnError);
      assert.notStrictEqual(pc.onfailed, originalOnFailed);

      handler.close();

      assert.strictEqual(pc.onerror, originalOnError);
      assert.strictEqual(pc.onfailed, originalOnFailed);
    });

    it('does not stack wraps when a second handler is created over the same pc', () => {
      const originalOnError = () => { /* Call's handler */ };
      const pc = createPeerConnectionStub({ onerror: originalOnError });
      const first = createHandler(pc).handler;
      first.close();

      const second = createHandler(pc).handler;
      second.close();

      assert.strictEqual(pc.onerror, originalOnError);
    });

    it('clears the cached answer', async () => {
      const pc = createPeerConnectionStub({ answerIncomingCall: stubAnswerIncomingCall() });
      const { handler } = createHandler(pc);
      await handler.setDescription(OFFER_SDP);
      assert.strictEqual((handler as any)._cachedAnswer, ANSWER_SDP);

      handler.close();

      assert.strictEqual((handler as any)._cachedAnswer, null);
    });

    it('rejects operations started after close instead of hanging', async () => {
      // SIP.js does not drop its SDH reference on close, so late calls land here.
      const pc = createPeerConnectionStub();
      const { handler } = createHandler(pc);
      handler.close();

      await assert.rejects(handler.getDescription(), /closed/);
      await assert.rejects(handler.setDescription(OFFER_SDP), /closed/);
      sinon.assert.notCalled(pc.makeOutgoingCall);
      sinon.assert.notCalled(pc.answerIncomingCall);
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
