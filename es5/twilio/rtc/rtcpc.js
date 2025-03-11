"use strict";
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
// tslint:disable only-arrow-functions
/* global webkitRTCPeerConnection, mozRTCPeerConnection, mozRTCSessionDescription, mozRTCIceCandidate */
Object.defineProperty(exports, "__esModule", { value: true });
var log_1 = require("../log");
var util = require("../util");
var sdp_1 = require("./sdp");
var RTCPeerConnectionShim = require('rtcpeerconnection-shim');
function RTCPC(options) {
    if (typeof window === 'undefined') {
        this.log.info('No RTCPeerConnection implementation available. The window object was not found.');
        return;
    }
    if (options && options.RTCPeerConnection) {
        this.RTCPeerConnection = options.RTCPeerConnection;
    }
    else if (util.isLegacyEdge()) {
        this.RTCPeerConnection = new RTCPeerConnectionShim(typeof window !== 'undefined' ? window : global);
    }
    else if (typeof window.RTCPeerConnection === 'function') {
        this.RTCPeerConnection = window.RTCPeerConnection;
    }
    else if (typeof window.webkitRTCPeerConnection === 'function') {
        this.RTCPeerConnection = webkitRTCPeerConnection;
    }
    else if (typeof window.mozRTCPeerConnection === 'function') {
        this.RTCPeerConnection = mozRTCPeerConnection;
        window.RTCSessionDescription = mozRTCSessionDescription;
        window.RTCIceCandidate = mozRTCIceCandidate;
    }
    else {
        this.log.info('No RTCPeerConnection implementation available');
    }
}
RTCPC.prototype.create = function (rtcConfiguration) {
    this.log = new log_1.default('RTCPC');
    this.pc = new this.RTCPeerConnection(rtcConfiguration);
};
RTCPC.prototype.createModernConstraints = function (c) {
    // createOffer differs between Chrome 23 and Chrome 24+.
    // See https://groups.google.com/forum/?fromgroups=#!topic/discuss-webrtc/JBDZtrMumyU
    // Unfortunately I haven't figured out a way to detect which format
    // is required ahead of time, so we'll first try the old way, and
    // if we get an exception, then we'll try the new way.
    if (typeof c === 'undefined') {
        return null;
    }
    // NOTE(mroberts): As of Chrome 38, Chrome still appears to expect
    // constraints under the 'mandatory' key, and with the first letter of each
    // constraint capitalized. Firefox, on the other hand, has deprecated the
    // 'mandatory' key and does not expect the first letter of each constraint
    // capitalized.
    var nc = Object.assign({}, c);
    if (typeof webkitRTCPeerConnection !== 'undefined' && !util.isLegacyEdge()) {
        nc.mandatory = {};
        if (typeof c.audio !== 'undefined') {
            nc.mandatory.OfferToReceiveAudio = c.audio;
        }
        if (typeof c.video !== 'undefined') {
            nc.mandatory.OfferToReceiveVideo = c.video;
        }
    }
    else {
        if (typeof c.audio !== 'undefined') {
            nc.offerToReceiveAudio = c.audio;
        }
        if (typeof c.video !== 'undefined') {
            nc.offerToReceiveVideo = c.video;
        }
    }
    delete nc.audio;
    delete nc.video;
    return nc;
};
RTCPC.prototype.createOffer = function (maxAverageBitrate, codecPreferences, constraints, onSuccess, onError) {
    var _this = this;
    constraints = this.createModernConstraints(constraints);
    return promisifyCreate(this.pc.createOffer, this.pc)(constraints).then(function (offer) {
        if (!_this.pc) {
            return Promise.resolve();
        }
        var sdp = sdp_1.setMaxAverageBitrate(offer.sdp, maxAverageBitrate);
        return promisifySet(_this.pc.setLocalDescription, _this.pc)(new RTCSessionDescription({
            sdp: sdp_1.setCodecPreferences(sdp, codecPreferences),
            type: 'offer',
        }));
    }).then(onSuccess, onError);
};
RTCPC.prototype.createAnswer = function (maxAverageBitrate, codecPreferences, constraints, onSuccess, onError) {
    var _this = this;
    constraints = this.createModernConstraints(constraints);
    return promisifyCreate(this.pc.createAnswer, this.pc)(constraints).then(function (answer) {
        if (!_this.pc) {
            return Promise.resolve();
        }
        var sdp = sdp_1.setMaxAverageBitrate(answer.sdp, maxAverageBitrate);
        return promisifySet(_this.pc.setLocalDescription, _this.pc)(new RTCSessionDescription({
            sdp: sdp_1.setCodecPreferences(sdp, codecPreferences),
            type: 'answer',
        }));
    }).then(onSuccess, onError);
};
RTCPC.prototype.processSDP = function (maxAverageBitrate, codecPreferences, sdp, constraints, onSuccess, onError) {
    var _this = this;
    sdp = sdp_1.setCodecPreferences(sdp, codecPreferences);
    var desc = new RTCSessionDescription({ sdp: sdp, type: 'offer' });
    return promisifySet(this.pc.setRemoteDescription, this.pc)(desc).then(function () {
        _this.createAnswer(maxAverageBitrate, codecPreferences, constraints, onSuccess, onError);
    });
};
RTCPC.prototype.getSDP = function () {
    return this.pc.localDescription.sdp;
};
RTCPC.prototype.processAnswer = function (codecPreferences, sdp, onSuccess, onError) {
    if (!this.pc) {
        return Promise.resolve();
    }
    sdp = sdp_1.setCodecPreferences(sdp, codecPreferences);
    return promisifySet(this.pc.setRemoteDescription, this.pc)(new RTCSessionDescription({ sdp: sdp, type: 'answer' })).then(onSuccess, onError);
};
/* NOTE(mroberts): Firefox 18 through 21 include a `mozRTCPeerConnection`
   object, but attempting to instantiate it will throw the error

       Error: PeerConnection not enabled (did you set the pref?)

   unless the `media.peerconnection.enabled` pref is enabled. So we need to test
   if we can actually instantiate `mozRTCPeerConnection`; however, if the user
   *has* enabled `media.peerconnection.enabled`, we need to perform the same
   test that we use to detect Firefox 24 and above, namely:

       typeof (new mozRTCPeerConnection()).getLocalStreams === 'function'

    NOTE(rrowland): We no longer support Legacy Edge as of Sep 1, 2020.
*/
RTCPC.test = function () {
    if (typeof navigator === 'object') {
        var getUserMedia = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
            || navigator.webkitGetUserMedia
            || navigator.mozGetUserMedia
            || navigator.getUserMedia;
        if (util.isLegacyEdge(navigator)) {
            return false;
        }
        if (getUserMedia && typeof window.RTCPeerConnection === 'function') {
            return true;
        }
        else if (getUserMedia && typeof window.webkitRTCPeerConnection === 'function') {
            return true;
        }
        else if (getUserMedia && typeof window.mozRTCPeerConnection === 'function') {
            try {
                var test_1 = new window.mozRTCPeerConnection();
                if (typeof test_1.getLocalStreams !== 'function') {
                    return false;
                }
            }
            catch (e) {
                return false;
            }
            return true;
        }
        else if (typeof RTCIceGatherer !== 'undefined') {
            return true;
        }
    }
    return false;
};
function promisify(fn, ctx, areCallbacksFirst, checkRval) {
    return function () {
        var args = Array.prototype.slice.call(arguments);
        return new Promise(function (resolve) {
            var returnValue = fn.apply(ctx, args);
            if (!checkRval) {
                resolve(returnValue);
                return;
            }
            if (typeof returnValue === 'object' && typeof returnValue.then === 'function') {
                resolve(returnValue);
            }
            else {
                throw new Error();
            }
        }).catch(function () { return new Promise(function (resolve, reject) {
            fn.apply(ctx, areCallbacksFirst
                ? [resolve, reject].concat(args)
                : args.concat([resolve, reject]));
        }); });
    };
}
function promisifyCreate(fn, ctx) {
    return promisify(fn, ctx, true, true);
}
function promisifySet(fn, ctx) {
    return promisify(fn, ctx, false, false);
}
exports.default = RTCPC;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnRjcGMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9ydGNwYy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7R0FJRztBQUNILGNBQWM7QUFDZCxzQ0FBc0M7QUFDdEMsd0dBQXdHOztBQUV4Ryw4QkFBeUI7QUFDekIsOEJBQWdDO0FBQ2hDLDZCQUFrRTtBQUVsRSxJQUFNLHFCQUFxQixHQUFHLE9BQU8sQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO0FBRWhFLFNBQVMsS0FBSyxDQUFDLE9BQU87SUFDcEIsSUFBSSxPQUFPLE1BQU0sS0FBSyxXQUFXLEVBQUU7UUFDakMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsaUZBQWlGLENBQUMsQ0FBQztRQUNqRyxPQUFPO0tBQ1I7SUFFRCxJQUFJLE9BQU8sSUFBSSxPQUFPLENBQUMsaUJBQWlCLEVBQUU7UUFDeEMsSUFBSSxDQUFDLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQztLQUNwRDtTQUFNLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRSxFQUFFO1FBQzlCLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLHFCQUFxQixDQUFDLE9BQU8sTUFBTSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUNyRztTQUFNLElBQUksT0FBTyxNQUFNLENBQUMsaUJBQWlCLEtBQUssVUFBVSxFQUFFO1FBQ3pELElBQUksQ0FBQyxpQkFBaUIsR0FBRyxNQUFNLENBQUMsaUJBQWlCLENBQUM7S0FDbkQ7U0FBTSxJQUFJLE9BQU8sTUFBTSxDQUFDLHVCQUF1QixLQUFLLFVBQVUsRUFBRTtRQUMvRCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsdUJBQXVCLENBQUM7S0FDbEQ7U0FBTSxJQUFJLE9BQU8sTUFBTSxDQUFDLG9CQUFvQixLQUFLLFVBQVUsRUFBRTtRQUM1RCxJQUFJLENBQUMs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