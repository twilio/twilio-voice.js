/**
 * @packageDocumentation
 * @module Voice
 */
import { EventEmitter } from 'events';
import Device from './device';
import { InvalidArgumentError, NotSupportedError } from './errors';
import Log from './log';
import OutputDeviceCollection from './outputdevicecollection';
import MediaDeviceInfoShim from './shims/mediadeviceinfo';
import getMediaDevicesInstance from './shims/mediadevices';
import { average, difference, isFirefox } from './util';

/**
 * Aliases for audio kinds, used for labelling.
 * @private
 */
const kindAliases: Record<string, string> = {
  audioinput: 'Audio Input',
  audiooutput: 'Audio Output',
};

/**
 * Provides input and output audio-based functionality in one convenient class.
 * @publicapi
 */
class AudioHelper extends EventEmitter {
  /**
   * The currently set audio constraints set by setAudioConstraints(). Starts as null.
   */
  get audioConstraints(): MediaTrackConstraints | null { return this._audioConstraints; }

  /**
   * A Map of all audio input devices currently available to the browser by their device ID.
   */
  availableInputDevices: Map<string, MediaDeviceInfo> = new Map();

  /**
   * A Map of all audio output devices currently available to the browser by their device ID.
   */
  availableOutputDevices: Map<string, MediaDeviceInfo> = new Map();

  /**
   * The active input device. Having no inputDevice specified by `setInputDevice()`
   * will disable input selection related functionality.
   */
  get inputDevice(): MediaDeviceInfo | null { return this._inputDevice; }

  /**
   * The current input stream.
   */
  get inputStream(): MediaStream | null { return this._inputStream; }

  /**
   * False if the browser does not support `HTMLAudioElement.setSinkId()` or
   * `MediaDevices.enumerateDevices()` and Twilio cannot facilitate output selection functionality.
   */
  isOutputSelectionSupported: boolean;

  /**
   * False if the browser does not support AudioContext and Twilio can not analyse the volume
   * in real-time.
   */
  isVolumeSupported: boolean;

  /**
   * The current set of output devices that incoming ringtone audio is routed through.
   * These are the sounds that may play while the user is away from the machine or not wearing
   * their headset. It is important that this audio is heard. If all specified
   * devices lost, this Set will revert to contain only the "default" device.
   */
  ringtoneDevices: OutputDeviceCollection;

  /**
   * The current set of output devices that call audio (`[voice, outgoing, disconnect, dtmf]`)
   * is routed through. These are the sounds that are initiated by the user, or played while
   * the user is otherwise present at the endpoint. If all specified devices are lost,
   * this Set will revert to contain only the "default" device.
   */
  speakerDevices: OutputDeviceCollection;

  /**
   * The currently set audio constraints set by setAudioConstraints().
   */
  private _audioConstraints: MediaTrackConstraints | null = null;

  /**
   * An AudioContext to use.
   */
  private _audioContext?: AudioContext;

  /**
   * Whether each sound is enabled.
   */
  private _enabledSounds: Record<Device.ToggleableSound, boolean> = {
    [Device.SoundName.Disconnect]: true,
    [Device.SoundName.Incoming]: true,
    [Device.SoundName.Outgoing]: true,
  };

  /**
   * The enumerateDevices method to use
   */
  private _enumerateDevices: any;

  /**
   * The `getUserMedia()` function to use.
   */
  private _getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;

  /**
   * The current input device.
   */
  private _inputDevice: MediaDeviceInfo | null = null;

  /**
   * The current input stream.
   */
  private _inputStream: MediaStream | null = null;

  /**
   * An AnalyserNode to use for input volume.
   */
  private _inputVolumeAnalyser?: AnalyserNode;

  /**
   * An MediaStreamSource to use for input volume.
   */
  private _inputVolumeSource?: MediaStreamAudioSourceNode;

  /**
   * Whether the {@link AudioHelper} is currently polling the input stream's volume.
   */
  private _isPollingInputVolume: boolean = false;

  /**
   * An instance of Logger to use.
   */
  private _log: Log = Log.getInstance();

  /**
   * The MediaDevices instance to use.
   */
  private _mediaDevices: AudioHelper.MediaDevicesLike | null;

