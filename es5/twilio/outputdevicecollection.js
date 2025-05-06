"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @packageDocumentation
 * @module Voice
 */
var constants_1 = require("./constants");
var errors_1 = require("./errors");
var log_1 = require("./log");
var DEFAULT_TEST_SOUND_URL = constants_1.SOUNDS_BASE_URL + "/outgoing.mp3";
/**
 * A smart collection containing a Set of active output devices.
 * @publicapi
 */
var OutputDeviceCollection = /** @class */ (function () {
    /**
     * @private
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
            return Promise.reject(new errors_1.InvalidArgumentError("Devices not found: " + missingIds.join(', ')));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0ZGV2aWNlY29sbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vb3V0cHV0ZGV2aWNlY29sbGVjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7R0FHRztBQUNILHlDQUE4QztBQUM5QyxtQ0FBc0Y7QUFDdEYsNkJBQXdCO0FBQ3hCLElBQU0sc0JBQXNCLEdBQU0sMkJBQWUsa0JBQWUsQ0FBQztBQUVqRTs7O0dBR0c7QUFDSDtJQVdFOztPQUVHO0lBQ0gsZ0NBQW9CLEtBQWEsRUFDYixpQkFBK0MsRUFDL0MsYUFBaUUsRUFDakUsWUFBcUI7UUFIckIsVUFBSyxHQUFMLEtBQUssQ0FBUTtRQUNiLHNCQUFpQixHQUFqQixpQkFBaUIsQ0FBOEI7UUFDL0Msa0JBQWEsR0FBYixhQUFhLENBQW9EO1FBQ2pFLGlCQUFZLEdBQVosWUFBWSxDQUFTO1FBaEJ6Qzs7V0FFRztRQUNLLG1CQUFjLEdBQXlCLElBQUksR0FBRyxFQUFFLENBQUM7UUFFekQ7O1dBRUc7UUFDSyxTQUFJLEdBQVEsSUFBSSxhQUFHLENBQUMsd0JBQXdCLENBQUMsQ0FBQztJQVFULENBQUM7SUFFOUM7Ozs7OztPQU1HO0lBQ0gsdUNBQU0sR0FBTixVQUFPLE1BQXVCO1FBQzVCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLFNBQVMsRUFBRSxNQUFNLENBQUMsQ0FBQztRQUNuQyxJQUFNLFVBQVUsR0FBWSxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO1FBRW5FLElBQU0sYUFBYSxHQUFvQixJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLFNBQVMsQ0FBQztlQUN2RSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1FBRXBELElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksSUFBSSxhQUFhLEVBQUU7WUFDOUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7U0FDeEM7UUFFRCwyRUFBMkU7UUFDM0UsbUJBQW1CO1FBQ25CLElBQU0sU0FBUyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxVQUFBLFVBQVUsSUFBSSxPQUFBLFVBQVUsQ0FBQyxRQUFRLEVBQW5CLENBQW1CLENBQUMsQ0FBQztRQUVsRyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsU0FBUyxDQUFDLENBQUM7UUFDMUMsT0FBTyxDQUFDLENBQUMsVUFBVSxDQUFDO0lBQ3RCLENBQUM7SUFFRDs7T0FFRztJQUNILG9DQUFHLEdBQUg7UUFDRSxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUM7SUFDN0IsQ0FBQztJQUVEOzs7OztPQUtHO0lBQ0gsb0NBQUcsR0FBSCxVQUFJLGFBQWdDO1FBQXBDLGlCQTZCQztRQTVCQyxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLEVBQUUsYUFBYSxDQUFDLENBQUM7UUFDdkMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUU7WUFDdEIsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksMEJBQWlCLENBQUMsc0RBQXNELENBQUMsQ0FBQyxDQUFDO1NBQ3RHO1FBRUQsSUFBTSxTQUFTLEdBQWEsS0FBSyxDQUFDLE9BQU8sQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUMsQ0FBQyxDQUFDLGFBQWEsQ0FBQyxDQUFDO1FBRTNGLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxFQUFFO1lBQ3JCLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLDZCQUFvQixDQUFDLHlDQUF5QyxDQUFDLENBQUMsQ0FBQztTQUM1RjtRQUVELElBQU0sVUFBVSxHQUFhLEVBQUUsQ0FBQztRQUNoQyxJQUFNLE9BQU8sR0FBdUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxVQUFDLEVBQVU7WUFDM0UsSUFBTSxNQUFNLEdBQWdDLEtBQUksQ0FBQyxpQkFBaUIsQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7WUFDM0UsSUFBSSxDQUFDLE1BQU0sRUFBRTtnQkFBRSxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO2FBQUU7WUFDckMsT0FBTyxNQUFNLENBQUM7UUFDaEIsQ0FBQyxDQUFDLENBQUM7UUFFSCxJQUFJLFVBQVUsQ0FBQyxNQUFNLEVBQUU7WUFDckIsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksNkJBQW9CLENBQUMsd0JBQXNCLFVBQVUsQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFHLENBQUMsQ0FBQyxDQUFDO1NBQ2hHO1FBRUQsT0FBTyxJQUFJLE9BQU8sQ0FBQyxVQUFBLE9BQU87WUFDeEIsT0FBTyxDQUFDLEtBQUksQ0FBQyxhQUFhLENBQUMsS0FBSSxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQyxDQUFDO1FBQ3JELENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQztZQUNOLEtBQUksQ0FBQyxjQUFjLENBQUMsS0FBSyxFQUFFLENBQUM7WUFDNUIsT0FBTyxDQUFDLE9BQU8sQ0FBQyxLQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsRUFBRSxLQUFJLENBQUMsY0FBYyxDQUFDLENBQUM7UUFDaEUsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxxQ0FBSSxHQUFKLFVBQUssUUFBeUM7UUFBekMseUJBQUEsRUFBQSxpQ0FBeUM7UUFDNUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUU7WUFDdEIsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksMEJBQWlCLENBQUMsc0RBQXNELENBQUMsQ0FBQyxDQUFDO1NBQ3RHO1FBRUQsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxFQUFFO1lBQzdCLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLDBCQUFpQixDQUFDLGtDQUFrQyxDQUFDLENBQUMsQ0FBQztTQUNsRjtRQUVELE9BQU8sT0FBTyxDQUFDLEdBQUcsQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQyxHQUFHLENBQUMsVUFBQyxNQUF1QjtZQUM3RSxJQUFJLEVBQW9CLENBQUM7WUFFekIsd0ZBQXdGO1lBQ3hGLDhFQUE4RTtZQUM5RSxPQUFPLElBQUksT0FBTyxDQUFDLFVBQUMsT0FBaUI7Z0JBQ25DLEVBQUUsR0FBRyxJQUFJLEtBQUssQ0FBQyxRQUFRLENBQUMsQ0FBQztnQkFDeEIsRUFBVSxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUM7WUFDbEMsQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQU0sT0FBQyxFQUFVLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsY0FBTSxPQUFBLEVBQUUsQ0FBQyxJQUFJLEVBQUUsRUFBVCxDQUFTLENBQUMsRUFBNUQsQ0FBNEQsQ0FBQyxDQUFDO1FBQzlFLENBQUMsQ0FBQyxDQUFDLENBQUM7SUFDTixDQUFDO0lBQ0gsNkJBQUM7QUFBRCxDQUFDLEFBbkhELElBbUhDIn0=