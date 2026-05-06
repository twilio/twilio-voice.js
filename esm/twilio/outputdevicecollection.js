import { SOUNDS_BASE_URL } from './constants.js';
import { NotSupportedError, InvalidArgumentError, InvalidStateError } from './errors/index.js';
import Log from './log.js';

const DEFAULT_TEST_SOUND_URL = `${SOUNDS_BASE_URL}/outgoing.mp3`;
/**
 * A smart collection containing a Set of active output devices.
 */
class OutputDeviceCollection {
    /**
     * @internal
     */
    constructor(_name, _availableDevices, _beforeChange, _isSupported) {
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
        this._log = new Log('OutputDeviceCollection');
    }
    /**
     * Delete a device from the collection. If no devices remain, the 'default'
     * device will be added as the sole device. If no `default` device exists,
     * the first available device will be used.
     * @param device - The device to delete from the collection
     * @returns whether the device was present before it was deleted
     */
    delete(device) {
        this._log.debug('.delete', device);
        const wasDeleted = !!(this._activeDevices.delete(device));
        const defaultDevice = this._availableDevices.get('default')
            || Array.from(this._availableDevices.values())[0];
        if (!this._activeDevices.size && defaultDevice) {
            this._activeDevices.add(defaultDevice);
        }
        // Call _beforeChange so that the implementation can react when a device is
        // removed or lost.
        const deviceIds = Array.from(this._activeDevices.values()).map(deviceInfo => deviceInfo.deviceId);
        this._beforeChange(this._name, deviceIds);
        return !!wasDeleted;
    }
    /**
     * Get the current set of devices.
     */
    get() {
        return this._activeDevices;
    }
    /**
     * Replace the current set of devices with a new set of devices.
     * @param deviceIdOrIds - An ID or array of IDs of devices to replace the existing devices with.
     * @returns Rejects if this feature is not supported, any of the supplied IDs are not found,
     * or no IDs are passed.
     */
    set(deviceIdOrIds) {
        this._log.debug('.set', deviceIdOrIds);
        if (!this._isSupported) {
            return Promise.reject(new NotSupportedError('This browser does not support audio output selection'));
        }
        const deviceIds = Array.isArray(deviceIdOrIds) ? deviceIdOrIds : [deviceIdOrIds];
        if (!deviceIds.length) {
            return Promise.reject(new InvalidArgumentError('Must specify at least one device to set'));
        }
        const missingIds = [];
        const devices = deviceIds.map((id) => {
            const device = this._availableDevices.get(id);
            if (!device) {
                missingIds.push(id);
            }
            return device;
        });
        if (missingIds.length) {
            return Promise.reject(new InvalidArgumentError(`Devices not found: ${missingIds.join(', ')}`));
        }
        return new Promise(resolve => {
            resolve(this._beforeChange(this._name, deviceIds));
        }).then(() => {
            this._activeDevices.clear();
            devices.forEach(this._activeDevices.add, this._activeDevices);
        });
    }
    /**
     * Test the devices by playing audio through them.
     * @param [soundUrl] - An optional URL. If none is specified, we will
     *   play a default test tone.
     * @returns Resolves with the result of the underlying HTMLAudioElements' play() calls.
     */
    test(soundUrl = DEFAULT_TEST_SOUND_URL) {
        if (!this._isSupported) {
            return Promise.reject(new NotSupportedError('This browser does not support audio output selection'));
        }
        if (!this._activeDevices.size) {
            return Promise.reject(new InvalidStateError('No active output devices to test'));
        }
        return Promise.all(Array.from(this._activeDevices).map((device) => {
            let el;
            // (rrowland) We need to wait for the oncanplay event because of a regression introduced
            // in Chrome M72: https://bugs.chromium.org/p/chromium/issues/detail?id=930876
            return new Promise((resolve) => {
                el = new Audio(soundUrl);
                el.oncanplay = resolve;
            }).then(() => el.setSinkId(device.deviceId).then(() => el.play()));
        }));
    }
}

export { OutputDeviceCollection as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0ZGV2aWNlY29sbGVjdGlvbi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9vdXRwdXRkZXZpY2Vjb2xsZWN0aW9uLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7QUFHQSxNQUFNLHNCQUFzQixHQUFHLENBQUEsRUFBRyxlQUFlLGVBQWU7QUFFaEU7O0FBRUc7QUFDVyxNQUFPLHNCQUFzQixDQUFBO0FBV3pDOztBQUVHO0FBQ0gsSUFBQSxXQUFBLENBQW9CLEtBQWEsRUFDYixpQkFBK0MsRUFDL0MsYUFBaUUsRUFDakUsWUFBcUIsRUFBQTtRQUhyQixJQUFBLENBQUEsS0FBSyxHQUFMLEtBQUs7UUFDTCxJQUFBLENBQUEsaUJBQWlCLEdBQWpCLGlCQUFpQjtRQUNqQixJQUFBLENBQUEsYUFBYSxHQUFiLGFBQWE7UUFDYixJQUFBLENBQUEsWUFBWSxHQUFaLFlBQVk7QUFoQmhDOztBQUVHO0FBQ0ssUUFBQSxJQUFBLENBQUEsY0FBYyxHQUF5QixJQUFJLEdBQUcsRUFBRTtBQUV4RDs7QUFFRztBQUNLLFFBQUEsSUFBQSxDQUFBLElBQUksR0FBUSxJQUFJLEdBQUcsQ0FBQyx3QkFBd0IsQ0FBQztJQVFSO0FBRTdDOzs7Ozs7QUFNRztBQUNILElBQUEsTUFBTSxDQUFDLE1BQXVCLEVBQUE7UUFDNUIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsU0FBUyxFQUFFLE1BQU0sQ0FBQztBQUNsQyxRQUFBLE1BQU0sVUFBVSxHQUFZLENBQUMsRUFBRSxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQztRQUVsRSxNQUFNLGFBQWEsR0FBb0IsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxTQUFTO0FBQ3RFLGVBQUEsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUM7UUFF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
