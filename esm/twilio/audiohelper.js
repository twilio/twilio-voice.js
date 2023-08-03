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
     * @param getUserMedia - The getUserMedia method to use.
     * @param [options]
     */
    constructor(onActiveOutputsChanged, onActiveInputChanged, getUserMedia, options) {
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
         * The current input stream.
         */
        this._inputStream = null;
        /**
         * Whether the {@link AudioHelper} is currently polling the input stream's volume.
         */
        this._isPollingInputVolume = false;
        /**
         * An instance of Logger to use.
         */
        this._log = Log.getInstance();
        /**
         * A record of unknown devices (Devices without labels)
         */
        this._unknownDeviceIndexes = {
            audioinput: {},
            audiooutput: {},
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
        /**
         * Update the available input and output devices
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
        options = Object.assign({
            AudioContext: typeof AudioContext !== 'undefined' && AudioContext,
            setSinkId: typeof HTMLAudioElement !== 'undefined' && HTMLAudioElement.prototype.setSinkId,
        }, options);
        this._getUserMedia = getUserMedia;
        this._mediaDevices = options.mediaDevices || getMediaDevicesInstance();
        this._onActiveInputChanged = onActiveInputChanged;
        this._enumerateDevices = typeof options.enumerateDevices === 'function'
            ? options.enumerateDevices
            : this._mediaDevices && this._mediaDevices.enumerateDevices;
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
     * The current input stream.
     */
    get inputStream() { return this._inputStream; }
    /**
     * Current state of the enabled sounds
     * @private
     */
    _getEnabledSounds() {
        return this._enabledSounds;
    }
    /**
     * Start polling volume if it's supported and there's an input stream to poll.
     * @private
     */
    _maybeStartPollingVolume() {
        if (!this.isVolumeSupported || !this._inputStream) {
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
    _unbind() {
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
    disconnect(doEnable) {
        return this._maybeEnableSound(Device.SoundName.Disconnect, doEnable);
    }
    /**
     * Enable or disable the incoming sound.
     * @param doEnable Passing `true` will enable the sound and `false` will disable the sound.
     * Not passing this parameter will not alter the enable-status of the sound.
     * @returns The enable-status of the sound.
     */
    incoming(doEnable) {
        return this._maybeEnableSound(Device.SoundName.Incoming, doEnable);
    }
    /**
     * Enable or disable the outgoing sound.
     * @param doEnable Passing `true` will enable the sound and `false` will disable the sound.
     * Not passing this parameter will not alter the enable-status of the sound.
     * @returns The enable-status of the sound.
     */
    outgoing(doEnable) {
        return this._maybeEnableSound(Device.SoundName.Outgoing, doEnable);
    }
    /**
     * Set the MediaTrackConstraints to be applied on every getUserMedia call for new input
     * device audio. Any deviceId specified here will be ignored. Instead, device IDs should
     * be specified using {@link AudioHelper#setInputDevice}. The returned Promise resolves
     * when the media is successfully reacquired, or immediately if no input device is set.
     * @param audioConstraints - The MediaTrackConstraints to apply.
     */
    setAudioConstraints(audioConstraints) {
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
    unsetAudioConstraints() {
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
        if (!this.inputDevice) {
            return Promise.resolve();
        }
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
            this._mediaDevices.addEventListener('deviceinfochange', this._updateAvailableDevices);
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
    _setInputDevice(deviceId, forceGetUserMedia) {
        if (typeof deviceId !== 'string') {
            return Promise.reject(new InvalidArgumentError('Must specify the device to set'));
        }
        const device = this.availableInputDevices.get(deviceId);
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
        return this._getUserMedia(constraints).then((stream) => {
            return this._onActiveInputChanged(stream).then(() => {
                this._replaceStream(stream);
                this._inputDevice = device;
                this._maybeStartPollingVolume();
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
            this.emit('deviceChange', lostActiveDevices);
        }
    }
    /**
     * Disconnect the old input volume source, and create and connect a new one with the current
     * input stream.
     */
    _updateVolumeSource() {
        if (!this._inputStream || !this._audioContext || !this._inputVolumeAnalyser) {
            return;
        }
        if (this._inputVolumeSource) {
            this._inputVolumeSource.disconnect();
        }
        try {
            this._inputVolumeSource = this._audioContext.createMediaStreamSource(this._inputStream);
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9oZWxwZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2F1ZGlvaGVscGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7R0FHRztBQUNILE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDdEMsT0FBTyxNQUFNLE1BQU0sVUFBVSxDQUFDO0FBQzlCLE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxpQkFBaUIsRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUNuRSxPQUFPLEdBQUcsTUFBTSxPQUFPLENBQUM7QUFDeEIsT0FBTyxzQkFBc0IsTUFBTSwwQkFBMEIsQ0FBQztBQUM5RCxPQUFPLG1CQUFtQixNQUFNLHlCQUF5QixDQUFDO0FBQzFELE9BQU8sdUJBQXVCLE1BQU0sc0JBQXNCLENBQUM7QUFDM0QsT0FBTyxFQUFFLE9BQU8sRUFBRSxVQUFVLEVBQUUsU0FBUyxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBRXhEOzs7R0FHRztBQUNILE1BQU0sV0FBVyxHQUEyQjtJQUMxQyxVQUFVLEVBQUUsYUFBYTtJQUN6QixXQUFXLEVBQUUsY0FBYztDQUM1QixDQUFDO0FBRUY7OztHQUdHO0FBQ0gsTUFBTSxXQUFZLFNBQVEsWUFBWTtJQW9JcEM7Ozs7Ozs7T0FPRztJQUNILFlBQVksc0JBQTRGLEVBQzVGLG9CQUFtRSxFQUNuRSxZQUEyRSxFQUMzRSxPQUE2QjtRQUN2QyxLQUFLLEVBQUUsQ0FBQztRQTFJVjs7V0FFRztRQUNILDBCQUFxQixHQUFpQyxJQUFJLEdBQUcsRUFBRSxDQUFDO1FBRWhFOztXQUVHO1FBQ0gsMkJBQXNCLEdBQWlDLElBQUksR0FBRyxFQUFFLENBQUM7UUF5Q2pFOztXQUVHO1FBQ0ssc0JBQWlCLEdBQWlDLElBQUksQ0FBQztRQU8vRDs7V0FFRztRQUNLLG1CQUFjLEdBQTRDO1lBQ2hFLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxVQUFVLENBQUMsRUFBRSxJQUFJO1lBQ25D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