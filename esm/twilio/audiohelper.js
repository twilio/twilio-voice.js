import { __awaiter } from 'tslib';
import { EventEmitter } from 'events';
import Device from './device.js';
import { InvalidArgumentError, NotSupportedError } from './errors/index.js';
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
    get inputStream() { return this._localProcessedStream || this._selectedInputDeviceStream; }
    /**
     * The processed stream if a local {@link AudioProcessor} was previously added.
     * @deprecated Use {@link AudioHelper#localProcessedStream} instead.
     */
    get processedStream() {
        this._log.warn('AudioHelper#processedStream is deprecated. Please use AudioHelper#localProcessedStream instead.');
        return this._localProcessedStream;
    }
    /**
     * The processed stream if a local {@link AudioProcessor} was previously added.
     */
    get localProcessedStream() { return this._localProcessedStream; }
    /**
     * The processed stream if a remote {@link AudioProcessor} was previously added.
     */
    get remoteProcessedStream() { return this._remoteProcessedStream; }
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
         * The default device stream, populated when a call adopts a stream from
         * _openDefaultDeviceWithConstraints (see _adoptDefaultInputDeviceStream).
         * See _selectedInputDeviceStream for differences.
         * TODO: Combine these two workflows (3.x?)
         */
        this._defaultInput = null;
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
         * Internal reference to the local processed stream.
         */
        this._localProcessedStream = null;
        /**
         * Internal reference to the added local AudioProcessor.
         */
        this._localProcessor = null;
        /**
         * Internal reference to the remote processed stream.
         */
        this._remoteProcessedStream = null;
        /**
         * The selected input stream coming from the microphone device.
         * This is populated when the setInputDevice is called, meaning,
         * the end user manually selected it, which is different than
         * _defaultInput.
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
            this._destroyLocalProcessedStream();
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
        this._destroyLocalProcessedStream();
        this._destroyRemoteProcessedStream();
        this._maybeStopPollingVolume();
        this.removeAllListeners();
        this._stopMicrophonePermissionListener();
        this._unbind();
    }
    /**
     * Destroys the remote processed stream and updates references.
     * @internal
     */
    _destroyRemoteProcessedStream() {
        if (this._remoteProcessor && this._remoteProcessedStream) {
            this._log.info('destroying remote processed stream');
            const remoteProcessedStream = this._remoteProcessedStream;
            this._remoteProcessedStream.getTracks().forEach(track => track.stop());
            this._remoteProcessedStream = null;
            this._remoteProcessor.destroyProcessedStream(remoteProcessedStream);
            this._audioProcessorEventObserver.emit('destroy', true);
        }
    }
    /**
     * Promise to wait for the input device, if setInputDevice is called outside of the SDK.
     * @internal
     */
    _getInputDevicePromise() {
        return this._inputDevicePromise;
    }
    /**
     * The current AudioProcessorEventObserver instance.
     * @internal
     */
    _getAudioProcessorEventObserver() {
        return this._audioProcessorEventObserver;
    }
    /**
     * Route remote stream to the processor if it exists.
     * @internal
     */
    _maybeCreateRemoteProcessedStream(stream) {
        if (this._remoteProcessor) {
            this._log.info('Creating remote processed stream');
            return this._remoteProcessor.createProcessedStream(stream).then((processedStream) => {
                this._remoteProcessedStream = processedStream;
                this._audioProcessorEventObserver.emit('create', true);
                return this._remoteProcessedStream;
            });
        }
        return Promise.resolve(stream);
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
     * Call getUserMedia with specified constraints. The result becomes the default device stream
     * only once a call adopts it, so a result for a call that has since ended leaves it alone.
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
            const processor = this._localProcessor;
            if (!processor) {
                return { processed: null, processor: null, raw: stream };
            }
            this._log.info('Creating local processed stream');
            // Through then(), so a processor that throws synchronously also releases the raw stream.
            return Promise.resolve().then(() => processor.createProcessedStream(stream)).then(processedStream => {
                if (!processedStream) {
                    throw new InvalidArgumentError('The local AudioProcessor did not return a MediaStream');
                }
                this._audioProcessorEventObserver.emit('create', false);
                return { processed: processedStream, processor, raw: stream };
            }).catch(error => {
                // Nothing holds the raw stream yet, so release it here.
                stream.getTracks().forEach(track => track.stop());
                throw error;
            });
        });
    }
    /**
     * Make a stream from _openDefaultDeviceWithConstraints the default device stream
     * @internal
     * @param input - The stream, adopted by the live call that opened it.
     */
    _adoptDefaultInputDeviceStream(input) {
        this._defaultInput = input;
        if (input.processed) {
            this._localProcessedStream = input.processed;
        }
    }
    /**
     * Stop the default audio stream
     * @internal
     * @param input - A stream from _openDefaultDeviceWithConstraints, released whether or not
     *   it was adopted. Defaults to the adopted default device stream.
     */
    _stopDefaultInputDeviceStream(input = this._defaultInput) {
        if (!input) {
            return;
        }
        this._log.info('stopping default device stream');
        input.raw.getTracks().forEach(track => track.stop());
        if (input === this._defaultInput) {
            this._defaultInput = null;
        }
        this._destroyDefaultProcessedStream(input);
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
     * Adds an {@link AudioProcessor} object and returns a Promise representing the result.
     * To add a remote AudioProcessor, pass `true`. To add a local AudioProcessor, pass `false`.
     * The default value is `false`.
     *
     * If `isRemote` is `false`, the AudioHelper routes the input audio stream through the
     * processor before sending the audio stream to Twilio. If `isRemote` is `true`, the AudioHelper
     * routes the output audio stream through the processor before playing it on the speaker.
     *
     * See the {@link AudioProcessor} interface for an example.
     *
     * @param processor The AudioProcessor to add.
     * @param isRemote If set to true, the processor will be applied to the remote
     * audio track. Default value is false.
     * @returns
     */
    addProcessor(processor, isRemote = false) {
        this._log.debug('.addProcessor');
        if (this._localProcessor && !isRemote) {
            throw new NotSupportedError('Can only have one Local AudioProcessor at a time.');
        }
        if (this._remoteProcessor && isRemote) {
            throw new NotSupportedError('Can only have one Remote AudioProcessor at a time.');
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
        if (isRemote) {
            this._remoteProcessor = processor;
            this._audioProcessorEventObserver.emit('add', true);
            return Promise.resolve();
        }
        else {
            this._localProcessor = processor;
            this._audioProcessorEventObserver.emit('add', false);
            return this._restartInputStreams();
        }
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
     * Removes an {@link AudioProcessor} and returns a Promise representing the result.
     * To remove a remote AudioProcessor, pass `true`. To remove a local AudioProcessor,
     * pass `false`. The default value is `false`.
     *
     * If `isRemote` is `false`, the AudioHelper uses the audio stream from the selected
     * input device for existing or future calls. If `isRemote` is `true`, the AudioHelper
     * uses the audio stream from the selected output device for existing or future calls.
     *
     * @param processor The AudioProcessor to remove.
     * @param isRemote If set to true, the processor will be removed from the remote
     * audio track. Default value is false.
     * @returns
     */
    removeProcessor(processor, isRemote = false) {
        this._log.debug('.removeProcessor');
        if (typeof processor !== 'object' || processor === null) {
            throw new InvalidArgumentError('Missing AudioProcessor argument.');
        }
        if (this._localProcessor !== processor && !isRemote) {
            throw new InvalidArgumentError('Cannot remove a Local AudioProcessor that has not been previously added.');
        }
        if (this._remoteProcessor !== processor && isRemote) {
            throw new InvalidArgumentError('Cannot remove a Remote AudioProcessor that has not been previously added.');
        }
        if (isRemote) {
            this._destroyRemoteProcessedStream();
            this._remoteProcessor = null;
            this._audioProcessorEventObserver.emit('remove', true);
            return Promise.resolve();
        }
        else {
            this._destroyLocalProcessedStream();
            this._localProcessor = null;
            this._audioProcessorEventObserver.emit('remove', false);
            return this._restartInputStreams();
        }
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
     * Unset the input device, stopping the tracks. This should only be called when not in a connection. While the
     *   Device is busy (see `Device.isBusy`), including with an accepted call that is still connecting, it rejects
     *   with InvalidStateError if an input device is set.
     */
    unsetInputDevice() {
        this._log.debug('.unsetInputDevice', this.inputDevice);
        if (!this.inputDevice) {
            return Promise.resolve();
        }
        this._destroyLocalProcessedStream();
        return this._onActiveInputChanged(null).then(() => {
            this._replaceStream(null);
            this._inputDevice = null;
            this._maybeStopPollingVolume();
        });
    }
    /**
     * Destroys a default device stream's processed stream, with the processor that created it.
     */
    _destroyDefaultProcessedStream(input) {
        const { processed, processor } = input;
        if (!processed || !processor) {
            return;
        }
        this._log.info('destroying local processed stream');
        input.processed = null;
        processed.getTracks().forEach(track => track.stop());
        if (processed === this._localProcessedStream) {
            this._localProcessedStream = null;
        }
        processor.destroyProcessedStream(processed);
        this._audioProcessorEventObserver.emit('destroy', false);
    }
    /**
     * Destroys the local processed stream and updates references.
     */
    _destroyLocalProcessedStream() {
        if (this._defaultInput && this._defaultInput.processed === this._localProcessedStream) {
            this._destroyDefaultProcessedStream(this._defaultInput);
            return;
        }
        if (this._localProcessor && this._localProcessedStream) {
            this._log.info('destroying local processed stream');
            const localProcessedStream = this._localProcessedStream;
            this._localProcessedStream.getTracks().forEach(track => track.stop());
            this._localProcessedStream = null;
            this._localProcessor.destroyProcessedStream(localProcessedStream);
            this._audioProcessorEventObserver.emit('destroy', false);
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
     * Route local stream to the processor if it exists.
     */
    _maybeCreateLocalProcessedStream(stream) {
        if (this._localProcessor) {
            this._log.info('Creating local processed stream');
            return this._localProcessor.createProcessedStream(stream).then((processedStream) => {
                this._localProcessedStream = processedStream;
                this._audioProcessorEventObserver.emit('create', false);
                return this._localProcessedStream;
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
     * Restart the active input streams
     */
    _restartInputStreams() {
        if (this.inputDevice && this._selectedInputDeviceStream) {
            this._log.info('Restarting selected input device');
            return this._setInputDevice(this.inputDevice.deviceId, true);
        }
        if (this._defaultInput) {
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
                    this._destroyLocalProcessedStream();
                    return this._maybeCreateLocalProcessedStream(originalStream).then((newStream) => {
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
            const isDefaultDeviceSet = this._defaultInput && this.availableInputDevices.get(defaultId);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9oZWxwZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vYXVkaW9oZWxwZXIudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7O0FBNkJBOztBQUVHO0FBQ0gsTUFBTSxXQUFXLEdBQTJCO0FBQzFDLElBQUEsVUFBVSxFQUFFLGFBQWE7QUFDekIsSUFBQSxXQUFXLEVBQUUsY0FBYztDQUM1QjtBQUVEOztBQUVHO0FBQ0gsTUFBTSxXQUFZLFNBQVEsWUFBWSxDQUFBO0FBQ3BDOztBQUVHO0lBQ0gsSUFBSSxnQkFBZ0IsS0FBbUMsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsQ0FBQztBQVl0Rjs7O0FBR0c7SUFDSCxJQUFJLFdBQVcsS0FBNkIsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7QUFFdEU7OztBQUdHO0FBQ0gsSUFBQSxJQUFJLFdBQVcsR0FBQSxFQUF5QixPQUFPLElBQUksQ0FBQyxxQkFBcUIsSUFBSSxJQUFJLENBQUMsMEJBQTBCLENBQUMsQ0FBQztBQWM5Rzs7O0FBR0c7QUFDSCxJQUFBLElBQUksZUFBZSxHQUFBO0FBQ2pCLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsaUdBQWlHLENBQUM7UUFDakgsT0FBTyxJQUFJLENBQUMscUJBQXFCO0lBQ25DO0FBRUE7O0FBRUc7SUFDSCxJQUFJLG9CQUFvQixLQUF5QixPQUFPLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxDQUFDO0FBRXBGOztBQUVHO0lBQ0gsSUFBSSxxQkFBcUIsS0FBeUIsT0FBTyxJQUFJLENBQUMsc0JBQXNCLENBQUMsQ0FBQztBQXdKdEY7Ozs7O0FBS0c7QUFDSCxJQUFBLFdBQUEsQ0FBWSxzQkFBNEYsRUFDNUYsb0JBQW1FLEVBQ25FLE9BQTZCLEVBQUE7QUFDdkMsUUFBQSxLQUFLLEVBQUU7QUFwTlQ7O0FBRUc7QUFDSCxRQUFBLElBQUEsQ0FBQSxxQkFBcUIsR0FBaUMsSUFBSSxHQUFHLEVBQUU7QUFFL0Q7O0FBRUc7QUFDSCxRQUFBLElBQUEsQ0FBQSxzQkFBc0IsR0FBaUMsSUFBSSxHQUFHLEVBQUU7QUE2RGhFOztBQUVHO1FBQ0ssSUFBQSxDQUFBLGlCQUFpQixHQUFpQyxJQUFJO0FBaUI5RDs7Ozs7QUFLRztRQUNLLElBQUEsQ0FBQSxhQUFhLEdBQThCLElBQUk7QUFFdkQ7O0FBRUc7QUFDSyxRQUFBLElBQUEsQ0FBQSxjQUFjLEdBQTRDO0FBQ2hFLFlBQUEsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLFVBQVUsR0FBRyxJQUFJO0FBQ25DLFlBQUEsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLFFBQVEsR0FBRyxJQUFJO0FBQ2pDLFlBQUEsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLFFBQVEsR0FBRyxJQUFJO1NBQ2xDO0FBWUQ7O0FBRUc7UUFDSyxJQUFBLENBQUEsWUFBWSxHQUEyQixJQUFJO0FBRW5EOztBQUVHO1FBQ0ssSUFBQSxDQUFBLG1CQUFtQixHQUF5QixJQUFJO0FBWXhEOztBQUVHO1FBQ0ssSUFBQSxDQUFBLHFCQUFxQixHQUFZLEtBQUs7QUFFOUM7O0FBRUc7QUFDSyxRQUFBLElBQUEsQ0FBQSxJQUFJLEdBQVEsSUFBSSxHQUFHLENBQUMsYUFBYSxDQUFDO0FBc0IxQzs7QUFFRztRQUNLLElBQUEsQ0FBQSxxQkFBcUIsR0FBdUIsSUFBSTtBQUV4RDs7QUFFRztRQUNLLElBQUEsQ0FBQSxlQUFlLEdBQTBCLElBQUk7QUFFckQ7O0FBRUc7UUFDSyxJQUFBLENBQUEsc0JBQXNCLEdBQXVCLElBQUk7QUFPekQ7Ozs7OztBQU1HO1FBQ0ssSUFBQSxDQUFBLDBCQUEwQixHQUF1QixJQUFJO0FBRTdEOztBQUVHO0FBQ0ssUUFBQSxJQUFBLENBQUEscUJBQXFCLEdBQTJDO0FBQ3RFLFlBQUEsVUFBVSxFQUFFLEVBQUc7QUFDZixZQUFBLFdBQVcsRUFBRSxFQUFHO1NBQ2pCO0FBd1NEOzs7QUFHRztRQUNILElBQUEsQ0FBQSx1QkFBdUIsR0FBRyxNQUFvQjtZQUM1QyxJQUFJLENBQUMsSUFBSSxDQUFDLGFBQWEsSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtBQUNsRCxnQkFBQSxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsMkJBQTJCLENBQUM7WUFDcEQ7WUFFQSxPQUFPLElBQUksQ0FBQyxpQkFBaUIsRUFBRSxDQUFDLElBQUksQ0FBQyxDQUFDLE9BQTBCLEtBQUk7Z0JBQ2xFLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQWtCLEtBQUssQ0FBQyxDQUFDLElBQUksS0FBSyxhQUFhLENBQUMsRUFDbEYsSUFBSSxDQUFDLHNCQUFzQixFQUMzQixJQUFJLENBQUMsaUJBQWlCLENBQUM7Z0JBRXpCLElBQUksQ0FBQyxjQUFjLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQWtCLEtBQUssQ0FBQyxDQUFDLElBQUksS0FBSyxZQUFZLENBQUMsRUFDakYsSUFBSSxDQUFDLHFCQUFxQixFQUMxQixJQUFJLENBQUMsZ0JBQWdCLENBQUM7Z0JBRXhCLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxHQUFHLENBQUMsU0FBUztBQUMxRCx1QkFBQSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxzQkFBc0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUV4RCxnQkFBQSxDQUFDLElBQUksQ0FBQyxjQUFjLEVBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxhQUFhLElBQUc7QUFDbEUsb0JBQUEsSUFBSSxDQUFDLGFBQWEsQ0FBQyxHQUFHLEVBQUUsQ0FBQyxJQUFJLElBQUksSUFBSSxDQUFDLHNCQUFzQixDQUFDLElBQUksSUFBSSxJQUFJLENBQUMsMEJBQTBCLEVBQUU7QUFDcEcsd0JBQUEsYUFBYSxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsUUFBUTtBQUNyQyw2QkFBQSxLQUFLLENBQUMsQ0FBQyxNQUFNLEtBQUk7NEJBQ2hCLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUEsb0NBQUEsRUFBdUMsTUFBTSxDQUFBLENBQUUsQ0FBQztBQUNqRSx3QkFBQSxDQUFDLENBQUM7b0JBQ047QUFDRixnQkFBQSxDQUFDLENBQUM7QUFDSixZQUFBLENBQUMsQ0FBQztBQUNKLFFBQUEsQ0FBQztBQThWRDs7OztBQUlHO0FBQ0ssUUFBQSxJQUFBLENBQUEsZ0JBQWdCLEdBQUcsQ0FBQyxVQUEyQixLQUFhO0FBQ2xFLFlBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxXQUFXLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLEtBQUssVUFBVSxDQUFDLFFBQVEsRUFBRTtBQUMxRSxnQkFBQSxPQUFPLEtBQUs7WUFDZDtZQUVBLElBQUksQ0FBQyw0QkFBNEIsRUFBRTtBQUNuQyxZQUFBLElBQUksQ0FBQyxjQUFjLENBQUMsSUFBSSxDQUFDO0FBQ3pCLFlBQUEsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJO1lBQ3hCLElBQUksQ0FBQyx1QkFBdUIsRUFBRTtZQUU5QixNQUFNLGFBQWEsR0FBb0IsSUFBSSxDQUFDLHFCQUFxQixDQUFDLEdBQUcsQ0FBQyxTQUFTO0FBQzFFLG1CQUFBLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBRXZELElBQUksYUFBYSxFQUFFO0FBQ2pCLGdCQUFBLElBQUksQ0FBQyxjQUFjLENBQUMsYUFBYSxDQUFDLFFBQVEsQ0FBQztZQUM3QztBQUVBLFlBQUEsT0FBTyxJQUFJO0FBQ2IsUUFBQSxDQUFDO0FBRUQ7Ozs7QUFJRztBQUNLLFFBQUEsSUFBQSxDQUFBLGlCQUFpQixHQUFHLENBQUMsVUFBMkIsS0FBYTtZQUNuRSxNQUFNLGNBQWMsR0FBWSxJQUFJLENBQUMsY0FBYyxDQUFDLE1BQU0sQ0FBQyxVQUFVLENBQUM7WUFDdEUsTUFBTSxlQUFlLEdBQVksSUFBSSxDQUFDLGVBQWUsQ0FBQyxNQUFNLENBQUMsVUFBVSxDQUFDO1lBQ3hFLE9BQU8sY0FBYyxJQUFJLGVBQWU7QUFDMUMsUUFBQSxDQUFDO0FBenJCQyxRQUFBLE9BQU8sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO0FBQ3RCLFlBQUEsWUFBWSxFQUFFLE9BQU8sWUFBWSxLQUFLLFdBQVcsSUFBSSxZQUFZO1lBQ2pFLFNBQVMsRUFBRSxPQUFPLGdCQUFnQixLQUFLLFdBQVcsSUFBSyxnQkFBZ0IsQ0FBQyxTQUFpQixDQUFDLFNBQVM7U0FDcEcsRUFBRSxPQUFPLENBQUM7QUFFWCxRQUFBLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxPQUFPLENBQUMsb0JBQW9CLEtBQUssTUFBTSxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUM7QUFFdEYsUUFBQSxJQUFJLENBQUMsa0JBQWtCLENBQUMsT0FBTyxDQUFDO0FBRWhDLFFBQUEsSUFBSSxDQUFDLDRCQUE0QixHQUFHLE9BQU8sQ0FBQywyQkFBMkI7UUFDdkUsSUFBSSxDQUFDLGFBQWEsR0FBRyxPQUFPLENBQUMsWUFBWSxJQUFJLFNBQVMsQ0FBQyxZQUFZO0FBQ25FLFFBQUEsSUFBSSxDQUFDLHFCQUFxQixHQUFHLG9CQUFvQjtRQUNqRCxJQUFJLENBQUMsaUJBQWlCLEdBQUcsT0FBTyxPQUFPLENBQUMsZ0JBQWdCLEtBQUs7Y0FDekQsT0FBTyxDQUFDO0FBQ1YsY0FBRSxJQUFJLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUM7QUFFdEYsUUFBQSxNQUFNLHVCQUF1QixHQUFZLENBQUMsRUFBRSxPQUFPLENBQUMsWUFBWSxJQUFJLE9BQU8sQ0FBQyxZQUFZLENBQUM7QUFDekYsUUFBQSxNQUFNLHNCQUFzQixHQUFZLENBQUMsQ0FBQyxJQUFJLENBQUMsaUJBQWlCO0FBRWhFLFFBQUEsSUFBSSxPQUFPLENBQUMsYUFBYSxFQUFFO0FBQ3pCLFlBQUEsSUFBSSxDQUFDLGNBQWMsR0FBRyxPQUFPLENBQUMsYUFBYTtRQUM3QztRQUVBLE1BQU0sa0JBQWtCLEdBQVksT0FBTyxPQUFPLENBQUMsU0FBUyxLQUFLLFVBQVU7QUFDM0UsUUFBQSxJQUFJLENBQUMsMEJBQTBCLEdBQUcsc0JBQXNCLElBQUksa0JBQWtCO0FBQzlFLFFBQUEsSUFBSSxDQUFDLGlCQUFpQixHQUFHLHVCQUF1QjtBQUVoRCxRQUFBLElBQUksSUFBSSxDQUFDLGlCQUFpQixFQUFFO0FBQzFCLFlBQUEsSUFBSSxDQUFDLGFBQWEsR0FBRyxPQUFPLENBQUMsWUFBWSxJQUFJLE9BQU8sQ0FBQyxZQUFZLElBQUksSUFBSSxPQUFPLENBQUMsWUFBWSxFQUFFO0FBQy9GLFlBQUEsSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFO2dCQUN0QixJQUFJLENBQUMsb0JBQW9CLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyxjQUFjLEVBQUU7QUFDL0QsZ0JBQUEsSUFBSSxDQUFDLG9CQUFvQixDQUFDLE9BQU8sR0FBRyxFQUFFO0FBQ3RDLGdCQUFBLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxxQkFBcUIsR0FBRyxHQUFHO1lBQ3ZEO1FBQ0Y7QUFFQSxRQUFBLElBQUksQ0FBQyxlQUFlLEdBQUcsSUFBSSxzQkFBc0IsQ0FBQyxVQUFVLEVBQzFELElBQUksQ0FBQyxzQkFBc0IsRUFBRSxzQkFBc0IsRUFBRSxJQUFJLENBQUMsMEJBQTBCLENBQUM7QUFDdkYsUUFBQSxJQUFJLENBQUMsY0FBYyxHQUFHLElBQUksc0JBQXNCLENBQUMsU0FBUyxFQUN4RCxJQUFJLENBQUMsc0JBQXNCLEVBQUUsc0JBQXNCLEVBQUUsSUFBSSxDQUFDLDBCQUEwQixDQUFDO1FBRXZGLElBQUksQ0FBQyxXQUFXLENBQUMsYUFBYSxFQUFFLENBQUMsU0FBaUIsS0FBSTtBQUNwRCxZQUFBLElBQUksU0FBUyxLQUFLLGFBQWEsRUFBRTtnQkFDL0IsSUFBSSxDQUFDLHdCQUF3QixFQUFFO1lBQ2pDO0FBQ0YsUUFBQSxDQUFDLENBQUM7UUFFRixJQUFJLENBQUMsV0FBVyxDQUFDLGdCQUFnQixFQUFFLENBQUMsU0FBaUIsS0FBSTtBQUN2RCxZQUFBLElBQUksU0FBUyxLQUFLLGFBQWEsRUFBRTtnQkFDL0IsSUFBSSxDQUFDLHVCQUF1QixFQUFFO1lBQ2hDO0FBQ0YsUUFBQSxDQUFDLENBQUM7QUFFRixRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLE1BQUs7Ozs7O0FBSzVCLFlBQUEsSUFBSSxDQUFDLElBQUksQ0FBQywwQkFBMEIsRUFBRTtBQUNwQyxnQkFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxnRUFBZ0UsQ0FBQztZQUNsRjtBQUVBLFlBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtBQUMzQixnQkFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBLHlFQUFBLENBQTJFLENBQUM7WUFDN0Y7QUFDRixRQUFBLENBQUMsQ0FBQztRQUVGLElBQUksc0JBQXNCLEVBQUU7WUFDMUIsSUFBSSxDQUFDLHNCQUFzQixFQUFFO1FBQy9COzs7O0FBS0EsUUFBQSxJQUFJLFNBQVMsSUFBSSxTQUFTLENBQUMsV0FBVyxJQUFJLE9BQU8sU0FBUyxDQUFDLFdBQVcsQ0FBQyxLQUFLLEtBQUssVUFBVSxFQUFFO0FBQzNGLFlBQUEsU0FBUyxDQUFDLFdBQVcsQ0FBQyxLQUFLLENBQUMsRUFBRSxJQUFJLEVBQUUsWUFBWSxFQUFFLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQywwQkFBMEIsS0FBSTtBQUN0RixnQkFBQSxJQUFJLDBCQUEwQixDQUFDLEtBQUssS0FBSyxTQUFTLEVBQUU7b0JBQ2xELE1BQU0saUJBQWlCLEdBQUcsTUFBSzt3QkFDN0IsSUFBSSxDQUFDLHVCQUF1QixFQUFFO3dCQUM5QixJQUFJLENBQUMsaUNBQWlDLEVBQUU7QUFDMUMsb0JBQUEsQ0FBQztBQUNELG9CQUFBLDBCQUEwQixDQUFDLGdCQUFnQixDQUFDLFFBQVEsRUFBRSxpQkFBaUIsQ0FBQztBQUN4RSxvQkFBQSxJQUFJLENBQUMsMkJBQTJCLEdBQUcsMEJBQTBCO0FBQzdELG9CQUFBLElBQUksQ0FBQyxvQ0FBb0MsR0FBRyxpQkFBaUI7Z0JBQy9EO1lBQ0YsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsTUFBTSxLQUFLLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUEsNkRBQUEsRUFBZ0UsTUFBTSxDQUFBLENBQUUsQ0FBQyxDQUFDO1FBQ2hIO2FBQU87QUFDTCxZQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLDREQUE0RCxDQUFDO1FBQzlFO0lBQ0Y7QUFFQTs7O0FBR0c7SUFDSCxRQUFRLEdBQUE7UUFDTixJQUFJLENBQUMsNkJBQTZCLEVBQUU7UUFDcEMsSUFBSSxDQUFDLDhCQUE4QixFQUFFO1FBQ3JDLElBQUksQ0FBQyw0QkFBNEIsRUFBRTtRQUNuQyxJQUFJLENBQUMsNkJBQTZCLEVBQUU7UUFDcEMsSUFBSSxDQUFDLHVCQUF1QixFQUFFO1FBQzlCLElBQUksQ0FBQyxrQkFBa0IsRUFBRTtRQUN6QixJQUFJLENBQUMsaUNBQWlDLEVBQUU7UUFDeEMsSUFBSSxDQUFDLE9BQU8sRUFBRTtJQUNoQjtBQUVBOzs7QUFHRztJQUNILDZCQUE2QixHQUFBO1FBQzNCLElBQUksSUFBSSxDQUFDLGdCQUFnQixJQUFJLElBQUksQ0FBQyxzQkFBc0IsRUFBRTtBQUN4RCxZQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLG9DQUFvQyxDQUFDO0FBQ3BELFlBQUEsTUFBTSxxQkFBcUIsR0FBRyxJQUFJLENBQUMsc0JBQXNCO0FBQ3pELFlBQUEsSUFBSSxDQUFDLHNCQUFzQixDQUFDLFNBQVMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO0FBQ3RFLFlBQUEsSUFBSSxDQUFDLHNCQUFzQixHQUFHLElBQUk7QUFDbEMsWUFBQSxJQUFJLENBQUMsZ0JBQWdCLENBQUMsc0JBQXNCLENBQUMscUJBQXFCLENBQUM7WUFDbkUsSUFBSSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDO1FBQ3pEO0lBQ0Y7QUFFQTs7O0FBR0c7SUFDSCxzQkFBc0IsR0FBQTtRQUNwQixPQUFPLElBQUksQ0FBQyxtQkFBbUI7SUFDakM7QUFFQTs7O0FBR0c7SUFDSCwrQkFBK0IsR0FBQTtRQUM3QixPQUFPLElBQUksQ0FBQyw0QkFBNEI7SUFDMUM7QUFFQTs7O0FBR0c7QUFDSCxJQUFBLGlDQUFpQyxDQUFDLE1BQW1CLEVBQUE7QUFDbkQsUUFBQSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsRUFBRTtBQUN6QixZQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGtDQUFrQyxDQUFDO0FBQ2xELFlBQUEsT0FBTyxJQUFJLENBQUMsZ0JBQWdCLENBQUMscUJBQXFCLENBQUMsTUFBTSxDQUFDLENBQUMsSUFBSSxDQUFDLENBQUMsZUFBNEIsS0FBSTtBQUMvRixnQkFBQSxJQUFJLENBQUMsc0JBQXNCLEdBQUcsZUFBZTtnQkFDN0MsSUFBSSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxRQUFRLEVBQUUsSUFBSSxDQUFDO2dCQUN0RCxPQUFPLElBQUksQ0FBQyxzQkFBc0I7QUFDcEMsWUFBQSxDQUFDLENBQUM7UUFDSjtBQUNBLFFBQUEsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQztJQUNoQztBQUVBOzs7QUFHRztJQUNILHdCQUF3QixHQUFBO1FBQ3RCLElBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLElBQUksQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFO1lBQUU7UUFBUTtRQUU1RCxJQUFJLENBQUMsbUJBQW1CLEVBQUU7UUFFMUIsSUFBSSxJQUFJLENBQUMscUJBQXFCLElBQUksQ0FBQyxJQUFJLENBQUMsb0JBQW9CLEVBQUU7WUFBRTtRQUFRO0FBRXhFLFFBQUEsTUFBTSxZQUFZLEdBQVcsSUFBSSxDQUFDLG9CQUFvQixDQUFDLGlCQUFpQjtBQUN4RSxRQUFBLE1BQU0sTUFBTSxHQUFlLElBQUksVUFBVSxDQUFDLFlBQVksQ0FBQztBQUV2RCxRQUFBLElBQUksQ0FBQyxxQkFBcUIsR0FBRyxJQUFJO1FBRWpDLE1BQU0sVUFBVSxHQUFHLE1BQVc7QUFDNUIsWUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLHFCQUFxQixFQUFFO2dCQUFFO1lBQVE7QUFFM0MsWUFBQSxJQUFJLElBQUksQ0FBQyxvQkFBb0IsRUFBRTtBQUM3QixnQkFBQSxJQUFJLENBQUMsb0JBQW9CLENBQUMsb0JBQW9CLENBQUMsTUFBTSxDQUFDO0FBQ3RELGdCQUFBLE1BQU0sV0FBVyxHQUFXLE9BQU8sQ0FBQyxNQUFNLENBQUM7Z0JBRTNDLElBQUksQ0FBQyxJQUFJLENBQUMsYUFBYSxFQUFFLFdBQVcsR0FBRyxHQUFHLENBQUM7WUFDN0M7WUFFQSxxQkFBcUIsQ0FBQyxVQUFVLENBQUM7QUFDbkMsUUFBQSxDQUFDO1FBRUQscUJBQXFCLENBQUMsVUFBVSxDQUFDO0lBQ25DO0FBRUE7OztBQUdHO0lBQ0gsdUJBQXVCLEdBQUE7QUFDckIsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFpQixFQUFFO1lBQUU7UUFBUTtBQUV2QyxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMscUJBQXFCLEtBQUssSUFBSSxDQUFDLFdBQVcsSUFBSSxJQUFJLENBQUMsYUFBYSxDQUFDLGFBQWEsQ0FBQyxDQUFDLEVBQUU7WUFDMUY7UUFDRjtBQUVBLFFBQUEsSUFBSSxJQUFJLENBQUMsa0JBQWtCLEVBQUU7QUFDM0IsWUFBQSxJQUFJLENBQUMsa0JBQWtCLENBQUMsVUFBVSxFQUFFO1lBQ3BDLE9BQU8sSUFBSSxDQUFDLGtCQUFrQjtRQUNoQztBQUVBLFFBQUEsSUFBSSxDQUFDLHFCQUFxQixHQUFHLEtBQUs7SUFDcEM7QUFFQTs7OztBQUlHO0FBQ0gsSUFBQSxpQ0FBaUMsQ0FBQyxXQUFtQyxFQUFBO1FBQ25FLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHlDQUF5QyxFQUFFLFdBQVcsQ0FBQztBQUN0RSxRQUFBLE9BQU8sSUFBSSxDQUFDLGFBQWEsQ0FBQyxXQUFXLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxNQUFtQixLQUNYO0FBRW5ELFlBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsb0RBQW9ELENBQUM7OztZQUdwRSxJQUFJLENBQUMsdUJBQXVCLEVBQUUsQ0FBQyxLQUFLLENBQUMsS0FBSyxJQUFHOztnQkFFM0MsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsaURBQWlELEVBQUUsS0FBSyxDQUFDO0FBQzFFLFlBQUEsQ0FBQyxDQUFDO0FBQ0YsWUFBQSxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsZUFBZTtZQUN0QyxJQUFJLENBQUMsU0FBUyxFQUFFO0FBQ2QsZ0JBQUEsT0FBTyxFQUFFLFNBQVMsRUFBRSxJQUFJLEVBQUUsU0FBUyxFQUFFLElBQUksRUFBRSxHQUFHLEVBQUUsTUFBTSxFQUFFO1lBQzFEO0FBRUEsWUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxpQ0FBaUMsQ0FBQzs7WUFFakQsT0FBTyxPQUFPLENBQUMsT0FBTyxFQUFFLENBQUMsSUFBSSxDQUFDLE1BQU0sU0FBUyxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsSUFBSSxDQUFDLGVBQWUsSUFBRztnQkFDbEcsSUFBSSxDQUFDLGVBQWUsRUFBRTtBQUNwQixvQkFBQSxNQUFNLElBQUksb0JBQW9CLENBQUMsdURBQXVELENBQUM7Z0JBQ3pGO2dCQUNBLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQztnQkFDdkQsT0FBTyxFQUFFLFNBQVMsRUFBRSxlQUFlLEVBQUUsU0FBUyxFQUFFLEdBQUcsRUFBRSxNQUFNLEVBQUU7QUFDL0QsWUFBQSxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsS0FBSyxJQUFHOztBQUVmLGdCQUFBLE1BQU0sQ0FBQyxTQUFTLEVBQUUsQ0FBQyxPQUFPLENBQUMsS0FBSyxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUUsQ0FBQztBQUNqRCxnQkFBQSxNQUFNLEtBQUs7QUFDYixZQUFBLENBQUMsQ0FBQztBQUNKLFFBQUEsQ0FBQyxDQUFDO0lBQ0o7QUFFQTs7OztBQUlHO0FBQ0gsSUFBQSw4QkFBOEIsQ0FBQyxLQUF5QixFQUFBO0FBQ3RELFFBQUEsSUFBSSxDQUFDLGFBQWEsR0FBRyxLQUFLO0FBQzFCLFFBQUEsSUFBSSxLQUFLLENBQUMsU0FBUyxFQUFFO0FBQ25CLFlBQUEsSUFBSSxDQUFDLHFCQUFxQixHQUFHLEtBQUssQ0FBQyxTQUFTO1FBQzlDO0lBQ0Y7QUFFQTs7Ozs7QUFLRztBQUNILElBQUEsNkJBQTZCLENBQUMsS0FBQSxHQUFtQyxJQUFJLENBQUMsYUFBYSxFQUFBO1FBQ2pGLElBQUksQ0FBQyxLQUFLLEVBQUU7WUFDVjtRQUNGO0FBRUEsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQztBQUNoRCxRQUFBLEtBQUssQ0FBQyxHQUFHLENBQUMsU0FBUyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDcEQsUUFBQSxJQUFJLEtBQUssS0FBSyxJQUFJLENBQUMsYUFBYSxFQUFFO0FBQ2hDLFlBQUEsSUFBSSxDQUFDLGFBQWEsR0FBRyxJQUFJO1FBQzNCO0FBQ0EsUUFBQSxJQUFJLENBQUMsOEJBQThCLENBQUMsS0FBSyxDQUFDO0lBQzVDO0FBRUE7OztBQUdHO0lBQ0gsT0FBTyxHQUFBOztBQUNMLFFBQUEsSUFBSSxNQUFBLElBQUksQ0FBQyxhQUFhLE1BQUEsSUFBQSxJQUFBLEVBQUEsS0FBQSxNQUFBLEdBQUEsTUFBQSxHQUFBLEVBQUEsQ0FBRSxtQkFBbUIsRUFBRTtZQUMzQyxJQUFJLENBQUMsYUFBYSxDQUFDLG1CQUFtQixDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsdUJBQXVCLENBQUM7UUFDdEY7SUFDRjtBQWtDQTs7O0FBR0c7QUFDSCxJQUFBLGtCQUFrQixDQUFDLE9BQTRCLEVBQUE7QUFDN0MsUUFBQSxJQUFJLE9BQU8sT0FBTyxDQUFDLGdCQUFnQixLQUFLLFVBQVUsRUFBRTtBQUNsRCxZQUFBLElBQUksQ0FBQyxpQkFBaUIsR0FBRyxPQUFPLENBQUMsZ0JBQWdCO1FBQ25EO0FBQ0EsUUFBQSxJQUFJLE9BQU8sT0FBTyxDQUFDLFlBQVksS0FBSyxVQUFVLEVBQUU7QUFDOUMsWUFBQSxJQUFJLENBQUMsYUFBYSxHQUFHLE9BQU8sQ0FBQyxZQUFZO1FBQzNDO0lBQ0Y7QUFFQTs7Ozs7Ozs7Ozs7Ozs7O0FBZUc7QUFDSCxJQUFBLFlBQVksQ0FBQyxTQUF5QixFQUFFLFFBQUEsR0FBb0IsS0FBSyxFQUFBO0FBQy9ELFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDO0FBRWhDLFFBQUEsSUFBSSxJQUFJLENBQUMsZUFBZSxJQUFJLENBQUMsUUFBUSxFQUFFO0FBQ3JDLFlBQUEsTUFBTSxJQUFJLGlCQUFpQixDQUFDLG1EQUFtRCxDQUFDO1FBQ2xGO0FBRUEsUUFBQSxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsSUFBSSxRQUFRLEVBQUU7QUFDckMsWUFBQSxNQUFNLElBQUksaUJBQWlCLENBQUMsb0RBQW9ELENBQUM7UUFDbkY7UUFFQSxJQUFJLE9BQU8sU0FBUyxLQUFLLFFBQVEsSUFBSSxTQUFTLEtBQUssSUFBSSxFQUFFO0FBQ3ZELFlBQUEsTUFBTSxJQUFJLG9CQUFvQixDQUFDLGtDQUFrQyxDQUFDO1FBQ3BFO0FBRUEsUUFBQSxJQUFJLE9BQU8sU0FBUyxDQUFDLHFCQUFxQixLQUFLLFVBQVUsRUFBRTtBQUN6RCxZQUFBLE1BQU0sSUFBSSxvQkFBb0IsQ0FBQyx5Q0FBeUMsQ0FBQztRQUMzRTtBQUVBLFFBQUEsSUFBSSxPQUFPLFNBQVMsQ0FBQyxzQkFBc0IsS0FBSyxVQUFVLEVBQUU7QUFDMUQsWUFBQSxNQUFNLElBQUksb0JBQW9CLENBQUMsMENBQTBDLENBQUM7UUFDNUU7UUFFQSxJQUFJLFFBQVEsRUFBRTtBQUNaLFlBQUEsSUFBSSxDQUFDLGdCQUFnQixHQUFHLFNBQVM7WUFDakMsSUFBSSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxLQUFLLEVBQUUsSUFBSSxDQUFDO0FBQ25ELFlBQUEsT0FBTyxPQUFPLENBQUMsT0FBTyxFQUFFO1FBQzFCO2FBQU87QUFDTCxZQUFBLElBQUksQ0FBQyxlQUFlLEdBQUcsU0FBUztZQUNoQyxJQUFJLENBQUMsNEJBQTRCLENBQUMsSUFBSSxDQUFDLEtBQUssRUFBRSxLQUFLLENBQUM7QUFDcEQsWUFBQSxPQUFPLElBQUksQ0FBQyxvQkFBb0IsRUFBRTtRQUNwQztJQUNGO0FBRUE7Ozs7O0FBS0c7QUFDSCxJQUFBLFVBQVUsQ0FBQyxRQUFrQixFQUFBO1FBQzNCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLGFBQWEsRUFBRSxRQUFRLENBQUM7QUFDeEMsUUFBQSxPQUFPLElBQUksQ0FBQyxpQkFBaUIsQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDLFVBQVUsRUFBRSxRQUFRLENBQUM7SUFDdEU7QUFFQTs7Ozs7QUFLRztBQUNILElBQUEsUUFBUSxDQUFDLFFBQWtCLEVBQUE7UUFDekIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsV0FBVyxFQUFFLFFBQVEsQ0FBQztBQUN0QyxRQUFBLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQztJQUNwRTtBQUVBOzs7OztBQUtHO0FBQ0gsSUFBQSxRQUFRLENBQUMsUUFBa0IsRUFBQTtRQUN6QixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxXQUFXLEVBQUUsUUFBUSxDQUFDO0FBQ3RDLFFBQUEsT0FBTyxJQUFJLENBQUMsaUJBQWlCLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEVBQUUsUUFBUSxDQUFDO0lBQ3BFO0FBRUE7Ozs7Ozs7Ozs7Ozs7QUFhRztBQUNILElBQUEsZUFBZSxDQUFDLFNBQXlCLEVBQUUsUUFBQSxHQUFvQixLQUFLLEVBQUE7QUFDbEUsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxrQkFBa0IsQ0FBQztRQUVuQyxJQUFJLE9BQU8sU0FBUyxLQUFLLFFBQVEsSUFBSSxTQUFTLEtBQUssSUFBSSxFQUFFO0FBQ3ZELFlBQUEsTUFBTSxJQUFJLG9CQUFvQixDQUFDLGtDQUFrQyxDQUFDO1FBQ3BFO1FBRUEsSUFBSSxJQUFJLENBQUMsZUFBZSxLQUFLLFNBQVMsSUFBSSxDQUFDLFFBQVEsRUFBRTtBQUNuRCxZQUFBLE1BQU0sSUFBSSxvQkFBb0IsQ0FBQywwRUFBMEUsQ0FBQztRQUM1RztRQUNBLElBQUksSUFBSSxDQUFDLGdCQUFnQixLQUFLLFNBQVMsSUFBSSxRQUFRLEVBQUU7QUFDbkQsWUFBQSxNQUFNLElBQUksb0JBQW9CLENBQUMsMkVBQTJFLENBQUM7UUFDN0c7UUFFQSxJQUFJLFFBQVEsRUFBRTtZQUNaLElBQUksQ0FBQyw2QkFBNkIsRUFBRTtBQUNwQyxZQUFBLElBQUksQ0FBQyxnQkFBZ0IsR0FBRyxJQUFJO1lBQzVCLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQztBQUN0RCxZQUFBLE9BQU8sT0FBTyxDQUFDLE9BQU8sRUFBRTtRQUMxQjthQUFPO1lBQ0wsSUFBSSxDQUFDLDRCQUE0QixFQUFFO0FBQ25DLFlBQUEsSUFBSSxDQUFDLGVBQWUsR0FBRyxJQUFJO1lBQzNCLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQztBQUN2RCxZQUFBLE9BQU8sSUFBSSxDQUFDLG9CQUFvQixFQUFFO1FBQ3BDO0lBQ0Y7QUFFQTs7Ozs7O0FBTUc7QUFDSCxJQUFBLG1CQUFtQixDQUFDLGdCQUF1QyxFQUFBO1FBQ3pELElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLHNCQUFzQixFQUFFLGdCQUFnQixDQUFDO1FBQ3pELElBQUksQ0FBQyxpQkFBaUIsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUcsRUFBRSxnQkFBZ0IsQ0FBQztBQUM3RCxRQUFBLE9BQU8sSUFBSSxDQUFDLGlCQUFpQixDQUFDLFFBQVE7UUFFdEMsT0FBTyxJQUFJLENBQUM7QUFDVixjQUFFLElBQUksQ0FBQyxlQUFlLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLEVBQUUsSUFBSTtBQUN0RCxjQUFFLE9BQU8sQ0FBQyxPQUFPLEVBQUU7SUFDdkI7QUFFQTs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQWlERztBQUNILElBQUEsY0FBYyxDQUFDLFFBQWdCLEVBQUE7UUFDN0IsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsaUJBQWlCLEVBQUUsUUFBUSxDQUFDO1FBQzVDLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxRQUFRLEVBQUUsS0FBSyxDQUFDO0lBQzlDO0FBRUE7Ozs7QUFJRztJQUNILHFCQUFxQixHQUFBO0FBQ25CLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsd0JBQXdCLENBQUM7QUFDekMsUUFBQSxJQUFJLENBQUMsaUJBQWlCLEdBQUcsSUFBSTtRQUM3QixPQUFPLElBQUksQ0FBQztBQUNWLGNBQUUsSUFBSSxDQUFDLGVBQWUsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLFFBQVEsRUFBRSxJQUFJO0FBQ3RELGNBQUUsT0FBTyxDQUFDLE9BQU8sRUFBRTtJQUN2QjtBQUVBOzs7O0FBSUc7SUFDSCxnQkFBZ0IsR0FBQTtRQUNkLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLG1CQUFtQixFQUFFLElBQUksQ0FBQyxXQUFXLENBQUM7QUFDdEQsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRTtBQUFFLFlBQUEsT0FBTyxPQUFPLENBQUMsT0FBTyxFQUFFO1FBQUU7UUFFbkQsSUFBSSxDQUFDLDRCQUE0QixFQUFFO1FBRW5DLE9BQU8sSUFBSSxDQUFDLHFCQUFxQixDQUFDLElBQUksQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFLO0FBQ2hELFlBQUEsSUFBSSxDQUFDLGNBQWMsQ0FBQyxJQUFJLENBQUM7QUFDekIsWUFBQSxJQUFJLENBQUMsWUFBWSxHQUFHLElBQUk7WUFDeEIsSUFBSSxDQUFDLHVCQUF1QixFQUFFO0FBQ2hDLFFBQUEsQ0FBQyxDQUFDO0lBQ0o7QUFFQTs7QUFFRztBQUNLLElBQUEsOEJBQThCLENBQUMsS0FBeUIsRUFBQTtBQUM5RCxRQUFBLE1BQU0sRUFBRSxTQUFTLEVBQUUsU0FBUyxFQUFFLEdBQUcsS0FBSztBQUN0QyxRQUFBLElBQUksQ0FBQyxTQUFTLElBQUksQ0FBQyxTQUFTLEVBQUU7WUFDNUI7UUFDRjtBQUVBLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsbUNBQW1DLENBQUM7QUFDbkQsUUFBQSxLQUFLLENBQUMsU0FBUyxHQUFHLElBQUk7QUFDdEIsUUFBQSxTQUFTLENBQUMsU0FBUyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDcEQsUUFBQSxJQUFJLFNBQVMsS0FBSyxJQUFJLENBQUMscUJBQXFCLEVBQUU7QUFDNUMsWUFBQSxJQUFJLENBQUMscUJBQXFCLEdBQUcsSUFBSTtRQUNuQztBQUNBLFFBQUEsU0FBUyxDQUFDLHNCQUFzQixDQUFDLFNBQVMsQ0FBQztRQUMzQyxJQUFJLENBQUMsNEJBQTRCLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxLQUFLLENBQUM7SUFDMUQ7QUFFQTs7QUFFRztJQUNLLDRCQUE0QixHQUFBO0FBQ2xDLFFBQUEsSUFBSSxJQUFJLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxhQUFhLENBQUMsU0FBUyxLQUFLLElBQUksQ0FBQyxxQkFBcUIsRUFBRTtBQUNyRixZQUFBLElBQUksQ0FBQyw4QkFBOEIsQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO1lBQ3ZEO1FBQ0Y7UUFFQSxJQUFJLElBQUksQ0FBQyxlQUFlLElBQUksSUFBSSxDQUFDLHFCQUFxQixFQUFFO0FBQ3RELFlBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsbUNBQW1DLENBQUM7QUFDbkQsWUFBQSxNQUFNLG9CQUFvQixHQUFHLElBQUksQ0FBQyxxQkFBcUI7QUFDdkQsWUFBQSxJQUFJLENBQUMscUJBQXFCLENBQUMsU0FBUyxFQUFFLENBQUMsT0FBTyxDQUFDLEtBQUssSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFLENBQUM7QUFDckUsWUFBQSxJQUFJLENBQUMscUJBQXFCLEdBQUcsSUFBSTtBQUNqQyxZQUFBLElBQUksQ0FBQyxlQUFlLENBQUMsc0JBQXNCLENBQUMsb0JBQW9CLENBQUM7WUFDakUsSUFBSSxDQUFDLDRCQUE0QixDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsS0FBSyxDQUFDO1FBQzFEO0lBQ0Y7QUFFQTs7OztBQUlHO0FBQ0ssSUFBQSxzQkFBc0IsQ0FBQyxlQUFnQyxFQUFBO0FBQzdELFFBQUEsTUFBTSxFQUFFLEdBQVcsZUFBZSxDQUFDLFFBQVE7QUFDM0MsUUFBQSxNQUFNLElBQUksR0FBVyxlQUFlLENBQUMsSUFBSTtRQUV6QyxJQUFJLEtBQUssR0FBVyxJQUFJLENBQUMscUJBQXFCLENBQUMsSUFBSSxDQUFDLENBQUMsRUFBRSxDQUFDO1FBQ3hELElBQUksQ0FBQyxLQUFLLEVBQUU7QUFDVixZQUFBLEtBQUssR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDLE1BQU0sR0FBRyxDQUFDO1lBQ2hFLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxJQUFJLENBQUMsQ0FBQyxFQUFFLENBQUMsR0FBRyxLQUFLO1FBQzlDO0FBRUEsUUFBQSxPQUFPLEtBQUs7SUFDZDtBQUVBOztBQUVHO0lBQ0ssc0JBQXNCLEdBQUE7UUFDNUIsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQyxJQUFJLENBQUMsaUJBQWlCLEVBQUU7QUFDbEQsWUFBQSxNQUFNLElBQUksaUJBQWlCLENBQUMsOEJBQThCLENBQUM7UUFDN0Q7QUFFQSxRQUFBLElBQUksSUFBSSxDQUFDLGFBQWEsQ0FBQyxnQkFBZ0IsRUFBRTtZQUN2QyxJQUFJLENBQUMsYUFBYSxDQUFDLGdCQUFnQixDQUFDLGNBQWMsRUFBRSxJQUFJLENBQUMsdUJBQXVCLENBQUM7UUFDbkY7QUFFQSxRQUFBLElBQUksQ0FBQyx1QkFBdUIsRUFBRSxDQUFDLElBQUksQ0FBQyxNQUFLO0FBQ3ZDLFlBQUEsSUFBSSxDQUFDLElBQUksQ0FBQywwQkFBMEIsRUFBRTtnQkFBRTtZQUFRO1lBRWhELE9BQU8sQ0FBQyxHQUFHLENBQUM7QUFDVixnQkFBQSxJQUFJLENBQUMsY0FBYyxDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUM7QUFDbEMsZ0JBQUEsSUFBSSxDQUFDLGVBQWUsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDO0FBQ3BDLGFBQUEsQ0FBQyxDQUFDLEtBQUssQ0FBQyxNQUFNLElBQUc7Z0JBQ2hCLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLENBQUEsNkNBQUEsRUFBZ0QsTUFBTSxDQUFBLENBQUUsQ0FBQztBQUMxRSxZQUFBLENBQUMsQ0FBQztBQUNKLFFBQUEsQ0FBQyxDQUFDO0lBQ0o7QUFFQTs7QUFFRztBQUNLLElBQUEsZ0NBQWdDLENBQUMsTUFBbUIsRUFBQTtBQUMxRCxRQUFBLElBQUksSUFBSSxDQUFDLGVBQWUsRUFBRTtBQUN4QixZQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGlDQUFpQyxDQUFDO0FBQ2pELFlBQUEsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLHFCQUFxQixDQUFDLE1BQU0sQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLGVBQTRCLEtBQUk7QUFDOUYsZ0JBQUEsSUFBSSxDQUFDLHFCQUFxQixHQUFHLGVBQWU7Z0JBQzVDLElBQUksQ0FBQyw0QkFBNEIsQ0FBQyxJQUFJLENBQUMsUUFBUSxFQUFFLEtBQUssQ0FBQztnQkFDdkQsT0FBTyxJQUFJLENBQUMscUJBQXFCO0FBQ25DLFlBQUEsQ0FBQyxDQUFDO1FBQ0o7QUFDQSxRQUFBLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7SUFDaEM7QUFFQTs7Ozs7QUFLRztJQUNLLGlCQUFpQixDQUFDLFNBQWlDLEVBQUUsUUFBa0IsRUFBQTtBQUM3RSxRQUFBLElBQUksT0FBTyxRQUFRLEtBQUssV0FBVyxFQUFFO0FBQ25DLFlBQUEsSUFBSSxDQUFDLGNBQWMsQ0FBQyxTQUFTLENBQUMsR0FBRyxRQUFRO1FBQzNDO0FBQ0EsUUFBQSxPQUFPLElBQUksQ0FBQyxjQUFjLENBQUMsU0FBUyxDQUFDO0lBQ3ZDO0FBc0NBOzs7QUFHRztBQUNLLElBQUEsY0FBYyxDQUFDLE1BQTBCLEVBQUE7QUFDL0MsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyw0QkFBNEIsQ0FBQztBQUM1QyxRQUFBLElBQUksSUFBSSxDQUFDLDBCQUEwQixFQUFFO0FBQ25DLFlBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsdUNBQXVDLENBQUM7WUFDdkQsSUFBSSxDQUFDLDhCQUE4QixFQUFFO1FBQ3ZDO0FBRUEsUUFBQSxJQUFJLENBQUMsMEJBQTBCLEdBQUcsTUFBTTtJQUMxQztBQUVBOztBQUVHO0lBQ0ssb0JBQW9CLEdBQUE7UUFDMUIsSUFBSSxJQUFJLENBQUMsV0FBVyxJQUFJLElBQUksQ0FBQywwQkFBMEIsRUFBRTtBQUN2RCxZQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGtDQUFrQyxDQUFDO0FBQ2xELFlBQUEsT0FBTyxJQUFJLENBQUMsZUFBZSxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQztRQUM5RDtBQUVBLFFBQUEsSUFBSSxJQUFJLENBQUMsYUFBYSxFQUFFO1lBQ3RCLE1BQU0sYUFBYSxHQUFHLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsU0FBUztBQUMzRCxtQkFBQSxLQUFLLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUVyRCxZQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHlEQUF5RCxDQUFDO1lBQ3pFLE9BQU8sSUFBSSxDQUFDLGVBQWUsQ0FBQyxhQUFhLENBQUMsUUFBUSxFQUFFLElBQUksQ0FBQztRQUMzRDtBQUVBLFFBQUEsT0FBTyxPQUFPLENBQUMsT0FBTyxFQUFFO0lBQzFCO0FBRUE7Ozs7OztBQU1HO0lBQ1csZUFBZSxDQUFDLFFBQWdCLEVBQUUsaUJBQTBCLEVBQUE7O1lBQ3hFLE1BQU0sY0FBYyxHQUFHLE1BQVcsU0FBQSxDQUFBLElBQUEsRUFBQSxNQUFBLEVBQUEsTUFBQSxFQUFBLGFBQUE7QUFDaEMsZ0JBQUEsTUFBTSxJQUFJLENBQUMscUJBQXFCLEVBQUU7QUFFbEMsZ0JBQUEsSUFBSSxPQUFPLFFBQVEsS0FBSyxRQUFRLEVBQUU7b0JBQ2hDLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLG9CQUFvQixDQUFDLGdDQUFnQyxDQUFDLENBQUM7Z0JBQ25GO2dCQUVBLE1BQU0sTUFBTSxHQUFnQyxJQUFJLENBQUMscUJBQXFCLENBQUMsR0FBRyxDQUFDLFFBQVEsQ0FBQztnQkFDcEYsSUFBSSxDQUFDLE1BQU0sRUFBRTtBQUNYLG9CQUFBLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLG9CQUFvQixDQUFDLENBQUEsa0JBQUEsRUFBcUIsUUFBUSxDQUFBLENBQUUsQ0FBQyxDQUFDO2dCQUNsRjtnQkFFQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyw0QkFBNEIsR0FBRyxRQUFRLENBQUM7QUFFdkQsZ0JBQUEsSUFBSSxJQUFJLENBQUMsWUFBWSxJQUFJLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxLQUFLLFFBQVEsSUFBSSxJQUFJLENBQUMsMEJBQTBCLEVBQUU7b0JBQ25HLElBQUksQ0FBQyxpQkFBaUIsRUFBRTtBQUN0Qix3QkFBQSxPQUFPLE9BQU8sQ0FBQyxPQUFPLEVBQUU7b0JBQzFCOzs7QUFJQSxvQkFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyw2REFBNkQsQ0FBQztvQkFDN0UsSUFBSSxDQUFDLDhCQUE4QixFQUFFO2dCQUN2Qzs7Z0JBR0EsSUFBSSxDQUFDLDZCQUE2QixFQUFFO2dCQUVwQyxNQUFNLFdBQVcsR0FBRyxFQUFFLEtBQUssRUFBRSxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsUUFBUSxFQUFFLEVBQUUsS0FBSyxFQUFFLFFBQVEsRUFBRSxFQUFFLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLEVBQUU7QUFDdEcsZ0JBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMscUNBQXFDLENBQUM7QUFDckQsZ0JBQUEsT0FBTyxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLGNBQTJCLEtBQUk7b0JBRTFFLElBQUksQ0FBQyw0QkFBNEIsRUFBRTtBQUVuQyxvQkFBQSxPQUFPLElBQUksQ0FBQyxnQ0FBZ0MsQ0FBQyxjQUFjLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxTQUFTLEtBQUk7QUFDOUUsd0JBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsaURBQWlELENBQUM7d0JBQ2pFLE9BQU8sSUFBSSxDQUFDLHFCQUFxQixDQUFDLFNBQVMsQ0FBQyxDQUFDLElBQUksQ0FBQyxNQUFLO0FBQ3JELDRCQUFBLElBQUksQ0FBQyxjQUFjLENBQUMsY0FBYyxDQUFDO0FBQ25DLDRCQUFBLElBQUksQ0FBQyxZQUFZLEdBQUcsTUFBTTs0QkFDMUIsSUFBSSxDQUFDLHdCQUF3QixFQUFFO0FBQ2pDLHdCQUFBLENBQUMsQ0FBQztBQUNKLG9CQUFBLENBQUMsQ0FBQztBQUNKLGdCQUFBLENBQUMsQ0FBQztBQUNKLFlBQUEsQ0FBQyxDQUFBO1lBRUQsT0FBTyxJQUFJLENBQUMsbUJBQW1CLEdBQUcsY0FBYyxFQUFFLENBQUMsT0FBTyxDQUFDLE1BQUs7QUFDOUQsZ0JBQUEsSUFBSSxDQUFDLG1CQUFtQixHQUFHLElBQUk7QUFDakMsWUFBQSxDQUFDLENBQUM7UUFDSixDQUFDLENBQUE7QUFBQSxJQUFBO0FBRUQ7O0FBRUc7SUFDSyxpQ0FBaUMsR0FBQTs7QUFDdkMsUUFBQSxJQUFJLE1BQUEsSUFBSSxDQUFDLDJCQUEyQixNQUFBLElBQUEsSUFBQSxFQUFBLEtBQUEsTUFBQSxHQUFBLE1BQUEsR0FBQSxFQUFBLENBQUUsbUJBQW1CLEVBQUU7WUFDekQsSUFBSSxDQUFDLDJCQUEyQixDQUFDLG1CQUFtQixDQUFDLFFBQVEsRUFBRSxJQUFJLENBQUMsb0NBQW9DLENBQUM7UUFDM0c7SUFDRjtBQUVBOztBQUVHO0lBQ0ssOEJBQThCLEdBQUE7QUFDcEMsUUFBQSxJQUFJLElBQUksQ0FBQywwQkFBMEIsRUFBRTtBQUNuQyxZQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGlDQUFpQyxDQUFDO0FBQ2pELFlBQUEsSUFBSSxDQUFDLDBCQUEwQixDQUFDLFNBQVMsRUFBRSxDQUFDLE9BQU8sQ0FBQyxLQUFLLElBQUksS0FBSyxDQUFDLElBQUksRUFBRSxDQUFDO1FBQzVFO0lBQ0Y7QUFFQTs7Ozs7O0FBTUc7QUFDSyxJQUFBLGNBQWMsQ0FBQyxjQUFpQyxFQUNqQyxnQkFBOEMsRUFDOUMsZ0JBQTBELEVBQUE7QUFDL0UsUUFBQSxNQUFNLGdCQUFnQixHQUFhLGNBQWMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQyxRQUFRLENBQUM7UUFDdEUsTUFBTSxjQUFjLEdBQWEsS0FBSyxDQUFDLElBQUksQ0FBQyxnQkFBZ0IsQ0FBQyxNQUFNLEVBQUUsQ0FBQyxDQUFDLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDLFFBQVEsQ0FBQztRQUMzRixNQUFNLGlCQUFpQixHQUFzQixFQUFFOztRQUcvQyxNQUFNLGFBQWEsR0FBYSxVQUFVLENBQUMsY0FBYyxFQUFFLGdCQUFnQixDQUFDO0FBQzVFLFFBQUEsYUFBYSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFlBQW9CLEtBQUk7WUFDN0MsTUFBTSxVQUFVLEdBQWdDLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxZQUFZLENBQUM7WUFDbEYsSUFBSSxVQUFVLEVBQUU7QUFDZCxnQkFBQSxnQkFBZ0IsQ0FBQyxNQUFNLENBQUMsWUFBWSxDQUFDO0FBQ3JDLGdCQUFBLElBQUksZ0JBQWdCLENBQUMsVUFBVSxDQUFDLEVBQUU7QUFBRSxvQkFBQSxpQkFBaUIsQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO2dCQUFFO1lBQzFFO0FBQ0YsUUFBQSxDQUFDLENBQUM7O1FBR0YsSUFBSSxhQUFhLEdBQVksS0FBSztBQUNsQyxRQUFBLGNBQWMsQ0FBQyxPQUFPLENBQUMsU0FBUyxJQUFHO1lBQ2pDLE1BQU0sY0FBYyxHQUFnQyxnQkFBZ0IsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDLFFBQVEsQ0FBQztZQUM1RixNQUFNLGtCQUFrQixHQUFvQixJQUFJLENBQUMsb0JBQW9CLENBQUMsU0FBUyxDQUFDO1lBRWhGLElBQUksQ0FBQyxjQUFjLElBQUksY0FBYyxDQUFDLEtBQUssS0FBSyxrQkFBa0IsQ0FBQyxLQUFLLEVBQUU7Z0JBQ3hFLGdCQUFnQixDQUFDLEdBQUcsQ0FBQyxTQUFTLENBQUMsUUFBUSxFQUFFLGtCQUFrQixDQUFDO2dCQUM1RCxhQUFhLEdBQUcsSUFBSTtZQUN0QjtBQUNGLFFBQUEsQ0FBQyxDQUFDO0FBRUYsUUFBQSxJQUFJLGFBQWEsSUFBSSxhQUFhLENBQUMsTUFBTSxFQUFFOzs7Ozs7WUFNekMsTUFBTSxTQUFTLEdBQUcsU0FBUzs7QUFFM0IsWUFBQSxNQUFNLGdCQUFnQixHQUFHLElBQUksQ0FBQyxXQUFXLElBQUksSUFBSSxDQUFDLFdBQVcsQ0FBQyxRQUFRLEtBQUssU0FBUzs7O0FBR3BGLFlBQUEsTUFBTSxrQkFBa0IsR0FBRyxJQUFJLENBQUMsYUFBYSxJQUFJLElBQUksQ0FBQyxxQkFBcUIsQ0FBQyxHQUFHLENBQUMsU0FBUyxDQUFDO0FBRTFGLFlBQUEsSUFBSSxnQkFBZ0IsSUFBSSxrQkFBa0IsRUFBRTtBQUMxQyxnQkFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBO0FBQzhDLG9FQUFBLENBQUEsQ0FBQzs7Ozs7Z0JBTTlELFVBQVUsQ0FBQyxNQUFLO0FBQ2Qsb0JBQUEsSUFBSSxDQUFDLGVBQWUsQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDO2dCQUN2QyxDQUFDLEVBQUUsQ0FBQyxDQUFDO1lBQ1A7WUFDQSxJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxlQUFlLEVBQUUsaUJBQWlCLENBQUM7QUFDbkQsWUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLGNBQWMsRUFBRSxpQkFBaUIsQ0FBQztRQUM5QztJQUNGO0FBRUE7OztBQUdHO0lBQ0ssbUJBQW1CLEdBQUE7QUFDekIsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLFdBQVcsSUFBSSxDQUFDLElBQUksQ0FBQyxhQUFhLElBQUksQ0FBQyxJQUFJLENBQUMsb0JBQW9CLEVBQUU7WUFDMUU7UUFDRjtBQUVBLFFBQUEsSUFBSSxJQUFJLENBQUMsa0JBQWtCLEVBQUU7QUFDM0IsWUFBQSxJQUFJLENBQUMsa0JBQWtCLENBQUMsVUFBVSxFQUFFO1FBQ3RDO0FBRUEsUUFBQSxJQUFJO0FBQ0YsWUFBQSxJQUFJLENBQUMsa0JBQWtCLEdBQUcsSUFBSSxDQUFDLGFBQWEsQ0FBQyx1QkFBdUIsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDO1lBQ3RGLElBQUksQ0FBQyxrQkFBa0IsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLG9CQUFvQixDQUFDO1FBQzVEO1FBQUUsT0FBTyxFQUFFLEVBQUU7WUFDWCxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxnQ0FBZ0MsRUFBRSxFQUFFLENBQUM7WUFDcEQsT0FBTyxJQUFJLENBQUMsa0JBQWtCO1FBQ2hDO0lBQ0Y7QUFFQTs7OztBQUlHO0FBQ0ssSUFBQSxvQkFBb0IsQ0FBQyxlQUFnQyxFQUFBO0FBQzNELFFBQUEsTUFBTSxPQUFPLEdBQTJCO1lBQ3RDLFFBQVEsRUFBRSxlQUFlLENBQUMsUUFBUTtZQUNsQyxPQUFPLEVBQUUsZUFBZSxDQUFDLE9BQU87WUFDaEMsSUFBSSxFQUFFLGVBQWUsQ0FBQyxJQUFJO1lBQzFCLEtBQUssRUFBRSxlQUFlLENBQUMsS0FBSztTQUM3QjtBQUVELFFBQUEsSUFBSSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUU7QUFDbEIsWUFBQSxJQUFJLE9BQU8sQ0FBQyxRQUFRLEtBQUssU0FBUyxFQUFFO0FBQ2xDLGdCQUFBLE9BQU8sQ0FBQyxLQUFLLEdBQUcsU0FBUztZQUMzQjtpQkFBTztnQkFDTCxNQUFNLEtBQUssR0FBVyxJQUFJLENBQUMsc0JBQXNCLENBQUMsZUFBZSxDQUFDO0FBQ2xFLGdCQUFBLE9BQU8sQ0FBQyxLQUFLLEdBQUcsQ0FBQSxRQUFBLEVBQVcsV0FBVyxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsQ0FBQSxRQUFBLEVBQVcsS0FBSyxFQUFFO1lBQ3hFO1FBQ0Y7QUFFQSxRQUFBLE9BQU8sSUFBSSxtQkFBbUIsQ0FBQyxPQUFPLENBQW9CO0lBQzVEO0FBQ0Q7QUFFRDs7QUFFRztBQUNILENBQUEsVUFBVSxXQUFXLEVBQUE7QUF3RnJCLENBQUMsRUF4RlMsV0FBVyxLQUFYLFdBQVcsR0FBQSxFQUFBLENBQUEsQ0FBQTtBQTBGckIsb0JBQWUsV0FBVzs7OzsifQ==
