import {
  BodyAndContentType,
  SessionDescriptionHandler,
  SessionDescriptionHandlerOptions as BaseSessionDescriptionHandlerOptions,
} from 'sip.js';

/**
 * Local extension of SIP.js's public SessionDescriptionHandlerOptions
 * type. SIP.js's web-platform SDH ships a richer type in a private
 * subpath (sip.js/lib/platform/web/...), but importing from that path
 * is fragile across versions. We only need offerOptions for ICE-restart
 * plumbing, so we widen the public type here.
 */
interface SessionDescriptionHandlerOptions extends BaseSessionDescriptionHandlerOptions {
  offerOptions?: RTCOfferOptions;
}

/**
 * Shape of error payloads emitted by PeerConnection.onerror.
 */
interface PeerConnectionError {
  info: { code: number; message: string; twilioError?: Error };
}

/**
 * Narrow view of the SDK's PeerConnection class containing only the
 * methods that SipSessionDescriptionHandler depends on. The real
 * PeerConnection class (lib/twilio/rtc/peerconnection.ts) structurally
 * satisfies this interface.
 */
export interface IPeerConnection {
  onerror: (error: PeerConnectionError) => void;
  // PeerConnection.iceRestart() rejects by calling onfailed(message) with a
  // plain string, NOT by calling onerror. The SDH wraps this in addition to
  // onerror so pending getDescription() Promises reject on ICE-restart
  // failures instead of hanging.
  onfailed: (message: string) => void;

  makeOutgoingCall(
    callSid: string,
    rtcConfiguration: RTCConfiguration,
    onOfferReady: (offerSdp: string) => void,
  ): void;

  answerIncomingCall(
    callSid: string,
    sdp: string,
    rtcConfiguration: RTCConfiguration,
    onAnswerReady: (answerSdp: string) => void,
    onMediaStarted: (pc: RTCPeerConnection) => void,
  ): void;

  processAnswer(
    sdp: string,
    onMediaStarted: (pc: RTCPeerConnection) => void,
  ): void;

  iceRestart(onOfferReady: (offerSdp: string) => void): void;

  close(): void;
}

const APPLICATION_SDP = 'application/sdp';

/**
 * Bridges SIP.js's SessionDescriptionHandler interface to the SDK's
 * PeerConnection. The SDH does not own the RTCPeerConnection — it
 * delegates offer/answer creation and remote-SDP processing to
 * PeerConnection. Its job is to translate between SIP.js's Promise-
 * based SDH contract and PeerConnection's callback-based API.
 *
 * Call flows:
 *   Outbound: getDescription() -> makeOutgoingCall produces offer
 *             setDescription() -> processAnswer consumes remote answer
 *   Inbound:  setDescription() -> answerIncomingCall consumes offer and
 *                                 produces an answer (cached)
 *             getDescription() -> returns the cached answer
 *   ICE restart: getDescription({offerOptions:{iceRestart:true}}) -> pc.iceRestart
 *                produces a fresh-ICE offer; subsequent setDescription
 *                consumes the remote answer via processAnswer.
 *
 * Error handling: PeerConnection reports failures via `onerror` (generic,
 * rejects whatever is pending) and `onfailed` (ICE-state failures plus
 * ICE-restart createOffer rejections). We wrap both and call the previous
 * handlers (Call owns them) so Call still emits its error events. The
 * onfailed wrap is scoped: it only rejects pending Promises when the SDH
 * itself initiated an ICE restart, so that runtime ICE failures do not
 * reject unrelated in-flight setDescription Promises.
 */
export class SipSessionDescriptionHandler implements SessionDescriptionHandler {
  private _cachedAnswer: string | null = null;
  private _hasSentOffer: boolean = false;
  // True while an ICE-restart getDescription() is in flight. Scopes the
  // onfailed wrap: pc.onfailed fires both for createOffer rejection (what
  // we want to reject the pending Promise for) and for ICE state = failed
  // at runtime (what we do NOT want to reject unrelated in-flight
  // setDescription Promises for).
  private _iceRestartPending: boolean = false;
  // PeerConnection reports failures via onerror, not the success callbacks
  // we pass in. Every in-flight operation adds its reject handler here;
  // the onerror hook in the constructor rejects all of them. SIP.js can
  // issue overlapping setDescription calls (e.g. PRACK/UPDATE during early
  // media), so a single-slot field would let earlier Promises hang.
  private _pendingRejects: Set<(error: Error) => void> = new Set();

