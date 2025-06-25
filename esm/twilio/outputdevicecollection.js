import { SOUNDS_BASE_URL } from './constants';
import { InvalidArgumentError, InvalidStateError, NotSupportedError } from './errors';
import Log from './log';
const DEFAULT_TEST_SOUND_URL = `${SOUNDS_BASE_URL}/outgoing.mp3`;
/**
 * A smart collection containing a Set of active output devices.
 */
export default class OutputDeviceCollection {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoib3V0cHV0ZGV2aWNlY29sbGVjdGlvbi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vb3V0cHV0ZGV2aWNlY29sbGVjdGlvbi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEVBQUUsZUFBZSxFQUFFLE1BQU0sYUFBYSxDQUFDO0FBQzlDLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxpQkFBaUIsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUN0RixPQUFPLEdBQUcsTUFBTSxPQUFPLENBQUM7QUFDeEIsTUFBTSxzQkFBc0IsR0FBRyxHQUFHLGVBQWUsZUFBZSxDQUFDO0FBRWpFOztHQUVHO0FBQ0gsTUFBTSxDQUFDLE9BQU8sT0FBTyxzQkFBc0I7SUFXekM7O09BRUc7SUFDSCxZQUFvQixLQUFhLEVBQ2IsaUJBQStDLEVBQy9DLGFBQWlFLEVBQ2pFLFlBQXFCO1FBSHJCLFVBQUssR0FBTCxLQUFLLENBQVE7UUFDYixzQkFBaUIsR0FBakIsaUJBQWlCLENBQThCO1FBQy9DLGtCQUFhLEdBQWIsYUFBYSxDQUFvRDtRQUNqRSxpQkFBWSxHQUFaLFlBQVksQ0FBUztRQWhCekM7O1dBRUc7UUFDSyxtQkFBYyxHQUF5QixJQUFJLEdBQUcsRUFBRSxDQUFDO1FBRXpEOztXQUVHO1FBQ0ssU0FBSSxHQUFRLElBQUksR0FBRyxDQUFDLHdCQUF3QixDQUFDLENBQUM7SUFRVCxDQUFDO0lBRTlDOzs7Ozs7T0FNRztJQUNILE1BQU0sQ0FBQyxNQUF1QjtRQUM1QixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxTQUFTLEVBQUUsTUFBTSxDQUFDLENBQUM7UUFDbkMsTUFBTSxVQUFVLEdBQVksQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztRQUVuRSxNQUFNLGFBQWEsR0FBb0IsSUFBSSxDQUFDLGlCQUFpQixDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUM7ZUFDdkUsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxFQUFFLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztRQUVwRCxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLElBQUksYUFBYSxFQUFFLENBQUM7WUFDL0MsSUFBSSxDQUFDLGNBQWMsQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLENBQUM7UUFDekMsQ0FBQztRQUVELDJFQUEyRTtRQUMzRSxtQkFBbUI7UUFDbkIsTUFBTSxTQUFTLEdBQUcsS0FBSyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsR0FBRyxDQUFDLFVBQVUsQ0FBQyxFQUFFLENBQUMsVUFBVSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBRWxHLElBQUksQ0FBQyxhQUFhLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxTQUFTLENBQUMsQ0FBQztRQUMxQyxPQUFPLENBQUMsQ0FBQyxVQUFVLENBQUM7SUFDdEIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsR0FBRztRQUNELE9BQU8sSUFBSSxDQUFDLGNBQWMsQ0FBQztJQUM3QixDQUFDO0lBRUQ7Ozs7O09BS0c7SUFDSCxHQUFHLENBQUMsYUFBZ0M7UUFDbEMsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxFQUFFLGFBQWEsQ0FBQyxDQUFDO1FBQ3ZDLElBQUksQ0FBQyxJQUFJLENBQUMsWUFBWSxFQUFFLENBQUM7WUFDdkIsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUksaUJBQWlCLENBQUMsc0RBQXNELENBQUMsQ0FBQyxDQUFDO1FBQ3ZHLENBQUM7UUFFRCxNQUFNLFNBQVMsR0FBYSxLQUFLLENBQUMsT0FBTyxDQUFDLGFBQWEsQ0FBQyxDQUFDLENBQUMsQ0FBQyxhQUFhLENBQUMsQ0FBQyxDQUFDLENBQUMsYUFBYSxDQUFDLENBQUM7UUFFM0YsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLEVBQUUsQ0FBQztZQUN0QixPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxvQkFBb0IsQ0FBQyx5Q0FBeUMsQ0FBQyxDQUFDLENBQUM7UUFDN0YsQ0FBQztRQUVELE1BQU0sVUFBVSxHQUFhLEVBQUUsQ0FBQztRQUNoQyxNQUFNLE9BQU8sR0FBdUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEVBQVUsRUFBRSxFQUFFO1lBQy9FLE1BQU0sTUFBTSxHQUFnQyxJQUFJLENBQUMsaUJBQWlCLENBQUMsR0FBRyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQzNFLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFBQyxVQUFVLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQUMsQ0FBQztZQUNyQyxPQUFPLE1BQU0sQ0FBQztRQUNoQixDQUFDLENBQUMsQ0FBQztRQUVILElBQUksVUFBVSxDQUFDLE1BQU0sRUFBRSxDQUFDO1lBQ3RCLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLG9CQUFvQixDQUFDLHNCQUFzQixVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQ2pHLENBQUM7UUFFRCxPQUFPLElBQUksT0FBTyxDQUFDLE9BQU8sQ0FBQyxFQUFFO1lBQzNCLE9BQU8sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsU0FBUyxDQUFDLENBQUMsQ0FBQztRQUNyRCxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFO1lBQ1gsSUFBSSxDQUFDLGNBQWMsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUM1QixPQUFPLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUMsR0FBRyxFQUFFLElBQUksQ0FBQyxjQUFjLENBQUMsQ0FBQztRQUNoRSxDQUFDLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRDs7Ozs7T0FLRztJQUNILElBQUksQ0FBQyxXQUFtQixzQkFBc0I7UUFDNUMsSUFBSSxDQUFDLElBQUksQ0FBQyxZQUFZLEVBQUUsQ0FBQztZQUN2QixPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSxpQkFBaUIsQ0FBQyxzREFBc0QsQ0FBQyxDQUFDLENBQUM7UUFDdkcsQ0FBQztRQUVELElBQUksQ0FBQyxJQUFJLENBQUMsY0FBYyxDQUFDLElBQUksRUFBRSxDQUFDO1lBQzlCLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLGlCQUFpQixDQUFDLGtDQUFrQyxDQUFDLENBQUMsQ0FBQztRQUNuRixDQUFDO1FBRUQsT0FBTyxPQUFPLENBQUMsR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLE1BQXVCLEVBQUUsRUFBRTtZQUNqRixJQUFJLEVBQW9CLENBQUM7WUFFekIsd0ZBQXdGO1lBQ3hGLDhFQUE4RTtZQUM5RSxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBaUIsRUFBRSxFQUFFO2dCQUN2QyxFQUFFLEdBQUcsSUFBSSxLQUFLLENBQUMsUUFBUSxDQUFDLENBQUM7Z0JBQ3hCLEVBQVUsQ0FBQyxTQUFTLEdBQUcsT0FBTyxDQUFDO1lBQ2xDLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBRSxFQUFVLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQyxJQUFJLENBQUMsR0FBRyxFQUFFLENBQUMsRUFBRSxDQUFDLElBQUksRUFBRSxDQUFDLENBQUMsQ0FBQztRQUM5RSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ04sQ0FBQztDQUNGIn0=