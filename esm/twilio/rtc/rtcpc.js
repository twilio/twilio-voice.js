// @ts-nocheck
// tslint:disable only-arrow-functions
/* global webkitRTCPeerConnection, mozRTCPeerConnection, mozRTCSessionDescription, mozRTCIceCandidate */
import Log from '../log';
import * as util from '../util';
import { setCodecPreferences, setMaxAverageBitrate } from './sdp';
const RTCPeerConnectionShim = require('rtcpeerconnection-shim');
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
    this.log = new Log('RTCPC');
    this.pc = new this.RTCPeerConnection(rtcConfiguration);
};
RTCPC.prototype.createModernConstraints = c => {
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
    const nc = Object.assign({}, c);
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
    constraints = this.createModernConstraints(constraints);
    return promisifyCreate(this.pc.createOffer, this.pc)(constraints).then(offer => {
        if (!this.pc) {
            return Promise.resolve();
        }
        const sdp = setMaxAverageBitrate(offer.sdp, maxAverageBitrate);
        return promisifySet(this.pc.setLocalDescription, this.pc)(new RTCSessionDescription({
            sdp: setCodecPreferences(sdp, codecPreferences),
            type: 'offer',
        }));
    }).then(onSuccess, onError);
};
RTCPC.prototype.createAnswer = function (maxAverageBitrate, codecPreferences, constraints, onSuccess, onError) {
    constraints = this.createModernConstraints(constraints);
    return promisifyCreate(this.pc.createAnswer, this.pc)(constraints).then(answer => {
        if (!this.pc) {
            return Promise.resolve();
        }
        const sdp = setMaxAverageBitrate(answer.sdp, maxAverageBitrate);
        return promisifySet(this.pc.setLocalDescription, this.pc)(new RTCSessionDescription({
            sdp: setCodecPreferences(sdp, codecPreferences),
            type: 'answer',
        }));
    }).then(onSuccess, onError);
};
RTCPC.prototype.processSDP = function (maxAverageBitrate, codecPreferences, sdp, constraints, onSuccess, onError) {
    sdp = setCodecPreferences(sdp, codecPreferences);
    const desc = new RTCSessionDescription({ sdp, type: 'offer' });
    return promisifySet(this.pc.setRemoteDescription, this.pc)(desc).then(() => {
        this.createAnswer(maxAverageBitrate, codecPreferences, constraints, onSuccess, onError);
    });
};
RTCPC.prototype.getSDP = function () {
    return this.pc.localDescription.sdp;
};
RTCPC.prototype.processAnswer = function (codecPreferences, sdp, onSuccess, onError) {
    if (!this.pc) {
        return Promise.resolve();
    }
    sdp = setCodecPreferences(sdp, codecPreferences);
    return promisifySet(this.pc.setRemoteDescription, this.pc)(new RTCSessionDescription({ sdp, type: 'answer' })).then(onSuccess, onError);
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
RTCPC.test = () => {
    if (typeof navigator === 'object') {
        const getUserMedia = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
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
                const test = new window.mozRTCPeerConnection();
                if (typeof test.getLocalStreams !== 'function') {
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
        const args = Array.prototype.slice.call(arguments);
        return new Promise(resolve => {
            const returnValue = fn.apply(ctx, args);
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
        }).catch(() => new Promise((resolve, reject) => {
            fn.apply(ctx, areCallbacksFirst
                ? [resolve, reject].concat(args)
                : args.concat([resolve, reject]));
        }));
    };
}
function promisifyCreate(fn, ctx) {
    return promisify(fn, ctx, true, true);
}
function promisifySet(fn, ctx) {
    return promisify(fn, ctx, false, false);
}
export default RTCPC;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnRjcGMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9ydGNwYy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxjQUFjO0FBQ2Qsc0NBQXNDO0FBQ3RDLHdHQUF3RztBQUV4RyxPQUFPLEdBQUcsTUFBTSxRQUFRLENBQUM7QUFDekIsT0FBTyxLQUFLLElBQUksTUFBTSxTQUFTLENBQUM7QUFDaEMsT0FBTyxFQUFFLG1CQUFtQixFQUFFLG9CQUFvQixFQUFFLE1BQU0sT0FBTyxDQUFDO0FBRWxFLE1BQU0scUJBQXFCLEdBQUcsT0FBTyxDQUFDLHdCQUF3QixDQUFDLENBQUM7QUFFaEUsU0FBUyxLQUFLLENBQUMsT0FBTztJQUNwQixJQUFJLE9BQU8sTUFBTSxLQUFLLFdBQVcsRUFBRSxDQUFDO1FBQ2xDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLGlGQUFpRixDQUFDLENBQUM7UUFDakcsT0FBTztJQUNULENBQUM7SUFFRCxJQUFJLE9BQU8sSUFBSSxPQUFPLENBQUMsaUJBQWlCLEVBQUUsQ0FBQztRQUN6QyxJQUFJLENBQUMsaUJBQWlCLEdBQUcsT0FBTyxDQUFDLGlCQUFpQixDQUFDO0lBQ3JELENBQUM7U0FBTSxJQUFJLElBQUksQ0FBQyxZQUFZLEVBQUUsRUFBRSxDQUFDO1FBQy9CLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLHFCQUFxQixDQUFDLE9BQU8sTUFBTSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztJQUN0RyxDQUFDO1NBQU0sSUFBSSxPQUFPLE1BQU0sQ0FBQyxpQkFBaUIsS0FBSyxVQUFVLEVBQUUsQ0FBQztRQUMxRCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsTUFBTSxDQUFDLGlCQUFpQixDQUFDO0lBQ3BELENBQUM7U0FBTSxJQUFJLE9BQU8sTUFBTSxDQUFDLHVCQUF1QixLQUFLLFVBQVUsRUFBRSxD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