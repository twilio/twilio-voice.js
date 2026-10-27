import {
  BodyAndContentType,
  SessionDescriptionHandler,
} from 'sip.js';

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
  // Null until the RTCPeerConnection is created.
  version?: { pc?: { iceConnectionState?: string; connectionState?: string } } | null;

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

  // answerIncomingCall cannot be reused here: it re-initializes the media
  // stream, which no-ops without calling back once the PC is open.
  processOffer(
    sdp: string,
    onAnswerReady: (answerSdp: string) => void,
    onMediaStarted: (pc: RTCPeerConnection) => void,
  ): void;

  iceRestart(onOfferReady: (offerSdp: string) => void): void;

  close(): void;
}

const APPLICATION_SDP = 'application/sdp';
const CLOSED_ERROR_MESSAGE = 'SipSessionDescriptionHandler closed';

/**
 * Error name for an ICE-restart offer that PeerConnection couldn't create.
 * Call has already been told. It retries on Chrome and ends the call elsewhere.
 */
export const ICE_RESTART_OFFER_FAILED = 'IceRestartOfferFailed';

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
 *   ICE restart: requestIceRestart() then getDescription() -> pc.iceRestart
 *                produces a fresh-ICE offer; subsequent setDescription
 *                consumes the remote answer via processAnswer.
 *   Remote re-INVITE: once the initial exchange has completed, SIP.js drives
 *                setDescription(remote offer) -> pc.processOffer, then
 *                getDescription() -> the answer processOffer cached.
 *
 * Error handling: PeerConnection reports failures via `onerror` (generic,
 * rejects whatever is pending) and `onfailed` (ICE-state failures plus
 * ICE-restart createOffer rejections). We wrap both and call the previous
 * handlers (Call owns them) so Call still emits its error events. The
 * onfailed wrap is scoped: it only rejects pending Promises while an ICE
 * restart is in flight, so that runtime ICE failures do not reject
 * unrelated in-flight get/setDescription Promises.
 */
export class SipSessionDescriptionHandler implements SessionDescriptionHandler {
  private _cachedAnswer: string | null = null;
  // SIP.js can still call in after close(), which already unwrapped
  // pc.onerror, so a new operation would never settle. Reject up front.
  private _closed: boolean = false;
  // True once the initial offer/answer exchange has completed. A remote offer
  // arriving after this point is a server-initiated re-INVITE.
  private _hasNegotiated: boolean = false;
  private _hasSentOffer: boolean = false;
  // One shot, set by requestIceRestart(). SIP.js persists invite options across
  // the dialog, so the intent cannot be read back from them.
  private _iceRestartRequested: boolean = false;
  // pc.onfailed reports both a createOffer rejection during our restart and a
  // runtime ICE failure. Only the first should reject the pending Promise.
  // Call._mediaReconnectBackoff fires serially, so at most one is in flight.
  private _iceRestartPending: boolean = false;
  // PeerConnection reports failures through onerror, not the callbacks we pass
  // it, so every in-flight operation parks its reject here. A Set because SIP.js
  // can overlap setDescription calls (PRACK/UPDATE during early media).
  private _pendingRejects: Set<(error: Error) => void> = new Set();

  // Call's pc.onerror / pc.onfailed, captured before the constructor wraps
  // them. close() puts them back, so Call keeps receiving errors after the
  // Session is disposed and a recreated Session re-wraps instead of stacking.
  private _previousOnError: (error: PeerConnectionError) => void;
  private _previousOnFailed: (message: string) => void;

  constructor(
    private _pc: IPeerConnection,
    private _callSid: string,
    private _rtcConfiguration: RTCConfiguration = {},
    // Call's onAnswer. Fired once, after the initial offer/answer settles, so
    // a throw can't strand SIP.js's Promise. ICE-restart answers and remote
    // re-INVITEs don't re-fire it.
    private _onMediaStarted?: (pc: RTCPeerConnection) => void,
  ) {
    const previousOnError = this._previousOnError = this._pc.onerror;
    this._pc.onerror = (error: PeerConnectionError) => {
      // Clear _iceRestartPending so a later runtime onfailed doesn't re-enter
      // _failPending. Harmless today (pending set is already drained) but keeps
      // the flag's meaning ("ICE restart in flight") accurate.
      this._iceRestartPending = false;
      this._failPending(error?.info?.twilioError || new Error(error?.info?.message || 'PeerConnection error'));
      previousOnError(error);
    };
    const previousOnFailed = this._previousOnFailed = this._pc.onfailed;
    this._pc.onfailed = (message: string) => {
      // Only reject pending Promises if an ICE restart is in flight —
      // that's the one case where pc.onfailed carries a createOffer
      // rejection we need to propagate. Runtime ICE failures (ICE state
      // = failed with no restart requested) must not reject unrelated
      // setDescription Promises.
      if (this._iceRestartPending) {
        this._iceRestartPending = false;
        // Rejecting frees SIP.js for the next re-INVITE. previousOnFailed
        // still runs so Call handles it as on VSP: a retry on Chrome.
        const error = new Error(message || 'PeerConnection failed');
        error.name = ICE_RESTART_OFFER_FAILED;
        this._failPending(error);
      }
      previousOnFailed(message);
    };
  }

