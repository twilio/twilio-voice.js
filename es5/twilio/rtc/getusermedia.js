'use strict';

var _typeof = typeof Symbol === "function" && typeof Symbol.iterator === "symbol" ? function (obj) { return typeof obj; } : function (obj) { return obj && typeof Symbol === "function" && obj.constructor === Symbol && obj !== Symbol.prototype ? "symbol" : typeof obj; };

var NotSupportedError = require('../errors').NotSupportedError;
var util = require('../util');

function getUserMedia(constraints, options) {
  options = options || {};
  options.util = options.util || util;
  options.navigator = options.navigator || (typeof navigator !== 'undefined' ? navigator : null);

  return new Promise(function (resolve, reject) {
    if (!options.navigator) {
      throw new NotSupportedError('getUserMedia is not supported');
    }

    switch ('function') {
      case _typeof(options.navigator.mediaDevices && options.navigator.mediaDevices.getUserMedia):
        return resolve(options.navigator.mediaDevices.getUserMedia(constraints));
      case _typeof(options.navigator.webkitGetUserMedia):
        return options.navigator.webkitGetUserMedia(constraints, resolve, reject);
      case _typeof(options.navigator.mozGetUserMedia):
        return options.navigator.mozGetUserMedia(constraints, resolve, reject);
      case _typeof(options.navigator.getUserMedia):
        return options.navigator.getUserMedia(constraints, resolve, reject);
      default:
        throw new NotSupportedError('getUserMedia is not supported');
    }
  }).catch(function (e) {
    throw options.util.isFirefox() && e.name === 'NotReadableError' ? new NotSupportedError('Firefox does not currently support opening multiple audio input tracks' + 'simultaneously, even across different tabs.\n' + 'Related Bugzilla thread: https://bugzilla.mozilla.org/show_bug.cgi?id=1299324') : e;
  });
}

module.exports = getUserMedia;