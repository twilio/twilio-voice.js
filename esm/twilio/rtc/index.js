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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxjQUFjO0FBQ2QsT0FBTyxjQUFjLE1BQU0sa0JBQWtCLENBQUM7QUFDOUMsT0FBTyxLQUFLLE1BQU0sU0FBUyxDQUFDO0FBRTVCLFNBQVMsT0FBTztJQUNkLE9BQU8sS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO0FBQ3RCLENBQUM7QUFFRCxTQUFTLGNBQWM7SUFDckIsT0FBTyxPQUFPLGNBQWMsS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ25FLENBQUM7QUFFRCxPQUFPLEVBQ0wsT0FBTyxFQUNQLGNBQWMsRUFDZCxjQUFjLEdBQ2YsQ0FBQyJ9