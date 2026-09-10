'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var constants = require('./constants.js');
var index = require('./errors/index.js');
var log = require('./log.js');

var DEFAULT_TEST_SOUND_URL = "".concat(constants.SOUNDS_BASE_URL, "/outgoing.mp3");
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
        this._log = new log.default('OutputDeviceCollection');
    }
    /**
     * Delete a device from the collection. If no devices remain, the 'default'
     * device will be added as the sole device. If no `default` device exists,
     * the first available device will be used. On browsers without output
     * selection, the collection is left empty.
     * @param device - The device to delete from the collection
     * @returns whether the device was present before it was deleted
     */
    OutputDeviceCollection.prototype.delete = function (device) {
        var _this = this;
        this._log.debug('.delete', device);
        var wasDeleted = !!(this._activeDevices.delete(device));
        // Without sink support _beforeChange rejects, and nothing can catch it.
        if (!this._isSupported) {
            return wasDeleted;
        }
        var defaultDevice = this._availableDevices.get('default')
            || Array.from(this._availableDevices.values())[0];
        if (!this._activeDevices.size && defaultDevice) {
            this._activeDevices.add(defaultDevice);
        }
        // Call _beforeChange so that the implementation can react when a device is
        // removed or lost.
        var deviceIds = Array.from(this._activeDevices.values()).map(function (deviceInfo) { return deviceInfo.deviceId; });
        // Nothing can await a synchronous method. The wrapper also tolerates a
        // _beforeChange that returns a non-promise or throws.
        new Promise(function (resolve) {
            resolve(_this._beforeChange(_this._name, deviceIds));
        }).catch(function (reason) {
            _this._log.warn("Unable to update audio output devices. ".concat(reason));
        });
        return wasDeleted;
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
            return Promise.reject(new index.NotSupportedError('This browser does not support audio output selection'));
        }
        var deviceIds = Array.isArray(deviceIdOrIds) ? deviceIdOrIds : [deviceIdOrIds];
        if (!deviceIds.length) {
            return Promise.reject(new index.InvalidArgumentError('Must specify at least one device to set'));
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
            return Promise.reject(new index.InvalidArgumentError("Devices not found: ".concat(missingIds.join(', '))));
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
            return Promise.reject(new index.NotSupportedError('This browser does not support audio output selection'));
        }
        if (!this._activeDevices.size) {
            return Promise.reject(new index.InvalidStateError('No active output devices to test'));
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0ZGV2aWNlY29sbGVjdGlvbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9vdXRwdXRkZXZpY2Vjb2xsZWN0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIlNPVU5EU19CQVNFX1VSTCIsIkxvZyIsIk5vdFN1cHBvcnRlZEVycm9yIiwiSW52YWxpZEFyZ3VtZW50RXJyb3IiLCJJbnZhbGlkU3RhdGVFcnJvciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFHQSxJQUFNLHNCQUFzQixHQUFHLEVBQUEsQ0FBQSxNQUFBLENBQUdBLHlCQUFlLGtCQUFlO0FBRWhFOztBQUVHO0FBQ0gsSUFBQSxzQkFBQSxrQkFBQSxZQUFBO0FBV0U7O0FBRUc7QUFDSCxJQUFBLFNBQUEsc0JBQUEsQ0FBb0IsS0FBYSxFQUNiLGlCQUErQyxFQUMvQyxhQUFpRSxFQUNqRSxZQUFxQixFQUFBO1FBSHJCLElBQUEsQ0FBQSxLQUFLLEdBQUwsS0FBSztRQUNMLElBQUEsQ0FBQSxpQkFBaUIsR0FBakIsaUJBQWlCO1FBQ2pCLElBQUEsQ0FBQSxhQUFhLEdBQWIsYUFBYTtRQUNiLElBQUEsQ0FBQSxZQUFZLEdBQVosWUFBWTtBQWhCaEM7O0FBRUc7QUFDSyxRQUFBLElBQUEsQ0FBQSxjQUFjLEdBQXlCLElBQUksR0FBRyxFQUFFO0FBRXhEOztBQUVHO0FBQ0ssUUFBQSxJQUFBLENBQUEsSUFBSSxHQUFRLElBQUlDLFdBQUcsQ0FBQyx3QkFBd0IsQ0FBQztJQVFSO0FBRTdDOzs7Ozs7O0FBT0c7SUFDSCxzQkFBQSxDQUFBLFNBQUEsQ0FBQSxNQUFNLEdBQU4sVUFBTyxNQUF1QixFQUFBO1FBQTlCLElBQUEsS0FBQSxHQUFBLElBQUE7UUFDRSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDO0FBQ2xDLFFBQUEsSUFBTSxVQUFVLEdBQVksQ0FBQyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsTUFBTSxDQUFD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