  /**
   * Called with the new input stream when the active input is changed.
   */
  private _onActiveInputChanged: (stream: MediaStream | null) => Promise<void>;

  /**
   * A record of unknown devices (Devices without labels)
   */
  private _unknownDeviceIndexes: Record<string, Record<string, number>> = {
    audioinput: { },
    audiooutput: { },
  };

  /**
   * @constructor
   * @private
   * @param onActiveOutputsChanged - A callback to be called when the user changes the active output devices.
   * @param onActiveInputChanged - A callback to be called when the user changes the active input device.
   * @param getUserMedia - The getUserMedia method to use.
   * @param [options]
   */
  constructor(onActiveOutputsChanged: (type: 'ringtone' | 'speaker', outputIds: string[]) => Promise<void>,
              onActiveInputChanged: (stream: MediaStream | null) => Promise<void>,
              getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>,
              options?: AudioHelper.Options) {
    super();

    options = Object.assign({
      AudioContext: typeof AudioContext !== 'undefined' && AudioContext,
      setSinkId: typeof HTMLAudioElement !== 'undefined' && (HTMLAudioElement.prototype as any).setSinkId,
    }, options);

    this._getUserMedia = getUserMedia;
    this._mediaDevices = options.mediaDevices || getMediaDevicesInstance() as AudioHelper.MediaDevicesLike;
    this._onActiveInputChanged = onActiveInputChanged;
    this._enumerateDevices = typeof options.enumerateDevices === 'function'
      ? options.enumerateDevices
      : this._mediaDevices && this._mediaDevices.enumerateDevices;

    const isAudioContextSupported: boolean = !!(options.AudioContext || options.audioContext);
    const isEnumerationSupported: boolean = !!this._enumerateDevices;

    const isSetSinkSupported: boolean = typeof options.setSinkId === 'function';
    this.isOutputSelectionSupported = isEnumerationSupported && isSetSinkSupported;
    this.isVolumeSupported = isAudioContextSupported;

    if (this.isVolumeSupported) {
      this._audioContext = options.audioContext || options.AudioContext && new options.AudioContext();
      if (this._audioContext) {
        this._inputVolumeAnalyser = this._audioContext.createAnalyser();
        this._inputVolumeAnalyser.fftSize = 32;
        this._inputVolumeAnalyser.smoothingTimeConstant = 0.3;
      }
    }

    this.ringtoneDevices = new OutputDeviceCollection('ringtone',
      this.availableOutputDevices, onActiveOutputsChanged, this.isOutputSelectionSupported);
    this.speakerDevices = new OutputDeviceCollection('speaker',
      this.availableOutputDevices, onActiveOutputsChanged, this.isOutputSelectionSupported);

    this.addListener('newListener', (eventName: string) => {
      if (eventName === 'inputVolume') {
        this._maybeStartPollingVolume();
      }
    });

    this.addListener('removeListener', (eventName: string) => {
      if (eventName === 'inputVolume') {
        this._maybeStopPollingVolume();
      }
    });

    this.once('newListener', () => {
      // NOTE (rrowland): Ideally we would only check isEnumerationSupported here, but
      //   in at least one browser version (Tested in FF48) enumerateDevices actually
      //   returns bad data for the listed devices. Instead, we check for
      //   isOutputSelectionSupported to avoid these quirks that may negatively affect customers.
      if (!this.isOutputSelectionSupported) {
        this._log.warn('Warning: This browser does not support audio output selection.');
      }

      if (!this.isVolumeSupported) {
        this._log.warn(`Warning: This browser does not support Twilio's volume indicator feature.`);
      }
    });

    if (isEnumerationSupported) {
      this._initializeEnumeration();
    }
  }

  /**
   * Start polling volume if it's supported and there's an input stream to poll.
   * @private
   */
  _maybeStartPollingVolume(): void {
    if (!this.isVolumeSupported || !this._inputStream) { return; }

    this._updateVolumeSource();

    if (this._isPollingInputVolume || !this._inputVolumeAnalyser) { return; }

    const bufferLength: number = this._inputVolumeAnalyser.frequencyBinCount;
    const buffer: Uint8Array = new Uint8Array(bufferLength);

    this._isPollingInputVolume = true;

    const emitVolume = (): void => {
      if (!this._isPollingInputVolume) { return; }

      if (this._inputVolumeAnalyser) {
        this._inputVolumeAnalyser.getByteFrequencyData(buffer);
        const inputVolume: number = average(buffer);

        this.emit('inputVolume', inputVolume / 255);
      }

      requestAnimationFrame(emitVolume);
    };

    requestAnimationFrame(emitVolume);
  }

