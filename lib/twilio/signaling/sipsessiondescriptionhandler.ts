import { BodyAndContentType, SessionDescriptionHandler } from 'sip.js';

/**
 * Narrow view of the SDK's PeerConnection class containing only the
 * methods that SipSessionDescriptionHandler depends on. The real
 * PeerConnection class (lib/twilio/rtc/peerconnection.ts) structurally
 * satisfies this interface.
 */
export interface IPeerConnection {
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
 */
export class SipSessionDescriptionHandler implements SessionDescriptionHandler {
  private _cachedAnswer: string | null = null;
  private _hasSentOffer: boolean = false;

  constructor(
    private _pc: IPeerConnection,
    private _callSid: string,
    private _rtcConfiguration: RTCConfiguration = {},
  ) {}

  getDescription(): Promise<BodyAndContentType> {
    if (this._cachedAnswer !== null) {
      const body = this._cachedAnswer;
      this._cachedAnswer = null;
      return Promise.resolve({ body, contentType: APPLICATION_SDP });
    }
    return new Promise<BodyAndContentType>((resolve) => {
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
      return new Promise<void>((resolve) => {
        this._pc.processAnswer(sdp, () => resolve());
      });
    }
    return new Promise<void>((resolve) => {
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
    this._pc.close();
  }

  sendDtmf(_tones: string): boolean {
    return false;
  }
}
