// @ts-nocheck
import PeerConnection from './peerconnection';
import RTCPC from './rtcpc';

function enabled() {
  return RTCPC.test();
}

function getMediaEngine() {
  return typeof RTCIceGatherer !== 'undefined' ? 'ORTC' : 'WebRTC';
}

export {
  enabled,
  getMediaEngine,
  PeerConnection,
};
