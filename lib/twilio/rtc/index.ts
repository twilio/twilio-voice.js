import PeerConnection from './peerconnection';
import RTCPC from './rtcpc';

function enabled(): boolean {
  return RTCPC.test();
}

function getMediaEngine(): string {
  return typeof (globalThis as any).RTCIceGatherer !== 'undefined' ? 'ORTC' : 'WebRTC';
}

export {
  enabled,
  getMediaEngine,
  PeerConnection,
};
