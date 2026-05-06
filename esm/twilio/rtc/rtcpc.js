import Log from '../log.js';
import { isLegacyEdge } from '../util.js';
import { setMaxAverageBitrate, setCodecPreferences } from './sdp.js';

// @ts-nocheck
// tslint:disable only-arrow-functions
/* global webkitRTCPeerConnection, mozRTCPeerConnection, mozRTCSessionDescription, mozRTCIceCandidate */
function RTCPC(options) {
    this.log = new Log('RTCPC');
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
    if (typeof webkitRTCPeerConnection !== 'undefined' && !isLegacyEdge()) {
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
    constraints = this.createModernConstraints(constraints);
    return promisifyCreate(this.pc.createOffer, this.pc)(constraints).then(offer => {
        if (!this.pc) {
            return Promise.resolve();
        }
        const sdp = setMaxAverageBitrate(offer.sdp, maxAverageBitrate);
        return promisifySet(this.pc.setLocalDescription, this.pc)(new RTCSessionDescription({
            sdp,
            type: 'offer',
        }));
    }).then(onSuccess, onError);
};
RTCPC.prototype.createAnswer = function (maxAverageBitrate, constraints, onSuccess, onError) {
    constraints = this.createModernConstraints(constraints);
    return promisifyCreate(this.pc.createAnswer, this.pc)(constraints).then(answer => {
        if (!this.pc) {
            return Promise.resolve();
        }
        const sdp = setMaxAverageBitrate(answer.sdp, maxAverageBitrate);
        return promisifySet(this.pc.setLocalDescription, this.pc)(new RTCSessionDescription({
            sdp,
            type: 'answer',
        }));
    }).then(onSuccess, onError);
};
RTCPC.prototype.processSDP = function (maxAverageBitrate, codecPreferences, sdp, constraints, onSuccess, onError) {
    sdp = setCodecPreferences(sdp, codecPreferences);
    const desc = new RTCSessionDescription({ sdp, type: 'offer' });
    return promisifySet(this.pc.setRemoteDescription, this.pc)(desc).then(() => {
        this.createAnswer(maxAverageBitrate, constraints, onSuccess, onError);
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
        if (isLegacyEdge(navigator)) {
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

export { RTCPC as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicnRjcGMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vcnRjL3J0Y3BjLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbInV0aWwuaXNMZWdhY3lFZGdlIl0sIm1hcHBpbmdzIjoiOzs7O0FBQUE7QUFDQTtBQUNBO0FBTUEsU0FBUyxLQUFLLENBQUMsT0FBb0MsRUFBQTtJQUNqRCxJQUFJLENBQUMsR0FBRyxHQUFHLElBQUksR0FBRyxDQUFDLE9BQU8sQ0FBQztBQUUzQixJQUFBLElBQUksT0FBTyxNQUFNLEtBQUssV0FBVyxFQUFFO0FBQ2pDLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsaUZBQWlGLENBQUM7UUFDaEc7SUFDRjtBQUVBLElBQUEsSUFBSSxPQUFPLElBQUksT0FBTyxDQUFDLGlCQUFpQixFQUFFO0FBQ3hDLFFBQUEsSUFBSSxDQUFDLGlCQUFpQixHQUFHLE9BQU8sQ0FBQyxpQkFBaUI7SUFDcEQ7QUFBTyxTQUFBLElBQUksT0FBTyxNQUFNLENBQUMsaUJBQWlCLEtBQUssVUFBVSxFQUFFO0FBQ3pELFFBQUEsSUFBSSxDQUFDLGlCQUFpQixHQUFHLE1BQU0sQ0FBQyxpQkFBaUI7SUFDbkQ7QUFBTyxTQUFBLElBQUksT0FBTyxNQUFNLENBQUMsdUJBQXVCLEtBQUssVUFBVSxFQUFFO0FBQy9ELFFBQUEsSUFBSSxDQUFDLGlCQUFpQixHQUFHLHVCQUF1QjtJQUNsRDtBQUFPLFNBQUEsSUFBSSxPQUFPLE1BQU0sQ0FBQyxvQkFBb0IsS0FBSyxVQUFVLEVBQUU7QUFDNUQsUUFBQSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsb0JBQW9CO0FBQzdDLFFBQUEsTUFBTSxDQUFDLHFCQUFxQixHQUFHLHdCQUF3QjtBQUN2RCxRQUFBLE1BQU0sQ0FBQyxlQUFlLEdBQUcsa0JBQWtCO0lBQzdDO1NBQU87QUFDTCxRQUFBLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLCtDQUErQyxDQUFDO0lBQ2hFO0FB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
