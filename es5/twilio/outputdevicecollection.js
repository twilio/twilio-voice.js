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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0ZGV2aWNlY29sbGVjdGlvbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9vdXRwdXRkZXZpY2Vjb2xsZWN0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIlNPVU5EU19CQVNFX1VSTCIsIkxvZyIsIk5vdFN1cHBvcnRlZEVycm9yIiwiSW52YWxpZEFyZ3VtZW50RXJyb3IiLCJJbnZhbGlkU3RhdGVFcnJvciJdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7QUFHQSxJQUFNLHNCQUFzQixHQUFHLEVBQUEsQ0FBQSxNQUFBLENBQUdBLHlCQUFlLGtCQUFlO0FBRWhFOztBQUVHO0FBQ0gsSUFBQSxzQkFBQSxrQkFBQSxZQUFBO0FBV0U7O0FBRUc7QUFDSCxJQUFBLFNBQUEsc0JBQUEsQ0FBb0IsS0FBYSxFQUNiLGlCQUErQyxFQUMvQyxhQUFpRSxFQUNqRSxZQUFxQixFQUFBO1FBSHJCLElBQUEsQ0FBQSxLQUFLLEdBQUwsS0FBSztRQUNMLElBQUEsQ0FBQSxpQkFBaUIsR0FBakIsaUJBQWlCO1FBQ2pCLElBQUEsQ0FBQSxhQUFhLEdBQWIsYUFBYTtRQUNiLElBQUEsQ0FBQSxZQUFZLEdBQVosWUFBWTtBQWhCaEM7O0FBRUc7QUFDSyxRQUFBLElBQUEsQ0FBQSxjQUFjLEdBQXlCLElBQUksR0FBRyxFQUFFO0FBRXhEOztBQUVHO0FBQ0ssUUFBQSxJQUFBLENBQUEsSUFBSSxHQUFRLElBQUlDLFdBQUcsQ0FBQyx3QkFBd0IsQ0FBQztJQVFSO0FBRTdDOzs7Ozs7QUFNRztJQUNILHNCQUFBLENBQUEsU0FBQSxDQUFBLE1BQU0sR0FBTixVQUFPLE1BQXVCLEVBQUE7UUFDNUIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQztBQUNsQyxRQUFBLElBQU0sVUFBVSxHQUFZLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUVsRSxJQUFN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
