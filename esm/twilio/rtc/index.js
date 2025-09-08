export { default as PeerConnection } from './peerconnection.js';
import RTCPC from './rtcpc.js';

// @ts-nocheck
function enabled() {
    return RTCPC.test();
}
function getMediaEngine() {
    return typeof RTCIceGatherer !== 'undefined' ? 'ORTC' : 'WebRTC';
}

export { enabled, getMediaEngine };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vcnRjL2luZGV4LnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBO0FBSUEsU0FBUyxPQUFPLEdBQUE7QUFDZCxJQUFBLE9BQU8sS0FBSyxDQUFDLElBQUksRUFBRTtBQUNyQjtBQUVBLFNBQVMsY0FBYyxHQUFBO0FBQ3JCLElBQUEsT0FBTyxPQUFPLGNBQWMsS0FBSyxXQUFXLEdBQUcsTUFBTSxHQUFHLFFBQVE7QUFDbEU7Ozs7In0=
