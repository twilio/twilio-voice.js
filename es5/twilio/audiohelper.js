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
         * The audio stream of the default device.
         * This is populated when _openDefaultDeviceWithConstraints is called,
         * See _selectedInputDeviceStream for differences.
         * TODO: Combine these two workflows (3.x?)
         */
        _this._defaultInputDeviceStream = null;
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
         * Internal reference to the processed stream
         */
        _this._processedStream = null;
        /**
         * The selected input stream coming from the microphone device.
         * This is populated when the setInputDevice is called, meaning,
         * the end user manually selected it, which is different than
         * the defaultInputDeviceStream.
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
            _this._destroyProcessedStream();
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
        get: function () { return this._processedStream || this._selectedInputDeviceStream; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(AudioHelper.prototype, "processedStream", {
        /**
         * The processed stream if an {@link AudioProcessor} was previously added.
         */
        get: function () { return this._processedStream; },
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
        this._destroyProcessedStream();
        this._maybeStopPollingVolume();
        this.removeAllListeners();
        this._stopMicrophonePermissionListener();
        this._unbind();
    };
    /**
     * Promise to wait for the input device, if setInputDevice is called outside of the SDK
     * @internal
     */
    AudioHelper.prototype._getInputDevicePromise = function () {
        return this._inputDevicePromise;
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
     * Call getUserMedia with specified constraints
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
            _this._defaultInputDeviceStream = stream;
            return _this._maybeCreateProcessedStream(stream);
        });
    };
    /**
     * Stop the default audio stream
     * @internal
     */
    AudioHelper.prototype._stopDefaultInputDeviceStream = function () {
        if (this._defaultInputDeviceStream) {
            this._log.info('stopping default device stream');
            this._defaultInputDeviceStream.getTracks().forEach(function (track) { return track.stop(); });
            this._defaultInputDeviceStream = null;
            this._destroyProcessedStream();
        }
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
     * Adds an {@link AudioProcessor} object. Once added, the AudioHelper will route
     * the input audio stream through the processor before sending the audio
     * stream to Twilio. Only one AudioProcessor can be added at this time.
     *
     * See the {@link AudioProcessor} interface for an example.
     *
     * @param processor The AudioProcessor to add.
     * @returns
     */
    AudioHelper.prototype.addProcessor = function (processor) {
        this._log.debug('.addProcessor');
        if (this._processor) {
            throw new index.NotSupportedError('Adding multiple AudioProcessors is not supported at this time.');
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
        this._processor = processor;
        this._audioProcessorEventObserver.emit('add');
        return this._restartStreams();
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
     * Removes an {@link AudioProcessor}. Once removed, the AudioHelper will start using
     * the audio stream from the selected input device for existing or future calls.
     *
     * @param processor The AudioProcessor to remove.
     * @returns
     */
    AudioHelper.prototype.removeProcessor = function (processor) {
        this._log.debug('.removeProcessor');
        if (typeof processor !== 'object' || processor === null) {
            throw new index.InvalidArgumentError('Missing AudioProcessor argument.');
        }
        if (this._processor !== processor) {
            throw new index.InvalidArgumentError('Cannot remove an AudioProcessor that has not been previously added.');
        }
        this._destroyProcessedStream();
        this._processor = null;
        this._audioProcessorEventObserver.emit('remove');
        return this._restartStreams();
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
     * Unset the input device, stopping the tracks. This should only be called when not in a connection, and
     *   will not allow removal of the input device during a live call.
     */
    AudioHelper.prototype.unsetInputDevice = function () {
        var _this = this;
        this._log.debug('.unsetInputDevice', this.inputDevice);
        if (!this.inputDevice) {
            return Promise.resolve();
        }
        this._destroyProcessedStream();
        return this._onActiveInputChanged(null).then(function () {
            _this._replaceStream(null);
            _this._inputDevice = null;
            _this._maybeStopPollingVolume();
        });
    };
    /**
     * Destroys processed stream and update references
     */
    AudioHelper.prototype._destroyProcessedStream = function () {
        if (this._processor && this._processedStream) {
            this._log.info('destroying processed stream');
            var processedStream = this._processedStream;
            this._processedStream.getTracks().forEach(function (track) { return track.stop(); });
            this._processedStream = null;
            this._processor.destroyProcessedStream(processedStream);
            this._audioProcessorEventObserver.emit('destroy');
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
     * Route input stream to the processor if it exists
     */
    AudioHelper.prototype._maybeCreateProcessedStream = function (stream) {
        var _this = this;
        if (this._processor) {
            this._log.info('Creating processed stream');
            return this._processor.createProcessedStream(stream).then(function (processedStream) {
                _this._processedStream = processedStream;
                _this._audioProcessorEventObserver.emit('create');
                return _this._processedStream;
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
     * Restart the active streams
     */
    AudioHelper.prototype._restartStreams = function () {
        if (this.inputDevice && this._selectedInputDeviceStream) {
            this._log.info('Restarting selected input device');
            return this._setInputDevice(this.inputDevice.deviceId, true);
        }
        if (this._defaultInputDeviceStream) {
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
                                        _this._destroyProcessedStream();
                                        return _this._maybeCreateProcessedStream(originalStream).then(function (newStream) {
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
            var isDefaultDeviceSet = this._defaultInputDeviceStream && this.availableInputDevices.get(defaultId_1);
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9oZWxwZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vYXVkaW9oZWxwZXIudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOlsiX19leHRlbmRzIiwiRGV2aWNlIiwiTG9nIiwiT3V0cHV0RGV2aWNlQ29sbGVjdGlvbiIsImF2ZXJhZ2UiLCJOb3RTdXBwb3J0ZWRFcnJvciIsIkludmFsaWRBcmd1bWVudEVycm9yIiwiX19hd2FpdGVyIiwiZGlmZmVyZW5jZSIsIk1lZGlhRGV2aWNlSW5mb1NoaW0iLCJFdmVudEVtaXR0ZXIiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7QUFVQTs7QUFFRztBQUNILElBQU0sV0FBVyxHQUEyQjtBQUMxQyxJQUFBLFVBQVUsRUFBRSxhQUFhO0FBQ3pCLElBQUEsV0FBVyxFQUFFLGNBQWM7Q0FDNUI7QUFFRDs7QUFFRztBQUNILElBQUEsV0FBQSxrQkFBQSxVQUFBLE1BQUEsRUFBQTtJQUEwQkEsZUFBQSxDQUFBLFdBQUEsRUFBQSxNQUFBLENBQUE7QUF5THhCOzs7OztBQUtHO0FBQ0gsSUFBQSxTQUFBLFdBQUEsQ0FBWSxzQkFBNEYsRUFDNUYsb0JBQW1FLEVBQ25FLE9BQTZCLEVBQUE7O1FBQ3ZDLElBQUEsS0FBQSxHQUFBLE1BQUssV0FBRSxJQUFBLElBQUE7QUE1TFQ7O0FBRUc7QUFDSCxRQUFBLEtBQUEsQ0FBQSxxQkFBcUIsR0FBaUMsSUFBSSxHQUFHLEVBQUU7QUFFL0Q7O0FBRUc7QUFDSCxRQUFBLEtBQUEsQ0FBQSxzQkFBc0IsR0FBaUMsSUFBSSxHQUFHLEVBQUU7QUErQ2hFOztBQUVHO1FBQ0ssS0FBQSxDQUFBLGlCQUFpQixHQUFpQyxJQUFJO0FBaUI5RDs7Ozs7QUFLRztRQUNLLEtBQUEsQ0FBQSx5QkFBeUIsR0FBdUIsSUFBSTtBQUU1RDs7QUFFRztRQUNLLEtBQUEsQ0FBQSxjQUFjLElBQUEsRUFBQSxHQUFBLEVBQUE7QUFDcEIsWUFBQSxFQUFBLENBQUNDLGNBQU0sQ0FB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
