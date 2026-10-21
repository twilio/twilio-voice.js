'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var log = require('../log.js');
var util = require('../util.js');
var sdp = require('./sdp.js');

// @ts-nocheck
// tslint:disable only-arrow-functions
/* global webkitRTCPeerConnection, mozRTCPeerConnection, mozRTCSessionDescription, mozRTCIceCandidate */
function RTCPC(options) {
    this.log = new log.default('RTCPC');
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
RTCPC.prototype.createOffer = function (maxAverageBitrate, constraints, onSuccess, onError) {
    var _this = this;
    constraints = this.createModernConstraints(constraints);
    return promisifyCreate(this.pc.createOffer, this.pc)(constraints).then(function (offer) {
        if (!_this.pc) {
            return Promise.resolve();
        }
        var sdp$1 = sdp.setMaxAverageBitrate(offer.sdp, maxAverageBitrate);
        return promisifySet(_this.pc.setLocalDescription, _this.pc)(new RTCSessionDescription({
            sdp: sdp$1,
            type: 'offer',
        }));
    }).then(onSuccess, onError);
};
RTCPC.prototype.createAnswer = function (maxAverageBitrate, constraints, onSuccess, onError) {
    var _this = this;
    constraints = this.createModernConstraints(constraints);
    return promisifyCreate(this.pc.createAnswer, this.pc)(constraints).then(function (answer) {
        if (!_this.pc) {
            return Promise.resolve();
        }
        var sdp$1 = sdp.setMaxAverageBitrate(answer.sdp, maxAverageBitrate);
        return promisifySet(_this.pc.setLocalDescription, _this.pc)(new RTCSessionDescription({
            sdp: sdp$1,
            type: 'answer',
        }));
    }).then(onSuccess, onError);
};
RTCPC.prototype.processSDP = function (maxAverageBitrate, codecPreferences, sdp$1, constraints, onSuccess, onError) {
    var _this = this;
    sdp$1 = sdp.setCodecPreferences(sdp$1, codecPreferences);
    var desc = new RTCSessionDescription({ sdp: sdp$1, type: 'offer' });
    return promisifySet(this.pc.setRemoteDescription, this.pc)(desc).then(function () {
        _this.createAnswer(maxAverageBitrate, constraints, onSuccess, onError);
    }, onError);
};
RTCPC.prototype.getSDP = function () {
    return this.pc.localDescription.sdp;
};
RTCPC.prototype.processAnswer = function (codecPreferences, sdp$1, onSuccess, onError) {
    if (!this.pc) {
        return Promise.resolve();
    }
    sdp$1 = sdp.setCodecPreferences(sdp$1, codecPreferences);
    return promisifySet(this.pc.setRemoteDescription, this.pc)(new RTCSessionDescription({ sdp: sdp$1, type: 'answer' })).then(onSuccess, onError);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnRjcGMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vcnRjL3J0Y3BjLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIkxvZyIsInV0aWwuaXNMZWdhY3lFZGdlIiwic2RwIiwic2V0TWF4QXZlcmFnZUJpdHJhdGUiLCJzZXRDb2RlY1ByZWZlcmVuY2VzIl0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQUFBO0FBQ0E7QUFDQTtBQU1BLFNBQVMsS0FBSyxDQUFDLE9BQW9DLEVBQUE7SUFDakQsSUFBSSxDQUFDLEdBQUcsR0FBRyxJQUFJQSxXQUFHLENBQUMsT0FBTyxDQUFDO0FBRTNCLElBQUEsSUFBSSxPQUFPLE1BQU0sS0FBSyxXQUFXLEVBQUU7QUFDakMsUUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxpRkFBaUYsQ0FBQztRQUNoRztJQUNGO0FBRUEsSUFBQSxJQUFJLE9BQU8sSUFBSSxPQUFPLENBQUMsaUJBQWlCLEVBQUU7QUFDeEMsUUFBQSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsT0FBTyxDQUFDLGlCQUFpQjtJQUNwRDtBQUFPLFNBQUEsSUFBSSxPQUFPLE1BQU0sQ0FBQyxpQkFBaUIsS0FBSyxVQUFVLEVBQUU7QUFDekQsUUFBQSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsTUFBTSxDQUFDLGlCQUFpQjtJQUNuRDtBQUFPLFNBQUEsSUFBSSxPQUFPLE1BQU0sQ0FBQyx1QkFBdUIsS0FBSyxVQUFVLEVBQUU7QUFDL0QsUUFBQSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsdUJBQXVCO0lBQ2xEO0FBQU8sU0FBQSxJQUFJLE9BQU8sTUFBTSxDQUFDLG9CQUFvQixLQUFLLFVBQVUsRUFBRTtBQUM1RCxRQUFBLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxvQkFBb0I7QUFDN0MsUUFBQSxNQUFNLENBQUMscUJBQXFCLEdBQUcsd0JBQXdCO0FBQ3ZELFFBQUEsTUFBTSxDQUFDLGVBQWUsR0FBRyxrQkFBa0I7SUFDN0M7U0FB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
