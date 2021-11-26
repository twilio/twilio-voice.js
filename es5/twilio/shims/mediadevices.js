var EventTarget = require('./eventtarget');
var inherits = require('util').inherits;
var POLL_INTERVAL_MS = 500;
var nativeMediaDevices = typeof navigator !== 'undefined' && navigator.mediaDevices;
/**
 * Make a custom MediaDevices object, and proxy through existing functionality. If
 *   devicechange is present, we simply reemit the event. If not, we will do the
 *   detection ourselves and fire the event when necessary. The same logic exists
 *   for deviceinfochange for consistency, however deviceinfochange is our own event
 *   so it is unlikely that it will ever be native. The w3c spec for devicechange
 *   is unclear as to whether MediaDeviceInfo changes (such as label) will
 *   trigger the devicechange event. We have an open question on this here:
 *   https://bugs.chromium.org/p/chromium/issues/detail?id=585096
 */
function MediaDevicesShim() {
    EventTarget.call(this);
    this._defineEventHandler('devicechange');
    this._defineEventHandler('deviceinfochange');
    var knownDevices = [];
    Object.defineProperties(this, {
        _deviceChangeIsNative: {
            value: reemitNativeEvent(this, 'devicechange')
        },
        _deviceInfoChangeIsNative: {
            value: reemitNativeEvent(this, 'deviceinfochange')
        },
        _knownDevices: {
            value: knownDevices
        },
        _pollInterval: {
            value: null,
            writable: true
        }
    });
    if (typeof nativeMediaDevices.enumerateDevices === 'function') {
        nativeMediaDevices.enumerateDevices().then(function (devices) {
            devices.sort(sortDevicesById).forEach([].push, knownDevices);
        });
    }
    this._eventEmitter.on('newListener', function maybeStartPolling(eventName) {
        if (eventName !== 'devicechange' && eventName !== 'deviceinfochange') {
            return;
        }
        this._pollInterval = this._pollInterval
            || setInterval(sampleDevices.bind(null, this), POLL_INTERVAL_MS);
    }.bind(this));
    this._eventEmitter.on('removeListener', function maybeStopPolling() {
        if (this._pollInterval && !hasChangeListeners(this)) {
            clearInterval(this._pollInterval);
            this._pollInterval = null;
        }
    }.bind(this));
}
inherits(MediaDevicesShim, EventTarget);
if (nativeMediaDevices && typeof nativeMediaDevices.enumerateDevices === 'function') {
    MediaDevicesShim.prototype.enumerateDevices = function enumerateDevices() {
        return nativeMediaDevices.enumerateDevices.apply(nativeMediaDevices, arguments);
    };
}
MediaDevicesShim.prototype.getUserMedia = function getUserMedia() {
    return nativeMediaDevices.getUserMedia.apply(nativeMediaDevices, arguments);
};
function deviceInfosHaveChanged(newDevices, oldDevices) {
    var oldLabels = oldDevices.reduce(function (map, device) { return map.set(device.deviceId, device.label || null); }, new Map());
    return newDevices.some(function (newDevice) {
        var oldLabel = oldLabels.get(newDevice.deviceId);
        return typeof oldLabel !== 'undefined' && oldLabel !== newDevice.label;
    });
}
function devicesHaveChanged(newDevices, oldDevices) {
    return newDevices.length !== oldDevices.length
        || propertyHasChanged('deviceId', newDevices, oldDevices);
}
function hasChangeListeners(mediaDevices) {
    return ['devicechange', 'deviceinfochange'].reduce(function (count, event) { return count + mediaDevices._eventEmitter.listenerCount(event); }, 0) > 0;
}
/**
 * Sample the current set of devices and emit devicechange event if a device has been
 *   added or removed, and deviceinfochange if a device's label has changed.
 * @param {MediaDevicesShim} mediaDevices
 * @private
 */
function sampleDevices(mediaDevices) {
    nativeMediaDevices.enumerateDevices().then(function (newDevices) {
        var knownDevices = mediaDevices._knownDevices;
        var oldDevices = knownDevices.slice();
        // Replace known devices in-place
        [].splice.apply(knownDevices, [0, knownDevices.length]
            .concat(newDevices.sort(sortDevicesById)));
        if (!mediaDevices._deviceChangeIsNative
            && devicesHaveChanged(knownDevices, oldDevices)) {
            mediaDevices.dispatchEvent(new Event('devicechange'));
        }
        if (!mediaDevices._deviceInfoChangeIsNative
            && deviceInfosHaveChanged(knownDevices, oldDevices)) {
            mediaDevices.dispatchEvent(new Event('deviceinfochange'));
        }
    });
}
/**
 * Accepts two sorted arrays and the name of a property to compare on objects from each.
 *   Arrays should also be of the same length.
 * @param {string} propertyName - Name of the property to compare on each object
 * @param {Array<Object>} as - The left-side array of objects to compare.
 * @param {Array<Object>} bs - The right-side array of objects to compare.
 * @private
 * @returns {boolean} True if the property of any object in array A is different than
 *   the same property of its corresponding object in array B.
 */
function propertyHasChanged(propertyName, as, bs) {
    return as.some(function (a, i) { return a[propertyName] !== bs[i][propertyName]; });
}
/**
 * Re-emit the native event, if the native mediaDevices has the corresponding property.
 * @param {MediaDevicesShim} mediaDevices
 * @param {string} eventName - Name of the event
 * @private
 * @returns {boolean} Whether the native mediaDevice had the corresponding property
 */
function reemitNativeEvent(mediaDevices, eventName) {
    var methodName = "on" + eventName;
    function dispatchEvent(event) {
        mediaDevices.dispatchEvent(event);
    }
    if (methodName in nativeMediaDevices) {
        // Use addEventListener if it's available so we don't stomp on any other listeners
        // for this event. Currently, navigator.mediaDevices.addEventListener does not exist in Safari.
        if ('addEventListener' in nativeMediaDevices) {
            nativeMediaDevices.addEventListener(eventName, dispatchEvent);
        }
        else {
            nativeMediaDevices[methodName] = dispatchEvent;
        }
        return true;
    }
    return false;
}
function sortDevicesById(a, b) {
    return a.deviceId < b.deviceId;
}
module.exports = (function shimMediaDevices() {
    return nativeMediaDevices ? new MediaDevicesShim() : null;
})();
//# sourceMappingURL=mediadevices.js.map