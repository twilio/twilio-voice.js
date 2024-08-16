/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnRjcGMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9ydGNwYy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7OztHQUlHO0FBQ0gsY0FBYztBQUNkLHNDQUFzQztBQUN0Qyx3R0FBd0c7QUFFeEcsT0FBTyxHQUFHLE1BQU0sUUFBUSxDQUFDO0FBQ3pCLE9BQU8sS0FBSyxJQUFJLE1BQU0sU0FBUyxDQUFDO0FBQ2hDLE9BQU8sRUFBRSxtQkFBbUIsRUFBRSxvQkFBb0IsRUFBRSxNQUFNLE9BQU8sQ0FBQztBQUVsRSxNQUFNLHFCQUFxQixHQUFHLE9BQU8sQ0FBQyx3QkFBd0IsQ0FBQyxDQUFDO0FBRWhFLFNBQVMsS0FBSyxDQUFDLE9BQU87SUFDcEIsSUFBSSxPQUFPLE1BQU0sS0FBSyxXQUFXLEVBQUU7UUFDakMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsaUZBQWlGLENBQUMsQ0FBQztRQUNqRyxPQUFPO0tBQ1I7SUFFRCxJQUFJLE9BQU8sSUFBSSxPQUFPLENBQUMsaUJBQWlCLEVBQUU7UUFDeEMsSUFBSSxDQUFDLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxpQkFBaUIsQ0FBQztLQUNwRDtTQUFNLElBQUksSUFBSSxDQUFDLFlBQVksRUFBRSxFQUFFO1FBQzlCLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxJQUFJLHFCQUFxQixDQUFDLE9BQU8sTUFBTSxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQztLQUNyRztTQUFNLElBQUksT0FBTyxNQUFNLENBQUMsaUJBQWlCLEtBQUssVUFBVSxFQUFFO1FBQ3pELElBQUksQ0FBQyxpQkFBaUIsR0FBRyxNQUFNLENBQUMsaUJBQWlCLENBQUM7S0FDbkQ7U0FBTSxJQUFJLE9BQU8sTUFBTSxDQUFDLHVCQUF1QixLQUFLLFVBQVUsRUFBRTtRQUMvRCxJQUFJLENBQUMsaUJBQWlCLEdBQUcs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