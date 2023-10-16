/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
import PeerConnection from './peerconnection';
import RTCPC from './rtcpc';
function enabled() {
    return RTCPC.test();
}
function getMediaEngine() {
    return typeof RTCIceGatherer !== 'undefined' ? 'ORTC' : 'WebRTC';
}
export { enabled, getMediaEngine, PeerConnection, };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7OztHQUlHO0FBQ0gsY0FBYztBQUNkLE9BQU8sY0FBYyxNQUFNLGtCQUFrQixDQUFDO0FBQzlDLE9BQU8sS0FBSyxNQUFNLFNBQVMsQ0FBQztBQUU1QixTQUFTLE9BQU87SUFDZCxPQUFPLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUN0QixDQUFDO0FBRUQsU0FBUyxjQUFjO0lBQ3JCLE9BQU8sT0FBTyxjQUFjLEtBQUssV0FBVyxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUNuRSxDQUFDO0FBRUQsT0FBTyxFQUNMLE9BQU8sRUFDUCxjQUFjLEVBQ2QsY0FBYyxHQUNmLENBQUMifQ==