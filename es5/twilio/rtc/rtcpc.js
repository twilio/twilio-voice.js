"use strict";
// @ts-nocheck
// tslint:disable only-arrow-functions
/* global webkitRTCPeerConnection, mozRTCPeerConnection, mozRTCSessionDescription, mozRTCIceCandidate */
Object.defineProperty(exports, "__esModule", { value: true });
var log_1 = require("../log");
var util = require("../util");
var sdp_1 = require("./sdp");
function RTCPC(options) {
    this.log = new log_1.default('RTCPC');
    if (typeof window === 'undefined') {
        this.log.info('No RTCPeerConnection implementation available. The window object was not found.');
        return;
    }
    if (options && options.RTCPeerConnection) {
        this.RTCPeerConnection = options.RTCPeerConnection;
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
        var sdp = (0, sdp_1.setMaxAverageBitrate)(offer.sdp, maxAverageBitrate);
        return promisifySet(_this.pc.setLocalDescription, _this.pc)(new RTCSessionDescription({
            sdp: (0, sdp_1.setCodecPreferences)(sdp, codecPreferences),
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
        var sdp = (0, sdp_1.setMaxAverageBitrate)(answer.sdp, maxAverageBitrate);
        return promisifySet(_this.pc.setLocalDescription, _this.pc)(new RTCSessionDescription({
            sdp: (0, sdp_1.setCodecPreferences)(sdp, codecPreferences),
            type: 'answer',
        }));
    }).then(onSuccess, onError);
};
RTCPC.prototype.processSDP = function (maxAverageBitrate, codecPreferences, sdp, constraints, onSuccess, onError) {
    var _this = this;
    sdp = (0, sdp_1.setCodecPreferences)(sdp, codecPreferences);
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
    sdp = (0, sdp_1.setCodecPreferences)(sdp, codecPreferences);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnRjcGMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9ydGNwYy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsY0FBYztBQUNkLHNDQUFzQztBQUN0Qyx3R0FBd0c7O0FBRXhHLDhCQUF5QjtBQUN6Qiw4QkFBZ0M7QUFDaEMsNkJBQWtFO0FBRWxFLFNBQVMsS0FBSyxDQUFDLE9BQW9DO0lBQ2pELElBQUksQ0FBQyxHQUFHLEdBQUcsSUFBSSxhQUFHLENBQUMsT0FBTyxDQUFDLENBQUM7SUFFNUIsSUFBSSxPQUFPLE1BQU0sS0FBSyxXQUFXLEVBQUUsQ0FBQztRQUNsQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxpRkFBaUYsQ0FBQyxDQUFDO1FBQ2pHLE9BQU87SUFDVCxDQUFDO0lBRUQsSUFBSSxPQUFPLElBQUksT0FBTyxDQUFDLGlCQUFpQixFQUFFLENBQUM7UUFDekMsSUFBSSxDQUFDLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQztJQUNyRCxDQUFDO1NBQU0sSUFBSSxPQUFPLE1BQU0sQ0FBQyxpQkFBaUIsS0FBSyxVQUFVLEVBQUUsQ0FBQztRQUMxRCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsTUFBTSxDQUFDLGlCQUFpQixDQUFDO0lBQ3BELENBQUM7U0FBTSxJQUFJLE9BQU8sTUFBTSxDQUFDLHVCQUF1QixLQUFLLFVBQVUsRUFBRSxDQUFDO1FBQ2hFLElBQUksQ0FBQyxpQkFBaUIsR0FBRyx1QkFBdUIsQ0FBQztJQUNuRCxDQUFDO1NBQU0sSUFBSSxPQUFPLE1BQU0sQ0FBQyxvQkFBb0IsS0FBSyxVQUFVLEVBQUUsQ0FBQztRQUM3RCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsb0JBQW9CLENBQUM7UUFDOUMsTUFBTSxDQUFDLHFCQUFxQixHQUFHLHdCQUF3QixDQUFDO1FBQ3hELE1BQU0sQ0FBQyxlQUFlLEdBQUcsa0JBQWtCLENBQUM7SUFDOUMsQ0FBQztTQUFN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