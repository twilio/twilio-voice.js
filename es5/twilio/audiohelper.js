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
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g;
    return g = { next: verb(0), "throw": verb(1), "return": verb(2) }, typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (_) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
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
        // NOTE (kchoy): Currently microphone permissions are not supported in firefox.
        // https://github.com/mozilla/standards-positions/issues/19#issuecomment-370158947
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
        }).catch(function (reason) { return _this._log.warn("Warning: unable to listen for microphone permission changes. " + reason); });
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
        this._stopMicrophonePermissionListener();
        this._unbind();
    };
    /**
     * Promise to wait for the input device, if setInputDevice is called outside of the SDK
     * @private
     */
    AudioHelper.prototype._getInputDevicePromise = function () {
        return this._inputDevicePromise;
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
        var setInputDevice = function () { return __awaiter(_this, void 0, void 0, function () {
            var device, constraints;
            var _this = this;
            return __generator(this, function (_a) {
                if (typeof deviceId !== 'string') {
                    return [2 /*return*/, Promise.reject(new errors_1.InvalidArgumentError('Must specify the device to set'))];
                }
                device = this.availableInputDevices.get(deviceId);
                if (!device) {
                    return [2 /*return*/, Promise.reject(new errors_1.InvalidArgumentError("Device not found: " + deviceId))];
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
            });
        }); };
        return this._inputDevicePromise = setInputDevice().finally(function () {
            _this._inputDevicePromise = null;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9oZWxwZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2F1ZGlvaGVscGVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7OztBQUFBOzs7R0FHRztBQUNILGlDQUFzQztBQUd0QyxtQ0FBOEI7QUFDOUIsbUNBQW1FO0FBQ25FLDZCQUF3QjtBQUN4QixtRUFBOEQ7QUFDOUQsMkRBQTBEO0FBQzFELCtCQUF3RDtBQUV4RDs7O0dBR0c7QUFDSCxJQUFNLFdBQVcsR0FBMkI7SUFDMUMsVUFBVSxFQUFFLGFBQWE7SUFDekIsV0FBVyxFQUFFLGNBQWM7Q0FDNUIsQ0FBQztBQUVGOzs7R0FHRztBQUNIO0lBQTBCLCtCQUFZO0lBb0xwQzs7Ozs7O09BTUc7SUFDSCxxQkFBWSxzQkFBNEYsRUFDNUYsb0JBQW1FLEVBQ25FLE9BQTZCOztRQUZ6QyxZQUdFLGlCQUFPLFNBb0ZSO1FBNVFEOztXQUVHO1FBQ0gsMkJBQXFCLEdBQWlDLElBQUksR0FBRyxFQUFFLENBQUM7UUFFaEU7O1dBRUc7UUFDSCw0QkFBc0IsR0FBaUMsSUFBSSxHQUFHLEVBQUUsQ0FBQztRQStDakU7O1dBRUc7UUFDSyx1QkFBaUIsR0FBaUMsSUFBSSxDQUFDO1FBWS9EOzs7OztXQUtHO1FBQ0ssK0JBQXlCLEdBQXVCLElBQUksQ0FBQztRQUU3RDs7V0FFRztRQUNLLG9CQUFjO1lBQ3BCLEdBQUMsZ0JBQU0sQ0FBQyxTQUFTLENBQUMsVUFBVSxJQUFHLElBQUk7WUFDbkMsR0FBQyxnQkFBTSxDQUFDLFNBQVMsQ0FBQyxRQUFRLElBQUcsSUFBSTtZQUNqQyxHQUFDLGdCQUFNLENBQUMsU0FBUyxDQUFDLFFBQVEsSUFBRyxJQUFJO2dCQUNqQztRQVlGOztXQUVHO1FBQ0ssa0JBQVksR0FBMkIsSUFBSSxDQUFDO1FBRXBEOztXQUVHO1FBQ0sseUJBQW1CLEdBQXlCLElB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