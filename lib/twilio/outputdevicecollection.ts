import { SOUNDS_BASE_URL } from './constants';
import { InvalidArgumentError, InvalidStateError, NotSupportedError } from './errors';
import Log from './log';
const DEFAULT_TEST_SOUND_URL = `${SOUNDS_BASE_URL}/outgoing.mp3`;

/**
 * A smart collection containing a Set of active output devices.
 */
export default class OutputDeviceCollection {
  /**
   * The currently active output devices.
   */
  private _activeDevices: Set<MediaDeviceInfo> = new Set();

  /**
   * An instance of Logger to use.
   */
  private _log: Log = new Log('OutputDeviceCollection');

  /**
   * @internal
   */
  constructor(private _name: string,
              private _availableDevices: Map<string, MediaDeviceInfo>,
              private _beforeChange: (name: string, devices: string[]) => Promise<void>,
              private _isSupported: boolean) { }

  /**
   * Delete a device from the collection. If no devices remain, the 'default'
   * device will be added as the sole device. If no `default` device exists,
   * the first available device will be used.
   * @param device - The device to delete from the collection
   * @returns whether the device was present before it was deleted
   */
  delete(device: MediaDeviceInfo): boolean {
    this._log.debug('.delete', device);
    const wasDeleted: boolean = !!(this._activeDevices.delete(device));

    const defaultDevice: MediaDeviceInfo = this._availableDevices.get('default')
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
  get(): Set<MediaDeviceInfo> {
    return this._activeDevices;
  }

  /**
   * Replace the current set of devices with a new set of devices.
   * @param deviceIdOrIds - An ID or array of IDs of devices to replace the existing devices with.
   * @returns Rejects if this feature is not supported, any of the supplied IDs are not found,
   * or no IDs are passed.
   */
  set(deviceIdOrIds: string | string[]): Promise<void> {
    this._log.debug('.set', deviceIdOrIds);
    if (!this._isSupported) {
      return Promise.reject(new NotSupportedError('This browser does not support audio output selection'));
    }

    const deviceIds: string[] = Array.isArray(deviceIdOrIds) ? deviceIdOrIds : [deviceIdOrIds];

    if (!deviceIds.length) {
      return Promise.reject(new InvalidArgumentError('Must specify at least one device to set'));
    }

    const missingIds: string[] = [];
    const devices: Array<MediaDeviceInfo | undefined> = deviceIds.map((id: string) => {
      const device: MediaDeviceInfo | undefined = this._availableDevices.get(id);
      if (!device) { missingIds.push(id); }
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
  test(soundUrl: string = DEFAULT_TEST_SOUND_URL): Promise<any> {
    if (!this._isSupported) {
      return Promise.reject(new NotSupportedError('This browser does not support audio output selection'));
    }

    if (!this._activeDevices.size) {
      return Promise.reject(new InvalidStateError('No active output devices to test'));
    }

    return Promise.all(Array.from(this._activeDevices).map((device: MediaDeviceInfo) => {
      let el: HTMLAudioElement;

      // (rrowland) We need to wait for the oncanplay event because of a regression introduced
      // in Chrome M72: https://bugs.chromium.org/p/chromium/issues/detail?id=930876
      return new Promise((resolve: Function) => {
        el = new Audio(soundUrl);
        (el as any).oncanplay = resolve;
      }).then(() => (el as any).setSinkId(device.deviceId).then(() => el.play()));
    }));
  }
}
