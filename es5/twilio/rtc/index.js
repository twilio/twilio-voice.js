'use strict';

var PeerConnection = require('./peerconnection');

var _require = require('./rtcpc'),
    test = _require.test;

function enabled() {
  return test();
}

function getMediaEngine() {
  return typeof RTCIceGatherer !== 'undefined' ? 'ORTC' : 'WebRTC';
}

module.exports = {
  enabled: enabled,
  getMediaEngine: getMediaEngine,
  PeerConnection: PeerConnection
};