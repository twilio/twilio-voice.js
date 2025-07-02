"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var constants_1 = require("./constants");
var errors_1 = require("./errors");
var log_1 = require("./log");
var DEFAULT_TEST_SOUND_URL = "".concat(constants_1.SOUNDS_BASE_URL, "/outgoing.mp3");
/**
 * A smart collection containing a Set of active output devices.
 */
var OutputDeviceCollection = /** @class */ (function () {
    /**
     * @internal
     */
    function OutputDeviceCollection(_name, _availableDevices, _beforeChange, _isSupported) {
        this._name = _name;
        this._availableDevices = _availableDevices;
        this._beforeChange = _beforeChange;
        this._isSupported = _isSupported;
        /**
         * The currently active output devices.
         */
        this._activeDevices = new Set();
        /**
         * An instance of Logger to use.
         */
        this._log = new log_1.default('OutputDeviceCollection');
    }
    /**
     * Delete a device from the collection. If no devices remain, the 'default'
     * device will be added as the sole device. If no `default` device exists,
     * the first available device will be used.
     * @param device - The device to delete from the collection
     * @returns whether the device was present before it was deleted
     */
    OutputDeviceCollection.prototype.delete = function (device) {
        this._log.debug('.delete', device);
        var wasDeleted = !!(this._activeDevices.delete(device));
        var defaultDevice = this._availableDevices.get('default')
            || Array.from(this._availableDevices.values())[0];
        if (!this._activeDevices.size && defaultDevice) {
            this._activeDevices.add(defaultDevice);
        }
        // Call _beforeChange so that the implementation can react when a device is
        // removed or lost.
        var deviceIds = Array.from(this._activeDevices.values()).map(function (deviceInfo) { return deviceInfo.deviceId; });
        this._beforeChange(this._name, deviceIds);
        return !!wasDeleted;
    };
    /**
     * Get the current set of devices.
     */
    OutputDeviceCollection.prototype.get = function () {
        return this._activeDevices;
    };
    /**
     * Replace the current set of devices with a new set of devices.
     * @param deviceIdOrIds - An ID or array of IDs of devices to replace the existing devices with.
     * @returns Rejects if this feature is not supported, any of the supplied IDs are not found,
     * or no IDs are passed.
     */
    OutputDeviceCollection.prototype.set = function (deviceIdOrIds) {
        var _this = this;
        this._log.debug('.set', deviceIdOrIds);
        if (!this._isSupported) {
            return Promise.reject(new errors_1.NotSupportedError('This browser does not support audio output selection'));
        }
        var deviceIds = Array.isArray(deviceIdOrIds) ? deviceIdOrIds : [deviceIdOrIds];
        if (!deviceIds.length) {
            return Promise.reject(new errors_1.InvalidArgumentError('Must specify at least one device to set'));
        }
        var missingIds = [];
        var devices = deviceIds.map(function (id) {
            var device = _this._availableDevices.get(id);
            if (!device) {
                missingIds.push(id);
            }
            return device;
        });
        if (missingIds.length) {
            return Promise.reject(new errors_1.InvalidArgumentError("Devices not found: ".concat(missingIds.join(', '))));
        }
        return new Promise(function (resolve) {
            resolve(_this._beforeChange(_this._name, deviceIds));
        }).then(function () {
            _this._activeDevices.clear();
            devices.forEach(_this._activeDevices.add, _this._activeDevices);
        });
    };
    /**
     * Test the devices by playing audio through them.
     * @param [soundUrl] - An optional URL. If none is specified, we will
     *   play a default test tone.
     * @returns Resolves with the result of the underlying HTMLAudioElements' play() calls.
     */
    OutputDeviceCollection.prototype.test = function (soundUrl) {
        if (soundUrl === void 0) { soundUrl = DEFAULT_TEST_SOUND_URL; }
        if (!this._isSupported) {
            return Promise.reject(new errors_1.NotSupportedError('This browser does not support audio output selection'));
        }
        if (!this._activeDevices.size) {
            return Promise.reject(new errors_1.InvalidStateError('No active output devices to test'));
        }
        return Promise.all(Array.from(this._activeDevices).map(function (device) {
            var el;
            // (rrowland) We need to wait for the oncanplay event because of a regression introduced
            // in Chrome M72: https://bugs.chromium.org/p/chromium/issues/detail?id=930876
            return new Promise(function (resolve) {
                el = new Audio(soundUrl);
                el.oncanplay = resolve;
            }).then(function () { return el.setSinkId(device.deviceId).then(function () { return el.play(); }); });
        }));
    };
    return OutputDeviceCollection;
}());
exports.default = OutputDeviceCollection;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0ZGV2aWNlY29sbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vb3V0cHV0ZGV2aWNlY29sbGVjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLHlDQUE4QztBQUM5QyxtQ0FBc0Y7QUFDdEYsNkJBQXdCO0FBQ3hCLElBQU0sc0JBQXNCLEdBQUcsVUFBRywyQkFBZSxrQkFBZSxDQUFDO0FBRWpFOztHQUVHO0FBQ0g7SUFXRTs7T0FFRztJQUNILGdDQUFvQixLQUFhLEVBQ2IsaUJBQStDLEVBQy9DLGFBQWlFLEVBQ2pFLFlBQXFCO1FBSHJCLFVBQUssR0FBTCxLQUFLLENBQVE7UUFDYixzQkFBaUIsR0FBakIsaUJBQWlCLENBQThCO1FBQy9DLGtCQUFhLEdBQWIsYUFBYSxDQUFvRDtRQUNqRSxpQkFBWSxHQUFaLFlBQVksQ0FBUztRQWhCekM7O1dBRUc7UUFDSyxtQkFBYyxHQUF5QixJQUFJLEdBQUcsRUFBRSxDQUFDO1FBRXpEOztXQUVHO1FBQ0ssU0FBSSxHQUFRLElBQUksYUFBRyxDQUFDLHdCQUF3QixDQUFDLENBQUM7SUFRVCxDQUFDO0lBRTlDOzs7Ozs7T0FNRztJQUNILHVDQUFNLEdBQU4sVUFBTyxNQUF1QjtRQUM1QixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDbkMsSUFBTSxVQUFVLEdBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUVuRSxJQUFNLGFBQWEsR0FBb0IsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUM7ZUFDdkUsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVwRCxJQUFJLENBQUMsSUFBSSxD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