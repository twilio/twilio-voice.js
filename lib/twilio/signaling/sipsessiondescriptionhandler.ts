import { BodyAndContentType, SessionDescriptionHandler } from 'sip.js';

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
 *
 * Error handling: PeerConnection reports failures via its `onerror`
 * callback, not through the success-only callbacks we pass in. While a
 * PeerConnection call is pending, the SDH subscribes to `onerror` and
 * rejects the current Promise if it fires. The previous handler (Call
 * owns it) is still invoked so Call can emit its own error event.
 */
export class SipSessionDescriptionHandler implements SessionDescriptionHandler {
  private _cachedAnswer: string | null = null;
  private _hasSentOffer: boolean = false;
  // PeerConnection reports failures via onerror, not the success callbacks
  // we pass in. When an operation is pending we store its reject handler
  // here; the onerror hook in the constructor triggers it.
  private _rejectPending: ((error: Error) => void) | null = null;

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
  }

  getDescription(): Promise<BodyAndContentType> {
    if (this._cachedAnswer !== null) {
      const body = this._cachedAnswer;
      this._cachedAnswer = null;
      return Promise.resolve({ body, contentType: APPLICATION_SDP });
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
        this._pc.processAnswer(sdp, () => resolve());
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
    this._failPending(new Error('SipSessionDescriptionHandler closed'));
    this._pc.close();
  }

  sendDtmf(_tones: string): boolean {
    return false;
  }

  private _awaitOperation<T>(start: (resolve: (value: T) => void) => void): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      this._rejectPending = reject;
      start((value) => {
        this._rejectPending = null;
        resolve(value);
      });
    });
  }

  private _failPending(error: Error): void {
    const reject = this._rejectPending;
    if (reject) {
      this._rejectPending = null;
      reject(error);
    }
  }
}
