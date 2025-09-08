'use strict';

var peerconnection = require('./peerconnection.js');
var rtcpc = require('./rtcpc.js');

// @ts-nocheck
function enabled() {
    return rtcpc.default.test();
}
function getMediaEngine() {
    return typeof RTCIceGatherer !== 'undefined' ? 'ORTC' : 'WebRTC';
}

exports.PeerConnection = peerconnection.default;
exports.enabled = enabled;
exports.getMediaEngine = getMediaEngine;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vcnRjL2luZGV4LnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIlJUQ1BDIl0sIm1hcHBpbmdzIjoiOzs7OztBQUFBO0FBSUEsU0FBUyxPQUFPLEdBQUE7QUFDZCxJQUFBLE9BQU9BLGFBQUssQ0FBQyxJQUFJLEVBQUU7QUFDckI7QUFFQSxTQUFTLGNBQWMsR0FBQTtBQUNyQixJQUFBLE9BQU8sT0FBTyxjQUFjLEtBQUssV0FBVyxHQUFHLE1BQU0sR0FBRyxRQUFRO0FBQ2xFOzs7Ozs7In0=
