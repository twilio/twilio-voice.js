"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PeerConnection = exports.getMediaEngine = exports.enabled = void 0;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaW5kZXguanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9pbmRleC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFBQTs7OztHQUlHO0FBQ0gsY0FBYztBQUNkLG1EQUE4QztBQWM1Qyx5QkFkSyx3QkFBYyxDQWNMO0FBYmhCLGlDQUE0QjtBQUU1QixTQUFTLE9BQU87SUFDZCxPQUFPLGVBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUN0QixDQUFDO0FBT0MsMEJBQU87QUFMVCxTQUFTLGNBQWM7SUFDckIsT0FBTyxPQUFPLGNBQWMsS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsUUFBUSxDQUFDO0FBQ25FLENBQUM7QUFJQyx3Q0FBYyJ9