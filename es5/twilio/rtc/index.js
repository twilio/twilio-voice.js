"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
var peerconnection_1 = require("./peerconnection");
exports.PeerConnection = peerconnection_1.default;
var rtcpc_1 = require("./rtcpc");
function enabled() {
    return rtcpc_1.default.test();
}
exports.enabled = enabled;
function getMediaEngine() {
    return typeof RTCIceGatherer !== 'undefined' ? 'ORTC' : 'WebRTC';
}
exports.getMediaEngine = getMediaEngine;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7O0dBSUc7QUFDSCxjQUFjO0FBQ2QsbURBQThDO0FBYzVDLHlCQWRLLHdCQUFjLENBY0w7QUFiaEIsaUNBQTRCO0FBRTVCLFNBQVMsT0FBTztJQUNkLE9BQU8sZUFBSyxDQUFDLElBQUksRUFBRSxDQUFDO0FBQ3RCLENBQUM7QUFPQywwQkFBTztBQUxULFNBQVMsY0FBYztJQUNyQixPQUFPLE9BQU8sY0FBYyxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUM7QUFDbkUsQ0FBQztBQUlDLHdDQUFjIn0=