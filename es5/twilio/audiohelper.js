'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var events = require('events');
var device = require('./device.js');
var index = require('./errors/index.js');
var log = require('./log.js');
var outputdevicecollection = require('./outputdevicecollection.js');
var mediadeviceinfo = require('./shims/mediadeviceinfo.js');
var util = require('./util.js');

/**
 * Aliases for audio kinds, used for labelling.
 */
var kindAliases = {
    audioinput: 'Audio Input',
    audiooutput: 'Audio Output',
};
/**
 * Provides input and output audio-based functionality in one convenient class.
 */
var AudioHelper = /** @class */ (function (_super) {
    tslib.__extends(AudioHelper, _super);
    /**
     * @internal
     * @param onActiveOutputsChanged - A callback to be called when the user changes the active output devices.
     * @param onActiveInputChanged - A callback to be called when the user changes the active input device.
     * @param [options]
     */
    function AudioHelper(onActiveOutputsChanged, onActiveInputChanged, options) {
        var _a;
        var _this = _super.call(this) || this;
        /**
         * A Map of all audio input devices currently available to the browser by their device ID.
         */
        _this.availableInputDevices = new Map();
        /**
         * A Map of all audio output devices currently available to the browser by their device ID.
         */
        _this.availableOutputDevices = new Map();
        /**
         * The currently set audio constraints set by setAudioConstraints().
         */
        _this._audioConstraints = null;
        /**
         * The default device stream, populated when a call adopts a stream from
         * _openDefaultDeviceWithConstraints (see _adoptDefaultInputDeviceStream).
         * See _selectedInputDeviceStream for differences.
         * TODO: Combine these two workflows (3.x?)
         */
        _this._defaultInput = null;
        /**
         * Whether each sound is enabled.
         */
        _this._enabledSounds = (_a = {},
            _a[device.default.SoundName.Disconnect] = true,
            _a[device.default.SoundName.Incoming] = true,
            _a[device.default.SoundName.Outgoing] = true,
            _a);
        /**
         * The current input device.
         */
        _this._inputDevice = null;
        /**
         * The internal promise created when calling setInputDevice
         */
        _this._inputDevicePromise = null;
        /**
         * Whether the {@link AudioHelper} is currently polling the input stream's volume.
         */
        _this._isPollingInputVolume = false;
        /**
         * An instance of Logger to use.
         */
        _this._log = new log.default('AudioHelper');
        /**
         * Internal reference to the local processed stream.
         */
        _this._localProcessedStream = null;
        /**
         * Internal reference to the added local AudioProcessor.
         */
        _this._localProcessor = null;
        /**
         * Internal reference to the remote processed stream.
         */
        _this._remoteProcessedStream = null;
        /**
         * The selected input stream coming from the microphone device.
         * This is populated when the setInputDevice is called, meaning,
         * the end user manually selected it, which is different than
         * _defaultInput.
         * TODO: Combine these two workflows (3.x?)
         */
        _this._selectedInputDeviceStream = null;
        /**
         * A record of unknown devices (Devices without labels)
         */
        _this._unknownDeviceIndexes = {
            audioinput: {},
            audiooutput: {},
        };
        /**
         * Update the available input and output devices
         * @internal
         */
        _this._updateAvailableDevices = function () {
            if (!_this._mediaDevices || !_this._enumerateDevices) {
                return Promise.reject('Enumeration not supported');
            }
            return _this._enumerateDevices().then(function (devices) {
                _this._updateDevices(devices.filter(function (d) { return d.kind === 'audiooutput'; }), _this.availableOutputDevices, _this._removeLostOutput);
                _this._updateDevices(devices.filter(function (d) { return d.kind === 'audioinput'; }), _this.availableInputDevices, _this._removeLostInput);
                var defaultDevice = _this.availableOutputDevices.get('default')
                    || Array.from(_this.availableOutputDevices.values())[0];
                [_this.speakerDevices, _this.ringtoneDevices].forEach(function (outputDevices) {
                    if (!outputDevices.get().size && _this.availableOutputDevices.size && _this.isOutputSelectionSupported) {
                        outputDevices.set(defaultDevice.deviceId)
                            .catch(function (reason) {
                            _this._log.warn("Unable to set audio output devices. ".concat(reason));
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
        _this._removeLostInput = function (lostDevice) {
            if (!_this.inputDevice || _this.inputDevice.deviceId !== lostDevice.deviceId) {
                return false;
            }
            _this._destroyLocalProcessedStream();
            _this._replaceStream(null);
            _this._inputDevice = null;
            _this._maybeStopPollingVolume();
            var defaultDevice = _this.availableInputDevices.get('default')
                || Array.from(_this.availableInputDevices.values())[0];
            if (defaultDevice) {
                _this.setInputDevice(defaultDevice.deviceId);
            }
            return true;
        };
        /**
         * Remove an input device from outputs
         * @param lostDevice
         * @returns Whether the device was active
         */
        _this._removeLostOutput = function (lostDevice) {
            var wasSpeakerLost = _this.speakerDevices.delete(lostDevice);
            var wasRingtoneLost = _this.ringtoneDevices.delete(lostDevice);
            return wasSpeakerLost || wasRingtoneLost;
        };
        options = Object.assign({
            AudioContext: typeof AudioContext !== 'undefined' && AudioContext,
            setSinkId: typeof HTMLAudioElement !== 'undefined' && HTMLAudioElement.prototype.setSinkId,
        }, options);
        _this._beforeSetInputDevice = options.beforeSetInputDevice || (function () { return Promise.resolve(); });
        _this._updateUserOptions(options);
        _this._audioProcessorEventObserver = options.audioProcessorEventObserver;
        _this._mediaDevices = options.mediaDevices || navigator.mediaDevices;
        _this._onActiveInputChanged = onActiveInputChanged;
        _this._enumerateDevices = typeof options.enumerateDevices === 'function'
            ? options.enumerateDevices
            : _this._mediaDevices && _this._mediaDevices.enumerateDevices.bind(_this._mediaDevices);
        var isAudioContextSupported = !!(options.AudioContext || options.audioContext);
        var isEnumerationSupported = !!_this._enumerateDevices;
        if (options.enabledSounds) {
            _this._enabledSounds = options.enabledSounds;
        }
        var isSetSinkSupported = typeof options.setSinkId === 'function';
        _this.isOutputSelectionSupported = isEnumerationSupported && isSetSinkSupported;
        _this.isVolumeSupported = isAudioContextSupported;
        if (_this.isVolumeSupported) {
            _this._audioContext = options.audioContext || options.AudioContext && new options.AudioContext();
            if (_this._audioContext) {
                _this._inputVolumeAnalyser = _this._audioContext.createAnalyser();
                _this._inputVolumeAnalyser.fftSize = 32;
                _this._inputVolumeAnalyser.smoothingTimeConstant = 0.3;
            }
        }
        _this.ringtoneDevices = new outputdevicecollection.default('ringtone', _this.availableOutputDevices, onActiveOutputsChanged, _this.isOutputSelectionSupported);
        _this.speakerDevices = new outputdevicecollection.default('speaker', _this.availableOutputDevices, onActiveOutputsChanged, _this.isOutputSelectionSupported);
        _this.addListener('newListener', function (eventName) {
            if (eventName === 'inputVolume') {
                _this._maybeStartPollingVolume();
            }
        });
        _this.addListener('removeListener', function (eventName) {
            if (eventName === 'inputVolume') {
                _this._maybeStopPollingVolume();
            }
        });
        _this.once('newListener', function () {
            // NOTE (rrowland): Ideally we would only check isEnumerationSupported here, but
            //   in at least one browser version (Tested in FF48) enumerateDevices actually
            //   returns bad data for the listed devices. Instead, we check for
            //   isOutputSelectionSupported to avoid these quirks that may negatively affect customers.
            if (!_this.isOutputSelectionSupported) {
                _this._log.warn('Warning: This browser does not support audio output selection.');
            }
            if (!_this.isVolumeSupported) {
                _this._log.warn("Warning: This browser does not support Twilio's volume indicator feature.");
            }
        });
        if (isEnumerationSupported) {
            _this._initializeEnumeration();
        }
        // NOTE (kchoy): Currently microphone permissions are not supported in firefox, and Safari V15 and older.
        // https://github.com/mozilla/standards-positions/issues/19#issuecomment-370158947
        // https://caniuse.com/permissions-api
        if (navigator && navigator.permissions && typeof navigator.permissions.query === 'function') {
            navigator.permissions.query({ name: 'microphone' }).then(function (microphonePermissionStatus) {
                if (microphonePermissionStatus.state !== 'granted') {
                    var handleStateChange = function () {
                        _this._updateAvailableDevices();
                        _this._stopMicrophonePermissionListener();
                    };
                    microphonePermissionStatus.addEventListener('change', handleStateChange);
                    _this._microphonePermissionStatus = microphonePermissionStatus;
                    _this._onMicrophonePermissionStatusChanged = handleStateChange;
                }
            }).catch(function (reason) { return _this._log.warn("Warning: unable to listen for microphone permission changes. ".concat(reason)); });
        }
        else {
            _this._log.warn('Warning: current browser does not support permissions API.');
        }
        return _this;
    }
    Object.defineProperty(AudioHelper.prototype, "audioConstraints", {
        /**
         * The currently set audio constraints set by setAudioConstraints(). Starts as null.
         */
        get: function () { return this._audioConstraints; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(AudioHelper.prototype, "inputDevice", {
        /**
         * The active input device. Having no inputDevice specified by `setInputDevice()`
         * will disable input selection related functionality.
         */
        get: function () { return this._inputDevice; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(AudioHelper.prototype, "inputStream", {
        /**
         * The current input stream coming from the microphone device or
         * the processed audio stream if there is an {@link AudioProcessor}.
         */
        get: function () { return this._localProcessedStream || this._selectedInputDeviceStream; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(AudioHelper.prototype, "processedStream", {
        /**
         * The processed stream if a local {@link AudioProcessor} was previously added.
         * @deprecated Use {@link AudioHelper#localProcessedStream} instead.
         */
        get: function () {
            this._log.warn('AudioHelper#processedStream is deprecated. Please use AudioHelper#localProcessedStream instead.');
            return this._localProcessedStream;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(AudioHelper.prototype, "localProcessedStream", {
        /**
         * The processed stream if a local {@link AudioProcessor} was previously added.
         */
        get: function () { return this._localProcessedStream; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(AudioHelper.prototype, "remoteProcessedStream", {
        /**
         * The processed stream if a remote {@link AudioProcessor} was previously added.
         */
        get: function () { return this._remoteProcessedStream; },
        enumerable: false,
        configurable: true
    });
    /**
     * Destroy this AudioHelper instance
     * @internal
     */
    AudioHelper.prototype._destroy = function () {
        this._stopDefaultInputDeviceStream();
        this._stopSelectedInputDeviceStream();
        this._destroyLocalProcessedStream();
        this._destroyRemoteProcessedStream();
        this._maybeStopPollingVolume();
        this.removeAllListeners();
        this._stopMicrophonePermissionListener();
        this._unbind();
    };
    /**
     * Destroys the remote processed stream and updates references.
     * @internal
     */
    AudioHelper.prototype._destroyRemoteProcessedStream = function () {
        if (this._remoteProcessor && this._remoteProcessedStream) {
            this._log.info('destroying remote processed stream');
            var remoteProcessedStream = this._remoteProcessedStream;
            this._remoteProcessedStream.getTracks().forEach(function (track) { return track.stop(); });
            this._remoteProcessedStream = null;
            this._remoteProcessor.destroyProcessedStream(remoteProcessedStream);
            this._audioProcessorEventObserver.emit('destroy', true);
        }
    };
    /**
     * Promise to wait for the input device, if setInputDevice is called outside of the SDK.
     * @internal
     */
    AudioHelper.prototype._getInputDevicePromise = function () {
        return this._inputDevicePromise;
    };
    /**
     * The current AudioProcessorEventObserver instance.
     * @internal
     */
    AudioHelper.prototype._getAudioProcessorEventObserver = function () {
        return this._audioProcessorEventObserver;
    };
    /**
     * Route remote stream to the processor if it exists.
     * @internal
     */
    AudioHelper.prototype._maybeCreateRemoteProcessedStream = function (stream) {
        var _this = this;
        if (this._remoteProcessor) {
            this._log.info('Creating remote processed stream');
            return this._remoteProcessor.createProcessedStream(stream).then(function (processedStream) {
                _this._remoteProcessedStream = processedStream;
                _this._audioProcessorEventObserver.emit('create', true);
                return _this._remoteProcessedStream;
            });
        }
        return Promise.resolve(stream);
    };
    /**
     * Start polling volume if it's supported and there's an input stream to poll.
     * @internal
     */
    AudioHelper.prototype._maybeStartPollingVolume = function () {
        var _this = this;
        if (!this.isVolumeSupported || !this.inputStream) {
            return;
        }
        this._updateVolumeSource();
        if (this._isPollingInputVolume || !this._inputVolumeAnalyser) {
            return;
        }
        var bufferLength = this._inputVolumeAnalyser.frequencyBinCount;
        var buffer = new Uint8Array(bufferLength);
        this._isPollingInputVolume = true;
        var emitVolume = function () {
            if (!_this._isPollingInputVolume) {
                return;
            }
            if (_this._inputVolumeAnalyser) {
                _this._inputVolumeAnalyser.getByteFrequencyData(buffer);
                var inputVolume = util.average(buffer);
                _this.emit('inputVolume', inputVolume / 255);
            }
            requestAnimationFrame(emitVolume);
        };
        requestAnimationFrame(emitVolume);
    };
    /**
     * Stop polling volume if it's currently polling and there are no listeners.
     * @internal
     */
    AudioHelper.prototype._maybeStopPollingVolume = function () {
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
    };
    /**
     * Call getUserMedia with specified constraints. The result becomes the default device stream
     * only once a call adopts it, so a result for a call that has since ended leaves it alone.
     * @internal
     */
    AudioHelper.prototype._openDefaultDeviceWithConstraints = function (constraints) {
        var _this = this;
        this._log.info('Opening default device with constraints', constraints);
        return this._getUserMedia(constraints).then(function (stream) {
            _this._log.info('Opened default device. Updating available devices.');
            // Ensures deviceId's and labels are populated after the gUM call
            // by calling enumerateDevices
            _this._updateAvailableDevices().catch(function (error) {
                // Ignore error, we don't want to break the call flow
                _this._log.warn('Unable to updateAvailableDevices after gUM call', error);
            });
            var processor = _this._localProcessor;
            if (!processor) {
                return { processed: null, processor: null, raw: stream };
            }
            _this._log.info('Creating local processed stream');
            // Through then(), so a processor that throws synchronously also releases the raw stream.
            return Promise.resolve().then(function () { return processor.createProcessedStream(stream); }).then(function (processedStream) {
                if (!processedStream) {
                    throw new index.InvalidArgumentError('The local AudioProcessor did not return a MediaStream');
                }
                _this._audioProcessorEventObserver.emit('create', false);
                return { processed: processedStream, processor: processor, raw: stream };
            }).catch(function (error) {
                // Nothing holds the raw stream yet, so release it here.
                stream.getTracks().forEach(function (track) { return track.stop(); });
                throw error;
            });
        });
    };
    /**
     * Make a stream from _openDefaultDeviceWithConstraints the default device stream
     * @internal
     * @param input - The stream, adopted by the live call that opened it.
     */
    AudioHelper.prototype._adoptDefaultInputDeviceStream = function (input) {
        this._defaultInput = input;
        if (input.processed) {
            this._localProcessedStream = input.processed;
        }
    };
    /**
     * Stop the default audio stream
     * @internal
     * @param input - A stream from _openDefaultDeviceWithConstraints, released whether or not
     *   it was adopted. Defaults to the adopted default device stream.
     */
    AudioHelper.prototype._stopDefaultInputDeviceStream = function (input) {
        if (input === void 0) { input = this._defaultInput; }
        if (!input) {
            return;
        }
        this._log.info('stopping default device stream');
        input.raw.getTracks().forEach(function (track) { return track.stop(); });
        if (input === this._defaultInput) {
            this._defaultInput = null;
        }
        this._destroyDefaultProcessedStream(input);
    };
    /**
     * Unbind the listeners from mediaDevices.
     * @internal
     */
    AudioHelper.prototype._unbind = function () {
        var _a;
        if ((_a = this._mediaDevices) === null || _a === void 0 ? void 0 : _a.removeEventListener) {
            this._mediaDevices.removeEventListener('devicechange', this._updateAvailableDevices);
        }
    };
    /**
     * Update AudioHelper options that can be changed by the user
     * @internal
     */
    AudioHelper.prototype._updateUserOptions = function (options) {
        if (typeof options.enumerateDevices === 'function') {
            this._enumerateDevices = options.enumerateDevices;
        }
        if (typeof options.getUserMedia === 'function') {
            this._getUserMedia = options.getUserMedia;
        }
    };
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
    AudioHelper.prototype.addProcessor = function (processor, isRemote) {
        if (isRemote === void 0) { isRemote = false; }
        this._log.debug('.addProcessor');
        if (this._localProcessor && !isRemote) {
            throw new index.NotSupportedError('Can only have one Local AudioProcessor at a time.');
        }
        if (this._remoteProcessor && isRemote) {
            throw new index.NotSupportedError('Can only have one Remote AudioProcessor at a time.');
        }
        if (typeof processor !== 'object' || processor === null) {
            throw new index.InvalidArgumentError('Missing AudioProcessor argument.');
        }
        if (typeof processor.createProcessedStream !== 'function') {
            throw new index.InvalidArgumentError('Missing createProcessedStream() method.');
        }
        if (typeof processor.destroyProcessedStream !== 'function') {
            throw new index.InvalidArgumentError('Missing destroyProcessedStream() method.');
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
    };
    /**
     * Enable or disable the disconnect sound.
     * @param doEnable Passing `true` will enable the sound and `false` will disable the sound.
     * Not passing this parameter will not alter the enable-status of the sound.
     * @returns The enable-status of the sound.
     */
    AudioHelper.prototype.disconnect = function (doEnable) {
        this._log.debug('.disconnect', doEnable);
        return this._maybeEnableSound(device.default.SoundName.Disconnect, doEnable);
    };
    /**
     * Enable or disable the incoming sound.
     * @param doEnable Passing `true` will enable the sound and `false` will disable the sound.
     * Not passing this parameter will not alter the enable-status of the sound.
     * @returns The enable-status of the sound.
     */
    AudioHelper.prototype.incoming = function (doEnable) {
        this._log.debug('.incoming', doEnable);
        return this._maybeEnableSound(device.default.SoundName.Incoming, doEnable);
    };
    /**
     * Enable or disable the outgoing sound.
     * @param doEnable Passing `true` will enable the sound and `false` will disable the sound.
     * Not passing this parameter will not alter the enable-status of the sound.
     * @returns The enable-status of the sound.
     */
    AudioHelper.prototype.outgoing = function (doEnable) {
        this._log.debug('.outgoing', doEnable);
        return this._maybeEnableSound(device.default.SoundName.Outgoing, doEnable);
    };
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
    AudioHelper.prototype.removeProcessor = function (processor, isRemote) {
        if (isRemote === void 0) { isRemote = false; }
        this._log.debug('.removeProcessor');
        if (typeof processor !== 'object' || processor === null) {
            throw new index.InvalidArgumentError('Missing AudioProcessor argument.');
        }
        if (this._localProcessor !== processor && !isRemote) {
            throw new index.InvalidArgumentError('Cannot remove a Local AudioProcessor that has not been previously added.');
        }
        if (this._remoteProcessor !== processor && isRemote) {
            throw new index.InvalidArgumentError('Cannot remove a Remote AudioProcessor that has not been previously added.');
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
    };
    /**
     * Set the MediaTrackConstraints to be applied on every getUserMedia call for new input
     * device audio. Any deviceId specified here will be ignored. Instead, device IDs should
     * be specified using {@link AudioHelper#setInputDevice}. The returned Promise resolves
     * when the media is successfully reacquired, or immediately if no input device is set.
     * @param audioConstraints - The MediaTrackConstraints to apply.
     */
    AudioHelper.prototype.setAudioConstraints = function (audioConstraints) {
        this._log.debug('.setAudioConstraints', audioConstraints);
        this._audioConstraints = Object.assign({}, audioConstraints);
        delete this._audioConstraints.deviceId;
        return this.inputDevice
            ? this._setInputDevice(this.inputDevice.deviceId, true)
            : Promise.resolve();
    };
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
    AudioHelper.prototype.setInputDevice = function (deviceId) {
        this._log.debug('.setInputDevice', deviceId);
        return this._setInputDevice(deviceId, false);
    };
    /**
     * Unset the MediaTrackConstraints to be applied on every getUserMedia call for new input
     * device audio. The returned Promise resolves when the media is successfully reacquired,
     * or immediately if no input device is set.
     */
    AudioHelper.prototype.unsetAudioConstraints = function () {
        this._log.debug('.unsetAudioConstraints');
        this._audioConstraints = null;
        return this.inputDevice
            ? this._setInputDevice(this.inputDevice.deviceId, true)
            : Promise.resolve();
    };
    /**
     * Unset the input device, stopping the tracks. This should only be called when not in a connection. While the
     *   Device is busy (see `Device.isBusy`), including with an accepted call that is still connecting, it rejects
     *   with InvalidStateError if an input device is set.
     */
    AudioHelper.prototype.unsetInputDevice = function () {
        var _this = this;
        this._log.debug('.unsetInputDevice', this.inputDevice);
        if (!this.inputDevice) {
            return Promise.resolve();
        }
        this._destroyLocalProcessedStream();
        return this._onActiveInputChanged(null).then(function () {
            _this._replaceStream(null);
            _this._inputDevice = null;
            _this._maybeStopPollingVolume();
        });
    };
    /**
     * Destroys a default device stream's processed stream, with the processor that created it.
     */
    AudioHelper.prototype._destroyDefaultProcessedStream = function (input) {
        var processed = input.processed, processor = input.processor;
        if (!processed || !processor) {
            return;
        }
        this._log.info('destroying local processed stream');
        input.processed = null;
        processed.getTracks().forEach(function (track) { return track.stop(); });
        if (processed === this._localProcessedStream) {
            this._localProcessedStream = null;
        }
        processor.destroyProcessedStream(processed);
        this._audioProcessorEventObserver.emit('destroy', false);
    };
    /**
     * Destroys the local processed stream and updates references.
     */
    AudioHelper.prototype._destroyLocalProcessedStream = function () {
        if (this._defaultInput && this._defaultInput.processed === this._localProcessedStream) {
            this._destroyDefaultProcessedStream(this._defaultInput);
            return;
        }
        if (this._localProcessor && this._localProcessedStream) {
            this._log.info('destroying local processed stream');
            var localProcessedStream = this._localProcessedStream;
            this._localProcessedStream.getTracks().forEach(function (track) { return track.stop(); });
            this._localProcessedStream = null;
            this._localProcessor.destroyProcessedStream(localProcessedStream);
            this._audioProcessorEventObserver.emit('destroy', false);
        }
    };
    /**
     * Get the index of an un-labeled Device.
     * @param mediaDeviceInfo
     * @returns The index of the passed MediaDeviceInfo
     */
    AudioHelper.prototype._getUnknownDeviceIndex = function (mediaDeviceInfo) {
        var id = mediaDeviceInfo.deviceId;
        var kind = mediaDeviceInfo.kind;
        var index = this._unknownDeviceIndexes[kind][id];
        if (!index) {
            index = Object.keys(this._unknownDeviceIndexes[kind]).length + 1;
            this._unknownDeviceIndexes[kind][id] = index;
        }
        return index;
    };
    /**
     * Initialize output device enumeration.
     */
    AudioHelper.prototype._initializeEnumeration = function () {
        var _this = this;
        if (!this._mediaDevices || !this._enumerateDevices) {
            throw new index.NotSupportedError('Enumeration is not supported');
        }
        if (this._mediaDevices.addEventListener) {
            this._mediaDevices.addEventListener('devicechange', this._updateAvailableDevices);
        }
        this._updateAvailableDevices().then(function () {
            if (!_this.isOutputSelectionSupported) {
                return;
            }
            Promise.all([
                _this.speakerDevices.set('default'),
                _this.ringtoneDevices.set('default'),
            ]).catch(function (reason) {
                _this._log.warn("Warning: Unable to set audio output devices. ".concat(reason));
            });
        });
    };
    /**
     * Route local stream to the processor if it exists.
     */
    AudioHelper.prototype._maybeCreateLocalProcessedStream = function (stream) {
        var _this = this;
        if (this._localProcessor) {
            this._log.info('Creating local processed stream');
            return this._localProcessor.createProcessedStream(stream).then(function (processedStream) {
                _this._localProcessedStream = processedStream;
                _this._audioProcessorEventObserver.emit('create', false);
                return _this._localProcessedStream;
            });
        }
        return Promise.resolve(stream);
    };
    /**
     * Set whether the sound is enabled or not
     * @param soundName
     * @param doEnable
     * @returns Whether the sound is enabled or not
     */
    AudioHelper.prototype._maybeEnableSound = function (soundName, doEnable) {
        if (typeof doEnable !== 'undefined') {
            this._enabledSounds[soundName] = doEnable;
        }
        return this._enabledSounds[soundName];
    };
    /**
     * Stop the tracks on the current input stream before replacing it with the passed stream.
     * @param stream - The new stream
     */
    AudioHelper.prototype._replaceStream = function (stream) {
        this._log.info('Replacing with new stream.');
        if (this._selectedInputDeviceStream) {
            this._log.info('Old stream detected. Stopping tracks.');
            this._stopSelectedInputDeviceStream();
        }
        this._selectedInputDeviceStream = stream;
    };
    /**
     * Restart the active input streams
     */
    AudioHelper.prototype._restartInputStreams = function () {
        if (this.inputDevice && this._selectedInputDeviceStream) {
            this._log.info('Restarting selected input device');
            return this._setInputDevice(this.inputDevice.deviceId, true);
        }
        if (this._defaultInput) {
            var defaultDevice = this.availableInputDevices.get('default')
                || Array.from(this.availableInputDevices.values())[0];
            this._log.info('Restarting default input device, now becoming selected.');
            return this._setInputDevice(defaultDevice.deviceId, true);
        }
        return Promise.resolve();
    };
    /**
     * Replace the current input device with a new device by ID.
     * @param deviceId - An ID of a device to replace the existing
     *   input device with.
     * @param forceGetUserMedia - If true, getUserMedia will be called even if
     *   the specified device is already active.
     */
    AudioHelper.prototype._setInputDevice = function (deviceId, forceGetUserMedia) {
        return tslib.__awaiter(this, void 0, void 0, function () {
            var setInputDevice;
            var _this = this;
            return tslib.__generator(this, function (_a) {
                setInputDevice = function () { return tslib.__awaiter(_this, void 0, void 0, function () {
                    var device, constraints;
                    var _this = this;
                    return tslib.__generator(this, function (_a) {
                        switch (_a.label) {
                            case 0: return [4 /*yield*/, this._beforeSetInputDevice()];
                            case 1:
                                _a.sent();
                                if (typeof deviceId !== 'string') {
                                    return [2 /*return*/, Promise.reject(new index.InvalidArgumentError('Must specify the device to set'))];
                                }
                                device = this.availableInputDevices.get(deviceId);
                                if (!device) {
                                    return [2 /*return*/, Promise.reject(new index.InvalidArgumentError("Device not found: ".concat(deviceId)))];
                                }
                                this._log.info('Setting input device. ID: ' + deviceId);
                                if (this._inputDevice && this._inputDevice.deviceId === deviceId && this._selectedInputDeviceStream) {
                                    if (!forceGetUserMedia) {
                                        return [2 /*return*/, Promise.resolve()];
                                    }
                                    // If the currently active track is still in readyState `live`, gUM may return the same track
                                    // rather than returning a fresh track.
                                    this._log.info('Same track detected on setInputDevice, stopping old tracks.');
                                    this._stopSelectedInputDeviceStream();
                                }
                                // Release the default device in case it was created previously
                                this._stopDefaultInputDeviceStream();
                                constraints = { audio: Object.assign({ deviceId: { exact: deviceId } }, this.audioConstraints) };
                                this._log.info('setInputDevice: getting new tracks.');
                                return [2 /*return*/, this._getUserMedia(constraints).then(function (originalStream) {
                                        _this._destroyLocalProcessedStream();
                                        return _this._maybeCreateLocalProcessedStream(originalStream).then(function (newStream) {
                                            _this._log.info('setInputDevice: invoking _onActiveInputChanged.');
                                            return _this._onActiveInputChanged(newStream).then(function () {
                                                _this._replaceStream(originalStream);
                                                _this._inputDevice = device;
                                                _this._maybeStartPollingVolume();
                                            });
                                        });
                                    })];
                        }
                    });
                }); };
                return [2 /*return*/, this._inputDevicePromise = setInputDevice().finally(function () {
                        _this._inputDevicePromise = null;
                    })];
            });
        });
    };
    /**
     * Remove event listener for microphone permissions
     */
    AudioHelper.prototype._stopMicrophonePermissionListener = function () {
        var _a;
        if ((_a = this._microphonePermissionStatus) === null || _a === void 0 ? void 0 : _a.removeEventListener) {
            this._microphonePermissionStatus.removeEventListener('change', this._onMicrophonePermissionStatusChanged);
        }
    };
    /**
     * Stop the selected audio stream
     */
    AudioHelper.prototype._stopSelectedInputDeviceStream = function () {
        if (this._selectedInputDeviceStream) {
            this._log.info('Stopping selected device stream');
            this._selectedInputDeviceStream.getTracks().forEach(function (track) { return track.stop(); });
        }
    };
    /**
     * Update a set of devices.
     * @param updatedDevices - An updated list of available Devices
     * @param availableDevices - The previous list of available Devices
     * @param removeLostDevice - The method to call if a previously available Device is
     *   no longer available.
     */
    AudioHelper.prototype._updateDevices = function (updatedDevices, availableDevices, removeLostDevice) {
        var _this = this;
        var updatedDeviceIds = updatedDevices.map(function (d) { return d.deviceId; });
        var knownDeviceIds = Array.from(availableDevices.values()).map(function (d) { return d.deviceId; });
        var lostActiveDevices = [];
        // Remove lost devices
        var lostDeviceIds = util.difference(knownDeviceIds, updatedDeviceIds);
        lostDeviceIds.forEach(function (lostDeviceId) {
            var lostDevice = availableDevices.get(lostDeviceId);
            if (lostDevice) {
                availableDevices.delete(lostDeviceId);
                if (removeLostDevice(lostDevice)) {
                    lostActiveDevices.push(lostDevice);
                }
            }
        });
        // Add any new devices, or devices with updated labels
        var deviceChanged = false;
        updatedDevices.forEach(function (newDevice) {
            var existingDevice = availableDevices.get(newDevice.deviceId);
            var newMediaDeviceInfo = _this._wrapMediaDeviceInfo(newDevice);
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
            var defaultId_1 = 'default';
            // this.inputDevice is not null if audio.setInputDevice() was explicitly called
            var isInputDeviceSet = this.inputDevice && this.inputDevice.deviceId === defaultId_1;
            // If this.inputDevice is null, and default stream is not null, it means
            // the user is using the default stream and did not explicitly call audio.setInputDevice()
            var isDefaultDeviceSet = this._defaultInput && this.availableInputDevices.get(defaultId_1);
            if (isInputDeviceSet || isDefaultDeviceSet) {
                this._log.warn("Calling getUserMedia after device change to ensure that the           tracks of the active device (default) have not gone stale.");
                // NOTE(csantos): Updating the stream in the same execution context as the devicechange event
                // causes the new gUM call to fail silently. Meaning, the gUM call may succeed,
                // but it won't actually update the stream. We need to update the stream in a different
                // execution context (setTimeout) to properly update the stream.
                setTimeout(function () {
                    _this._setInputDevice(defaultId_1, true);
                }, 0);
            }
            this._log.debug('#deviceChange', lostActiveDevices);
            this.emit('deviceChange', lostActiveDevices);
        }
    };
    /**
     * Disconnect the old input volume source, and create and connect a new one with the current
     * input stream.
     */
    AudioHelper.prototype._updateVolumeSource = function () {
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
    };
    /**
     * Convert a MediaDeviceInfo to a IMediaDeviceInfoShim.
     * @param mediaDeviceInfo - The info to convert
     * @returns The converted shim
     */
    AudioHelper.prototype._wrapMediaDeviceInfo = function (mediaDeviceInfo) {
        var options = {
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
                var index = this._getUnknownDeviceIndex(mediaDeviceInfo);
                options.label = "Unknown ".concat(kindAliases[options.kind], " Device ").concat(index);
            }
        }
        return new mediadeviceinfo.default(options);
    };
    return AudioHelper;
}(events.EventEmitter));
/**
 * @mergeModuleWith AudioHelper
 */
(function (AudioHelper) {
})(AudioHelper || (AudioHelper = {}));
var AudioHelper$1 = AudioHelper;

exports.default = AudioHelper$1;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9oZWxwZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vYXVkaW9oZWxwZXIudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOlsiX19leHRlbmRzIiwiRGV2aWNlIiwiTG9nIiwiT3V0cHV0RGV2aWNlQ29sbGVjdGlvbiIsImF2ZXJhZ2UiLCJJbnZhbGlkQXJndW1lbnRFcnJvciIsIk5vdFN1cHBvcnRlZEVycm9yIiwiX19hd2FpdGVyIiwiZGlmZmVyZW5jZSIsIk1lZGlhRGV2aWNlSW5mb1NoaW0iLCJFdmVudEVtaXR0ZXIiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUE2QkE7O0FBRUc7QUFDSCxJQUFNLFdBQVcsR0FBMkI7QUFDMUMsSUFBQSxVQUFVLEVBQUUsYUFBYTtBQUN6QixJQUFBLFdBQVcsRUFBRSxjQUFjO0NBQzVCO0FBRUQ7O0FBRUc7QUFDSCxJQUFBLFdBQUEsa0JBQUEsVUFBQSxNQUFBLEVBQUE7SUFBMEJBLGVBQUEsQ0FBQSxXQUFBLEVBQUEsTUFBQSxDQUFBO0FBaU54Qjs7Ozs7QUFLRztBQUNILElBQUEsU0FBQSxXQUFBLENBQVksc0JBQTRGLEVBQzVGLG9CQUFtRSxFQUNuRSxPQUE2QixFQUFBOztRQUN2QyxJQUFBLEtBQUEsR0FBQSxNQUFLLFdBQUUsSUFBQSxJQUFBO0FBcE5UOztBQUVHO0FBQ0gsUUFBQSxLQUFBLENBQUEscUJBQXFCLEdBQWlDLElBQUksR0FBRyxFQUFFO0FBRS9EOztBQUVHO0FBQ0gsUUFBQSxLQUFBLENBQUEsc0JBQXNCLEdBQWlDLElBQUksR0FBRyxFQUFFO0FBNkRoRTs7QUFFRztRQUNLLEtBQUEsQ0FBQSxpQkFBaUIsR0FBaUMsSUFBSTtBQWlCOUQ7Ozs7O0FBS0c7UUFDSyxLQUFBLENBQUEsYUFBYSxHQUE4QixJQUFJO0FBRXZEOztBQUVHO1FBQ0ssS0FBQSxDQUFBLGNBQWMsSUFBQSxFQUFBLEdBQUEsRUFBQTtBQUNwQixZQUFBLEVBQUEsQ0FBQ0MsY0FBTSxDQUFD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