  /**
   * Invariant: at most one SipSessionDescriptionHandler exists per
   * PeerConnection lifetime. The constructor wraps pc.onerror and
   * pc.onfailed and stores the previous handlers in closures. Creating
   * a second SDH over the same PC would stack wraps indefinitely and
   * keep old Promise rejects reachable via closure. Today Call owns one
   * PC per call and SIP.js memoizes one SDH per Session, so this holds.
   */
  constructor(
    private _pc: IPeerConnection,
    private _callSid: string,
    private _rtcConfiguration: RTCConfiguration = {},
  ) {
    const previousOnError = this._pc.onerror;
    this._pc.onerror = (error: PeerConnectionError) => {
      this._failPending(error?.info?.twilioError || new Error(error?.info?.message || 'PeerConnection error'));
      previousOnError(error);
    };
    const previousOnFailed = this._pc.onfailed;
    this._pc.onfailed = (message: string) => {
      // Only reject pending Promises if an ICE restart is in flight —
      // that's the one case where pc.onfailed carries a createOffer
      // rejection we need to propagate. Runtime ICE failures (ICE state
      // = failed with no restart requested) must not reject unrelated
      // setDescription Promises.
      if (this._iceRestartPending) {
        this._iceRestartPending = false;
        this._failPending(new Error(message || 'PeerConnection failed'));
      }
      previousOnFailed(message);
    };
  }

  getDescription(options?: SessionDescriptionHandlerOptions): Promise<BodyAndContentType> {
    if (this._cachedAnswer !== null) {
      const body = this._cachedAnswer;
      this._cachedAnswer = null;
      return Promise.resolve({ body, contentType: APPLICATION_SDP });
    }
    // SIP.js forwards sessionDescriptionHandlerOptions from session.invite()
    // into this options argument. SipSignalingAdapter.iceRestart() sets
    // offerOptions.iceRestart when Call's media backoff requests a restart;
    // that routes through pc.iceRestart() (fresh ICE candidates) instead
    // of pc.makeOutgoingCall().
    if (options?.offerOptions?.iceRestart) {
      this._iceRestartPending = true;
      return this._awaitOperation<BodyAndContentType>((resolve) => {
        this._pc.iceRestart((offerSdp) => {
          this._iceRestartPending = false;
          // Set _hasSentOffer so SIP.js's follow-up setDescription for the
          // 200 OK's answer routes to processAnswer, matching outbound
          // offer/answer semantics.
          this._hasSentOffer = true;
          resolve({ body: offerSdp, contentType: APPLICATION_SDP });
        });
      });
    }
    return this._awaitOperation<BodyAndContentType>((resolve) => {
      this._pc.makeOutgoingCall(this._callSid, this._rtcConfiguration, (offerSdp) => {
        this._hasSentOffer = true;
        resolve({ body: offerSdp, contentType: APPLICATION_SDP });
      });
    });
  }

  hasDescription(contentType: string): boolean {
    return contentType === APPLICATION_SDP;
  }

  setDescription(sdp: string): Promise<void> {
    if (this._hasSentOffer) {
      return this._awaitOperation<void>((resolve) => {
        this._pc.processAnswer(sdp, () => {
          // Outbound offer/answer exchange complete. Clear the flag so a
          // subsequent re-INVITE on the same session (SIP.js memoizes the
          // SDH per Session) can route correctly — inbound re-INVITE must
          // go down answerIncomingCall, outbound must set the flag again.
          this._hasSentOffer = false;
          resolve();
        });
      });
    }
    return this._awaitOperation<void>((resolve) => {
      this._pc.answerIncomingCall(
        this._callSid,
        sdp,
        this._rtcConfiguration,
        (answerSdp) => { this._cachedAnswer = answerSdp; },
        () => resolve(),
      );
    });
  }

  close(): void {
    // Call owns the PeerConnection lifecycle and closes it in its own
    // teardown paths. SIP.js invokes close() on the SDH at session end —
    // we must NOT close the PC here, or it would be closed twice (risking
    // duplicate close events or log warnings on torn-down handlers).
    this._iceRestartPending = false;
    this._failPending(new Error('SipSessionDescriptionHandler closed'));
  }

  sendDtmf(_tones: string): boolean {
    // DTMF is routed through SipSignalingAdapter.dtmf() as SIP INFO, not
    // the SDH path. Returning false tells SIP.js "I don't implement DTMF."
    return false;
  }

  private _awaitOperation<T>(start: (resolve: (value: T) => void) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this._pendingRejects.add(reject);
      start((value) => {
        this._pendingRejects.delete(reject);
        resolve(value);
      });
    });
  }

  private _failPending(error: Error): void {
    const rejects = Array.from(this._pendingRejects);
    this._pendingRejects.clear();
    rejects.forEach((reject) => reject(error));
  }
}