  /**
   * Stop polling volume if it's currently polling and there are no listeners.
   * @private
   */
  _maybeStopPollingVolume(): void {
    if (!this.isVolumeSupported) { return; }

    if (!this._isPollingInputVolume || (this._inputStream && this.listenerCount('inputVolume'))) {
      return;
    }

    if (this._inputVolumeSource) {
      this._inputVolumeSource.disconnect();
      delete this._inputVolumeSource;
    }

    this._isPollingInputVolume = false;
  }

  /**
   * Unbind the listeners from mediaDevices.
   * @private
   */
  _unbind(): void {
    if (!this._mediaDevices || !this._enumerateDevices) {
      throw new NotSupportedError('Enumeration is not supported');
    }

    if (this._mediaDevices.removeEventListener) {
      this._mediaDevices.removeEventListener('devicechange', this._updateAvailableDevices);
      this._mediaDevices.removeEventListener('deviceinfochange', this._updateAvailableDevices);
    }
  }

  /**
   * Enable or disable the disconnect sound.
   * @param doEnable Passing `true` will enable the sound and `false` will disable the sound.
   * Not passing this parameter will not alter the enable-status of the sound.
   * @returns The enable-status of the sound.
   */
  disconnect(doEnable?: boolean): boolean {
    return this._maybeEnableSound(Device.SoundName.Disconnect, doEnable);
  }

  /**
   * Enable or disable the incoming sound.
   * @param doEnable Passing `true` will enable the sound and `false` will disable the sound.
   * Not passing this parameter will not alter the enable-status of the sound.
   * @returns The enable-status of the sound.
   */
  incoming(doEnable?: boolean): boolean {
    return this._maybeEnableSound(Device.SoundName.Incoming, doEnable);
  }

  /**
   * Enable or disable the outgoing sound.
   * @param doEnable Passing `true` will enable the sound and `false` will disable the sound.
   * Not passing this parameter will not alter the enable-status of the sound.
   * @returns The enable-status of the sound.
   */
  outgoing(doEnable?: boolean): boolean {
    return this._maybeEnableSound(Device.SoundName.Outgoing, doEnable);
  }

  /**
   * Set the MediaTrackConstraints to be applied on every getUserMedia call for new input
   * device audio. Any deviceId specified here will be ignored. Instead, device IDs should
   * be specified using {@link AudioHelper#setInputDevice}. The returned Promise resolves
   * when the media is successfully reacquired, or immediately if no input device is set.
   * @param audioConstraints - The MediaTrackConstraints to apply.
   */
  setAudioConstraints(audioConstraints: MediaTrackConstraints): Promise<void> {
    this._audioConstraints = Object.assign({ }, audioConstraints);
    delete this._audioConstraints.deviceId;

    return this.inputDevice
      ? this._setInputDevice(this.inputDevice.deviceId, true)
      : Promise.resolve();
  }

  /**
   * Replace the current input device with a new device by ID.
   * @param deviceId - An ID of a device to replace the existing
   *   input device with.
   */
  setInputDevice(deviceId: string): Promise<void> {
    return !isFirefox()
      ? this._setInputDevice(deviceId, false)
      : Promise.reject(new NotSupportedError('Firefox does not currently support opening multiple ' +
        'audio input tracks simultaneously, even across different tabs. As a result, ' +
        'Device.audio.setInputDevice is disabled on Firefox until support is added.\n' +
        'Related BugZilla thread: https://bugzilla.mozilla.org/show_bug.cgi?id=1299324'));
  }

  /**
   * Unset the MediaTrackConstraints to be applied on every getUserMedia call for new input
   * device audio. The returned Promise resolves when the media is successfully reacquired,
   * or immediately if no input device is set.
   */
  unsetAudioConstraints(): Promise<void> {
    this._audioConstraints = null;
    return this.inputDevice
      ? this._setInputDevice(this.inputDevice.deviceId, true)
      : Promise.resolve();
  }

