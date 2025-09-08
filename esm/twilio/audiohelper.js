import { __awaiter } from 'tslib';
import { EventEmitter } from 'events';
import Device from './device.js';
import { NotSupportedError, InvalidArgumentError } from './errors/index.js';
import Log from './log.js';
import OutputDeviceCollection from './outputdevicecollection.js';
import MediaDeviceInfoShim from './shims/mediadeviceinfo.js';
import { difference, average } from './util.js';

/**
 * Aliases for audio kinds, used for labelling.
 */
const kindAliases = {
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
    get audioConstraints() { return this._audioConstraints; }
    /**
     * The active input device. Having no inputDevice specified by `setInputDevice()`
     * will disable input selection related functionality.
     */
    get inputDevice() { return this._inputDevice; }
    /**
     * The current input stream coming from the microphone device or
     * the processed audio stream if there is an {@link AudioProcessor}.
     */
    get inputStream() { return this._processedStream || this._selectedInputDeviceStream; }
    /**
     * The processed stream if an {@link AudioProcessor} was previously added.
     */
    get processedStream() { return this._processedStream; }
    /**
     * @internal
     * @param onActiveOutputsChanged - A callback to be called when the user changes the active output devices.
     * @param onActiveInputChanged - A callback to be called when the user changes the active input device.
     * @param [options]
     */
    constructor(onActiveOutputsChanged, onActiveInputChanged, options) {
        super();
        /**
         * A Map of all audio input devices currently available to the browser by their device ID.
         */
        this.availableInputDevices = new Map();
        /**
         * A Map of all audio output devices currently available to the browser by their device ID.
         */
        this.availableOutputDevices = new Map();
        /**
         * The currently set audio constraints set by setAudioConstraints().
         */
        this._audioConstraints = null;
        /**
         * The audio stream of the default device.
         * This is populated when _openDefaultDeviceWithConstraints is called,
         * See _selectedInputDeviceStream for differences.
         * TODO: Combine these two workflows (3.x?)
         */
        this._defaultInputDeviceStream = null;
        /**
         * Whether each sound is enabled.
         */
        this._enabledSounds = {
            [Device.SoundName.Disconnect]: true,
            [Device.SoundName.Incoming]: true,
            [Device.SoundName.Outgoing]: true,
        };
        /**
         * The current input device.
         */
        this._inputDevice = null;
        /**
         * The internal promise created when calling setInputDevice
         */
        this._inputDevicePromise = null;
        /**
         * Whether the {@link AudioHelper} is currently polling the input stream's volume.
         */
        this._isPollingInputVolume = false;
        /**
         * An instance of Logger to use.
         */
        this._log = new Log('AudioHelper');
        /**
         * Internal reference to the processed stream
         */
        this._processedStream = null;
        /**
         * The selected input stream coming from the microphone device.
         * This is populated when the setInputDevice is called, meaning,
         * the end user manually selected it, which is different than
         * the defaultInputDeviceStream.
         * TODO: Combine these two workflows (3.x?)
         */
        this._selectedInputDeviceStream = null;
        /**
         * A record of unknown devices (Devices without labels)
         */
        this._unknownDeviceIndexes = {
            audioinput: {},
            audiooutput: {},
        };
        /**
         * Update the available input and output devices
         * @internal
         */
        this._updateAvailableDevices = () => {
            if (!this._mediaDevices || !this._enumerateDevices) {
                return Promise.reject('Enumeration not supported');
            }
            return this._enumerateDevices().then((devices) => {
                this._updateDevices(devices.filter((d) => d.kind === 'audiooutput'), this.availableOutputDevices, this._removeLostOutput);
                this._updateDevices(devices.filter((d) => d.kind === 'audioinput'), this.availableInputDevices, this._removeLostInput);
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
        };
        /**
         * Remove an input device from inputs
         * @param lostDevice
         * @returns Whether the device was active
         */
        this._removeLostInput = (lostDevice) => {
            if (!this.inputDevice || this.inputDevice.deviceId !== lostDevice.deviceId) {
                return false;
            }
            this._destroyProcessedStream();
            this._replaceStream(null);
            this._inputDevice = null;
            this._maybeStopPollingVolume();
            const defaultDevice = this.availableInputDevices.get('default')
                || Array.from(this.availableInputDevices.values())[0];
            if (defaultDevice) {
                this.setInputDevice(defaultDevice.deviceId);
            }
            return true;
        };
        /**
         * Remove an input device from outputs
         * @param lostDevice
         * @returns Whether the device was active
         */
        this._removeLostOutput = (lostDevice) => {
            const wasSpeakerLost = this.speakerDevices.delete(lostDevice);
            const wasRingtoneLost = this.ringtoneDevices.delete(lostDevice);
            return wasSpeakerLost || wasRingtoneLost;
        };
        options = Object.assign({
            AudioContext: typeof AudioContext !== 'undefined' && AudioContext,
            setSinkId: typeof HTMLAudioElement !== 'undefined' && HTMLAudioElement.prototype.setSinkId,
        }, options);
        this._beforeSetInputDevice = options.beforeSetInputDevice || (() => Promise.resolve());
        this._updateUserOptions(options);
        this._audioProcessorEventObserver = options.audioProcessorEventObserver;
        this._mediaDevices = options.mediaDevices || navigator.mediaDevices;
        this._onActiveInputChanged = onActiveInputChanged;
        this._enumerateDevices = typeof options.enumerateDevices === 'function'
            ? options.enumerateDevices
            : this._mediaDevices && this._mediaDevices.enumerateDevices.bind(this._mediaDevices);
        const isAudioContextSupported = !!(options.AudioContext || options.audioContext);
        const isEnumerationSupported = !!this._enumerateDevices;
        if (options.enabledSounds) {
            this._enabledSounds = options.enabledSounds;
        }
        const isSetSinkSupported = typeof options.setSinkId === 'function';
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
        this.ringtoneDevices = new OutputDeviceCollection('ringtone', this.availableOutputDevices, onActiveOutputsChanged, this.isOutputSelectionSupported);
        this.speakerDevices = new OutputDeviceCollection('speaker', this.availableOutputDevices, onActiveOutputsChanged, this.isOutputSelectionSupported);
        this.addListener('newListener', (eventName) => {
            if (eventName === 'inputVolume') {
                this._maybeStartPollingVolume();
            }
        });
        this.addListener('removeListener', (eventName) => {
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
        }
        else {
            this._log.warn('Warning: current browser does not support permissions API.');
        }
    }
    /**
     * Destroy this AudioHelper instance
     * @internal
     */
    _destroy() {
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
    _getInputDevicePromise() {
        return this._inputDevicePromise;
    }
    /**
     * Start polling volume if it's supported and there's an input stream to poll.
     * @internal
     */
    _maybeStartPollingVolume() {
        if (!this.isVolumeSupported || !this.inputStream) {
            return;
        }
        this._updateVolumeSource();
        if (this._isPollingInputVolume || !this._inputVolumeAnalyser) {
            return;
        }
        const bufferLength = this._inputVolumeAnalyser.frequencyBinCount;
        const buffer = new Uint8Array(bufferLength);
        this._isPollingInputVolume = true;
        const emitVolume = () => {
            if (!this._isPollingInputVolume) {
                return;
            }
            if (this._inputVolumeAnalyser) {
                this._inputVolumeAnalyser.getByteFrequencyData(buffer);
                const inputVolume = average(buffer);
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
    _maybeStopPollingVolume() {
        if (!this.isVolumeSupported) {
            return;
        }
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
    _openDefaultDeviceWithConstraints(constraints) {
        this._log.info('Opening default device with constraints', constraints);
        return this._getUserMedia(constraints).then((stream) => {
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
    _stopDefaultInputDeviceStream() {
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
    _unbind() {
        var _a;
        if ((_a = this._mediaDevices) === null || _a === void 0 ? void 0 : _a.removeEventListener) {
            this._mediaDevices.removeEventListener('devicechange', this._updateAvailableDevices);
        }
    }
    /**
     * Update AudioHelper options that can be changed by the user
     * @internal
     */
    _updateUserOptions(options) {
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
    addProcessor(processor) {
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
    disconnect(doEnable) {
        this._log.debug('.disconnect', doEnable);
        return this._maybeEnableSound(Device.SoundName.Disconnect, doEnable);
    }
    /**
     * Enable or disable the incoming sound.
     * @param doEnable Passing `true` will enable the sound and `false` will disable the sound.
     * Not passing this parameter will not alter the enable-status of the sound.
     * @returns The enable-status of the sound.
     */
    incoming(doEnable) {
        this._log.debug('.incoming', doEnable);
        return this._maybeEnableSound(Device.SoundName.Incoming, doEnable);
    }
    /**
     * Enable or disable the outgoing sound.
     * @param doEnable Passing `true` will enable the sound and `false` will disable the sound.
     * Not passing this parameter will not alter the enable-status of the sound.
     * @returns The enable-status of the sound.
     */
    outgoing(doEnable) {
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
    removeProcessor(processor) {
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
    setAudioConstraints(audioConstraints) {
        this._log.debug('.setAudioConstraints', audioConstraints);
        this._audioConstraints = Object.assign({}, audioConstraints);
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
    setInputDevice(deviceId) {
        this._log.debug('.setInputDevice', deviceId);
        return this._setInputDevice(deviceId, false);
    }
    /**
     * Unset the MediaTrackConstraints to be applied on every getUserMedia call for new input
     * device audio. The returned Promise resolves when the media is successfully reacquired,
     * or immediately if no input device is set.
     */
    unsetAudioConstraints() {
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
    unsetInputDevice() {
        this._log.debug('.unsetInputDevice', this.inputDevice);
        if (!this.inputDevice) {
            return Promise.resolve();
        }
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
    _destroyProcessedStream() {
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
    _getUnknownDeviceIndex(mediaDeviceInfo) {
        const id = mediaDeviceInfo.deviceId;
        const kind = mediaDeviceInfo.kind;
        let index = this._unknownDeviceIndexes[kind][id];
        if (!index) {
            index = Object.keys(this._unknownDeviceIndexes[kind]).length + 1;
            this._unknownDeviceIndexes[kind][id] = index;
        }
        return index;
    }
    /**
     * Initialize output device enumeration.
     */
    _initializeEnumeration() {
        if (!this._mediaDevices || !this._enumerateDevices) {
            throw new NotSupportedError('Enumeration is not supported');
        }
        if (this._mediaDevices.addEventListener) {
            this._mediaDevices.addEventListener('devicechange', this._updateAvailableDevices);
        }
        this._updateAvailableDevices().then(() => {
            if (!this.isOutputSelectionSupported) {
                return;
            }
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
    _maybeCreateProcessedStream(stream) {
        if (this._processor) {
            this._log.info('Creating processed stream');
            return this._processor.createProcessedStream(stream).then((processedStream) => {
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
    _maybeEnableSound(soundName, doEnable) {
        if (typeof doEnable !== 'undefined') {
            this._enabledSounds[soundName] = doEnable;
        }
        return this._enabledSounds[soundName];
    }
    /**
     * Stop the tracks on the current input stream before replacing it with the passed stream.
     * @param stream - The new stream
     */
    _replaceStream(stream) {
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
    _restartStreams() {
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
    _setInputDevice(deviceId, forceGetUserMedia) {
        return __awaiter(this, void 0, void 0, function* () {
            const setInputDevice = () => __awaiter(this, void 0, void 0, function* () {
                yield this._beforeSetInputDevice();
                if (typeof deviceId !== 'string') {
                    return Promise.reject(new InvalidArgumentError('Must specify the device to set'));
                }
                const device = this.availableInputDevices.get(deviceId);
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
                return this._getUserMedia(constraints).then((originalStream) => {
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
            });
            return this._inputDevicePromise = setInputDevice().finally(() => {
                this._inputDevicePromise = null;
            });
        });
    }
    /**
     * Remove event listener for microphone permissions
     */
    _stopMicrophonePermissionListener() {
        var _a;
        if ((_a = this._microphonePermissionStatus) === null || _a === void 0 ? void 0 : _a.removeEventListener) {
            this._microphonePermissionStatus.removeEventListener('change', this._onMicrophonePermissionStatusChanged);
        }
    }
    /**
     * Stop the selected audio stream
     */
    _stopSelectedInputDeviceStream() {
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
    _updateDevices(updatedDevices, availableDevices, removeLostDevice) {
        const updatedDeviceIds = updatedDevices.map(d => d.deviceId);
        const knownDeviceIds = Array.from(availableDevices.values()).map(d => d.deviceId);
        const lostActiveDevices = [];
        // Remove lost devices
        const lostDeviceIds = difference(knownDeviceIds, updatedDeviceIds);
        lostDeviceIds.forEach((lostDeviceId) => {
            const lostDevice = availableDevices.get(lostDeviceId);
            if (lostDevice) {
                availableDevices.delete(lostDeviceId);
                if (removeLostDevice(lostDevice)) {
                    lostActiveDevices.push(lostDevice);
                }
            }
        });
        // Add any new devices, or devices with updated labels
        let deviceChanged = false;
        updatedDevices.forEach(newDevice => {
            const existingDevice = availableDevices.get(newDevice.deviceId);
            const newMediaDeviceInfo = this._wrapMediaDeviceInfo(newDevice);
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
    _updateVolumeSource() {
        if (!this.inputStream || !this._audioContext || !this._inputVolumeAnalyser) {
            return;
        }
        if (this._inputVolumeSource) {
            this._inputVolumeSource.disconnect();
        }
        try {
            this._inputVolumeSource = this._audioContext.createMediaStreamSource(this.inputStream);
            this._inputVolumeSource.connect(this._inputVolumeAnalyser);
        }
        catch (ex) {
            this._log.warn('Unable to update volume source', ex);
            delete this._inputVolumeSource;
        }
    }
    /**
     * Convert a MediaDeviceInfo to a IMediaDeviceInfoShim.
     * @param mediaDeviceInfo - The info to convert
     * @returns The converted shim
     */
    _wrapMediaDeviceInfo(mediaDeviceInfo) {
        const options = {
            deviceId: mediaDeviceInfo.deviceId,
            groupId: mediaDeviceInfo.groupId,
            kind: mediaDeviceInfo.kind,
            label: mediaDeviceInfo.label,
        };
        if (!options.label) {
            if (options.deviceId === 'default') {
                options.label = 'Default';
            }
            else {
                const index = this._getUnknownDeviceIndex(mediaDeviceInfo);
                options.label = `Unknown ${kindAliases[options.kind]} Device ${index}`;
            }
        }
        return new MediaDeviceInfoShim(options);
    }
}
/**
 * @mergeModuleWith AudioHelper
 */
(function (AudioHelper) {
})(AudioHelper || (AudioHelper = {}));
var AudioHelper$1 = AudioHelper;

export { AudioHelper$1 as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9oZWxwZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vYXVkaW9oZWxwZXIudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBVUE7O0FBRUc7QUFDSCxNQUFNLFdBQVcsR0FBMkI7QUFDMUMsSUFBQSxVQUFVLEVBQUUsYUFBYTtBQUN6QixJQUFBLFdBQVcsRUFBRSxjQUFjO0NBQzVCO0FBRUQ7O0FBRUc7QUFDSCxNQUFNLFdBQVksU0FBUSxZQUFZLENBQUE7QUFDcEM7O0FBRUc7SUFDSCxJQUFJLGdCQUFnQixLQUFtQyxPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxDQUFDO0FBWXRGOzs7QUFHRztJQUNILElBQUksV0FBVyxLQUE2QixPQUFPLElBQUksQ0FBQyxZQUFZLENBQUMsQ0FBQztBQUV0RTs7O0FBR0c7QUFDSCxJQUFBLElBQUksV0FBVyxHQUFBLEVBQXlCLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixJQUFJLElBQUksQ0FBQywwQkFBMEIsQ0FBQyxDQUFDO0FBY3pHOztBQUVHO0lBQ0gsSUFBSSxlQUFlLEtBQXlCLE9BQU8sSUFBSSxDQUFDLGdCQUFnQixDQUFDLENBQUM7QUE4STFFOzs7OztBQUtHO0FBQ0gsSUFBQSxXQUFBLENBQVksc0JBQTRGLEVBQzVGLG9CQUFtRSxFQUNuRSxPQUE2QixFQUFBO0FBQ3ZDLFFBQUEsS0FBSyxFQUFFO0FBNUxUOztBQUVHO0FBQ0gsUUFBQSxJQUFBLENBQUEscUJBQXFCLEdBQWlDLElBQUksR0FBRyxFQUFFO0FBRS9EOztBQUVHO0FBQ0gsUUFBQSxJQUFBLENBQUEsc0JBQXNCLEdBQWlDLElBQUksR0FBRyxFQUFFO0FBK0NoRTs7QUFFRztRQUNLLElBQUEsQ0FBQSxpQkFBaUIsR0FBaUMsSUFBSTtBQWlCOUQ7Ozs7O0FBS0c7UUFDSyxJQUFBLENBQUEseUJBQXlCLEdBQXVCLElBQUk7QUFFNUQ7O0FBRUc7QUFDSyxRQUFBLElBQUEs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
