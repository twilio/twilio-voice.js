"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeerConnection = void 0;
exports.enabled = enabled;
exports.getMediaEngine = getMediaEngine;
// @ts-nocheck
var peerconnection_1 = require("./peerconnection");
exports.PeerConnection = peerconnection_1.default;
var rtcpc_1 = require("./rtcpc");
function enabled() {
    return rtcpc_1.default.test();
}
function getMediaEngine() {
    return typeof RTCIceGatherer !== 'undefined' ? 'ORTC' : 'WebRTC';
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFhRSwwQkFBTztBQUNQLHdDQUFjO0FBZGhCLGNBQWM7QUFDZCxtREFBOEM7QUFjNUMseUJBZEssd0JBQWMsQ0FjTDtBQWJoQixpQ0FBNEI7QUFFNUIsU0FBUyxPQUFPO0lBQ2QsT0FBTyxlQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDdEIsQ0FBQztBQUVELFNBQVMsY0FBYztJQUNyQixPQUFPLE9BQU8sY0FBYyxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7QUFDbkUsQ0FBQyJ9