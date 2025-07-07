import { EventEmitter } from 'events';
import AudioProcessor from './audioprocessor';
import { AudioProcessorEventObserver } from './audioprocessoreventobserver';
import Device from './device';
import { InvalidArgumentError, NotSupportedError } from './errors';
import Log from './log';
import OutputDeviceCollection from './outputdevicecollection';
import MediaDeviceInfoShim from './shims/mediadeviceinfo';
import { average, difference, isFirefox } from './util';

/**
 * Aliases for audio kinds, used for labelling.
 */
const kindAliases: Record<string, string> = {
  audioinput: 'Audio Input',
  audiooutput: 'Audio Output',
};

/**
 * Provides input and output audio-based functionality in one convenient class.
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
   * The current input stream coming from the microphone device or
   * the processed audio stream if there is an {@link AudioProcessor}.
   */
  get inputStream(): MediaStream | null { return this._processedStream || this._selectedInputDeviceStream; }

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
   * The processed stream if an {@link AudioProcessor} was previously added.
   */
  get processedStream(): MediaStream | null { return this._processedStream; }

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
   * The AudioProcessorEventObserver instance to use
   */
  private _audioProcessorEventObserver: AudioProcessorEventObserver;

  /**
   * Promise to wait for before setting the input device.
   */
  private _beforeSetInputDevice: () => Promise<any>;

  /**
   * The audio stream of the default device.
   * This is populated when _openDefaultDeviceWithConstraints is called,
   * See _selectedInputDeviceStream for differences.
   * TODO: Combine these two workflows (3.x?)
   */
  private _defaultInputDeviceStream: MediaStream | null = null;

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
   * The internal promise created when calling setInputDevice
   */
  private _inputDevicePromise: Promise<void> | null = null;

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
  private _log: Log = new Log('AudioHelper');

  /**
   * The MediaDevices instance to use.
   */
  private _mediaDevices: AudioHelper.MediaDevicesLike | null;

  /**
   * The microphone permission status
   */
  private _microphonePermissionStatus: PermissionStatus | null;

  /**
   * Called with the new input stream when the active input is changed.
   */
  private _onActiveInputChanged: (stream: MediaStream | null) => Promise<void>;

  /**
   * Handler for microphone permission status change
   */
  private _onMicrophonePermissionStatusChanged: () => void;

  /**
   * Internal reference to the processed stream
   */
  private _processedStream: MediaStream | null = null;

  /**
   * Internal reference to the added AudioProcessor
   */
  private _processor: AudioProcessor | null;

  /**
   * The selected input stream coming from the microphone device.
   * This is populated when the setInputDevice is called, meaning,
   * the end user manually selected it, which is different than
   * the defaultInputDeviceStream.
   * TODO: Combine these two workflows (3.x?)
   */
  private _selectedInputDeviceStream: MediaStream | null = null;

  /**
   * A record of unknown devices (Devices without labels)
   */
  private _unknownDeviceIndexes: Record<string, Record<string, number>> = {
    audioinput: { },
    audiooutput: { },
  };

  /**
   * @internal
   * @param onActiveOutputsChanged - A callback to be called when the user changes the active output devices.
   * @param onActiveInputChanged - A callback to be called when the user changes the active input device.
   * @param [options]
   */
  constructor(onActiveOutputsChanged: (type: 'ringtone' | 'speaker', outputIds: string[]) => Promise<void>,
              onActiveInputChanged: (stream: MediaStream | null) => Promise<void>,
              options?: AudioHelper.Options) {
    super();

    options = Object.assign({
      AudioContext: typeof AudioContext !== 'undefined' && AudioContext,
      setSinkId: typeof HTMLAudioElement !== 'undefined' && (HTMLAudioElement.prototype as any).setSinkId,
    }, options);

    this._beforeSetInputDevice = options.beforeSetInputDevice || (() => Promise.resolve());

    this._updateUserOptions(options);

    this._audioProcessorEventObserver = options.audioProcessorEventObserver;
    this._mediaDevices = options.mediaDevices || navigator.mediaDevices;
    this._onActiveInputChanged = onActiveInputChanged;
    this._enumerateDevices = typeof options.enumerateDevices === 'function'
      ? options.enumerateDevices
      : this._mediaDevices && this._mediaDevices.enumerateDevices.bind(this._mediaDevices);

    const isAudioContextSupported: boolean = !!(options.AudioContext || options.audioContext);
    const isEnumerationSupported: boolean = !!this._enumerateDevices;

    if (options.enabledSounds) {
      this._enabledSounds = options.enabledSounds;
    }

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

    // NOTE (kchoy): Currently microphone permissions are not supported in firefox, and Safari V15 and older.
    // https://github.com/mozilla/standards-positions/issues/19#issuecomment-370158947
    // https://caniuse.com/permissions-api
    if (navigator && navigator.permissions && typeof navigator.permissions.query === 'function') {
      navigator.permissions.query({ name: 'microphone' }).then((microphonePermissionStatus) => {
        if (microphonePermissionStatus.state !== 'granted') {
          const handleStateChange = () => {
            this._updateAvailableDevices();
            this._stopMicrophonePermissionListener();
          };
          microphonePermissionStatus.addEventListener('change', handleStateChange);
          this._microphonePermissionStatus = microphonePermissionStatus;
          this._onMicrophonePermissionStatusChanged = handleStateChange;
        }
      }).catch((reason) => this._log.warn(`Warning: unable to listen for microphone permission changes. ${reason}`));
    } else {
      this._log.warn('Warning: current browser does not support permissions API.');
    }
  }

  /**
   * Destroy this AudioHelper instance
   * @internal
   */
  _destroy(): void {
    this._stopDefaultInputDeviceStream();
    this._stopSelectedInputDeviceStream();
    this._destroyProcessedStream();
    this._maybeStopPollingVolume();
    this.removeAllListeners();
    this._stopMicrophonePermissionListener();
    this._unbind();
  }

  /**
   * Promise to wait for the input device, if setInputDevice is called outside of the SDK
   * @internal
   */
  _getInputDevicePromise(): Promise<void> | null {
    return this._inputDevicePromise;
  }

  /**
   * Start polling volume if it's supported and there's an input stream to poll.
   * @internal
   */
  _maybeStartPollingVolume(): void {
    if (!this.isVolumeSupported || !this.inputStream) { return; }

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
   * @internal
   */
  _maybeStopPollingVolume(): void {
    if (!this.isVolumeSupported) { return; }

    if (!this._isPollingInputVolume || (this.inputStream && this.listenerCount('inputVolume'))) {
      return;
    }

    if (this._inputVolumeSource) {
      this._inputVolumeSource.disconnect();
      delete this._inputVolumeSource;
    }

    this._isPollingInputVolume = false;
  }

  /**
   * Call getUserMedia with specified constraints
   * @internal
   */
  _openDefaultDeviceWithConstraints(constraints: MediaStreamConstraints): Promise<MediaStream> {
    this._log.info('Opening default device with constraints', constraints);
    return this._getUserMedia(constraints).then((stream: MediaStream) => {

      this._log.info('Opened default device. Updating available devices.');
      // Ensures deviceId's and labels are populated after the gUM call
      // by calling enumerateDevices
      this._updateAvailableDevices().catch(error => {
        // Ignore error, we don't want to break the call flow
        this._log.warn('Unable to updateAvailableDevices after gUM call', error);
      });
      this._defaultInputDeviceStream = stream;
      return this._maybeCreateProcessedStream(stream);
    });
  }

  /**
   * Stop the default audio stream
   * @internal
   */
  _stopDefaultInputDeviceStream(): void {
    if (this._defaultInputDeviceStream) {
      this._log.info('stopping default device stream');
      this._defaultInputDeviceStream.getTracks().forEach(track => track.stop());
      this._defaultInputDeviceStream = null;
      this._destroyProcessedStream();
    }
  }

  /**
   * Unbind the listeners from mediaDevices.
   * @internal
   */
  _unbind(): void {
    if (this._mediaDevices?.removeEventListener) {
      this._mediaDevices.removeEventListener('devicechange', this._updateAvailableDevices);
    }
  }

  /**
   * Update the available input and output devices
   * @internal
   */
  _updateAvailableDevices = (): Promise<void> => {
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
   * Update AudioHelper options that can be changed by the user
   * @internal
   */
  _updateUserOptions(options: AudioHelper.Options): void {
    if (typeof options.enumerateDevices === 'function') {
      this._enumerateDevices = options.enumerateDevices;
    }
    if (typeof options.getUserMedia === 'function') {
      this._getUserMedia = options.getUserMedia;
    }
  }

  /**
   * Adds an {@link AudioProcessor} object. Once added, the AudioHelper will route
   * the input audio stream through the processor before sending the audio
   * stream to Twilio. Only one AudioProcessor can be added at this time.
   *
   * See the {@link AudioProcessor} interface for an example.
   *
   * @param processor The AudioProcessor to add.
   * @returns
   */
  addProcessor(processor: AudioProcessor): Promise<void> {
    this._log.debug('.addProcessor');

    if (this._processor) {
      throw new NotSupportedError('Adding multiple AudioProcessors is not supported at this time.');
    }

    if (typeof processor !== 'object' || processor === null) {
      throw new InvalidArgumentError('Missing AudioProcessor argument.');
    }

    if (typeof processor.createProcessedStream !== 'function') {
      throw new InvalidArgumentError('Missing createProcessedStream() method.');
    }

    if (typeof processor.destroyProcessedStream !== 'function') {
      throw new InvalidArgumentError('Missing destroyProcessedStream() method.');
    }

    this._processor = processor;
    this._audioProcessorEventObserver.emit('add');
    return this._restartStreams();
  }

  /**
   * Enable or disable the disconnect sound.
   * @param doEnable Passing `true` will enable the sound and `false` will disable the sound.
   * Not passing this parameter will not alter the enable-status of the sound.
   * @returns The enable-status of the sound.
   */
  disconnect(doEnable?: boolean): boolean {
    this._log.debug('.disconnect', doEnable);
    return this._maybeEnableSound(Device.SoundName.Disconnect, doEnable);
  }

  /**
   * Enable or disable the incoming sound.
   * @param doEnable Passing `true` will enable the sound and `false` will disable the sound.
   * Not passing this parameter will not alter the enable-status of the sound.
   * @returns The enable-status of the sound.
   */
  incoming(doEnable?: boolean): boolean {
    this._log.debug('.incoming', doEnable);
    return this._maybeEnableSound(Device.SoundName.Incoming, doEnable);
  }

  /**
   * Enable or disable the outgoing sound.
   * @param doEnable Passing `true` will enable the sound and `false` will disable the sound.
   * Not passing this parameter will not alter the enable-status of the sound.
   * @returns The enable-status of the sound.
   */
  outgoing(doEnable?: boolean): boolean {
    this._log.debug('.outgoing', doEnable);
    return this._maybeEnableSound(Device.SoundName.Outgoing, doEnable);
  }

  /**
   * Removes an {@link AudioProcessor}. Once removed, the AudioHelper will start using
   * the audio stream from the selected input device for existing or future calls.
   *
   * @param processor The AudioProcessor to remove.
   * @returns
   */
  removeProcessor(processor: AudioProcessor): Promise<void> {
    this._log.debug('.removeProcessor');

    if (typeof processor !== 'object' || processor === null) {
      throw new InvalidArgumentError('Missing AudioProcessor argument.');
    }

    if (this._processor !== processor) {
      throw new InvalidArgumentError('Cannot remove an AudioProcessor that has not been previously added.');
    }

    this._destroyProcessedStream();
    this._processor = null;
    this._audioProcessorEventObserver.emit('remove');
    return this._restartStreams();
  }

  /**
   * Set the MediaTrackConstraints to be applied on every getUserMedia call for new input
   * device audio. Any deviceId specified here will be ignored. Instead, device IDs should
   * be specified using {@link AudioHelper#setInputDevice}. The returned Promise resolves
   * when the media is successfully reacquired, or immediately if no input device is set.
   * @param audioConstraints - The MediaTrackConstraints to apply.
   */
  setAudioConstraints(audioConstraints: MediaTrackConstraints): Promise<void> {
    this._log.debug('.setAudioConstraints', audioConstraints);
    this._audioConstraints = Object.assign({ }, audioConstraints);
    delete this._audioConstraints.deviceId;

    return this.inputDevice
      ? this._setInputDevice(this.inputDevice.deviceId, true)
      : Promise.resolve();
  }

  /**
   * Replace the current input device with a new device by ID.
   *
   * Calling `setInputDevice` sets the stream for current and future calls and
   * will not release it automatically.
   *
   * While this behavior is not an issue, it will result in the application
   * holding onto the input device, and the application may show a red
   * "recording" symbol in the browser tab.
   *
   * To remove the red "recording" symbol, the device must be released. To
   * release it, call `unsetInputDevice` after the call disconnects. Note that
   * after calling `unsetInputDevice` future calls will then use the default
   * input device.
   *
   * Consider application logic that keeps track of the user-selected device
   * and call `setInputDevice` before calling `device.connect()` for outgoing
   * calls and `call.accept()` for incoming calls. Furthermore, consider
   * calling `unsetInputDevice` once a call is disconnected. Below is an
   * example:
   *
   * ```ts
   * import { Device } from '@twilio/voice-sdk';
   * let inputDeviceId = ...;
   * const device = new Device(...);
   *
   * async function makeOutgoingCall() {
   *   await device.audio.setInputDevice(inputDeviceId);
   *   const call = await device.connect(...);
   *
   *   call.on('disconnect', async () => {
   *     inputDeviceId = ... // save the current input device id
   *     await device.audio.unsetInputDevice();
   *   });
   * }
   *
   * async function acceptIncomingCall(incomingCall) {
   *   await device.audio.setInputDevice(inputDeviceId);
   *   await incomingCall.accept();
   *
   *   incomingCall.on('disconnect', async () => {
   *     inputDeviceId = ... // save the current input device id
   *     await device.audio.unsetInputDevice();
   *   });
   * }
   * ```
   *
   * @param deviceId - An ID of a device to replace the existing
   *   input device with.
   */
  setInputDevice(deviceId: string): Promise<void> {
    this._log.debug('.setInputDevice', deviceId);
    return this._setInputDevice(deviceId, false);
  }

  /**
   * Unset the MediaTrackConstraints to be applied on every getUserMedia call for new input
   * device audio. The returned Promise resolves when the media is successfully reacquired,
   * or immediately if no input device is set.
   */
  unsetAudioConstraints(): Promise<void> {
    this._log.debug('.unsetAudioConstraints');
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
    this._log.debug('.unsetInputDevice', this.inputDevice);
    if (!this.inputDevice) { return Promise.resolve(); }

    this._destroyProcessedStream();

    return this._onActiveInputChanged(null).then(() => {
      this._replaceStream(null);
      this._inputDevice = null;
      this._maybeStopPollingVolume();
    });
  }

  /**
   * Destroys processed stream and update references
   */
  private _destroyProcessedStream() {
    if (this._processor && this._processedStream) {
      this._log.info('destroying processed stream');
      const processedStream = this._processedStream;
      this._processedStream.getTracks().forEach(track => track.stop());
      this._processedStream = null;
      this._processor.destroyProcessedStream(processedStream);
      this._audioProcessorEventObserver.emit('destroy');
    }
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
   * Route input stream to the processor if it exists
   */
  private _maybeCreateProcessedStream(stream: MediaStream): Promise<MediaStream> {
    if (this._processor) {
      this._log.info('Creating processed stream');
      return this._processor.createProcessedStream(stream).then((processedStream: MediaStream) => {
        this._processedStream = processedStream;
        this._audioProcessorEventObserver.emit('create');
        return this._processedStream;
      });
    }
    return Promise.resolve(stream);
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

    this._destroyProcessedStream();
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
    this._log.info('Replacing with new stream.');
    if (this._selectedInputDeviceStream) {
      this._log.info('Old stream detected. Stopping tracks.');
      this._stopSelectedInputDeviceStream();
    }

    this._selectedInputDeviceStream = stream;
  }

  /**
   * Restart the active streams
   */
  private _restartStreams(): Promise<void> {
    if (this.inputDevice && this._selectedInputDeviceStream) {
      this._log.info('Restarting selected input device');
      return this._setInputDevice(this.inputDevice.deviceId, true);
    }

    if (this._defaultInputDeviceStream) {
      const defaultDevice = this.availableInputDevices.get('default')
      || Array.from(this.availableInputDevices.values())[0];

      this._log.info('Restarting default input device, now becoming selected.');
      return this._setInputDevice(defaultDevice.deviceId, true);
    }

    return Promise.resolve();
  }

  /**
   * Replace the current input device with a new device by ID.
   * @param deviceId - An ID of a device to replace the existing
   *   input device with.
   * @param forceGetUserMedia - If true, getUserMedia will be called even if
   *   the specified device is already active.
   */
  private async _setInputDevice(deviceId: string, forceGetUserMedia: boolean): Promise<void> {
    const setInputDevice = async () => {
      await this._beforeSetInputDevice();

      if (typeof deviceId !== 'string') {
        return Promise.reject(new InvalidArgumentError('Must specify the device to set'));
      }

      const device: MediaDeviceInfo | undefined = this.availableInputDevices.get(deviceId);
      if (!device) {
        return Promise.reject(new InvalidArgumentError(`Device not found: ${deviceId}`));
      }

      this._log.info('Setting input device. ID: ' + deviceId);

      if (this._inputDevice && this._inputDevice.deviceId === deviceId && this._selectedInputDeviceStream) {
        if (!forceGetUserMedia) {
          return Promise.resolve();
        }

        // If the currently active track is still in readyState `live`, gUM may return the same track
        // rather than returning a fresh track.
        this._log.info('Same track detected on setInputDevice, stopping old tracks.');
        this._stopSelectedInputDeviceStream();
      }

      // Release the default device in case it was created previously
      this._stopDefaultInputDeviceStream();

      const constraints = { audio: Object.assign({ deviceId: { exact: deviceId } }, this.audioConstraints) };
      this._log.info('setInputDevice: getting new tracks.');
      return this._getUserMedia(constraints).then((originalStream: MediaStream) => {

        this._destroyProcessedStream();

        return this._maybeCreateProcessedStream(originalStream).then((newStream) => {
          this._log.info('setInputDevice: invoking _onActiveInputChanged.');
          return this._onActiveInputChanged(newStream).then(() => {
            this._replaceStream(originalStream);
            this._inputDevice = device;
            this._maybeStartPollingVolume();
          });
        });
      });
    };

    return this._inputDevicePromise = setInputDevice().finally(() => {
      this._inputDevicePromise = null;
    });
  }

  /**
   * Remove event listener for microphone permissions
   */
  private _stopMicrophonePermissionListener(): void {
    if (this._microphonePermissionStatus?.removeEventListener) {
      this._microphonePermissionStatus.removeEventListener('change', this._onMicrophonePermissionStatusChanged);
    }
  }

  /**
   * Stop the selected audio stream
   */
  private _stopSelectedInputDeviceStream(): void {
    if (this._selectedInputDeviceStream) {
      this._log.info('Stopping selected device stream');
      this._selectedInputDeviceStream.getTracks().forEach(track => track.stop());
    }
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
      const defaultId = 'default';
      // this.inputDevice is not null if audio.setInputDevice() was explicitly called
      const isInputDeviceSet = this.inputDevice && this.inputDevice.deviceId === defaultId;
      // If this.inputDevice is null, and default stream is not null, it means
      // the user is using the default stream and did not explicitly call audio.setInputDevice()
      const isDefaultDeviceSet = this._defaultInputDeviceStream && this.availableInputDevices.get(defaultId);

      if (isInputDeviceSet || isDefaultDeviceSet) {
        this._log.warn(`Calling getUserMedia after device change to ensure that the \
          tracks of the active device (default) have not gone stale.`);

        // NOTE(csantos): Updating the stream in the same execution context as the devicechange event
        // causes the new gUM call to fail silently. Meaning, the gUM call may succeed,
        // but it won't actually update the stream. We need to update the stream in a different
        // execution context (setTimeout) to properly update the stream.
        setTimeout(() => {
          this._setInputDevice(defaultId, true);
        }, 0);
      }
      this._log.debug('#deviceChange', lostActiveDevices);
      this.emit('deviceChange', lostActiveDevices);
    }
  }

  /**
   * Disconnect the old input volume source, and create and connect a new one with the current
   * input stream.
   */
  private _updateVolumeSource(): void {
    if (!this.inputStream || !this._audioContext || !this._inputVolumeAnalyser) {
      return;
    }

    if (this._inputVolumeSource) {
      this._inputVolumeSource.disconnect();
    }

    try {
      this._inputVolumeSource = this._audioContext.createMediaStreamSource(this.inputStream);
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

/**
 * @mergeModuleWith AudioHelper
 */
namespace AudioHelper {
  /**
   * Emitted when the available set of Devices changes.
   * @event
   * @param lostActiveDevices - An array containing any Devices that were previously active
   * that were lost as a result of this deviceChange event.
   * @example
   * ```ts
   * device.audio.on('deviceChange', lostActiveDevices => { });
   * ```
   */
  export declare function deviceChangeEvent(lostActiveDevices: MediaDeviceInfo[]): void;

  /**
   * Emitted on `requestAnimationFrame` (up to 60fps, depending on browser) with
   *   the current input and output volumes, as a percentage of maximum
   *   volume, between -100dB and -30dB. Represented by a floating point
   *   number.
   * @event
   * @param inputVolume - A floating point number between 0.0 and 1.0 inclusive.
   * @example
   * ```ts
   * device.audio.on('inputVolume', volume => { });
   * ```
   */
  export declare function inputVolumeEvent(inputVolume: number): void;

  /**
   * An object like MediaDevices.
   * @internal
   */
  export interface MediaDevicesLike {
    addEventListener?: (eventName: string, handler: (...args: any[]) => void) => void;
    enumerateDevices: (...args: any[]) => any;
    getUserMedia: (...args: any[]) => any;
    removeEventListener?: (eventName: string, handler: (...args: any[]) => void) => void;
  }

  /**
   * Options that can be passed to the AudioHelper constructor
   * @internal
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
     * AudioProcessorEventObserver to use
     */
    audioProcessorEventObserver: AudioProcessorEventObserver;

    /**
     * Promise to wait for before setting the input device.
     */
    beforeSetInputDevice?: () => Promise<any>;

    /**
     * Whether each sound is enabled.
     */
    enabledSounds?: Record<Device.ToggleableSound, boolean>;

    /**
     * Overrides the native MediaDevices.enumerateDevices API.
     */
    enumerateDevices?: any;

    /**
     * The getUserMedia method to use
     */
    getUserMedia: (constraints: MediaStreamConstraints) => Promise<MediaStream>;

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
