/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
import EventTarget from './eventtarget';
const POLL_INTERVAL_MS = 500;
let nativeMediaDevices = null;
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
class MediaDevicesShim extends EventTarget {
    constructor() {
        super();
        this._defineEventHandler('devicechange');
        this._defineEventHandler('deviceinfochange');
        const knownDevices = [];
        Object.defineProperties(this, {
            _deviceChangeIsNative: { value: reemitNativeEvent(this, 'devicechange') },
            _deviceInfoChangeIsNative: { value: reemitNativeEvent(this, 'deviceinfochange') },
            _knownDevices: { value: knownDevices },
            _pollInterval: {
                value: null,
                writable: true,
            },
        });
        if (typeof nativeMediaDevices.enumerateDevices === 'function') {
            nativeMediaDevices.enumerateDevices().then(devices => {
                devices.sort(sortDevicesById).forEach(d => knownDevices.push(d));
            });
        }
        this._eventEmitter.on('newListener', function maybeStartPolling(eventName) {
            if (eventName !== 'devicechange' && eventName !== 'deviceinfochange') {
                return;
            }
            // TODO: Remove polling in the next major release.
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
}
MediaDevicesShim.prototype.enumerateDevices = function enumerateDevices() {
    if (nativeMediaDevices && typeof nativeMediaDevices.enumerateDevices === 'function') {
        return nativeMediaDevices.enumerateDevices(...arguments);
    }
    return null;
};
MediaDevicesShim.prototype.getUserMedia = function getUserMedia() {
    return nativeMediaDevices.getUserMedia(...arguments);
};
function deviceInfosHaveChanged(newDevices, oldDevices) {
    newDevices = newDevices.filter(d => d.kind === 'audioinput' || d.kind === 'audiooutput');
    oldDevices = oldDevices.filter(d => d.kind === 'audioinput' || d.kind === 'audiooutput');
    // On certain browsers, we cannot use deviceId as a key for comparison.
    // It's missing along with the device label if the customer has not granted permission.
    // The following checks whether some old devices have empty labels and if they are now available.
    // This means, the user has granted permissions and the device info have changed.
    if (oldDevices.some(d => !d.deviceId) &&
        newDevices.some(d => !!d.deviceId)) {
        return true;
    }
    // Use both deviceId and "kind" to create a unique key
    // since deviceId is not unique across different kinds of devices.
    const oldLabels = oldDevices.reduce((map, device) => map.set(`${device.deviceId}-${device.kind}`, device.label), new Map());
    return newDevices.some(device => {
        const oldLabel = oldLabels.get(`${device.deviceId}-${device.kind}`);
        return typeof oldLabel !== 'undefined' && oldLabel !== device.label;
    });
}
function devicesHaveChanged(newDevices, oldDevices) {
    return newDevices.length !== oldDevices.length
        || propertyHasChanged('deviceId', newDevices, oldDevices);
}
function hasChangeListeners(mediaDevices) {
    return ['devicechange', 'deviceinfochange'].reduce((count, event) => count + mediaDevices._eventEmitter.listenerCount(event), 0) > 0;
}
/**
 * Sample the current set of devices and emit devicechange event if a device has been
 *   added or removed, and deviceinfochange if a device's label has changed.
 * @param {MediaDevicesShim} mediaDevices
 * @private
 */
function sampleDevices(mediaDevices) {
    nativeMediaDevices.enumerateDevices().then(newDevices => {
        const knownDevices = mediaDevices._knownDevices;
        const oldDevices = knownDevices.slice();
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
    return as.some((a, i) => a[propertyName] !== bs[i][propertyName]);
}
/**
 * Re-emit the native event, if the native mediaDevices has the corresponding property.
 * @param {MediaDevicesShim} mediaDevices
 * @param {string} eventName - Name of the event
 * @private
 * @returns {boolean} Whether the native mediaDevice had the corresponding property
 */
function reemitNativeEvent(mediaDevices, eventName) {
    const methodName = `on${eventName}`;
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
const getMediaDevicesInstance = () => {
    nativeMediaDevices = typeof navigator !== 'undefined' ? navigator.mediaDevices : null;
    return nativeMediaDevices ? new MediaDevicesShim() : null;
};
export default getMediaDevicesInstance;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWVkaWFkZXZpY2VzLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9zaGltcy9tZWRpYWRldmljZXMudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7R0FJRztBQUNILGNBQWM7QUFFZCxPQUFPLFdBQVcsTUFBTSxlQUFlLENBQUM7QUFFeEMsTUFBTSxnQkFBZ0IsR0FBRyxHQUFHLENBQUM7QUFFN0IsSUFBSSxrQkFBa0IsR0FBRyxJQUFJLENBQUM7QUFFOUI7Ozs7Ozs7OztHQVNHO0FBQ0gsTUFBTSxnQkFBaUIsU0FBUSxXQUFXO0lBQ3hDO1FBQ0UsS0FBSyxFQUFFLENBQUM7UUFFUixJQUFJLENBQUMsbUJBQW1CLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDekMsSUFBSSxDQUFDLG1CQUFtQixDQUFDLGtCQUFrQixDQUFDLENBQUM7UUFFN0MsTUFBTSxZQUFZLEdBQUcsRUFBRSxDQUFDO1FBQ3hCLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUU7WUFDNUIscUJBQXFCLEVBQUUsRUFBRSxLQUFLLEVBQUUsaUJBQWlCLENBQUMsSUFBSSxFQUFFLGNBQWMsQ0FBQyxFQUFFO1lBQ3pFLHlCQUF5QixFQUFFLEVBQUUsS0FBSyxFQUFFLGlCQUFpQixDQUFDLElBQUksRUFBRSxrQkFBa0IsQ0FBQyxFQUFFO1lBQ2pGLGFBQWEsRUFBRSxFQUFFLEtBQUssRUFBRSxZQUFZLEVBQUU7WUFDdEMsYUFBYSxFQUFFO2dCQUNiLEtBQUssRUFBRSxJQUFJO2dCQUNYLFFBQVEsRUFBRSxJQUFJO2FBQ2Y7U0FDRixDQUFDLENBQUM7UUFFSCxJQUFJLE9BQU8sa0JBQWtCLENBQUMsZ0JBQWdCLEtBQUssVUFBVSxFQUFFO1lBQzdELGtCQUFrQixDQUFDLGdCQUFnQixFQUFFLENBQUMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxFQUFFO2dCQUNuRCxPQUFPLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLFlBQVksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUNuRSxDQUFDLENBQUMsQ0FBQztTQUNKO1FBRUQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsYUFBYSxFQUFFLFNBQVMsaUJBQWlCLENBQUMsU0FBUztZQUN2RSxJQUFJLFNBQVMsS0FBSyxjQUFjLElBQUksU0FBUyxLQUFLLGtCQUFrQixFQUFFO2dCQUNwRSxPQUFPO2FBQ1I7WUFFRCxrREFBa0Q7WUFDbEQsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJLENBQUMsYUFBYTttQkFDbEMsV0FBVyxDQUFDLGFBQWEsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFLGdCQUFnQixDQUFDLENBQUM7UUFDckUsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO1FBRWQsSUFBSSxDQUFDLGFBQWEsQ0FBQyxFQUFFLENBQUMsZ0JBQWdCLEVBQUUsU0FBUyxnQkFBZ0I7WUFDL0QsSUFBSSxJQUFJLENBQUMsYUFBYSxJQUFJLENBQUMsa0JBQWtCLENBQUMsSUFBSSxDQUFDLEVBQUU7Z0JBQ25ELGFBQWEsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLENBQUM7Z0JBQ2xDLElBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDO2FBQzNCO1FBQ0gsQ0FBQyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0lBQ2hCLENBQUM7Q0FDRjtBQUVELGdCQUFnQixDQUFDLFNBQVMsQ0FBQyxnQkFBZ0IsR0FBRyxTQUFTLGdCQUFnQjtJQUNyRSxJQUFJLGtCQUFrQixJQUFJLE9BQU8sa0JBQWtCLENBQUMsZ0JBQWdCLEtBQUssVUFBVSxFQUFFO1FBQ25GLE9BQU8sa0JBQWtCLENBQUMsZ0JBQWdCLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQztLQUMxRDtJQUNELE9BQU8sSUFBSSxDQUFDO0FBQ2QsQ0FBQyxDQUFDO0FBRUYsZ0JBQWdCLENBQUMsU0FBUyxDQUFDLFlBQVksR0FBRyxTQUFTLFlBQVk7SUFDN0QsT0FBTyxrQkFBa0IsQ0FBQyxZQUFZLENBQUMsR0FBRyxTQUFTLENBQUMsQ0FBQztBQUN2RCxDQUFDLENBQUM7QUFFRixTQUFTLHNCQUFzQixDQUFDLFVBQVUsRUFBRSxVQUFVO0lBQ3BELFVBQVUsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLElBQUksS0FBSyxZQUFZLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxhQUFhLENBQUMsQ0FBQztJQUN6RixVQUFVLEdBQUcsVUFBVSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLEtBQUssWUFBWSxJQUFJLENBQUMsQ0FBQyxJQUFJLEtBQUssYUFBYSxDQUFDLENBQUM7SUFFekYsdUVBQXVFO0lBQ3ZFLHVGQUF1RjtJQUN2RixpR0FBaUc7SUFDakcsaUZBQWlGO0lBQ2pGLElBQUksVUFBVSxDQUFDLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFFBQVEsQ0FBQztRQUNuQyxVQUFVLENBQUMsSUFBSSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQyxRQUFRLENBQUMsRUFBRTtRQUNwQyxPQUFPLElBQUksQ0FBQztLQUNiO0lBRUQsc0RBQXNEO0lBQ3RELGtFQUFrRTtJQUNsRSxNQUFNLFNBQVMsR0FBRyxVQUFVLENBQUMsTUFBTSxDQUFDLENBQUMsR0FBRyxFQUFFLE1BQU0sRUFBRSxFQUFFLENBQ2xELEdBQUcsQ0FBQyxHQUFHLENBQUMsR0FBRyxNQUFNLENBQUMsUUFBUSxJQUFJLE1BQU0sQ0FBQyxJQUFJLEVBQUUsRUFBRSxNQUFNLENBQUMsS0FBSyxDQUFDLEVBQUUsSUFBSSxHQUFHLEVBQUUsQ0FBQyxDQUFDO0lBRXpFLE9BQU8sVUFBVSxDQUFDLElBQUksQ0FBQyxNQUFNLENBQUMsRUFBRTtRQUM5QixNQUFNLFFBQVEsR0FBRyxTQUFTLENBQUMsR0FBRyxDQUFDLEdBQUcsTUFBTSxDQUFDLFFBQVEsSUFBSSxNQUFNLENBQUMsSUFBSSxFQUFFLENBQUMsQ0FBQztRQUNwRSxPQUFPLE9BQU8sUUFBUSxLQUFLLFdBQVcsSUFBSSxRQUFRLEtBQUssTUFBTSxDQUFDLEtBQUssQ0FBQztJQUN0RSxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRCxTQUFTLGtCQUFrQixDQUFDLFVBQVUsRUFBRSxVQUFVO0lBQ2hELE9BQU8sVUFBVSxDQUFDLE1BQU0sS0FBSyxVQUFVLENBQUMsTUFBTTtXQUN6QyxrQkFBa0IsQ0FBQyxVQUFVLEVBQUUsVUFBVSxFQUFFLFVBQVUsQ0FBQyxDQUFDO0FBQzlELENBQUM7QUFFRCxTQUFTLGtCQUFrQixDQUFDLFlBQVk7SUFDdEMsT0FBTyxDQUFDLGNBQWMsRUFBRSxrQkFBa0IsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLEtBQUssRUFBRSxLQUFLLEVBQUUsRUFBRSxDQUFDLEtBQUssR0FBRyxZQUFZLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxLQUFLLENBQUMsRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLENBQUM7QUFDdkksQ0FBQztBQUVEOzs7OztHQUtHO0FBQ0gsU0FBUyxhQUFhLENBQUMsWUFBWTtJQUNqQyxrQkFBa0IsQ0FBQyxnQkFBZ0IsRUFBRSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsRUFBRTtRQUN0RCxNQUFNLFlBQVksR0FBRyxZQUFZLENBQUMsYUFBYSxDQUFDO1FBQ2hELE1BQU0sVUFBVSxHQUFHLFlBQVksQ0FBQyxLQUFLLEVBQUUsQ0FBQztRQUV4QyxpQ0FBaUM7UUFDakMsRUFBRSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUMsWUFBWSxFQUFFLENBQUMsQ0FBQyxFQUFFLFlBQVksQ0FBQyxNQUFNLENBQUM7YUFDbkQsTUFBTSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRTdDLElBQUksQ0FBQyxZQUFZLENBQUMscUJBQXFCO2VBQ2xDLGtCQUFrQixDQUFDLFlBQVksRUFBRSxVQUFVLENBQUMsRUFBRTtZQUNqRCxZQUFZLENBQUMsYUFBYSxDQUFDLElBQUksS0FBSyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUM7U0FDdkQ7UUFFRCxJQUFJLENBQUMsWUFBWSxDQUFDLHlCQUF5QjtlQUN0QyxzQkFBc0IsQ0FBQyxZQUFZLEVBQUUsVUFBVSxDQUFDLEVBQUU7WUFDckQsWUFBWSxDQUFDLGFBQWEsQ0FBQyxJQUFJLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQyxDQUFDLENBQUM7U0FDM0Q7SUFDSCxDQUFDLENBQUMsQ0FBQztBQUNMLENBQUM7QUFFRDs7Ozs7Ozs7O0dBU0c7QUFDSCxTQUFTLGtCQUFrQixDQUFDLFlBQVksRUFBRSxFQUFFLEVBQUUsRUFBRTtJQUM5QyxPQUFPLEVBQUUsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLEVBQUUsQ0FBQyxFQUFFLEVBQUUsQ0FBQyxDQUFDLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7QUFDcEUsQ0FBQztBQUVEOzs7Ozs7R0FNRztBQUNILFNBQVMsaUJBQWlCLENBQUMsWUFBWSxFQUFFLFNBQVM7SUFDaEQsTUFBTSxVQUFVLEdBQUcsS0FBSyxTQUFTLEVBQUUsQ0FBQztJQUVwQyxTQUFTLGFBQWEsQ0FBQyxLQUFLO1FBQzFCLFlBQVksQ0FBQyxhQUFhLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDcEMsQ0FBQztJQUVELElBQUksVUFBVSxJQUFJLGtCQUFrQixFQUFFO1FBQ3BDLGtGQUFrRjtRQUNsRiwrRkFBK0Y7UUFDL0YsSUFBSSxrQkFBa0IsSUFBSSxrQkFBa0IsRUFBRTtZQUM1QyxrQkFBa0IsQ0FBQyxnQkFBZ0IsQ0FBQyxTQUFTLEVBQUUsYUFBYSxDQUFDLENBQUM7U0FDL0Q7YUFBTTtZQUNMLGtCQUFrQixDQUFDLFVBQVUsQ0FBQyxHQUFHLGFBQWEsQ0FBQztTQUNoRDtRQUVELE9BQU8sSUFBSSxDQUFDO0tBQ2I7SUFFRCxPQUFPLEtBQUssQ0FBQztBQUNmLENBQUM7QUFFRCxTQUFTLGVBQWUsQ0FBQyxDQUFDLEVBQUUsQ0FBQztJQUMzQixPQUFPLENBQUMsQ0FBQyxRQUFRLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQztBQUNqQyxDQUFDO0FBRUQsTUFBTSx1QkFBdUIsR0FBRyxHQUFHLEVBQUU7SUFDbkMsa0JBQWtCLEdBQUcsT0FBTyxTQUFTLEtBQUssV0FBVyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7SUFDdEYsT0FBTyxrQkFBa0IsQ0FBQyxDQUFDLENBQUMsSUFBSSxnQkFBZ0IsRUFBRSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUM7QUFDNUQsQ0FBQyxDQUFDO0FBRUYsZUFBZSx1QkFBdUIsQ0FBQyJ9