  /**
   * Unset the input device, stopping the tracks. This should only be called when not in a connection, and
   *   will not allow removal of the input device during a live call.
   */
  unsetInputDevice(): Promise<void> {
    if (!this.inputDevice) { return Promise.resolve(); }

    return this._onActiveInputChanged(null).then(() => {
      this._replaceStream(null);
      this._inputDevice = null;
      this._maybeStopPollingVolume();
    });
  }

  /**
   * Get the index of an un-labeled Device.
   * @param mediaDeviceInfo
   * @returns The index of the passed MediaDeviceInfo
   */
  private _getUnknownDeviceIndex(mediaDeviceInfo: MediaDeviceInfo): number {
    const id: string = mediaDeviceInfo.deviceId;
    const kind: string = mediaDeviceInfo.kind;

    let index: number = this._unknownDeviceIndexes[kind][id];
    if (!index) {
      index = Object.keys(this._unknownDeviceIndexes[kind]).length + 1;
      this._unknownDeviceIndexes[kind][id] = index;
    }

    return index;
  }

  /**
   * Initialize output device enumeration.
   */
  private _initializeEnumeration(): void {
    if (!this._mediaDevices || !this._enumerateDevices) {
      throw new NotSupportedError('Enumeration is not supported');
    }

    if (this._mediaDevices.addEventListener) {
      this._mediaDevices.addEventListener('devicechange', this._updateAvailableDevices);
      this._mediaDevices.addEventListener('deviceinfochange', this._updateAvailableDevices);
    }

    this._updateAvailableDevices().then(() => {
      if (!this.isOutputSelectionSupported) { return; }

      Promise.all([
        this.speakerDevices.set('default'),
        this.ringtoneDevices.set('default'),
      ]).catch(reason => {
        this._log.warn(`Warning: Unable to set audio output devices. ${reason}`);
      });
    });
  }

  /**
   * Set whether the sound is enabled or not
   * @param soundName
   * @param doEnable
   * @returns Whether the sound is enabled or not
   */
  private _maybeEnableSound(soundName: Device.ToggleableSound, doEnable?: boolean): boolean {
    if (typeof doEnable !== 'undefined') {
      this._enabledSounds[soundName] = doEnable;
    }
    return this._enabledSounds[soundName];
  }

  /**
   * Remove an input device from inputs
   * @param lostDevice
   * @returns Whether the device was active
   */
  private _removeLostInput = (lostDevice: MediaDeviceInfo): boolean => {
    if (!this.inputDevice || this.inputDevice.deviceId !== lostDevice.deviceId) {
      return false;
    }

    this._replaceStream(null);
    this._inputDevice = null;
    this._maybeStopPollingVolume();

    const defaultDevice: MediaDeviceInfo = this.availableInputDevices.get('default')
      || Array.from(this.availableInputDevices.values())[0];

    if (defaultDevice) {
      this.setInputDevice(defaultDevice.deviceId);
    }

    return true;
  }

  /**
   * Remove an input device from outputs
   * @param lostDevice
   * @returns Whether the device was active
   */
  private _removeLostOutput = (lostDevice: MediaDeviceInfo): boolean => {
    const wasSpeakerLost: boolean = this.speakerDevices.delete(lostDevice);
    const wasRingtoneLost: boolean = this.ringtoneDevices.delete(lostDevice);
    return wasSpeakerLost || wasRingtoneLost;
  }

  /**
   * Stop the tracks on the current input stream before replacing it with the passed stream.
   * @param stream - The new stream
   */
  private _replaceStream(stream: MediaStream | null): void {
    if (this._inputStream) {
      this._inputStream.getTracks().forEach(track => {
        track.stop();
      });
    }

    this._inputStream = stream;
  }

