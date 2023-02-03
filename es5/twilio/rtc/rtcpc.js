'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

/* global webkitRTCPeerConnection, mozRTCPeerConnection, mozRTCSessionDescription, mozRTCIceCandidate */
var RTCPeerConnectionShim = require('rtcpeerconnection-shim');
var Log = require('../log').default;

var _require = require('./sdp'),
    setCodecPreferences = _require.setCodecPreferences,
    setMaxAverageBitrate = _require.setMaxAverageBitrate;

var util = require('../util');

function RTCPC() {
  if (typeof window === 'undefined') {
    this.log.info('No RTCPeerConnection implementation available. The window object was not found.');
    return;
  }

  if (util.isLegacyEdge()) {
    this.RTCPeerConnection = new RTCPeerConnectionShim(typeof window !== 'undefined' ? window : global);
  } else if (typeof window.RTCPeerConnection === 'function') {
    this.RTCPeerConnection = window.RTCPeerConnection;
  } else if (typeof window.webkitRTCPeerConnection === 'function') {
    this.RTCPeerConnection = webkitRTCPeerConnection;
  } else if (typeof window.mozRTCPeerConnection === 'function') {
    this.RTCPeerConnection = mozRTCPeerConnection;
    window.RTCSessionDescription = mozRTCSessionDescription;
    window.RTCIceCandidate = mozRTCIceCandidate;
  } else {
    this.log.info('No RTCPeerConnection implementation available');
  }
}

RTCPC.prototype.create = function (rtcConstraints, rtcConfiguration) {
  this.log = Log.getInstance();
  this.pc = new this.RTCPeerConnection(rtcConfiguration, rtcConstraints);
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
  } else {
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

    var sdp = setMaxAverageBitrate(offer.sdp, maxAverageBitrate);

    return promisifySet(_this.pc.setLocalDescription, _this.pc)(new RTCSessionDescription({
      type: 'offer',
      sdp: setCodecPreferences(sdp, codecPreferences)
    }));
  }).then(onSuccess, onError);
};
RTCPC.prototype.createAnswer = function (maxAverageBitrate, codecPreferences, constraints, onSuccess, onError) {
  var _this2 = this;

  constraints = this.createModernConstraints(constraints);
  return promisifyCreate(this.pc.createAnswer, this.pc)(constraints).then(function (answer) {
    if (!_this2.pc) {
      return Promise.resolve();
    }
    var sdp = setMaxAverageBitrate(answer.sdp, maxAverageBitrate);

    return promisifySet(_this2.pc.setLocalDescription, _this2.pc)(new RTCSessionDescription({
      type: 'answer',
      sdp: setCodecPreferences(sdp, codecPreferences)
    }));
  }).then(onSuccess, onError);
};
RTCPC.prototype.processSDP = function (maxAverageBitrate, codecPreferences, sdp, constraints, onSuccess, onError) {
  var _this3 = this;

  sdp = setCodecPreferences(sdp, codecPreferences);
  var desc = new RTCSessionDescription({ sdp: sdp, type: 'offer' });
  return promisifySet(this.pc.setRemoteDescription, this.pc)(desc).then(function () {
    _this3.createAnswer(maxAverageBitrate, codecPreferences, constraints, onSuccess, onError);
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
  if ((typeof navigator === 'undefined' ? 'undefined' : _typeof(navigator)) === 'object') {
    var getUserMedia = navigator.mediaDevices && navigator.mediaDevices.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.getUserMedia;

    if (util.isLegacyEdge(navigator)) {
      return false;
    }

    if (getUserMedia && typeof window.RTCPeerConnection === 'function') {
      return true;
    } else if (getUserMedia && typeof window.webkitRTCPeerConnection === 'function') {
      return true;
    } else if (getUserMedia && typeof window.mozRTCPeerConnection === 'function') {
      try {
        // eslint-disable-next-line babel/new-cap
        var test = new window.mozRTCPeerConnection();
        if (typeof test.getLocalStreams !== 'function') return false;
      } catch (e) {
        return false;
      }
      return true;
    } else if (typeof RTCIceGatherer !== 'undefined') {
      return true;
    }
  }

  return false;
};

function promisify(fn, ctx, areCallbacksFirst) {
  return function () {
    var args = Array.prototype.slice.call(arguments);

    return new Promise(function (resolve) {
      resolve(fn.apply(ctx, args));
    }).catch(function () {
      return new Promise(function (resolve, reject) {
        fn.apply(ctx, areCallbacksFirst ? [resolve, reject].concat(args) : args.concat([resolve, reject]));
      });
    });
  };
}

function promisifyCreate(fn, ctx) {
  return promisify(fn, ctx, true);
}

function promisifySet(fn, ctx) {
  return promisify(fn, ctx, false);
}

module.exports = RTCPC;