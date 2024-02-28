"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @packageDocumentation
 * @module Voice
 */
var events_1 = require("events");
var device_1 = require("./device");
var errors_1 = require("./errors");
var log_1 = require("./log");
var outputdevicecollection_1 = require("./outputdevicecollection");
var mediadeviceinfo_1 = require("./shims/mediadeviceinfo");
var util_1 = require("./util");
/**
 * Aliases for audio kinds, used for labelling.
 * @private
 */
var kindAliases = {
    audioinput: 'Audio Input',
    audiooutput: 'Audio Output',
};
/**
 * Provides input and output audio-based functionality in one convenient class.
 * @publicapi
 */
var AudioHelper = /** @class */ (function (_super) {
    __extends(AudioHelper, _super);
    /**
     * @constructor
     * @private
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
            _a[device_1.default.SoundName.Disconnect] = true,
            _a[device_1.default.SoundName.Incoming] = true,
            _a[device_1.default.SoundName.Outgoing] = true,
            _a);
        /**
         * The current input device.
         */
        _this._inputDevice = null;
        /**
         * Whether the {@link AudioHelper} is currently polling the input stream's volume.
         */
        _this._isPollingInputVolume = false;
        /**
         * An instance of Logger to use.
         */
        _this._log = new log_1.default('AudioHelper');
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
         * @private
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
                            _this._log.warn("Unable to set audio output devices. " + reason);
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
        _this.ringtoneDevices = new outputdevicecollection_1.default('ringtone', _this.availableOutputDevices, onActiveOutputsChanged, _this.isOutputSelectionSupported);
        _this.speakerDevices = new outputdevicecollection_1.default('speaker', _this.availableOutputDevices, onActiveOutputsChanged, _this.isOutputSelectionSupported);
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
     * @private
     */
    AudioHelper.prototype._destroy = function () {
        this._stopDefaultInputDeviceStream();
        this._stopSelectedInputDeviceStream();
        this._destroyProcessedStream();
        this._maybeStopPollingVolume();
        this.removeAllListeners();
        this._unbind();
    };
    /**
     * Start polling volume if it's supported and there's an input stream to poll.
     * @private
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
                var inputVolume = util_1.average(buffer);
                _this.emit('inputVolume', inputVolume / 255);
            }
            requestAnimationFrame(emitVolume);
        };
        requestAnimationFrame(emitVolume);
    };
    /**
     * Stop polling volume if it's currently polling and there are no listeners.
     * @private
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
     * @private
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
     * @private
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
     * @private
     */
    AudioHelper.prototype._unbind = function () {
        if (!this._mediaDevices || !this._enumerateDevices) {
            throw new errors_1.NotSupportedError('Enumeration is not supported');
        }
        if (this._mediaDevices.removeEventListener) {
            this._mediaDevices.removeEventListener('devicechange', this._updateAvailableDevices);
        }
    };
    /**
     * Update AudioHelper options that can be changed by the user
     * @private
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
            throw new errors_1.NotSupportedError('Adding multiple AudioProcessors is not supported at this time.');
        }
        if (typeof processor !== 'object' || processor === null) {
            throw new errors_1.InvalidArgumentError('Missing AudioProcessor argument.');
        }
        if (typeof processor.createProcessedStream !== 'function') {
            throw new errors_1.InvalidArgumentError('Missing createProcessedStream() method.');
        }
        if (typeof processor.destroyProcessedStream !== 'function') {
            throw new errors_1.InvalidArgumentError('Missing destroyProcessedStream() method.');
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
        return this._maybeEnableSound(device_1.default.SoundName.Disconnect, doEnable);
    };
    /**
     * Enable or disable the incoming sound.
     * @param doEnable Passing `true` will enable the sound and `false` will disable the sound.
     * Not passing this parameter will not alter the enable-status of the sound.
     * @returns The enable-status of the sound.
     */
    AudioHelper.prototype.incoming = function (doEnable) {
        this._log.debug('.incoming', doEnable);
        return this._maybeEnableSound(device_1.default.SoundName.Incoming, doEnable);
    };
    /**
     * Enable or disable the outgoing sound.
     * @param doEnable Passing `true` will enable the sound and `false` will disable the sound.
     * Not passing this parameter will not alter the enable-status of the sound.
     * @returns The enable-status of the sound.
     */
    AudioHelper.prototype.outgoing = function (doEnable) {
        this._log.debug('.outgoing', doEnable);
        return this._maybeEnableSound(device_1.default.SoundName.Outgoing, doEnable);
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
            throw new errors_1.InvalidArgumentError('Missing AudioProcessor argument.');
        }
        if (this._processor !== processor) {
            throw new errors_1.InvalidArgumentError('Cannot remove an AudioProcessor that has not been previously added.');
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
            throw new errors_1.NotSupportedError('Enumeration is not supported');
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
                _this._log.warn("Warning: Unable to set audio output devices. " + reason);
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
        var _this = this;
        if (typeof deviceId !== 'string') {
            return Promise.reject(new errors_1.InvalidArgumentError('Must specify the device to set'));
        }
        var device = this.availableInputDevices.get(deviceId);
        if (!device) {
            return Promise.reject(new errors_1.InvalidArgumentError("Device not found: " + deviceId));
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
        var constraints = { audio: Object.assign({ deviceId: { exact: deviceId } }, this.audioConstraints) };
        this._log.info('setInputDevice: getting new tracks.');
        return this._getUserMedia(constraints).then(function (originalStream) {
            _this._destroyProcessedStream();
            return _this._maybeCreateProcessedStream(originalStream).then(function (newStream) {
                _this._log.info('setInputDevice: invoking _onActiveInputChanged.');
                return _this._onActiveInputChanged(newStream).then(function () {
                    _this._replaceStream(originalStream);
                    _this._inputDevice = device;
                    _this._maybeStartPollingVolume();
                });
            });
        });
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
        var lostDeviceIds = util_1.difference(knownDeviceIds, updatedDeviceIds);
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
            if (this.inputDevice !== null && this.inputDevice.deviceId === 'default') {
                this._log.warn("Calling getUserMedia after device change to ensure that the           tracks of the active device (default) have not gone stale.");
                this._setInputDevice(this.inputDevice.deviceId, true);
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
                options.label = "Unknown " + kindAliases[options.kind] + " Device " + index;
            }
        }
        return new mediadeviceinfo_1.default(options);
    };
    return AudioHelper;
}(events_1.EventEmitter));
(function (AudioHelper) {
})(AudioHelper || (AudioHelper = {}));
exports.default = AudioHelper;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9oZWxwZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2F1ZGlvaGVscGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7OztBQUFBOzs7R0FHRztBQUNILGlDQUFzQztBQUd0QyxtQ0FBOEI7QUFDOUIsbUNBQW1FO0FBQ25FLDZCQUF3QjtBQUN4QixtRUFBOEQ7QUFDOUQsMkRBQTBEO0FBQzFELCtCQUF3RDtBQUV4RDs7O0dBR0c7QUFDSCxJQUFNLFdBQVcsR0FBMkI7SUFDMUMsVUFBVSxFQUFFLGFBQWE7SUFDekIsV0FBVyxFQUFFLGNBQWM7Q0FDNUIsQ0FBQztBQUVGOzs7R0FHRztBQUNIO0lBQTBCLCtCQUFZO0lBcUtwQzs7Ozs7O09BTUc7SUFDSCxxQkFBWSxzQkFBNEYsRUFDNUYsb0JBQW1FLEVBQ25FLE9BQTZCOztRQUZ6QyxZQUdFLGlCQUFPLFNBc0VSO1FBL09EOztXQUVHO1FBQ0gsMkJBQXFCLEdBQWlDLElBQUksR0FBRyxFQUFFLENBQUM7UUFFaEU7O1dBRUc7UUFDSCw0QkFBc0IsR0FBaUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQStDakU7O1dBRUc7UUFDSyx1QkFBaUIsR0FBaUMsSUFBSSxDQUFDO1FBWS9EOzs7OztXQUtHO1FBQ0ssK0JBQXlCLEdBQXVCLElBQUksQ0FBQztRQUU3RDs7V0FFRztRQUNLLG9CQUFjO1lBQ3BCLEdBQUMsZ0JBQU0sQ0FBQyxTQUFTLENBQUMsVUFBVSxJQUFHLElBQUk7WUFDbkMsR0FBQyxnQkFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLElBQUcsSUFBSTtZQUNqQyxHQUFDLGdCQUFNLENBQUMsU0FBUyxDQUFDLFFBQVEsSUFBRyxJQUFJO2dCQUNqQztRQVlGOztXQUVHO1FBQ0ssa0JBQVksR0FBMkIsSUFBSSxDQUFDO1FBWXBEOztXQUVHO1FBQ0ssMkJBQXFCLEdBQVksS0FBSyxDQUFDO1FBRS9DOztXQUVHO1FBQ0ssVUFBSSxHQUFRLElB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