  requestIceRestart(): void {
    this._iceRestartRequested = true;
  }

  cancelIceRestart(): void {
    this._iceRestartRequested = false;
  }

  /**
   * For a re-INVITE rejection that kept the dialog. Reports the restart as
   * failed, as PeerConnection does when it can't create the offer, so Call
   * handles it the same way. Skipped while media is healthy, as there's
   * nothing to retry.
   */
  failIceRestart(message: string): void {
    const pc = this._pc.version?.pc;
    const iceState = pc?.iceConnectionState;
    // connectionState also covers DTLS. PeerConnection reports both to Call.
    if ((iceState === 'connected' || iceState === 'completed')
      && (!pc?.connectionState || pc.connectionState === 'connected')) {
      return;
    }
    this._previousOnFailed(message);
  }

  getDescription(): Promise<BodyAndContentType> {
    if (this._closed) {
      return Promise.reject(new Error(CLOSED_ERROR_MESSAGE));
    }
    if (this._cachedAnswer !== null) {
      const body = this._cachedAnswer;
      this._cachedAnswer = null;
      return Promise.resolve({ body, contentType: APPLICATION_SDP });
    }
    if (this._iceRestartRequested) {
      this._iceRestartRequested = false;
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
    if (this._hasNegotiated) {
      // Offerless re-INVITE. Falling through would hang: makeOutgoingCall
      // no-ops on an open PC. Rejecting makes SIP.js respond 488 and keep
      // the call up. Supporting it also means answering from the ACK.
      return Promise.reject(new Error('Offerless re-INVITE is not supported'));
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
    if (this._closed) {
      return Promise.reject(new Error(CLOSED_ERROR_MESSAGE));
    }
    if (this._hasSentOffer) {
      return this._awaitOperation<void>((resolve) => {
        this._pc.processAnswer(sdp, (pc: RTCPeerConnection) => {
          const isInitialAnswer = !this._hasNegotiated;
          // Outbound offer/answer exchange complete. Clear the flag so a
          // subsequent re-INVITE on the same session (SIP.js memoizes the
          // SDH per Session) can route correctly. A remote re-INVITE must
          // go down processOffer, outbound must set the flag again.
          this._hasSentOffer = false;
          this._hasNegotiated = true;
          resolve();
          if (isInitialAnswer) {
            this._onMediaStarted?.(pc);
          }
        });
      });
    }
    if (this._hasNegotiated) {
      // Server-initiated re-INVITE carrying an offer. SIP.js follows this
      // with a getDescription() that collects the cached answer.
      return this._awaitOperation<void>((resolve) => {
        this._pc.processOffer(
          sdp,
          (answerSdp) => { this._cachedAnswer = answerSdp; },
          () => resolve(),
        );
      });
    }
    return this._awaitOperation<void>((resolve) => {
      this._pc.answerIncomingCall(
        this._callSid,
        sdp,
        this._rtcConfiguration,
        (answerSdp) => { this._cachedAnswer = answerSdp; },
        (pc: RTCPeerConnection) => {
          this._hasNegotiated = true;
          resolve();
          this._onMediaStarted?.(pc);
        },
      );
    });
  }

  /**
   * SIP.js calls this when our re-INVITE gets a non-2xx. The offer was never
   * answered, so a later remote re-INVITE must route to processOffer. Must
   * not reject: SIP.js sends BYE if it does.
   */
  rollbackDescription(): Promise<void> {
    this._hasSentOffer = false;
    return Promise.resolve();
  }

  close(): void {
    // Call owns the PeerConnection lifecycle and closes it in its own
    // teardown paths. SIP.js invokes close() on the SDH at session end —
    // we must NOT close the PC here, or it would be closed twice (risking
    // duplicate close events or log warnings on torn-down handlers).
    this._closed = true;
    this._iceRestartPending = false;
    // Also drops the PC's last reference to this SDH.
    this._pc.onerror = this._previousOnError;
    this._pc.onfailed = this._previousOnFailed;
    // Drop any answer produced but never collected, e.g. onAnswerReady fired
    // and the operation was cancelled before SIP.js called getDescription().
    this._cachedAnswer = null;
    this._failPending(new Error(CLOSED_ERROR_MESSAGE));
  }

  sendDtmf(_tones: string): boolean {
    // DTMF goes out as RFC2833 via Call's RTCDTMFSender, not through SIP.js.
    // Returning false tells SIP.js "I don't implement DTMF."
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