  /**
   * Replace the current input device with a new device by ID.
   * @param deviceId - An ID of a device to replace the existing
   *   input device with.
   * @param forceGetUserMedia - If true, getUserMedia will be called even if
   *   the specified device is already active.
   */
  private _setInputDevice(deviceId: string, forceGetUserMedia: boolean): Promise<void> {
    if (typeof deviceId !== 'string') {
      return Promise.reject(new InvalidArgumentError('Must specify the device to set'));
    }

    const device: MediaDeviceInfo | undefined = this.availableInputDevices.get(deviceId);
    if (!device) {
      return Promise.reject(new InvalidArgumentError(`Device not found: ${deviceId}`));
    }

    if (this._inputDevice && this._inputDevice.deviceId === deviceId && this._inputStream) {
      if (!forceGetUserMedia) {
        return Promise.resolve();
      }

      // If the currently active track is still in readyState `live`, gUM may return the same track
      // rather than returning a fresh track.
      this._inputStream.getTracks().forEach(track => {
        track.stop();
      });
    }

    const constraints = { audio: Object.assign({ deviceId: { exact: deviceId } }, this.audioConstraints) };
    return this._getUserMedia(constraints).then((stream: MediaStream) => {
      return this._onActiveInputChanged(stream).then(() => {
        this._replaceStream(stream);
        this._inputDevice = device;
        this._maybeStartPollingVolume();
      });
    });
  }

  /**
   * Update the available input and output devices
   */
  private _updateAvailableDevices = (): Promise<void> => {
    if (!this._mediaDevices || !this._enumerateDevices) {
      return Promise.reject('Enumeration not supported');
    }

    return this._enumerateDevices().then((devices: MediaDeviceInfo[]) => {
      this._updateDevices(devices.filter((d: MediaDeviceInfo) => d.kind === 'audiooutput'),
        this.availableOutputDevices,
        this._removeLostOutput);

      this._updateDevices(devices.filter((d: MediaDeviceInfo) => d.kind === 'audioinput'),
        this.availableInputDevices,
        this._removeLostInput);

      const defaultDevice = this.availableOutputDevices.get('default')
        || Array.from(this.availableOutputDevices.values())[0];

      [this.speakerDevices, this.ringtoneDevices].forEach(outputDevices => {
        if (!outputDevices.get().size && this.availableOutputDevices.size && this.isOutputSelectionSupported) {
          outputDevices.set(defaultDevice.deviceId)
            .catch((reason) => {
              this._log.warn(`Unable to set audio output devices. ${reason}`);
            });
        }
      });
    });
  }

  /**
   * Update a set of devices.
   * @param updatedDevices - An updated list of available Devices
   * @param availableDevices - The previous list of available Devices
   * @param removeLostDevice - The method to call if a previously available Device is
   *   no longer available.
   */
  private _updateDevices(updatedDevices: MediaDeviceInfo[],
                         availableDevices: Map<string, MediaDeviceInfo>,
                         removeLostDevice: (lostDevice: MediaDeviceInfo) => boolean): void {
    const updatedDeviceIds: string[] = updatedDevices.map(d => d.deviceId);
    const knownDeviceIds: string[] = Array.from(availableDevices.values()).map(d => d.deviceId);
    const lostActiveDevices: MediaDeviceInfo[] = [];

    // Remove lost devices
    const lostDeviceIds: string[] = difference(knownDeviceIds, updatedDeviceIds);
    lostDeviceIds.forEach((lostDeviceId: string) => {
      const lostDevice: MediaDeviceInfo | undefined = availableDevices.get(lostDeviceId);
      if (lostDevice) {
        availableDevices.delete(lostDeviceId);
        if (removeLostDevice(lostDevice)) { lostActiveDevices.push(lostDevice); }
      }
    });

    // Add any new devices, or devices with updated labels
    let deviceChanged: boolean = false;
    updatedDevices.forEach(newDevice => {
      const existingDevice: MediaDeviceInfo | undefined = availableDevices.get(newDevice.deviceId);
      const newMediaDeviceInfo: MediaDeviceInfo = this._wrapMediaDeviceInfo(newDevice);

      if (!existingDevice || existingDevice.label !== newMediaDeviceInfo.label) {
        availableDevices.set(newDevice.deviceId, newMediaDeviceInfo);
        deviceChanged = true;
      }
    });

    if (deviceChanged || lostDeviceIds.length) {
      // Force a new gUM in case the underlying tracks of the active stream have changed. One
      //   reason this might happen is when `default` is selected and set to a USB device,
      //   then that device is unplugged or plugged back in. We can't check for the 'ended'
      //   event or readyState because it is asynchronous and may take upwards of 5 seconds,
      //   in my testing. (rrowland)
      if (this.inputDevice !== null && this.inputDevice.deviceId === 'default') {
        this._log.warn(`Calling getUserMedia after device change to ensure that the \
          tracks of the active device (default) have not gone stale.`);
        this._setInputDevice(this.inputDevice.deviceId, true);
      }

      this.emit('deviceChange', lostActiveDevices);
    }
  }

