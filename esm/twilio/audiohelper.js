var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
import { average, difference } from './util';
/**
 * Aliases for audio kinds, used for labelling.
 * @private
 */
const kindAliases = {
    audioinput: 'Audio Input',
    audiooutput: 'Audio Output',
};
/**
 * Provides input and output audio-based functionality in one convenient class.
 * @publicapi
 */
class AudioHelper extends EventEmitter {
    /**
     * @constructor
     * @private
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
         * @private
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
     * Destroy this AudioHelper instance
     * @private
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
     * @private
     */
    _getInputDevicePromise() {
        return this._inputDevicePromise;
    }
    /**
     * Start polling volume if it's supported and there's an input stream to poll.
     * @private
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
     * @private
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
     * @private
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
     * @private
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
     * @private
     */
    _unbind() {
        var _a;
        if ((_a = this._mediaDevices) === null || _a === void 0 ? void 0 : _a.removeEventListener) {
            this._mediaDevices.removeEventListener('devicechange', this._updateAvailableDevices);
        }
    }
    /**
     * Update AudioHelper options that can be changed by the user
     * @private
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
(function (AudioHelper) {
})(AudioHelper || (AudioHelper = {}));
export default AudioHelper;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9oZWxwZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2F1ZGlvaGVscGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBOzs7R0FHRztBQUNILE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFHdEMsT0FBTyxNQUFNLE1BQU0sVUFBVSxDQUFDO0FBQzlCLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUNuRSxPQUFPLEdBQUcsTUFBTSxPQUFPLENBQUM7QUFDeEIsT0FBTyxzQkFBc0IsTUFBTSwwQkFBMEIsQ0FBQztBQUM5RCxPQUFPLG1CQUFtQixNQUFNLHlCQUF5QixDQUFDO0FBQzFELE9BQU8sRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFhLE1BQU0sUUFBUSxDQUFDO0FBRXhEOzs7R0FHRztBQUNILE1BQU0sV0FBVyxHQUEyQjtJQUMxQyxVQUFVLEVBQUUsYUFBYTtJQUN6QixXQUFXLEVBQUUsY0FBYztDQUM1QixDQUFDO0FBRUY7OztHQUdHO0FBQ0gsTUFBTSxXQUFZLFNBQVEsWUFBWTtJQXlMcEM7Ozs7OztPQU1HO0lBQ0gsWUFBWSxzQkFBNEYsRUFDNUYsb0JBQW1FLEVBQ25FLE9BQTZCO1FBQ3ZDLEtBQUssRUFBRSxDQUFDO1FBN0xWOztXQUVHO1FBQ0gsMEJBQXFCLEdBQWlDLElBQUksR0FBRyxFQUFFLENBQUM7UUFFaEU7O1dBRUc7UUFDSCwyQkFBc0IsR0FBaUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQStDakU7O1dBRUc7UUFDSyxzQkFBaUIsR0FBaUMsSUFBSSxDQUFDO1FBaUIvRDs7Ozs7V0FLRztRQUNLLDhCQUF5QixHQUF1QixJQUFJLENBQUM7UUFFN0Q7O1dBRUc7UUFDSyxtQkFBYyxHQUE0QztZQUNoRSxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsVUFBVSxDQUFDLEVBQUUsSUFBSTtZQUNuQyxDQUFD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