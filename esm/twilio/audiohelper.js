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
     * Destroy this AudioHelper instance
     * @private
     */
    _destroy() {
        this._stopDefaultInputDeviceStream();
        this._stopSelectedInputDeviceStream();
        this._destroyProcessedStream();
        this._maybeStopPollingVolume();
        this.removeAllListeners();
        this._unbind();
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
        if (!this._mediaDevices || !this._enumerateDevices) {
            throw new NotSupportedError('Enumeration is not supported');
        }
        if (this._mediaDevices.removeEventListener) {
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
            if (this.inputDevice !== null && this.inputDevice.deviceId === 'default') {
                this._log.warn(`Calling getUserMedia after device change to ensure that the \
          tracks of the active device (default) have not gone stale.`);
                this._setInputDevice(this.inputDevice.deviceId, true);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9oZWxwZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2F1ZGlvaGVscGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7R0FHRztBQUNILE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFHdEMsT0FBTyxNQUFNLE1BQU0sVUFBVSxDQUFDO0FBQzlCLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUNuRSxPQUFPLEdBQUcsTUFBTSxPQUFPLENBQUM7QUFDeEIsT0FBTyxzQkFBc0IsTUFBTSwwQkFBMEIsQ0FBQztBQUM5RCxPQUFPLG1CQUFtQixNQUFNLHlCQUF5QixDQUFDO0FBQzFELE9BQU8sRUFBRSxPQUFPLEVBQUUsVUFBVSxFQUFhLE1BQU0sUUFBUSxDQUFDO0FBRXhEOzs7R0FHRztBQUNILE1BQU0sV0FBVyxHQUEyQjtJQUMxQyxVQUFVLEVBQUUsYUFBYTtJQUN6QixXQUFXLEVBQUUsY0FBYztDQUM1QixDQUFDO0FBRUY7OztHQUdHO0FBQ0gsTUFBTSxXQUFZLFNBQVEsWUFBWTtJQWdLcEM7Ozs7OztPQU1HO0lBQ0gsWUFBWSxzQkFBNEYsRUFDNUYsb0JBQW1FLEVBQ25FLE9BQTZCO1FBQ3ZDLEtBQUssRUFBRSxDQUFDO1FBcEtWOztXQUVHO1FBQ0gsMEJBQXFCLEdBQWlDLElBQUksR0FBRyxFQUFFLENBQUM7UUFFaEU7O1dBRUc7UUFDSCwyQkFBc0IsR0FBaUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQTBDakU7O1dBRUc7UUFDSyxzQkFBaUIsR0FBaUMsSUFBSSxDQUFDO1FBWS9EOzs7OztXQUtHO1FBQ0ssOEJBQXlCLEdBQXVCLElBQUksQ0FBQztRQUU3RDs7V0FFRztRQUNLLG1CQUFjLEdBQTRDO1lBQ2hFLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxJQUFJO1lBQ25DLENBQUMsTUFBTSxDQUFD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