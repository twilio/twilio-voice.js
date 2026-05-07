/**
 * Narrow view of the media handler that PStreamSignalingAdapter.iceRestart()
 * needs to produce a fresh-ICE offer. Satisfied structurally by PeerConnection.
 *
 * Lives outside signalingadapter.ts so the shared interface doesn't encode
 * a PStream-specific detail: the SIP adapter produces its offer via SIP.js
 * + SDH and does not use this type at runtime.
 */
export interface IMediaHandler {
  iceRestart(onOfferReady: (offerSdp: string) => void): void;
}
