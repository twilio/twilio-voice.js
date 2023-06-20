"use strict";
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
var eventtarget_1 = require("./eventtarget");
var POLL_INTERVAL_MS = 500;
var nativeMediaDevices = null;
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
var MediaDevicesShim = /** @class */ (function (_super) {
    __extends(MediaDevicesShim, _super);
    function MediaDevicesShim() {
        var _this = _super.call(this) || this;
        _this._defineEventHandler('devicechange');
        _this._defineEventHandler('deviceinfochange');
        var knownDevices = [];
        Object.defineProperties(_this, {
            _deviceChangeIsNative: { value: reemitNativeEvent(_this, 'devicechange') },
            _deviceInfoChangeIsNative: { value: reemitNativeEvent(_this, 'deviceinfochange') },
            _knownDevices: { value: knownDevices },
            _pollInterval: {
                value: null,
                writable: true,
            },
        });
        if (typeof nativeMediaDevices.enumerateDevices === 'function') {
            nativeMediaDevices.enumerateDevices().then(function (devices) {
                devices.sort(sortDevicesById).forEach(function (d) { return knownDevices.push(d); });
            });
        }
        _this._eventEmitter.on('newListener', function maybeStartPolling(eventName) {
            if (eventName !== 'devicechange' && eventName !== 'deviceinfochange') {
                return;
            }
            // TODO: Remove polling in the next major release.
            this._pollInterval = this._pollInterval
                || setInterval(sampleDevices.bind(null, this), POLL_INTERVAL_MS);
        }.bind(_this));
        _this._eventEmitter.on('removeListener', function maybeStopPolling() {
            if (this._pollInterval && !hasChangeListeners(this)) {
                clearInterval(this._pollInterval);
                this._pollInterval = null;
            }
        }.bind(_this));
        return _this;
    }
    return MediaDevicesShim;
}(eventtarget_1.default));
MediaDevicesShim.prototype.enumerateDevices = function enumerateDevices() {
    if (nativeMediaDevices && typeof nativeMediaDevices.enumerateDevices === 'function') {
        return nativeMediaDevices.enumerateDevices.apply(nativeMediaDevices, arguments);
    }
    return null;
};
MediaDevicesShim.prototype.getUserMedia = function getUserMedia() {
    return nativeMediaDevices.getUserMedia.apply(nativeMediaDevices, arguments);
};
function deviceInfosHaveChanged(newDevices, oldDevices) {
    newDevices = newDevices.filter(function (d) { return d.kind === 'audioinput' || d.kind === 'audiooutput'; });
    oldDevices = oldDevices.filter(function (d) { return d.kind === 'audioinput' || d.kind === 'audiooutput'; });
    // On certain browsers, we cannot use deviceId as a key for comparison.
    // It's missing along with the device label if the customer has not granted permission.
    // The following checks whether some old devices have empty labels and if they are now available.
    // This means, the user has granted permissions and the device info have changed.
    if (oldDevices.some(function (d) { return !d.deviceId; }) &&
        newDevices.some(function (d) { return !!d.deviceId; })) {
        return true;
    }
    // Use both deviceId and "kind" to create a unique key
    // since deviceId is not unique across different kinds of devices.
    var oldLabels = oldDevices.reduce(function (map, device) {
        return map.set(device.deviceId + "-" + device.kind, device.label);
    }, new Map());
    return newDevices.some(function (device) {
        var oldLabel = oldLabels.get(device.deviceId + "-" + device.kind);
        return typeof oldLabel !== 'undefined' && oldLabel !== device.label;
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
var getMediaDevicesInstance = function () {
    nativeMediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
    return nativeMediaDevices ? new MediaDevicesShim() : null;
};
exports.default = getMediaDevicesInstance;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVkaWFkZXZpY2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9zaGltcy9tZWRpYWRldmljZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7QUFDSCxjQUFjOzs7Ozs7Ozs7Ozs7Ozs7QUFFZCw2Q0FBd0M7QUFFeEMsSUFBTSxnQkFBZ0IsR0FBRyxHQUFHLENBQUM7QUFFN0IsSUFBSSxrQkFBa0IsR0FBRyxJQUFJLENBQUM7QUFFOUI7Ozs7Ozs7OztHQVNHO0FBQ0g7SUFBK0Isb0NBQVc7SUFDeEM7UUFBQSxZQUNFLGlCQUFPLFNBc0NSO1FBcENDLEtBQUksQ0FBQyxtQkFBbUIsQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUN6QyxLQUFJLENBQUMsbUJBQW1CLENBQUMsa0JBQWtCLENBQUMsQ0FBQztRQUU3QyxJQUFNLFlBQVksR0FBRyxFQUFFLENBQUM7UUFDeEIsTUFBTSxDQUFDLGdCQUFnQixDQUFDLEtBQUksRUFBRTtZQUM1QixxQkFBcUIsRUFBRSxFQUFFLEtBQUssRUFBRSxpQkFBaUIsQ0FBQyxLQUFJLEVBQUUsY0FBYyxDQUFDLEVBQUU7WUFDekUseUJBQXlCLEVBQUUsRUFBRSxLQUFLLEVBQUUsaUJBQWlCLENBQUMsS0FBSSxFQUFFLGtCQUFrQixDQUFDLEVBQUU7WUFDakYsYUFBYSxFQUFFLEVBQUUsS0FBSyxFQUFFLFlBQVksRUFBRTtZQUN0QyxhQUFhLEVBQUU7Z0JBQ2IsS0FBSyxFQUFFLElBQUk7Z0JBQ1gsUUFBUSxFQUFFLElBQUk7YUFDZjtTQUNGLENBQUMsQ0FBQztRQUVILElBQUksT0FBTyxrQkFBa0IsQ0FBQyxnQkFBZ0IsS0FBSyxVQUFVLEVBQUU7WUFDN0Qsa0JBQWtCLENBQUMsZ0JBQWdCLEVBQUUsQ0FBQyxJQUFJLENBQUMsVUFBQSxPQUFPO2dCQUNoRCxPQUFPLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFBLENBQUMsSUFB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