  /**
   * Disconnect the old input volume source, and create and connect a new one with the current
   * input stream.
   */
  private _updateVolumeSource(): void {
    if (!this._inputStream || !this._audioContext || !this._inputVolumeAnalyser) {
      return;
    }

    if (this._inputVolumeSource) {
      this._inputVolumeSource.disconnect();
    }

    try {
      this._inputVolumeSource = this._audioContext.createMediaStreamSource(this._inputStream);
      this._inputVolumeSource.connect(this._inputVolumeAnalyser);
    } catch (ex) {
      this._log.warn('Unable to update volume source', ex);
      delete this._inputVolumeSource;
    }
  }

  /**
   * Convert a MediaDeviceInfo to a IMediaDeviceInfoShim.
   * @param mediaDeviceInfo - The info to convert
   * @returns The converted shim
   */
  private _wrapMediaDeviceInfo(mediaDeviceInfo: MediaDeviceInfo): MediaDeviceInfo {
    const options: Record<string, string> = {
      deviceId: mediaDeviceInfo.deviceId,
      groupId: mediaDeviceInfo.groupId,
      kind: mediaDeviceInfo.kind,
      label: mediaDeviceInfo.label,
    };

    if (!options.label) {
      if (options.deviceId === 'default') {
        options.label = 'Default';
      } else {
        const index: number = this._getUnknownDeviceIndex(mediaDeviceInfo);
        options.label = `Unknown ${kindAliases[options.kind]} Device ${index}`;
      }
    }

    return new MediaDeviceInfoShim(options) as MediaDeviceInfo;
  }
}

namespace AudioHelper {
  /**
   * Emitted when the available set of Devices changes.
   * @param lostActiveDevices - An array containing any Devices that were previously active
   * that were lost as a result of this deviceChange event.
   * @example `device.audio.on('deviceChange', lostActiveDevices => { })`
   * @event
   * @private
   */
  declare function deviceChangeEvent(lostActiveDevices: MediaDeviceInfo[]): void;

  /**
   * Emitted on `requestAnimationFrame` (up to 60fps, depending on browser) with
   *   the current input and output volumes, as a percentage of maximum
   *   volume, between -100dB and -30dB. Represented by a floating point
   *   number.
   * @param inputVolume - A floating point number between 0.0 and 1.0 inclusive.
   * @example `device.audio.on('inputVolume', volume => { })`
   * @event
   */
  declare function inputVolumeEvent(inputVolume: number): void;

  /**
   * An object like MediaDevices.
   * @private
   */
  export interface MediaDevicesLike {
    addEventListener?: (eventName: string, handler: (...args: any[]) => void) => void;
    enumerateDevices: (...args: any[]) => any;
    getUserMedia: (...args: any[]) => any;
    removeEventListener?: (eventName: string, handler: (...args: any[]) => void) => void;
  }

  /**
   * Options that can be passed to the AudioHelper constructor
   * @private
   */
  export interface Options {
    /**
     * A custom replacement for the AudioContext constructor.
     */
    AudioContext?: typeof AudioContext;

    /**
     * An existing AudioContext instance to use.
     */
    audioContext?: AudioContext;

    /**
     * Overrides the native MediaDevices.enumerateDevices API.
     */
    enumerateDevices?: any;

    /**
     * A custom MediaDevices instance to use.
     */
    mediaDevices?: AudioHelper.MediaDevicesLike;

    /**
     * A custom setSinkId function to use.
     */
    setSinkId?: (sinkId: string) => Promise<void>;
  }
}

export default AudioHelper;
