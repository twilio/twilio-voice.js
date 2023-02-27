"use strict";

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

var MediaDeviceInfoShim = function MediaDeviceInfoShim(options) {
  _classCallCheck(this, MediaDeviceInfoShim);

  Object.defineProperties(this, {
    deviceId: {
      get: function get() {
        return options.deviceId;
      }
    },
    groupId: {
      get: function get() {
        return options.groupId;
      }
    },
    kind: {
      get: function get() {
        return options.kind;
      }
    },
    label: {
      get: function get() {
        return options.label;
      }
    }
  });
};

module.exports = MediaDeviceInfoShim;