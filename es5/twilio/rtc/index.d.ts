import PeerConnection from './peerconnection';
declare function enabled(): boolean;
declare function getMediaEngine(): "ORTC" | "WebRTC";
export { enabled, getMediaEngine, PeerConnection, };
