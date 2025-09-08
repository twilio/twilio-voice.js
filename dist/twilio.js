/*! @twilio/voice-sdk.js 2.15.1-rc1

The following license applies to all parts of this software except as
documented below.

    Copyright (C) 2015-2024 Twilio, inc.
 
    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at
 
        http://www.apache.org/licenses/LICENSE-2.0
 
    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.

This software includes rtcpeerconnection-shim under the following (BSD 3-Clause) license.

    Copyright (c) 2017 Philipp Hancke. All rights reserved.

    Copyright (c) 2014, The WebRTC project authors. All rights reserved.

    Redistribution and use in source and binary forms, with or without
    modification, are permitted provided that the following conditions are
    met:

      * Redistributions of source code must retain the above copyright
        notice, this list of conditions and the following disclaimer.

      * Redistributions in binary form must reproduce the above copyright
        notice, this list of conditions and the following disclaimer in
        the documentation and/or other materials provided with the
        distribution.

      * Neither the name of Philipp Hancke nor the names of its contributors may
        be used to endorse or promote products derived from this software
        without specific prior written permission.

    THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
    "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
    LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
    A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
    HOLDER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
    SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
    LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
    DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
    (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
    OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

This software includes backoff under the following (MIT) license.

    Copyright (C) 2012 Mathieu Turcotte

    Permission is hereby granted, free of charge, to any person obtaining a copy of
    this software and associated documentation files (the "Software"), to deal in
    the Software without restriction, including without limitation the rights to
    use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
    of the Software, and to permit persons to whom the Software is furnished to do
    so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.

This software includes loglevel under the following (MIT) license.

    Copyright (c) 2013 Tim Perry

    Permission is hereby granted, free of charge, to any person obtaining a copy of
    this software and associated documentation files (the "Software"), to deal in
    the Software without restriction, including without limitation the rights to
    use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies
    of the Software, and to permit persons to whom the Software is furnished to do
    so, subject to the following conditions:

    The above copyright notice and this permission notice shall be included in all
    copies or substantial portions of the Software.

    THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
    IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
    FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
    AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
    LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
    OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
    SOFTWARE.

 */
(function(root) {
  var bundle = (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict';

var call = require('./twilio/call.js');
var device = require('./twilio/device.js');
var log = require('./twilio/log.js');
var preflight = require('./twilio/preflight/preflight.js');
var index = require('./twilio/errors/index.js');



Object.defineProperty(exports, "Call", {
	enumerable: true,
	get: function () { return call.default; }
});
Object.defineProperty(exports, "Device", {
	enumerable: true,
	get: function () { return device.default; }
});
exports.Logger = log.Logger;
Object.defineProperty(exports, "PreflightTest", {
	enumerable: true,
	get: function () { return preflight.PreflightTest; }
});
exports.TwilioError = index;


},{"./twilio/call.js":9,"./twilio/device.js":12,"./twilio/errors/index.js":15,"./twilio/log.js":18,"./twilio/preflight/preflight.js":20}],2:[function(require,module,exports){
'use strict';

var tslib = require('tslib');
var deferred = require('./deferred.js');

/**
 * Queue async operations and executes them synchronously.
 */
var AsyncQueue = /** @class */ (function () {
    function AsyncQueue() {
        /**
         * The list of async operations in this queue
         */
        this._operations = [];
    }
    /**
     * Adds the async operation to the queue
     * @param callback An async callback that returns a promise
     * @returns A promise that will get resolved or rejected after executing the callback
     */
    AsyncQueue.prototype.enqueue = function (callback) {
        var hasPending = !!this._operations.length;
        var deferred$1 = new deferred.default();
        this._operations.push({ deferred: deferred$1, callback: callback });
        if (!hasPending) {
            this._processQueue();
        }
        return deferred$1.promise;
    };
    /**
     * Start processing the queue. This executes the first item and removes it after.
     * Then do the same for next items until the queue is emptied.
     */
    AsyncQueue.prototype._processQueue = function () {
        return tslib.__awaiter(this, void 0, void 0, function () {
            var _a, deferred, callback, result, error, hasResolved, e_1;
            return tslib.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!this._operations.length) return [3 /*break*/, 5];
                        _a = this._operations[0], deferred = _a.deferred, callback = _a.callback;
                        result = void 0;
                        error = void 0;
                        hasResolved = void 0;
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 3, , 4]);
                        return [4 /*yield*/, callback()];
                    case 2:
                        result = _b.sent();
                        hasResolved = true;
                        return [3 /*break*/, 4];
                    case 3:
                        e_1 = _b.sent();
                        error = e_1;
                        return [3 /*break*/, 4];
                    case 4:
                        // Remove the item
                        this._operations.shift();
                        if (hasResolved) {
                            deferred.resolve(result);
                        }
                        else {
                            deferred.reject(error);
                        }
                        return [3 /*break*/, 0];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    return AsyncQueue;
}());

exports.AsyncQueue = AsyncQueue;


},{"./deferred.js":11,"tslib":41}],3:[function(require,module,exports){
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


},{"./device.js":12,"./errors/index.js":15,"./log.js":18,"./outputdevicecollection.js":19,"./shims/mediadeviceinfo.js":33,"./util.js":37,"events":39,"tslib":41}],4:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var deferred = require('./deferred.js');
var eventtarget = require('./eventtarget.js');

/**
 * An {@link AudioPlayer} is an HTMLAudioElement-like object that uses AudioContext
 *   to circumvent browser limitations.
 * @private
 */
var AudioPlayer = /** @class */ (function (_super) {
    tslib.__extends(AudioPlayer, _super);
    /**
     * @private
     */
    function AudioPlayer(audioContext, srcOrOptions, options) {
        if (srcOrOptions === void 0) { srcOrOptions = {}; }
        if (options === void 0) { options = {}; }
        var _this = _super.call(this) || this;
        /**
         * The AudioBufferSourceNode of the actively loaded sound. Null if a sound
         *   has not been loaded yet. This is re-used for each time the sound is
         *   played.
         */
        _this._audioNode = null;
        /**
         * Whether or not the audio element should loop. If disabled during playback,
         *   playing continues until the sound ends and then stops looping.
         */
        _this._loop = false;
        /**
         * An Array of deferred-like objects for each pending `play` Promise. When
         *   .pause() is called or .src is set, all pending play Promises are
         *   immediately rejected.
         */
        _this._pendingPlayDeferreds = [];
        /**
         * The current sinkId of the device audio is being played through.
         */
        _this._sinkId = 'default';
        /**
         * The source URL of the sound to play. When set, the currently playing sound will stop.
         */
        _this._src = '';
        if (typeof srcOrOptions !== 'string') {
            options = srcOrOptions;
        }
        _this._audioContext = audioContext;
        _this._audioElement = new (options.AudioFactory || Audio)();
        _this._bufferPromise = _this._createPlayDeferred().promise;
        _this._destination = _this._audioContext.destination;
        _this._gainNode = _this._audioContext.createGain();
        _this._gainNode.connect(_this._destination);
        _this._XMLHttpRequest = options.XMLHttpRequestFactory || XMLHttpRequest;
        _this.addEventListener('canplaythrough', function () {
            _this._resolvePlayDeferreds();
        });
        if (typeof srcOrOptions === 'string') {
            _this.src = srcOrOptions;
        }
        return _this;
    }
    Object.defineProperty(AudioPlayer.prototype, "destination", {
        get: function () { return this._destination; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(AudioPlayer.prototype, "loop", {
        get: function () { return this._loop; },
        set: function (shouldLoop) {
            var self = this;
            function pauseAfterPlaythrough() {
                self._audioNode.removeEventListener('ended', pauseAfterPlaythrough);
                self.pause();
            }
            // If a sound is already looping, it should continue playing
            //   the current playthrough and then stop.
            if (!shouldLoop && this.loop && !this.paused) {
                this._audioNode.addEventListener('ended', pauseAfterPlaythrough);
            }
            this._loop = shouldLoop;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(AudioPlayer.prototype, "muted", {
        /**
         * Whether the audio element is muted.
         */
        get: function () { return this._gainNode.gain.value === 0; },
        set: function (shouldBeMuted) {
            this._gainNode.gain.value = shouldBeMuted ? 0 : 1;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(AudioPlayer.prototype, "paused", {
        /**
         * Whether the sound is paused. this._audioNode only exists when sound is playing;
         *   otherwise AudioPlayer is considered paused.
         */
        get: function () { return this._audioNode === null; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(AudioPlayer.prototype, "src", {
        get: function () { return this._src; },
        set: function (src) {
            this._load(src);
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(AudioPlayer.prototype, "srcObject", {
        /**
         * The srcObject of the HTMLMediaElement
         */
        get: function () {
            return this._audioElement.srcObject;
        },
        set: function (srcObject) {
            this._audioElement.srcObject = srcObject;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(AudioPlayer.prototype, "sinkId", {
        get: function () { return this._sinkId; },
        enumerable: false,
        configurable: true
    });
    /**
     * Stop any ongoing playback and reload the source file.
     */
    AudioPlayer.prototype.load = function () {
        this._load(this._src);
    };
    /**
     * Pause the audio coming from this AudioPlayer. This will reject any pending
     *   play Promises.
     */
    AudioPlayer.prototype.pause = function () {
        if (this.paused) {
            return;
        }
        this._audioElement.pause();
        this._audioNode.stop();
        this._audioNode.disconnect(this._gainNode);
        this._audioNode = null;
        this._rejectPlayDeferreds(new Error('The play() request was interrupted by a call to pause().'));
    };
    /**
     * Play the sound. If the buffer hasn't loaded yet, wait for the buffer to load. If
     *   the source URL is not set yet, this Promise will remain pending until a source
     *   URL is set.
     */
    AudioPlayer.prototype.play = function () {
        return tslib.__awaiter(this, void 0, void 0, function () {
            var buffer;
            var _this = this;
            return tslib.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!!this.paused) return [3 /*break*/, 2];
                        return [4 /*yield*/, this._bufferPromise];
                    case 1:
                        _a.sent();
                        if (!this.paused) {
                            return [2 /*return*/];
                        }
                        throw new Error('The play() request was interrupted by a call to pause().');
                    case 2:
                        this._audioNode = this._audioContext.createBufferSource();
                        this._audioNode.loop = this.loop;
                        this._audioNode.addEventListener('ended', function () {
                            if (_this._audioNode && _this._audioNode.loop) {
                                return;
                            }
                            _this.dispatchEvent('ended');
                        });
                        return [4 /*yield*/, this._bufferPromise];
                    case 3:
                        buffer = _a.sent();
                        if (this.paused) {
                            throw new Error('The play() request was interrupted by a call to pause().');
                        }
                        this._audioNode.buffer = buffer;
                        this._audioNode.connect(this._gainNode);
                        this._audioNode.start();
                        if (this._audioElement.srcObject) {
                            return [2 /*return*/, this._audioElement.play()];
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Change which device the sound should play through.
     * @param sinkId - The sink of the device to play sound through.
     */
    AudioPlayer.prototype.setSinkId = function (sinkId) {
        return tslib.__awaiter(this, void 0, void 0, function () {
            return tslib.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (typeof this._audioElement.setSinkId !== 'function') {
                            throw new Error('This browser does not support setSinkId.');
                        }
                        if (sinkId === this.sinkId) {
                            return [2 /*return*/];
                        }
                        if (sinkId === 'default') {
                            if (!this.paused) {
                                this._gainNode.disconnect(this._destination);
                            }
                            this._audioElement.srcObject = null;
                            this._destination = this._audioContext.destination;
                            this._gainNode.connect(this._destination);
                            this._sinkId = sinkId;
                            return [2 /*return*/];
                        }
                        return [4 /*yield*/, this._audioElement.setSinkId(sinkId)];
                    case 1:
                        _a.sent();
                        if (this._audioElement.srcObject) {
                            return [2 /*return*/];
                        }
                        this._gainNode.disconnect(this._audioContext.destination);
                        this._destination = this._audioContext.createMediaStreamDestination();
                        this._audioElement.srcObject = this._destination.stream;
                        this._sinkId = sinkId;
                        this._gainNode.connect(this._destination);
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Create a Deferred for a Promise that will be resolved when .src is set or rejected
     *   when .pause is called.
     */
    AudioPlayer.prototype._createPlayDeferred = function () {
        var deferred$1 = new deferred.default();
        this._pendingPlayDeferreds.push(deferred$1);
        return deferred$1;
    };
    /**
     * Stop current playback and load a sound file.
     * @param src - The source URL of the file to load
     */
    AudioPlayer.prototype._load = function (src) {
        var _this = this;
        if (this._src && this._src !== src) {
            this.pause();
        }
        this._src = src;
        this._bufferPromise = new Promise(function (resolve, reject) { return tslib.__awaiter(_this, void 0, void 0, function () {
            var buffer;
            return tslib.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!src) {
                            return [2 /*return*/, this._createPlayDeferred().promise];
                        }
                        return [4 /*yield*/, bufferSound(this._audioContext, this._XMLHttpRequest, src)];
                    case 1:
                        buffer = _a.sent();
                        this.dispatchEvent('canplaythrough');
                        resolve(buffer);
                        return [2 /*return*/];
                }
            });
        }); });
    };
    /**
     * Reject all deferreds for the Play promise.
     * @param reason
     */
    AudioPlayer.prototype._rejectPlayDeferreds = function (reason) {
        var deferreds = this._pendingPlayDeferreds;
        deferreds.splice(0, deferreds.length).forEach(function (_a) {
            var reject = _a.reject;
            return reject(reason);
        });
    };
    /**
     * Resolve all deferreds for the Play promise.
     * @param result
     */
    AudioPlayer.prototype._resolvePlayDeferreds = function (result) {
        var deferreds = this._pendingPlayDeferreds;
        deferreds.splice(0, deferreds.length).forEach(function (_a) {
            var resolve = _a.resolve;
            return resolve(result);
        });
    };
    return AudioPlayer;
}(eventtarget.default));
/**
 * Use XMLHttpRequest to load the AudioBuffer of a remote audio asset.
 * @private
 * @param context - The AudioContext to use to decode the audio data
 * @param RequestFactory - The XMLHttpRequest factory to build
 * @param src - The URL of the audio asset to load.
 * @returns A Promise containing the decoded AudioBuffer.
 */
// tslint:disable-next-line:variable-name
function bufferSound(context, RequestFactory, src) {
    return tslib.__awaiter(this, void 0, void 0, function () {
        var request, event;
        return tslib.__generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    request = new RequestFactory();
                    request.open('GET', src, true);
                    request.responseType = 'arraybuffer';
                    return [4 /*yield*/, new Promise(function (resolve) {
                            request.addEventListener('load', resolve);
                            request.send();
                        })];
                case 1:
                    event = _a.sent();
                    // Safari uses a callback here instead of a Promise.
                    try {
                        return [2 /*return*/, context.decodeAudioData(event.target.response)];
                    }
                    catch (e) {
                        return [2 /*return*/, new Promise(function (resolve) {
                                context.decodeAudioData(event.target.response, resolve);
                            })];
                    }
                    return [2 /*return*/];
            }
        });
    });
}

exports.default = AudioPlayer;


},{"./deferred.js":5,"./eventtarget.js":6,"tslib":41}],5:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

// @ts-nocheck
var Deferred = /** @class */ (function () {
    function Deferred() {
        var _this = this;
        this.promise = new Promise(function (resolve, reject) {
            _this._resolve = resolve;
            _this._reject = reject;
        });
    }
    Object.defineProperty(Deferred.prototype, "reject", {
        get: function () { return this._reject; },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Deferred.prototype, "resolve", {
        get: function () { return this._resolve; },
        enumerable: false,
        configurable: true
    });
    return Deferred;
}());

exports.default = Deferred;


},{}],6:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var events = require('events');

var EventTarget = /** @class */ (function () {
    function EventTarget() {
        this._eventEmitter = new events.EventEmitter();
    }
    EventTarget.prototype.addEventListener = function (name, handler) {
        return this._eventEmitter.addListener(name, handler);
    };
    EventTarget.prototype.dispatchEvent = function (name) {
        var _a;
        var args = [];
        for (var _i = 1; _i < arguments.length; _i++) {
            args[_i - 1] = arguments[_i];
        }
        return (_a = this._eventEmitter).emit.apply(_a, tslib.__spreadArray([name], args, false));
    };
    EventTarget.prototype.removeEventListener = function (name, handler) {
        return this._eventEmitter.removeListener(name, handler);
    };
    return EventTarget;
}());

exports.default = EventTarget;


},{"events":39,"tslib":41}],7:[function(require,module,exports){
'use strict';

var tslib = require('tslib');
var events = require('events');
var log = require('./log.js');

/**
 * AudioProcessorEventObserver observes {@link AudioProcessor}
 * related operations and re-emits them as generic events.
 * @internal
 */
var AudioProcessorEventObserver = /** @class */ (function (_super) {
    tslib.__extends(AudioProcessorEventObserver, _super);
    function AudioProcessorEventObserver() {
        var _this = _super.call(this) || this;
        _this._log = new log.default('AudioProcessorEventObserver');
        _this._log.info('Creating AudioProcessorEventObserver instance');
        _this.on('enabled', function () { return _this._reEmitEvent('enabled'); });
        _this.on('add', function () { return _this._reEmitEvent('add'); });
        _this.on('remove', function () { return _this._reEmitEvent('remove'); });
        _this.on('create', function () { return _this._reEmitEvent('create-processed-stream'); });
        _this.on('destroy', function () { return _this._reEmitEvent('destroy-processed-stream'); });
        return _this;
    }
    AudioProcessorEventObserver.prototype.destroy = function () {
        this.removeAllListeners();
    };
    AudioProcessorEventObserver.prototype._reEmitEvent = function (name) {
        this._log.info("AudioProcessor:".concat(name));
        this.emit('event', { name: name, group: 'audio-processor' });
    };
    return AudioProcessorEventObserver;
}(events.EventEmitter));

exports.AudioProcessorEventObserver = AudioProcessorEventObserver;


},{"./log.js":18,"events":39,"tslib":41}],8:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var events = require('events');

var Backoff = /** @class */ (function (_super) {
    tslib.__extends(Backoff, _super);
    /**
     * Construct a {@link Backoff}.
     * @param {object} options
     * @property {number} min - Initial timeout in milliseconds [100]
     * @property {number} max - Max timeout [10000]
     * @property {boolean} jitter - Apply jitter [0]
     * @property {number} factor - Multiplication factor for Backoff operation [2]
     */
    function Backoff(options) {
        var _this = _super.call(this) || this;
        Object.defineProperties(_this, {
            _attempts: {
                value: 0,
                writable: true,
            },
            _duration: {
                enumerable: false,
                get: function () {
                    var ms = this._min * Math.pow(this._factor, this._attempts);
                    if (this._jitter) {
                        var rand = Math.random();
                        var deviation = Math.floor(rand * this._jitter * ms);
                        // tslint:disable-next-line
                        ms = (Math.floor(rand * 10) & 1) === 0 ? ms - deviation : ms + deviation;
                    }
                    // tslint:disable-next-line
                    return Math.min(ms, this._max) | 0;
                },
            },
            _factor: { value: options.factor || 2 },
            _jitter: { value: options.jitter > 0 && options.jitter <= 1 ? options.jitter : 0 },
            _max: { value: options.max || 10000 },
            _min: { value: options.min || 100 },
            _timeoutID: {
                value: null,
                writable: true,
            },
        });
        return _this;
    }
    Backoff.prototype.backoff = function () {
        var _this = this;
        var duration = this._duration;
        if (this._timeoutID) {
            clearTimeout(this._timeoutID);
            this._timeoutID = null;
        }
        this.emit('backoff', this._attempts, duration);
        this._timeoutID = setTimeout(function () {
            _this.emit('ready', _this._attempts, duration);
            _this._attempts++;
        }, duration);
    };
    Backoff.prototype.reset = function () {
        this._attempts = 0;
        if (this._timeoutID) {
            clearTimeout(this._timeoutID);
            this._timeoutID = null;
        }
    };
    return Backoff;
}(events.EventEmitter));

exports.default = Backoff;


},{"events":39,"tslib":41}],9:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var events = require('events');
var backoff = require('./backoff.js');
var device = require('./device.js');
var index = require('./errors/index.js');
var log = require('./log.js');
var peerconnection = require('./rtc/peerconnection.js');
require('./rtc/rtcpc.js');
var icecandidate = require('./rtc/icecandidate.js');
var sdp = require('./rtc/sdp.js');
var sid = require('./sid.js');
var statsMonitor = require('./statsMonitor.js');
var util = require('./util.js');
var constants = require('./constants.js');
var generated = require('./errors/generated.js');

var BACKOFF_CONFIG = {
    factor: 1.1,
    jitter: 0.5,
    max: 30000,
    min: 1,
};
var DTMF_INTER_TONE_GAP = 70;
var DTMF_PAUSE_DURATION = 500;
var DTMF_TONE_DURATION = 160;
var METRICS_BATCH_SIZE = 10;
var METRICS_DELAY = 5000;
var MEDIA_DISCONNECT_ERROR = {
    disconnect: true,
    info: {
        code: 31003,
        message: 'Connection with Twilio was interrupted.',
        twilioError: new generated.MediaErrors.ConnectionError(),
    },
};
var MULTIPLE_THRESHOLD_WARNING_NAMES = {
    // The stat `packetsLostFraction` is monitored by two separate thresholds,
    // `maxAverage` and `max`. Each threshold emits a different warning name.
    packetsLostFraction: {
        max: 'packet-loss',
        maxAverage: 'packets-lost-fraction',
    },
};
var WARNING_NAMES = {
    audioInputLevel: 'audio-input-level',
    audioOutputLevel: 'audio-output-level',
    bytesReceived: 'bytes-received',
    bytesSent: 'bytes-sent',
    jitter: 'jitter',
    mos: 'mos',
    rtt: 'rtt',
};
var WARNING_PREFIXES = {
    max: 'high-',
    maxAverage: 'high-',
    maxDuration: 'constant-',
    min: 'low-',
    minStandardDeviation: 'constant-',
};
/**
 * A {@link Call} represents a media and signaling connection to a TwiML application.
 */
exports.default = /** @class */ (function (_super) {
    tslib.__extends(Call, _super);
    /**
     * @internal
     * @param config - Mandatory configuration options
     * @param options - Optional settings
     */
    function Call(config, options) {
        var _this = _super.call(this) || this;
        /**
         * Call parameters received from Twilio for an incoming call.
         */
        _this.parameters = {};
        /**
         * The number of times input volume has been the same consecutively.
         */
        _this._inputVolumeStreak = 0;
        /**
         * Whether the call has been answered.
         */
        _this._isAnswered = false;
        /**
         * Whether the call has been cancelled.
         */
        _this._isCancelled = false;
        /**
         * Whether the call has been rejected
         */
        _this._isRejected = false;
        /**
         * The most recent public input volume value. 0 -> 1 representing -100 to -30 dB.
         */
        _this._latestInputVolume = 0;
        /**
         * The most recent public output volume value. 0 -> 1 representing -100 to -30 dB.
         */
        _this._latestOutputVolume = 0;
        /**
         * An instance of Logger to use.
         */
        _this._log = new log.default('Call');
        /**
         * State of the {@link Call}'s media.
         */
        _this._mediaStatus = Call.State.Pending;
        /**
         * A map of messages sent via sendMessage API using voiceEventSid as the key.
         * The message will be deleted once an 'ack' or an error is received from the server.
         */
        _this._messages = new Map();
        /**
         * A batch of metrics samples to send to Insights. Gets cleared after
         * each send and appended to on each new sample.
         */
        _this._metricsSamples = [];
        /**
         * Options passed to this {@link Call}.
         */
        _this._options = {
            MediaHandler: peerconnection.default,
            MediaStream: null,
            enableImprovedSignalingErrorPrecision: false,
            offerSdp: null,
            shouldPlayDisconnect: function () { return true; },
            voiceEventSidGenerator: sid.generateVoiceEventSid,
        };
        /**
         * The number of times output volume has been the same consecutively.
         */
        _this._outputVolumeStreak = 0;
        /**
         * Whether the {@link Call} should send a hangup on disconnect.
         */
        _this._shouldSendHangup = true;
        /**
         * State of the {@link Call}'s signaling.
         */
        _this._signalingStatus = Call.State.Pending;
        /**
         * A Map of Sounds to play.
         */
        _this._soundcache = new Map();
        /**
         * State of the {@link Call}.
         */
        _this._status = Call.State.Pending;
        /**
         * Whether the {@link Call} has been connected. Used to determine if we are reconnected.
         */
        _this._wasConnected = false;
        /**
         * String representation of {@link Call} instance.
         * @internal
         */
        _this.toString = function () { return '[Twilio.Call instance]'; };
        _this._emitWarning = function (groupPrefix, warningName, threshold, value, wasCleared, warningData) {
            var groupSuffix = wasCleared ? '-cleared' : '-raised';
            var groupName = "".concat(groupPrefix, "warning").concat(groupSuffix);
            // Ignore constant input if the Call is muted (Expected)
            if (warningName === 'constant-audio-input-level' && _this.isMuted()) {
                return;
            }
            var level = wasCleared ? 'info' : 'warning';
            // Avoid throwing false positives as warnings until we refactor volume metrics
            if (warningName === 'constant-audio-output-level') {
                level = 'info';
            }
            var payloadData = { threshold: threshold };
            if (value) {
                if (value instanceof Array) {
                    payloadData.values = value.map(function (val) {
                        if (typeof val === 'number') {
                            return Math.round(val * 100) / 100;
                        }
                        return value;
                    });
                }
                else {
                    payloadData.value = value;
                }
            }
            _this._publisher.post(level, groupName, warningName, { data: payloadData }, _this);
            if (warningName !== 'constant-audio-output-level') {
                var emitName = wasCleared ? 'warning-cleared' : 'warning';
                _this._log.debug("#".concat(emitName), warningName);
                _this.emit(emitName, warningName, warningData && !wasCleared ? warningData : null);
            }
        };
        /**
         * Called when the {@link Call} receives an ack from signaling
         * @param payload
         */
        _this._onAck = function (payload) {
            var acktype = payload.acktype, callsid = payload.callsid, voiceeventsid = payload.voiceeventsid;
            if (_this.parameters.CallSid !== callsid) {
                _this._log.warn("Received ack from a different callsid: ".concat(callsid));
                return;
            }
            if (acktype === 'message') {
                _this._onMessageSent(voiceeventsid);
            }
        };
        /**
         * Called when the {@link Call} is answered.
         * @param payload
         */
        _this._onAnswer = function (payload) {
            if (typeof payload.reconnect === 'string') {
                _this._signalingReconnectToken = payload.reconnect;
            }
            // answerOnBridge=false will send a 183 which we need to catch in _onRinging when
            // the enableRingingState flag is disabled. In that case, we will receive a 200 after
            // the callee accepts the call firing a second `accept` event if we don't
            // short circuit here.
            if (_this._isAnswered && _this._status !== Call.State.Reconnecting) {
                return;
            }
            _this._setCallSid(payload);
            _this._isAnswered = true;
            _this._maybeTransitionToOpen();
        };
        /**
         * Called when the {@link Call} is cancelled.
         * @param payload
         */
        _this._onCancel = function (payload) {
            // (rrowland) Is this check necessary? Verify, and if so move to pstream / VSP module.
            var callsid = payload.callsid;
            if (_this.parameters.CallSid === callsid) {
                _this._isCancelled = true;
                _this._publisher.info('connection', 'cancel', null, _this);
                _this._cleanupEventListeners();
                _this._mediaHandler.close();
                _this._status = Call.State.Closed;
                _this._log.debug('#cancel');
                _this.emit('cancel');
                _this._pstream.removeListener('cancel', _this._onCancel);
            }
        };
        /**
         * Called when we receive a connected event from pstream.
         * Re-emits the event.
         */
        _this._onConnected = function () {
            _this._log.info('Received connected from pstream');
            if (_this._signalingReconnectToken && _this._mediaHandler.version) {
                _this._pstream.reconnect(_this._mediaHandler.version.getSDP(), _this.parameters.CallSid, _this._signalingReconnectToken);
            }
        };
        /**
         * Called when the {@link Call} is hung up.
         * @param payload
         */
        _this._onHangup = function (payload) {
            if (_this.status() === Call.State.Closed) {
                return;
            }
            /**
             *  see if callsid passed in message matches either callsid or outbound id
             *  call should always have either callsid or outbound id
             *  if no callsid passed hangup anyways
             */
            if (payload.callsid && (_this.parameters.CallSid || _this.outboundConnectionId)) {
                if (payload.callsid !== _this.parameters.CallSid
                    && payload.callsid !== _this.outboundConnectionId) {
                    return;
                }
            }
            else if (payload.callsid) {
                // hangup is for another call
                return;
            }
            _this._log.info('Received HANGUP from gateway');
            if (payload.error) {
                var code = payload.error.code;
                var errorConstructor = index.getPreciseSignalingErrorByCode(_this._options.enableImprovedSignalingErrorPrecision, code);
                var error = typeof errorConstructor !== 'undefined'
                    ? new errorConstructor(payload.error.message)
                    : new generated.GeneralErrors.ConnectionError('Error sent from gateway in HANGUP', payload.error);
                _this._log.error('Received an error from the gateway:', error);
                _this._log.debug('#error', error);
                _this.emit('error', error);
            }
            _this._shouldSendHangup = false;
            _this._publisher.info('connection', 'disconnected-by-remote', null, _this);
            _this._disconnect(null, true);
            _this._cleanupEventListeners();
        };
        /**
         * Called when there is a media failure.
         * Manages all media-related states and takes action base on the states
         * @param type - Type of media failure
         */
        _this._onMediaFailure = function (type) {
            var _a = Call.MediaFailure, ConnectionDisconnected = _a.ConnectionDisconnected, ConnectionFailed = _a.ConnectionFailed, IceGatheringFailed = _a.IceGatheringFailed, LowBytes = _a.LowBytes;
            // These types signifies the end of a single ICE cycle
            var isEndOfIceCycle = type === ConnectionFailed || type === IceGatheringFailed;
            // All browsers except chrome doesn't update pc.iceConnectionState and pc.connectionState
            // after issuing an ICE Restart, which we use to determine if ICE Restart is complete.
            // Since we cannot detect if ICE Restart is complete, we will not retry.
            if (!util.isChrome(window, window.navigator) && type === ConnectionFailed) {
                return _this._mediaHandler.onerror(MEDIA_DISCONNECT_ERROR);
            }
            // Ignore subsequent requests if ice restart is in progress
            if (_this._mediaStatus === Call.State.Reconnecting) {
                // This is a retry. Previous ICE Restart failed
                if (isEndOfIceCycle) {
                    // We already exceeded max retry time.
                    if (Date.now() - _this._mediaReconnectStartTime > BACKOFF_CONFIG.max) {
                        _this._log.warn('Exceeded max ICE retries');
                        return _this._mediaHandler.onerror(MEDIA_DISCONNECT_ERROR);
                    }
                    // Issue ICE restart with backoff
                    try {
                        _this._mediaReconnectBackoff.backoff();
                    }
                    catch (error) {
                        // Catch and ignore 'Backoff in progress.' errors. If a backoff is
                        // ongoing and we try to start another one, there shouldn't be a
                        // problem.
                        if (!(error.message && error.message === 'Backoff in progress.')) {
                            throw error;
                        }
                    }
                }
                return;
            }
            var pc = _this._mediaHandler.version.pc;
            var isIceDisconnected = pc && pc.iceConnectionState === 'disconnected';
            var hasLowBytesWarning = _this._monitor.hasActiveWarning('bytesSent', 'min')
                || _this._monitor.hasActiveWarning('bytesReceived', 'min');
            // Only certain conditions can trigger media reconnection
            if ((type === LowBytes && isIceDisconnected)
                || (type === ConnectionDisconnected && hasLowBytesWarning)
                || isEndOfIceCycle) {
                var mediaReconnectionError = new generated.MediaErrors.ConnectionError('Media connection failed.');
                _this._log.warn('ICE Connection disconnected.');
                _this._publisher.warn('connection', 'error', mediaReconnectionError, _this);
                _this._publisher.info('connection', 'reconnecting', null, _this);
                _this._mediaReconnectStartTime = Date.now();
                _this._status = Call.State.Reconnecting;
                _this._mediaStatus = Call.State.Reconnecting;
                _this._mediaReconnectBackoff.reset();
                _this._mediaReconnectBackoff.backoff();
                _this._log.debug('#reconnecting');
                _this.emit('reconnecting', mediaReconnectionError);
            }
        };
        /**
         * Called when media call is restored
         */
        _this._onMediaReconnected = function () {
            // Only trigger once.
            // This can trigger on pc.onIceConnectionChange and pc.onConnectionChange.
            if (_this._mediaStatus !== Call.State.Reconnecting) {
                return;
            }
            _this._log.info('ICE Connection reestablished.');
            _this._mediaStatus = Call.State.Open;
            if (_this._signalingStatus === Call.State.Open) {
                _this._publisher.info('connection', 'reconnected', null, _this);
                _this._log.debug('#reconnected');
                _this.emit('reconnected');
                _this._status = Call.State.Open;
            }
        };
        /**
         * Raised when a Call receives a message from the backend.
         * @param payload - A record representing the payload of the message from the
         * Twilio backend.
         */
        _this._onMessageReceived = function (payload) {
            var callsid = payload.callsid, content = payload.content, contenttype = payload.contenttype, messagetype = payload.messagetype, voiceeventsid = payload.voiceeventsid;
            if (_this.parameters.CallSid !== callsid) {
                _this._log.warn("Received a message from a different callsid: ".concat(callsid));
                return;
            }
            var data = {
                content: content,
                contentType: contenttype,
                messageType: messagetype,
                voiceEventSid: voiceeventsid,
            };
            _this._publisher.info('call-message', messagetype, {
                content_type: contenttype,
                event_type: 'received',
                voice_event_sid: voiceeventsid,
            }, _this);
            _this._log.debug('#messageReceived', JSON.stringify(data));
            _this.emit('messageReceived', data);
        };
        /**
         * Raised when a Call receives an 'ack' with an 'acktype' of 'message.
         * This means that the message sent via sendMessage API has been received by the signaling server.
         * @param voiceEventSid
         */
        _this._onMessageSent = function (voiceEventSid) {
            if (!_this._messages.has(voiceEventSid)) {
                _this._log.warn("Received a messageSent with a voiceEventSid that doesn't exists: ".concat(voiceEventSid));
                return;
            }
            var message = _this._messages.get(voiceEventSid);
            _this._messages.delete(voiceEventSid);
            _this._publisher.info('call-message', message === null || message === void 0 ? void 0 : message.messageType, {
                content_type: message === null || message === void 0 ? void 0 : message.contentType,
                event_type: 'sent',
                voice_event_sid: voiceEventSid,
            }, _this);
            _this._log.debug('#messageSent', JSON.stringify(message));
            _this.emit('messageSent', message);
        };
        /**
         * When we get a RINGING signal from PStream, update the {@link Call} status.
         * @param payload
         */
        _this._onRinging = function (payload) {
            _this._setCallSid(payload);
            // If we're not in 'connecting' or 'ringing' state, this event was received out of order.
            if (_this._status !== Call.State.Connecting && _this._status !== Call.State.Ringing) {
                return;
            }
            var hasEarlyMedia = !!payload.sdp;
            _this._status = Call.State.Ringing;
            _this._publisher.info('connection', 'outgoing-ringing', { hasEarlyMedia: hasEarlyMedia }, _this);
            _this._log.debug('#ringing');
            _this.emit('ringing', hasEarlyMedia);
        };
        /**
         * Called each time StatsMonitor emits a sample.
         * Emits stats event and batches the call stats metrics and sends them to Insights.
         * @param sample
         */
        _this._onRTCSample = function (sample) {
            var callMetrics = tslib.__assign(tslib.__assign({}, sample), { inputVolume: _this._latestInputVolume, outputVolume: _this._latestOutputVolume });
            _this._codec = callMetrics.codecName;
            _this._metricsSamples.push(callMetrics);
            if (_this._metricsSamples.length >= METRICS_BATCH_SIZE) {
                _this._publishMetrics();
            }
            _this.emit('sample', sample);
        };
        /**
         * Called when an 'error' event is received from the signaling stream.
         */
        _this._onSignalingError = function (payload) {
            var callsid = payload.callsid, voiceeventsid = payload.voiceeventsid, error = payload.error;
            if (_this.parameters.CallSid !== callsid) {
                _this._log.warn("Received an error from a different callsid: ".concat(callsid));
                return;
            }
            if (voiceeventsid && _this._messages.has(voiceeventsid)) {
                // Do not emit an error here. Device is handling all signaling related errors.
                _this._messages.delete(voiceeventsid);
                _this._log.warn("Received an error while sending a message.", payload);
                _this._publisher.error('call-message', 'error', {
                    code: error.code,
                    message: error.message,
                    voice_event_sid: voiceeventsid,
                }, _this);
                var twilioError = void 0;
                var errorConstructor = index.getPreciseSignalingErrorByCode(!!_this._options.enableImprovedSignalingErrorPrecision, error.code);
                if (typeof errorConstructor !== 'undefined') {
                    twilioError = new errorConstructor(error);
                }
                if (!twilioError) {
                    _this._log.error('Unknown Call Message Error: ', error);
                    twilioError = new generated.GeneralErrors.UnknownError(error.message, error);
                }
                _this._log.debug('#error', error, twilioError);
                _this.emit('error', twilioError);
            }
        };
        /**
         * Called when signaling is restored
         */
        _this._onSignalingReconnected = function () {
            if (_this._signalingStatus !== Call.State.Reconnecting) {
                return;
            }
            _this._log.info('Signaling Connection reestablished.');
            _this._signalingStatus = Call.State.Open;
            if (_this._mediaStatus === Call.State.Open) {
                _this._publisher.info('connection', 'reconnected', null, _this);
                _this._log.debug('#reconnected');
                _this.emit('reconnected');
                _this._status = Call.State.Open;
            }
        };
        /**
         * Called when we receive a transportClose event from pstream.
         * Re-emits the event.
         */
        _this._onTransportClose = function () {
            _this._log.error('Received transportClose from pstream');
            _this._log.debug('#transportClose');
            _this.emit('transportClose');
            if (_this._signalingReconnectToken) {
                _this._status = Call.State.Reconnecting;
                _this._signalingStatus = Call.State.Reconnecting;
                _this._publisher.info('connection', 'reconnecting', null, _this);
                _this._log.debug('#reconnecting');
                _this.emit('reconnecting', new generated.SignalingErrors.ConnectionDisconnected());
            }
            else {
                _this._status = Call.State.Closed;
                _this._signalingStatus = Call.State.Closed;
            }
        };
        /**
         * Re-emit an StatsMonitor warning as a {@link Call}.warning or .warning-cleared event.
         * @param warningData
         * @param wasCleared - Whether this is a -cleared or -raised event.
         */
        _this._reemitWarning = function (warningData, wasCleared) {
            var groupPrefix = /^audio/.test(warningData.name) ?
                'audio-level-' : 'network-quality-';
            var warningPrefix = WARNING_PREFIXES[warningData.threshold.name];
            /**
             * NOTE: There are two "packet-loss" warnings: `high-packet-loss` and
             * `high-packets-lost-fraction`, so in this case we need to use a different
             * `WARNING_NAME` mapping.
             */
            var warningName;
            if (warningData.name in MULTIPLE_THRESHOLD_WARNING_NAMES) {
                warningName = MULTIPLE_THRESHOLD_WARNING_NAMES[warningData.name][warningData.threshold.name];
            }
            else if (warningData.name in WARNING_NAMES) {
                warningName = WARNING_NAMES[warningData.name];
            }
            var warning = warningPrefix + warningName;
            _this._emitWarning(groupPrefix, warning, warningData.threshold.value, warningData.values || warningData.value, wasCleared, warningData);
        };
        /**
         * Re-emit an StatsMonitor warning-cleared as a .warning-cleared event.
         * @param warningData
         */
        _this._reemitWarningCleared = function (warningData) {
            _this._reemitWarning(warningData, true);
        };
        _this._soundcache = config.soundcache;
        if (typeof config.onIgnore === 'function') {
            _this._onIgnore = config.onIgnore;
        }
        var message = options && options.twimlParams || {};
        _this.customParameters = new Map(Object.entries(message).map(function (_a) {
            var key = _a[0], val = _a[1];
            return [key, String(val)];
        }));
        Object.assign(_this._options, options);
        if (_this._options.callParameters) {
            _this.parameters = _this._options.callParameters;
        }
        if (_this._options.reconnectToken) {
            _this._signalingReconnectToken = _this._options.reconnectToken;
        }
        _this._voiceEventSidGenerator =
            _this._options.voiceEventSidGenerator || sid.generateVoiceEventSid;
        _this._direction = _this.parameters.CallSid && !_this._options.reconnectCallSid ?
            Call.CallDirection.Incoming : Call.CallDirection.Outgoing;
        if (_this.parameters) {
            _this.callerInfo = _this.parameters.StirStatus
                ? { isVerified: _this.parameters.StirStatus === 'TN-Validation-Passed-A' }
                : null;
        }
        else {
            _this.callerInfo = null;
        }
        _this._mediaReconnectBackoff = new backoff.default(BACKOFF_CONFIG);
        _this._mediaReconnectBackoff.on('ready', function () { return _this._mediaHandler.iceRestart(); });
        // temporary call sid to be used for outgoing calls
        _this.outboundConnectionId = generateTempCallSid();
        var publisher = _this._publisher = config.publisher;
        if (_this._direction === Call.CallDirection.Incoming) {
            publisher.info('connection', 'incoming', null, _this);
        }
        else {
            publisher.info('connection', 'outgoing', {
                preflight: _this._options.preflight,
                reconnect: !!_this._options.reconnectCallSid,
            }, _this);
        }
        var monitor = _this._monitor = new (_this._options.StatsMonitor || statsMonitor.default)();
        monitor.on('sample', _this._onRTCSample);
        // First 20 seconds or so are choppy, so let's not bother with these warnings.
        monitor.disableWarnings();
        setTimeout(function () { return monitor.enableWarnings(); }, METRICS_DELAY);
        monitor.on('warning', function (data, wasCleared) {
            if (data.name === 'bytesSent' || data.name === 'bytesReceived') {
                _this._onMediaFailure(Call.MediaFailure.LowBytes);
            }
            _this._reemitWarning(data, wasCleared);
        });
        monitor.on('warning-cleared', function (data) {
            _this._reemitWarningCleared(data);
        });
        _this._mediaHandler = new (_this._options.MediaHandler)(config.audioHelper, config.pstream, {
            MediaStream: _this._options.MediaStream,
            RTCPeerConnection: _this._options.RTCPeerConnection,
            codecPreferences: _this._options.codecPreferences,
            dscp: _this._options.dscp,
            forceAggressiveIceNomination: _this._options.forceAggressiveIceNomination,
            maxAverageBitrate: _this._options.maxAverageBitrate,
        });
        _this.on('volume', function (inputVolume, outputVolume) {
            _this._inputVolumeStreak = _this._checkVolume(inputVolume, _this._inputVolumeStreak, _this._latestInputVolume, 'input');
            _this._outputVolumeStreak = _this._checkVolume(outputVolume, _this._outputVolumeStreak, _this._latestOutputVolume, 'output');
            _this._latestInputVolume = inputVolume;
            _this._latestOutputVolume = outputVolume;
        });
        _this._mediaHandler.onaudio = function (remoteAudio) {
            _this._log.debug('#audio');
            _this.emit('audio', remoteAudio);
        };
        _this._mediaHandler.onvolume = function (inputVolume, outputVolume, internalInputVolume, internalOutputVolume) {
            // (rrowland) These values mock the 0 -> 32767 format used by legacy getStats. We should look into
            // migrating to a newer standard, either 0.0 -> linear or -127 to 0 in dB, matching the range
            // chosen below.
            monitor.addVolumes((internalInputVolume / 255) * 32767, (internalOutputVolume / 255) * 32767);
            // (rrowland) 0.0 -> 1.0 linear
            _this.emit('volume', inputVolume, outputVolume);
        };
        _this._mediaHandler.ondtlstransportstatechange = function (state) {
            var level = state === 'failed' ? 'error' : 'debug';
            _this._publisher.post(level, 'dtls-transport-state', state, null, _this);
        };
        _this._mediaHandler.onpcconnectionstatechange = function (state) {
            var level = 'debug';
            var dtlsTransport = _this._mediaHandler.getRTCDtlsTransport();
            if (state === 'failed') {
                level = dtlsTransport && dtlsTransport.state === 'failed' ? 'error' : 'warning';
            }
            _this._publisher.post(level, 'pc-connection-state', state, null, _this);
        };
        _this._mediaHandler.onicecandidate = function (candidate) {
            var payload = new icecandidate.IceCandidate(candidate).toPayload();
            _this._publisher.debug('ice-candidate', 'ice-candidate', payload, _this);
        };
        _this._mediaHandler.onselectedcandidatepairchange = function (pair) {
            var localCandidatePayload = new icecandidate.IceCandidate(pair.local).toPayload();
            var remoteCandidatePayload = new icecandidate.IceCandidate(pair.remote, true).toPayload();
            _this._publisher.debug('ice-candidate', 'selected-ice-candidate-pair', {
                local_candidate: localCandidatePayload,
                remote_candidate: remoteCandidatePayload,
            }, _this);
        };
        _this._mediaHandler.oniceconnectionstatechange = function (state) {
            var level = state === 'failed' ? 'error' : 'debug';
            _this._publisher.post(level, 'ice-connection-state', state, null, _this);
        };
        _this._mediaHandler.onicegatheringfailure = function (type) {
            _this._publisher.warn('ice-gathering-state', type, null, _this);
            _this._onMediaFailure(Call.MediaFailure.IceGatheringFailed);
        };
        _this._mediaHandler.onicegatheringstatechange = function (state) {
            _this._publisher.debug('ice-gathering-state', state, null, _this);
        };
        _this._mediaHandler.onsignalingstatechange = function (state) {
            _this._publisher.debug('signaling-state', state, null, _this);
        };
        _this._mediaHandler.ondisconnected = function (msg) {
            _this._log.warn(msg);
            _this._publisher.warn('network-quality-warning-raised', 'ice-connectivity-lost', {
                message: msg,
            }, _this);
            _this._log.debug('#warning', 'ice-connectivity-lost');
            _this.emit('warning', 'ice-connectivity-lost');
            _this._onMediaFailure(Call.MediaFailure.ConnectionDisconnected);
        };
        _this._mediaHandler.onfailed = function (msg) {
            _this._onMediaFailure(Call.MediaFailure.ConnectionFailed);
        };
        _this._mediaHandler.onconnected = function () {
            // First time _mediaHandler is connected, but ICE Gathering issued an ICE restart and succeeded.
            if (_this._status === Call.State.Reconnecting) {
                _this._onMediaReconnected();
            }
        };
        _this._mediaHandler.onreconnected = function (msg) {
            _this._log.info(msg);
            _this._publisher.info('network-quality-warning-cleared', 'ice-connectivity-lost', {
                message: msg,
            }, _this);
            _this._log.debug('#warning-cleared', 'ice-connectivity-lost');
            _this.emit('warning-cleared', 'ice-connectivity-lost');
            _this._onMediaReconnected();
        };
        _this._mediaHandler.onerror = function (e) {
            if (e.disconnect === true) {
                _this._disconnect(e.info && e.info.message);
            }
            var error = e.info.twilioError || new generated.GeneralErrors.UnknownError(e.info.message);
            _this._log.error('Received an error from MediaStream:', e);
            _this._log.debug('#error', error);
            _this.emit('error', error);
        };
        _this._mediaHandler.onopen = function () {
            // NOTE(mroberts): While this may have been happening in previous
            // versions of Chrome, since Chrome 45 we have seen the
            // PeerConnection's onsignalingstatechange handler invoked multiple
            // times in the same signalingState 'stable'. When this happens, we
            // invoke this onopen function. If we invoke it twice without checking
            // for _status 'open', we'd accidentally close the PeerConnection.
            //
            // See <https://code.google.com/p/webrtc/issues/detail?id=4996>.
            if (_this._status === Call.State.Open || _this._status === Call.State.Reconnecting) {
                return;
            }
            else if (_this._status === Call.State.Ringing || _this._status === Call.State.Connecting) {
                _this.mute(_this._mediaHandler.isMuted);
                _this._mediaStatus = Call.State.Open;
                _this._maybeTransitionToOpen();
            }
            else {
                // call was probably canceled sometime before this
                _this._mediaHandler.close();
            }
        };
        _this._mediaHandler.onclose = function () {
            _this._status = Call.State.Closed;
            if (_this._options.shouldPlayDisconnect && _this._options.shouldPlayDisconnect()
                // Don't play disconnect sound if this was from a cancel event. i.e. the call
                // was ignored or hung up even before it was answered.
                // Similarly, don't play disconnect sound if the call was rejected.
                && !_this._isCancelled && !_this._isRejected) {
                _this._soundcache.get(device.default.SoundName.Disconnect).play();
            }
            monitor.disable();
            _this._publishMetrics();
            if (!_this._isCancelled && !_this._isRejected) {
                // tslint:disable no-console
                _this._log.debug('#disconnect');
                _this.emit('disconnect', _this);
            }
        };
        _this._pstream = config.pstream;
        _this._pstream.on('ack', _this._onAck);
        _this._pstream.on('cancel', _this._onCancel);
        _this._pstream.on('error', _this._onSignalingError);
        _this._pstream.on('ringing', _this._onRinging);
        _this._pstream.on('transportClose', _this._onTransportClose);
        _this._pstream.on('connected', _this._onConnected);
        _this._pstream.on('message', _this._onMessageReceived);
        _this.on('error', function (error) {
            _this._publisher.error('connection', 'error', {
                code: error.code, message: error.message,
            }, _this);
            if (_this._pstream && _this._pstream.status === 'disconnected') {
                _this._cleanupEventListeners();
            }
        });
        _this.on('disconnect', function () {
            _this._cleanupEventListeners();
        });
        return _this;
    }
    Object.defineProperty(Call.prototype, "direction", {
        /**
         * Whether this {@link Call} is incoming or outgoing.
         */
        get: function () {
            return this._direction;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Call.prototype, "codec", {
        /**
         * Audio codec used for this {@link Call}. Expecting {@link Call.Codec} but
         * will copy whatever we get from RTC stats.
         */
        get: function () {
            return this._codec;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Call.prototype, "connectToken", {
        /**
         * The connect token is available as soon as the call is established
         * and connected to Twilio. Use this token to reconnect to a call via the {@link Device.connect}
         * method.
         *
         * For incoming calls, it is available in the call object after the {@link Device.incomingEvent} is emitted.
         * For outgoing calls, it is available after the {@link Call.acceptEvent} is emitted.
         */
        get: function () {
            var _this = this;
            var signalingReconnectToken = this._signalingReconnectToken;
            var callSid = this.parameters && this.parameters.CallSid ? this.parameters.CallSid : undefined;
            if (!signalingReconnectToken || !callSid) {
                return;
            }
            var customParameters = this.customParameters && typeof this.customParameters.keys === 'function' ?
                Array.from(this.customParameters.keys()).reduce(function (result, key) {
                    result[key] = _this.customParameters.get(key);
                    return result;
                }, {}) : {};
            var parameters = this.parameters || {};
            return btoa(encodeURIComponent(JSON.stringify({
                customParameters: customParameters,
                parameters: parameters,
                signalingReconnectToken: signalingReconnectToken,
            })));
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Set the audio input tracks from a given stream.
     * @internal
     * @param stream
     */
    Call.prototype._setInputTracksFromStream = function (stream) {
        return this._mediaHandler.setInputTracksFromStream(stream);
    };
    /**
     * Set the audio output sink IDs.
     * @internal
     * @param sinkIds
     */
    Call.prototype._setSinkIds = function (sinkIds) {
        return this._mediaHandler._setSinkIds(sinkIds);
    };
    /**
     * Accept the incoming {@link Call}.
     * @param [options]
     */
    Call.prototype.accept = function (options) {
        var _this = this;
        this._log.debug('.accept', options);
        if (this._status !== Call.State.Pending) {
            this._log.debug(".accept noop. status is '".concat(this._status, "'"));
            return;
        }
        options = options || {};
        var rtcConfiguration = options.rtcConfiguration || this._options.rtcConfiguration;
        var rtcConstraints = options.rtcConstraints || this._options.rtcConstraints || {};
        var audioConstraints = {
            audio: typeof rtcConstraints.audio !== 'undefined' ? rtcConstraints.audio : true,
        };
        this._status = Call.State.Connecting;
        var connect = function () {
            if (_this._status !== Call.State.Connecting) {
                // call must have been canceled
                _this._cleanupEventListeners();
                _this._mediaHandler.close();
                return;
            }
            var onAnswer = function (pc) {
                // Report that the call was answered, and directionality
                var eventName = _this._direction === Call.CallDirection.Incoming
                    ? 'accepted-by-local'
                    : 'accepted-by-remote';
                _this._publisher.info('connection', eventName, null, _this);
                // Report the preferred codec and params as they appear in the SDP
                var _a = sdp.getPreferredCodecInfo(_this._mediaHandler.version.getSDP()), codecName = _a.codecName, codecParams = _a.codecParams;
                _this._publisher.info('settings', 'codec', {
                    codec_params: codecParams,
                    selected_codec: codecName,
                }, _this);
                // Enable RTC monitoring
                _this._monitor.enable(pc);
            };
            var sinkIds = typeof _this._options.getSinkIds === 'function' && _this._options.getSinkIds();
            if (Array.isArray(sinkIds)) {
                _this._mediaHandler._setSinkIds(sinkIds).catch(function () {
                    // (rrowland) We don't want this to throw to console since the customer
                    // can't control this. This will most commonly be rejected on browsers
                    // that don't support setting sink IDs.
                });
            }
            _this._pstream.addListener('hangup', _this._onHangup);
            if (_this._direction === Call.CallDirection.Incoming) {
                _this._isAnswered = true;
                _this._pstream.on('answer', _this._onAnswer);
                _this._mediaHandler.answerIncomingCall(_this.parameters.CallSid, _this._options.offerSdp, rtcConfiguration, onAnswer);
            }
            else {
                var params = Array.from(_this.customParameters.entries()).map(function (pair) {
                    return "".concat(encodeURIComponent(pair[0]), "=").concat(encodeURIComponent(pair[1]));
                }).join('&');
                _this._pstream.on('answer', _this._onAnswer);
                _this._mediaHandler.makeOutgoingCall(params, _this._signalingReconnectToken, _this._options.reconnectCallSid || _this.outboundConnectionId, rtcConfiguration, onAnswer);
            }
        };
        if (this._options.beforeAccept) {
            this._options.beforeAccept(this);
        }
        var inputStream = typeof this._options.getInputStream === 'function' && this._options.getInputStream();
        var promise = inputStream
            ? this._mediaHandler.setInputTracksFromStream(inputStream)
            : this._mediaHandler.openDefaultDeviceWithConstraints(audioConstraints);
        promise.then(function () {
            _this._publisher.info('get-user-media', 'succeeded', {
                data: { audioConstraints: audioConstraints },
            }, _this);
            connect();
        }, function (error) {
            var twilioError;
            if (error.code === 31208
                || ['PermissionDeniedError', 'NotAllowedError'].indexOf(error.name) !== -1) {
                twilioError = new generated.UserMediaErrors.PermissionDeniedError();
                _this._publisher.error('get-user-media', 'denied', {
                    data: {
                        audioConstraints: audioConstraints,
                        error: error,
                    },
                }, _this);
            }
            else {
                twilioError = new generated.UserMediaErrors.AcquisitionFailedError();
                _this._publisher.error('get-user-media', 'failed', {
                    data: {
                        audioConstraints: audioConstraints,
                        error: error,
                    },
                }, _this);
            }
            _this._disconnect();
            _this._log.debug('#error', error);
            _this.emit('error', twilioError);
        });
    };
    /**
     * Disconnect from the {@link Call}.
     */
    Call.prototype.disconnect = function () {
        this._log.debug('.disconnect');
        this._disconnect();
    };
    /**
     * Get the local MediaStream, if set.
     */
    Call.prototype.getLocalStream = function () {
        return this._mediaHandler && this._mediaHandler.stream;
    };
    /**
     * Get the remote MediaStream, if set.
     */
    Call.prototype.getRemoteStream = function () {
        return this._mediaHandler && this._mediaHandler._remoteStream;
    };
    /**
     * Ignore the incoming {@link Call}.
     */
    Call.prototype.ignore = function () {
        this._log.debug('.ignore');
        if (this._status !== Call.State.Pending) {
            this._log.debug(".ignore noop. status is '".concat(this._status, "'"));
            return;
        }
        this._status = Call.State.Closed;
        this._mediaHandler.ignore(this.parameters.CallSid);
        this._publisher.info('connection', 'ignored-by-local', null, this);
        if (this._onIgnore) {
            this._onIgnore();
        }
    };
    /**
     * Check whether call is muted
     */
    Call.prototype.isMuted = function () {
        return this._mediaHandler.isMuted;
    };
    /**
     * Mute incoming audio.
     * @param shouldMute - Whether the incoming audio should be muted. Defaults to true.
     */
    Call.prototype.mute = function (shouldMute) {
        if (shouldMute === void 0) { shouldMute = true; }
        this._log.debug('.mute', shouldMute);
        var wasMuted = this._mediaHandler.isMuted;
        this._mediaHandler.mute(shouldMute);
        var isMuted = this._mediaHandler.isMuted;
        if (wasMuted !== isMuted) {
            this._publisher.info('connection', isMuted ? 'muted' : 'unmuted', null, this);
            this._log.debug('#mute', isMuted);
            this.emit('mute', isMuted, this);
        }
    };
    /**
     * Post an event to Endpoint Analytics indicating that the end user
     *   has given call quality feedback. Called without a score, this
     *   will report that the customer declined to give feedback.
     * @param score - The end-user's rating of the call; an
     *   integer 1 through 5. Or undefined if the user declined to give
     *   feedback.
     * @param issue - The primary issue the end user
     *   experienced on the call. Can be: ['one-way-audio', 'choppy-audio',
     *   'dropped-call', 'audio-latency', 'noisy-call', 'echo']
     */
    Call.prototype.postFeedback = function (score, issue) {
        if (typeof score === 'undefined' || score === null) {
            return this._postFeedbackDeclined();
        }
        if (!Object.values(Call.FeedbackScore).includes(score)) {
            throw new index.InvalidArgumentError("Feedback score must be one of: ".concat(Object.values(Call.FeedbackScore)));
        }
        if (typeof issue !== 'undefined' && issue !== null && !Object.values(Call.FeedbackIssue).includes(issue)) {
            throw new index.InvalidArgumentError("Feedback issue must be one of: ".concat(Object.values(Call.FeedbackIssue)));
        }
        return this._publisher.info('feedback', 'received', {
            issue_name: issue,
            quality_score: score,
        }, this, true);
    };
    /**
     * Reject the incoming {@link Call}.
     */
    Call.prototype.reject = function () {
        this._log.debug('.reject');
        if (this._status !== Call.State.Pending) {
            this._log.debug(".reject noop. status is '".concat(this._status, "'"));
            return;
        }
        this._isRejected = true;
        this._pstream.reject(this.parameters.CallSid);
        this._mediaHandler.reject(this.parameters.CallSid);
        this._publisher.info('connection', 'rejected-by-local', null, this);
        this._cleanupEventListeners();
        this._mediaHandler.close();
        this._status = Call.State.Closed;
        this._log.debug('#reject');
        this.emit('reject');
    };
    /**
     * Send a string of digits.
     * @param digits
     */
    Call.prototype.sendDigits = function (digits) {
        var _this = this;
        this._log.debug('.sendDigits', digits);
        if (digits.match(/[^0-9*#w]/)) {
            throw new index.InvalidArgumentError('Illegal character passed into sendDigits');
        }
        var customSounds = this._options.customSounds || {};
        var sequence = [];
        digits.split('').forEach(function (digit) {
            var dtmf = (digit !== 'w') ? "dtmf".concat(digit) : '';
            if (dtmf === 'dtmf*') {
                dtmf = 'dtmfs';
            }
            if (dtmf === 'dtmf#') {
                dtmf = 'dtmfh';
            }
            sequence.push(dtmf);
        });
        var playNextDigit = function () {
            var digit = sequence.shift();
            if (digit) {
                if (_this._options.dialtonePlayer && !customSounds[digit]) {
                    _this._options.dialtonePlayer.play(digit);
                }
                else {
                    _this._soundcache.get(digit).play();
                }
            }
            if (sequence.length) {
                setTimeout(function () { return playNextDigit(); }, 200);
            }
        };
        playNextDigit();
        var dtmfSender = this._mediaHandler.getOrCreateDTMFSender();
        function insertDTMF(dtmfs) {
            if (!dtmfs.length) {
                return;
            }
            var dtmf = dtmfs.shift();
            if (dtmf && dtmf.length) {
                dtmfSender.insertDTMF(dtmf, DTMF_TONE_DURATION, DTMF_INTER_TONE_GAP);
            }
            setTimeout(insertDTMF.bind(null, dtmfs), DTMF_PAUSE_DURATION);
        }
        if (dtmfSender) {
            if (!('canInsertDTMF' in dtmfSender) || dtmfSender.canInsertDTMF) {
                this._log.info('Sending digits using RTCDTMFSender');
                // NOTE(mroberts): We can't just map 'w' to ',' since
                // RTCDTMFSender's pause duration is 2 s and Twilio's is more
                // like 500 ms. Instead, we will fudge it with setTimeout.
                insertDTMF(digits.split('w'));
                return;
            }
            this._log.info('RTCDTMFSender cannot insert DTMF');
        }
        // send pstream message to send DTMF
        this._log.info('Sending digits over PStream');
        if (this._pstream !== null && this._pstream.status !== 'disconnected') {
            this._pstream.dtmf(this.parameters.CallSid, digits);
        }
        else {
            var error = new generated.GeneralErrors.ConnectionError('Could not send DTMF: Signaling channel is disconnected');
            this._log.debug('#error', error);
            this.emit('error', error);
        }
    };
    /**
     * Send a message to Twilio. Your backend application can listen for these
     * messages to allow communication between your frontend and backend applications.
     * <br/><br/>This feature is currently in Beta.
     * @param message - The message object to send.
     * @returns A voice event sid that uniquely identifies the message that was sent.
     */
    Call.prototype.sendMessage = function (message) {
        this._log.debug('.sendMessage', JSON.stringify(message));
        var content = message.content, contentType = message.contentType, messageType = message.messageType;
        if (typeof content === 'undefined' || content === null) {
            throw new index.InvalidArgumentError('`content` is empty');
        }
        if (typeof messageType !== 'string') {
            throw new index.InvalidArgumentError('`messageType` must be a string.');
        }
        if (messageType.length === 0) {
            throw new index.InvalidArgumentError('`messageType` must be a non-empty string.');
        }
        if (this._pstream === null) {
            throw new index.InvalidStateError('Could not send CallMessage; Signaling channel is disconnected');
        }
        var callSid = this.parameters.CallSid;
        if (typeof this.parameters.CallSid === 'undefined') {
            throw new index.InvalidStateError('Could not send CallMessage; Call has no CallSid');
        }
        var voiceEventSid = this._voiceEventSidGenerator();
        this._messages.set(voiceEventSid, { content: content, contentType: contentType, messageType: messageType, voiceEventSid: voiceEventSid });
        this._pstream.sendMessage(callSid, content, contentType, messageType, voiceEventSid);
        return voiceEventSid;
    };
    /**
     * Get the current {@link Call} status.
     */
    Call.prototype.status = function () {
        return this._status;
    };
    /**
     * Check the volume passed, emitting a warning if one way audio is detected or cleared.
     * @param currentVolume - The current volume for this direction
     * @param streakFieldName - The name of the field on the {@link Call} object that tracks how many times the
     *   current value has been repeated consecutively.
     * @param lastValueFieldName - The name of the field on the {@link Call} object that tracks the most recent
     *   volume for this direction
     * @param direction - The directionality of this audio track, either 'input' or 'output'
     * @returns The current streak; how many times in a row the same value has been polled.
     */
    Call.prototype._checkVolume = function (currentVolume, currentStreak, lastValue, direction) {
        var wasWarningRaised = currentStreak >= 10;
        var newStreak = 0;
        if (lastValue === currentVolume) {
            newStreak = currentStreak;
        }
        if (newStreak >= 10) {
            this._emitWarning('audio-level-', "constant-audio-".concat(direction, "-level"), 10, newStreak, false);
        }
        else if (wasWarningRaised) {
            this._emitWarning('audio-level-', "constant-audio-".concat(direction, "-level"), 10, newStreak, true);
        }
        return newStreak;
    };
    /**
     * Clean up event listeners.
     */
    Call.prototype._cleanupEventListeners = function () {
        var _this = this;
        var cleanup = function () {
            if (!_this._pstream) {
                return;
            }
            _this._pstream.removeListener('ack', _this._onAck);
            _this._pstream.removeListener('answer', _this._onAnswer);
            _this._pstream.removeListener('cancel', _this._onCancel);
            _this._pstream.removeListener('error', _this._onSignalingError);
            _this._pstream.removeListener('hangup', _this._onHangup);
            _this._pstream.removeListener('ringing', _this._onRinging);
            _this._pstream.removeListener('transportClose', _this._onTransportClose);
            _this._pstream.removeListener('connected', _this._onConnected);
            _this._pstream.removeListener('message', _this._onMessageReceived);
        };
        // This is kind of a hack, but it lets us avoid rewriting more code.
        // Basically, there's a sequencing problem with the way PeerConnection raises
        // the
        //
        //   Cannot establish call. SDK is disconnected
        //
        // error in Call#accept. It calls PeerConnection#onerror, which emits
        // the error event on Call. An error handler on Call then calls
        // cleanupEventListeners, but then control returns to Call#accept. It's
        // at this point that we add a listener for the answer event that never gets
        // removed. setTimeout will allow us to rerun cleanup again, _after_
        // Call#accept returns.
        cleanup();
        setTimeout(cleanup, 0);
    };
    /**
     * Create the payload wrapper for a batch of metrics to be sent to Insights.
     */
    Call.prototype._createMetricPayload = function () {
        var payload = {
            call_sid: this.parameters.CallSid,
            dscp: !!this._options.dscp,
            sdk_version: constants.RELEASE_VERSION,
        };
        if (this._options.gateway) {
            payload.gateway = this._options.gateway;
        }
        payload.direction = this._direction;
        return payload;
    };
    /**
     * Disconnect the {@link Call}.
     * @param message - A message explaining why the {@link Call} is being disconnected.
     * @param wasRemote - Whether the disconnect was triggered locally or remotely.
     */
    Call.prototype._disconnect = function (message, wasRemote) {
        message = typeof message === 'string' ? message : null;
        if (this._status !== Call.State.Open
            && this._status !== Call.State.Connecting
            && this._status !== Call.State.Reconnecting
            && this._status !== Call.State.Ringing) {
            return;
        }
        this._log.info('Disconnecting...');
        // send pstream hangup message
        if (this._pstream !== null && this._pstream.status !== 'disconnected' && this._shouldSendHangup) {
            var callsid = this.parameters.CallSid || this.outboundConnectionId;
            if (callsid) {
                this._pstream.hangup(callsid, message);
            }
        }
        this._cleanupEventListeners();
        this._mediaHandler.close();
        if (!wasRemote) {
            this._publisher.info('connection', 'disconnected-by-local', null, this);
        }
    };
    /**
     * Transition to {@link CallStatus.Open} if criteria is met.
     */
    Call.prototype._maybeTransitionToOpen = function () {
        this._wasConnected;
        if (this._isAnswered) {
            this._onSignalingReconnected();
            this._signalingStatus = Call.State.Open;
            if (this._mediaHandler && this._mediaHandler.status === 'open') {
                this._status = Call.State.Open;
                if (!this._wasConnected) {
                    this._wasConnected = true;
                    this._log.debug('#accept');
                    this.emit('accept', this);
                }
            }
        }
    };
    /**
     * Post an event to Endpoint Analytics indicating that the end user
     *   has ignored a request for feedback.
     */
    Call.prototype._postFeedbackDeclined = function () {
        return this._publisher.info('feedback', 'received-none', null, this, true);
    };
    /**
     * Publish the current set of queued metrics samples to Insights.
     */
    Call.prototype._publishMetrics = function () {
        var _this = this;
        if (this._metricsSamples.length === 0) {
            return;
        }
        this._publisher.postMetrics('quality-metrics-samples', 'metrics-sample', this._metricsSamples.splice(0), this._createMetricPayload(), this).catch(function (e) {
            _this._log.warn('Unable to post metrics to Insights. Received error:', e);
        });
    };
    /**
     * Set the CallSid
     * @param payload
     */
    Call.prototype._setCallSid = function (payload) {
        var callSid = payload.callsid;
        if (!callSid) {
            return;
        }
        this.parameters.CallSid = callSid;
        this._mediaHandler.callSid = callSid;
    };
    /**
     * String representation of the {@link Call} class.
     */
    Call.toString = function () { return '[Twilio.Call class]'; };
    return Call;
}(events.EventEmitter));
/**
 * @mergeModuleWith Call
 */
(function (Call) {
    (function (State) {
        State["Closed"] = "closed";
        State["Connecting"] = "connecting";
        State["Open"] = "open";
        State["Pending"] = "pending";
        State["Reconnecting"] = "reconnecting";
        State["Ringing"] = "ringing";
    })(Call.State || (Call.State = {}));
    (function (FeedbackIssue) {
        FeedbackIssue["AudioLatency"] = "audio-latency";
        FeedbackIssue["ChoppyAudio"] = "choppy-audio";
        FeedbackIssue["DroppedCall"] = "dropped-call";
        FeedbackIssue["Echo"] = "echo";
        FeedbackIssue["NoisyCall"] = "noisy-call";
        FeedbackIssue["OneWayAudio"] = "one-way-audio";
    })(Call.FeedbackIssue || (Call.FeedbackIssue = {}));
    (function (FeedbackScore) {
        FeedbackScore[FeedbackScore["One"] = 1] = "One";
        FeedbackScore[FeedbackScore["Two"] = 2] = "Two";
        FeedbackScore[FeedbackScore["Three"] = 3] = "Three";
        FeedbackScore[FeedbackScore["Four"] = 4] = "Four";
        FeedbackScore[FeedbackScore["Five"] = 5] = "Five";
    })(Call.FeedbackScore || (Call.FeedbackScore = {}));
    (function (CallDirection) {
        CallDirection["Incoming"] = "INCOMING";
        CallDirection["Outgoing"] = "OUTGOING";
    })(Call.CallDirection || (Call.CallDirection = {}));
    (function (Codec) {
        Codec["Opus"] = "opus";
        Codec["PCMU"] = "pcmu";
    })(Call.Codec || (Call.Codec = {}));
    (function (IceGatheringFailureReason) {
        IceGatheringFailureReason["None"] = "none";
        IceGatheringFailureReason["Timeout"] = "timeout";
    })(Call.IceGatheringFailureReason || (Call.IceGatheringFailureReason = {}));
    (function (MediaFailure) {
        MediaFailure["ConnectionDisconnected"] = "ConnectionDisconnected";
        MediaFailure["ConnectionFailed"] = "ConnectionFailed";
        MediaFailure["IceGatheringFailed"] = "IceGatheringFailed";
        MediaFailure["LowBytes"] = "LowBytes";
    })(Call.MediaFailure || (Call.MediaFailure = {}));
})(exports.default || (exports.default = {}));
function generateTempCallSid() {
    return 'TJSxxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        /* tslint:disable:no-bitwise */
        var r = Math.random() * 16 | 0;
        var v = c === 'x' ? r : (r & 0x3 | 0x8);
        /* tslint:enable:no-bitwise */
        return v.toString(16);
    });
}


},{"./backoff.js":8,"./constants.js":10,"./device.js":12,"./errors/generated.js":14,"./errors/index.js":15,"./log.js":18,"./rtc/icecandidate.js":25,"./rtc/peerconnection.js":29,"./rtc/rtcpc.js":30,"./rtc/sdp.js":31,"./sid.js":34,"./statsMonitor.js":36,"./util.js":37,"events":39,"tslib":41}],10:[function(require,module,exports){
'use strict';

/**
 * This file is generated on build. To make changes, see /templates/constants.ts
 */
var PACKAGE_NAME = '@twilio/voice-sdk';
var RELEASE_VERSION = '2.15.1-rc1';
var SOUNDS_BASE_URL = 'https://sdk.twilio.com/js/client/sounds/releases/1.0.0';
var COWBELL_AUDIO_URL = "".concat(SOUNDS_BASE_URL, "/cowbell.mp3?cache=").concat(RELEASE_VERSION);
var ECHO_TEST_DURATION = 20000;

exports.COWBELL_AUDIO_URL = COWBELL_AUDIO_URL;
exports.ECHO_TEST_DURATION = ECHO_TEST_DURATION;
exports.PACKAGE_NAME = PACKAGE_NAME;
exports.RELEASE_VERSION = RELEASE_VERSION;
exports.SOUNDS_BASE_URL = SOUNDS_BASE_URL;


},{}],11:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

/**
 * Deferred Promise
 */
var Deferred = /** @class */ (function () {
    /**
     * @constructor
     */
    function Deferred() {
        var _this = this;
        this._promise = new Promise(function (resolve, reject) {
            _this._resolve = resolve;
            _this._reject = reject;
        });
    }
    Object.defineProperty(Deferred.prototype, "promise", {
        /**
         * @returns The {@link Deferred} Promise
         */
        get: function () {
            return this._promise;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Rejects this promise
     */
    Deferred.prototype.reject = function (reason) {
        this._reject(reason);
    };
    /**
     * Resolves this promise
     */
    Deferred.prototype.resolve = function (value) {
        this._resolve(value);
    };
    return Deferred;
}());

exports.default = Deferred;


},{}],12:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var events = require('events');
var loglevel = require('loglevel');
var audiohelper = require('./audiohelper.js');
var audioprocessoreventobserver = require('./audioprocessoreventobserver.js');
var call = require('./call.js');
var constants = require('./constants.js');
var dialtonePlayer = require('./dialtonePlayer.js');
var index$1 = require('./errors/index.js');
var eventpublisher = require('./eventpublisher.js');
var log = require('./log.js');
var preflight = require('./preflight/preflight.js');
var pstream = require('./pstream.js');
var regions = require('./regions.js');
var index = require('./rtc/index.js');
var getusermedia = require('./rtc/getusermedia.js');
var sid = require('./sid.js');
var sound = require('./sound.js');
var util = require('./util.js');
var generated = require('./errors/generated.js');

var REGISTRATION_INTERVAL = 30000;
var RINGTONE_PLAY_TIMEOUT = 2000;
var PUBLISHER_PRODUCT_NAME = 'twilio-js-sdk';
var INVALID_TOKEN_MESSAGE = 'Parameter "token" must be of type "string".';
/**
 * Twilio Device. Allows registration for incoming calls, and placing outgoing calls.
 */
exports.default = /** @class */ (function (_super) {
    tslib.__extends(Device, _super);
    /**
     * Construct a {@link Device} instance. The {@link Device} can be registered
     * to make and listen for calls using {@link Device.register}.
     * @param options
     */
    function Device(token, options) {
        var _a;
        if (options === void 0) { options = {}; }
        var _this = _super.call(this) || this;
        /**
         * The currently active {@link Call}, if there is one.
         */
        _this._activeCall = null;
        /**
         * The AudioHelper instance associated with this {@link Device}.
         */
        _this._audio = null;
        /**
         * The AudioProcessorEventObserver instance to use
         */
        _this._audioProcessorEventObserver = null;
        /**
         * An audio input MediaStream to pass to new {@link Call} instances.
         */
        _this._callInputStream = null;
        /**
         * An array of {@link Call}s. Though only one can be active, multiple may exist when there
         * are multiple incoming, unanswered {@link Call}s.
         */
        _this._calls = [];
        /**
         * An array of {@link Device} IDs to be used to play sounds through, to be passed to
         * new {@link Call} instances.
         */
        _this._callSinkIds = ['default'];
        /**
         * The list of chunder URIs that will be passed to PStream
         */
        _this._chunderURIs = [];
        /**
         * Default options used by {@link Device}.
         */
        _this._defaultOptions = {
            allowIncomingWhileBusy: false,
            closeProtection: false,
            codecPreferences: [call.default.Codec.PCMU, call.default.Codec.Opus],
            dscp: true,
            enableImprovedSignalingErrorPrecision: false,
            forceAggressiveIceNomination: false,
            logLevel: loglevel.levels.ERROR,
            maxCallSignalingTimeoutMs: 0,
            preflight: false,
            sounds: {},
            tokenRefreshMs: 10000,
            voiceEventSidGenerator: sid.generateVoiceEventSid,
        };
        /**
         * The name of the edge the {@link Device} is connected to.
         */
        _this._edge = null;
        /**
         * The name of the home region the {@link Device} is connected to.
         */
        _this._home = null;
        /**
         * The identity associated with this Device.
         */
        _this._identity = null;
        /**
         * An instance of Logger to use.
         */
        _this._log = new log.default('Device');
        /**
         * The internal promise created when calling {@link Device.makeCall}.
         */
        _this._makeCallPromise = null;
        /**
         * The options passed to {@link Device} constructor or {@link Device.updateOptions}.
         */
        _this._options = {};
        /**
         * The preferred URI to (re)-connect signaling to.
         */
        _this._preferredURI = null;
        /**
         * An Insights Event Publisher.
         */
        _this._publisher = null;
        /**
         * The region the {@link Device} is connected to.
         */
        _this._region = null;
        /**
         * A timeout ID for a setTimeout schedule to re-register the {@link Device}.
         */
        _this._regTimer = null;
        /**
         * Boolean representing whether or not the {@link Device} was registered when
         * receiving a signaling `offline`. Determines if the {@link Device} attempts
         * a `re-register` once signaling is re-established when receiving a
         * `connected` event from the stream.
         */
        _this._shouldReRegister = false;
        /**
         * A Map of Sounds to play.
         */
        _this._soundcache = new Map();
        /**
         * The current status of the {@link Device}.
         */
        _this._state = Device.State.Unregistered;
        /**
         * A map from {@link Device.State} to {@link Device.EventName}.
         */
        _this._stateEventMapping = (_a = {},
            _a[Device.State.Destroyed] = Device.EventName.Destroyed,
            _a[Device.State.Unregistered] = Device.EventName.Unregistered,
            _a[Device.State.Registering] = Device.EventName.Registering,
            _a[Device.State.Registered] = Device.EventName.Registered,
            _a);
        /**
         * The Signaling stream.
         */
        _this._stream = null;
        /**
         * A promise that will resolve when the Signaling stream is ready.
         */
        _this._streamConnectedPromise = null;
        /**
         * A timeout to track when the current AccessToken will expire.
         */
        _this._tokenWillExpireTimeout = null;
        /**
         * Create the default Insights payload
         * @param call
         */
        _this._createDefaultPayload = function (call) {
            var payload = {
                aggressive_nomination: _this._options.forceAggressiveIceNomination,
                browser_extension: _this._isBrowserExtension,
                dscp: !!_this._options.dscp,
                ice_restart_enabled: true,
                platform: index.getMediaEngine(),
                sdk_version: constants.RELEASE_VERSION,
            };
            function setIfDefined(propertyName, value) {
                if (value) {
                    payload[propertyName] = value;
                }
            }
            if (call) {
                var callSid = call.parameters.CallSid;
                setIfDefined('call_sid', /^TJ/.test(callSid) ? undefined : callSid);
                setIfDefined('temp_call_sid', call.outboundConnectionId);
                setIfDefined('audio_codec', call.codec);
                payload.direction = call.direction;
            }
            setIfDefined('gateway', _this._stream && _this._stream.gateway);
            setIfDefined('region', _this._stream && _this._stream.region);
            return payload;
        };
        /**
         * Called when a 'close' event is received from the signaling stream.
         */
        _this._onSignalingClose = function () {
            _this._stream = null;
            _this._streamConnectedPromise = null;
        };
        /**
         * Called when a 'connected' event is received from the signaling stream.
         */
        _this._onSignalingConnected = function (payload) {
            var _a;
            var region = regions.getRegionShortcode(payload.region);
            _this._edge = payload.edge || regions.regionToEdge[region] || payload.region;
            _this._region = region || payload.region;
            _this._home = payload.home;
            (_a = _this._publisher) === null || _a === void 0 ? void 0 : _a.setHost(regions.createEventGatewayURI(payload.home));
            if (payload.token) {
                _this._identity = payload.token.identity;
                if (typeof payload.token.ttl === 'number' &&
                    typeof _this._options.tokenRefreshMs === 'number') {
                    var ttlMs = payload.token.ttl * 1000;
                    var timeoutMs = Math.max(0, ttlMs - _this._options.tokenRefreshMs);
                    _this._tokenWillExpireTimeout = setTimeout(function () {
                        _this._log.debug('#tokenWillExpire');
                        _this.emit('tokenWillExpire', _this);
                        if (_this._tokenWillExpireTimeout) {
                            clearTimeout(_this._tokenWillExpireTimeout);
                            _this._tokenWillExpireTimeout = null;
                        }
                    }, timeoutMs);
                }
            }
            var preferredURIs = _this._getChunderws() || regions.getChunderURIs(_this._edge);
            if (preferredURIs.length > 0) {
                var preferredURI = preferredURIs[0];
                _this._preferredURI = regions.createSignalingEndpointURL(preferredURI);
            }
            else {
                _this._log.warn('Could not parse a preferred URI from the stream#connected event.');
            }
            // The signaling stream emits a `connected` event after reconnection, if the
            // device was registered before this, then register again.
            if (_this._shouldReRegister) {
                _this.register();
            }
        };
        /**
         * Called when an 'error' event is received from the signaling stream.
         */
        _this._onSignalingError = function (payload) {
            if (typeof payload !== 'object') {
                _this._log.warn('Invalid signaling error payload', payload);
                return;
            }
            var originalError = payload.error, callsid = payload.callsid, voiceeventsid = payload.voiceeventsid;
            // voiceeventsid is for call message events which are handled in the call object
            // missing originalError shouldn't be possible but check here to fail properly
            if (typeof originalError !== 'object' || !!voiceeventsid) {
                _this._log.warn('Ignoring signaling error payload', { originalError: originalError, voiceeventsid: voiceeventsid });
                return;
            }
            var call = (typeof callsid === 'string' && _this._findCall(callsid)) || undefined;
            var code = originalError.code, customMessage = originalError.message;
            var twilioError = originalError.twilioError;
            if (typeof code === 'number') {
                if (code === 31201) {
                    twilioError = new generated.AuthorizationErrors.AuthenticationFailed(originalError);
                }
                else if (code === 31204) {
                    twilioError = new generated.AuthorizationErrors.AccessTokenInvalid(originalError);
                }
                else if (code === 31205) {
                    // Stop trying to register presence after token expires
                    _this._stopRegistrationTimer();
                    twilioError = new generated.AuthorizationErrors.AccessTokenExpired(originalError);
                }
                else {
                    var errorConstructor = index$1.getPreciseSignalingErrorByCode(!!_this._options.enableImprovedSignalingErrorPrecision, code);
                    if (typeof errorConstructor !== 'undefined') {
                        twilioError = new errorConstructor(originalError);
                    }
                }
            }
            if (!twilioError) {
                _this._log.error('Unknown signaling error: ', originalError);
                twilioError = new generated.GeneralErrors.UnknownError(customMessage, originalError);
            }
            _this._log.error('Received error: ', twilioError);
            _this._log.debug('#error', originalError);
            _this.emit(Device.EventName.Error, twilioError, call);
        };
        /**
         * Called when an 'invite' event is received from the signaling stream.
         */
        _this._onSignalingInvite = function (payload) { return tslib.__awaiter(_this, void 0, void 0, function () {
            var wasBusy, callParameters, customParameters, call, play;
            var _this = this;
            var _a;
            return tslib.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        wasBusy = !!this._activeCall;
                        if (wasBusy && !this._options.allowIncomingWhileBusy) {
                            this._log.info('Device busy; ignoring incoming invite');
                            return [2 /*return*/];
                        }
                        if (!payload.callsid || !payload.sdp) {
                            this._log.debug('#error', payload);
                            this.emit(Device.EventName.Error, new generated.ClientErrors.BadRequest('Malformed invite from gateway'));
                            return [2 /*return*/];
                        }
                        callParameters = payload.parameters || {};
                        callParameters.CallSid = callParameters.CallSid || payload.callsid;
                        customParameters = Object.assign({}, util.queryToJson(callParameters.Params));
                        this._makeCallPromise = this._makeCall(customParameters, {
                            callParameters: callParameters,
                            enableImprovedSignalingErrorPrecision: !!this._options.enableImprovedSignalingErrorPrecision,
                            offerSdp: payload.sdp,
                            reconnectToken: payload.reconnect,
                            voiceEventSidGenerator: this._options.voiceEventSidGenerator,
                        });
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, , 3, 4]);
                        return [4 /*yield*/, this._makeCallPromise];
                    case 2:
                        call = _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        this._makeCallPromise = null;
                        return [7 /*endfinally*/];
                    case 4:
                        this._calls.push(call);
                        call.once('accept', function () {
                            _this._soundcache.get(Device.SoundName.Incoming).stop();
                            _this._publishNetworkChange();
                        });
                        play = (((_a = this._audio) === null || _a === void 0 ? void 0 : _a.incoming()) && !wasBusy)
                            ? function () { return _this._soundcache.get(Device.SoundName.Incoming).play(); }
                            : function () { return Promise.resolve(); };
                        this._showIncomingCall(call, play);
                        return [2 /*return*/];
                }
            });
        }); };
        /**
         * Called when an 'offline' event is received from the signaling stream.
         */
        _this._onSignalingOffline = function () {
            _this._log.info('Stream is offline');
            _this._edge = null;
            _this._region = null;
            _this._shouldReRegister = _this.state !== Device.State.Unregistered;
            _this._setState(Device.State.Unregistered);
        };
        /**
         * Called when a 'ready' event is received from the signaling stream.
         */
        _this._onSignalingReady = function () {
            _this._log.info('Stream is ready');
            _this._setState(Device.State.Registered);
        };
        /**
         * Publish a NetworkInformation#change event to Insights if there's an active {@link Call}.
         */
        _this._publishNetworkChange = function () {
            if (!_this._activeCall) {
                return;
            }
            if (_this._networkInformation) {
                _this._publisher.info('network-information', 'network-change', {
                    connection_type: _this._networkInformation.type,
                    downlink: _this._networkInformation.downlink,
                    downlinkMax: _this._networkInformation.downlinkMax,
                    effective_type: _this._networkInformation.effectiveType,
                    rtt: _this._networkInformation.rtt,
                }, _this._activeCall);
            }
        };
        /**
         * Update the input stream being used for calls so that any current call and all future calls
         * will use the new input stream.
         * @param inputStream
         */
        _this._updateInputStream = function (inputStream) {
            var call = _this._activeCall;
            if (call && !inputStream) {
                return Promise.reject(new index$1.InvalidStateError('Cannot unset input device while a call is in progress.'));
            }
            _this._callInputStream = inputStream;
            return call
                ? call._setInputTracksFromStream(inputStream)
                : Promise.resolve();
        };
        /**
         * Update the device IDs of output devices being used to play sounds through.
         * @param type - Whether to update ringtone or speaker sounds
         * @param sinkIds - An array of device IDs
         */
        _this._updateSinkIds = function (type, sinkIds) {
            var promise = type === 'ringtone'
                ? _this._updateRingtoneSinkIds(sinkIds)
                : _this._updateSpeakerSinkIds(sinkIds);
            return promise.then(function () {
                _this._publisher.info('audio', "".concat(type, "-devices-set"), {
                    audio_device_ids: sinkIds,
                }, _this._activeCall);
            }, function (error) {
                _this._publisher.error('audio', "".concat(type, "-devices-set-failed"), {
                    audio_device_ids: sinkIds,
                    message: error.message,
                }, _this._activeCall);
                throw error;
            });
        };
        // Setup loglevel asap to avoid missed logs
        _this._setupLoglevel(options.logLevel);
        _this._logOptions('constructor', options);
        _this.updateToken(token);
        if (util.isLegacyEdge()) {
            throw new index$1.NotSupportedError('Microsoft Edge Legacy (https://support.microsoft.com/en-us/help/4533505/what-is-microsoft-edge-legacy) ' +
                'is deprecated and will not be able to connect to Twilio to make or receive calls after September 1st, 2020. ' +
                'Please see this documentation for a list of supported browsers ' +
                'https://www.twilio.com/docs/voice/client/javascript#supported-browsers');
        }
        if (!Device.isSupported && options.ignoreBrowserSupport) {
            if (window && window.location && window.location.protocol === 'http:') {
                throw new index$1.NotSupportedError("twilio.js wasn't able to find WebRTC browser support.           This is most likely because this page is served over http rather than https,           which does not support WebRTC in many browsers. Please load this page over https and           try again.");
            }
            throw new index$1.NotSupportedError("twilio.js 1.3+ SDKs require WebRTC browser support.         For more information, see <https://www.twilio.com/docs/api/client/twilio-js>.         If you have any questions about this announcement, please contact         Twilio Support at <help@twilio.com>.");
        }
        var root = globalThis;
        var browser = root.msBrowser || root.browser || root.chrome;
        _this._isBrowserExtension = (!!browser && !!browser.runtime && !!browser.runtime.id)
            || (!!root.safari && !!root.safari.extension);
        if (_this._isBrowserExtension) {
            _this._log.info('Running as browser extension.');
        }
        if (navigator) {
            var n = navigator;
            _this._networkInformation = n.connection
                || n.mozConnection
                || n.webkitConnection;
        }
        if (_this._networkInformation && typeof _this._networkInformation.addEventListener === 'function') {
            _this._networkInformation.addEventListener('change', _this._publishNetworkChange);
        }
        Device._getOrCreateAudioContext();
        if (Device._audioContext) {
            if (!Device._dialtonePlayer) {
                Device._dialtonePlayer = new dialtonePlayer.default(Device._audioContext);
            }
        }
        _this._boundDestroy = _this.destroy.bind(_this);
        _this._boundConfirmClose = _this._confirmClose.bind(_this);
        if (typeof window !== 'undefined' && window.addEventListener) {
            window.addEventListener('unload', _this._boundDestroy);
            window.addEventListener('pagehide', _this._boundDestroy);
        }
        _this.updateOptions(options);
        return _this;
    }
    Object.defineProperty(Device, "audioContext", {
        /**
         * The AudioContext to be used by {@link Device} instances.
         * @private
         */
        get: function () {
            return Device._audioContext;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Device, "extension", {
        /**
         * Which sound file extension is supported.
         * @private
         */
        get: function () {
            // NOTE(mroberts): Node workaround.
            var a = typeof document !== 'undefined'
                ? document.createElement('audio') : { canPlayType: false };
            var canPlayMp3;
            try {
                canPlayMp3 = a.canPlayType && !!a.canPlayType('audio/mpeg').replace(/no/, '');
            }
            catch (e) {
                canPlayMp3 = false;
            }
            var canPlayVorbis;
            try {
                canPlayVorbis = a.canPlayType && !!a.canPlayType('audio/ogg;codecs=\'vorbis\'').replace(/no/, '');
            }
            catch (e) {
                canPlayVorbis = false;
            }
            return (canPlayVorbis && !canPlayMp3) ? 'ogg' : 'mp3';
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Device, "isSupported", {
        /**
         * Whether or not this SDK is supported by the current browser.
         */
        get: function () { return index.enabled(); },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Device, "packageName", {
        /**
         * Package name of the SDK.
         */
        get: function () { return constants.PACKAGE_NAME; },
        enumerable: false,
        configurable: true
    });
    /**
     * Run some tests to identify issues, if any, prohibiting successful calling.
     * @param token - A Twilio JWT token string
     * @param options
     */
    Device.runPreflight = function (token, options) {
        return new preflight.PreflightTest(token, tslib.__assign({ audioContext: Device._getOrCreateAudioContext() }, options));
    };
    /**
     * String representation of {@link Device} class.
     * @private
     */
    Device.toString = function () {
        return '[Twilio.Device class]';
    };
    Object.defineProperty(Device, "version", {
        /**
         * Current SDK version.
         */
        get: function () { return constants.RELEASE_VERSION; },
        enumerable: false,
        configurable: true
    });
    /**
     * Initializes the AudioContext instance shared across the Voice SDK,
     * or returns the existing instance if one has already been initialized.
     */
    Device._getOrCreateAudioContext = function () {
        if (!Device._audioContext) {
            if (typeof AudioContext !== 'undefined') {
                Device._audioContext = new AudioContext();
            }
            else if (typeof webkitAudioContext !== 'undefined') {
                Device._audioContext = new webkitAudioContext();
            }
        }
        return Device._audioContext;
    };
    Object.defineProperty(Device.prototype, "audio", {
        /**
         * Return the {@link AudioHelper} used by this {@link Device}.
         */
        get: function () {
            return this._audio;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Make an outgoing Call.
     * @param options
     */
    Device.prototype.connect = function () {
        return tslib.__awaiter(this, arguments, void 0, function (options) {
            var customParameters, parameters, signalingReconnectToken, connectTokenParts, isReconnect, twimlParams, callOptions, activeCall, _a;
            if (options === void 0) { options = {}; }
            return tslib.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        this._log.debug('.connect', JSON.stringify(options));
                        this._throwIfDestroyed();
                        if (this._activeCall) {
                            throw new index$1.InvalidStateError('A Call is already active');
                        }
                        if (options.connectToken) {
                            try {
                                connectTokenParts = JSON.parse(decodeURIComponent(atob(options.connectToken)));
                                customParameters = connectTokenParts.customParameters;
                                parameters = connectTokenParts.parameters;
                                signalingReconnectToken = connectTokenParts.signalingReconnectToken;
                            }
                            catch (_c) {
                                throw new index$1.InvalidArgumentError('Cannot parse connectToken');
                            }
                            if (!parameters || !parameters.CallSid || !signalingReconnectToken) {
                                throw new index$1.InvalidArgumentError('Invalid connectToken');
                            }
                        }
                        isReconnect = false;
                        twimlParams = {};
                        callOptions = {
                            enableImprovedSignalingErrorPrecision: !!this._options.enableImprovedSignalingErrorPrecision,
                            rtcConfiguration: options.rtcConfiguration,
                            voiceEventSidGenerator: this._options.voiceEventSidGenerator,
                        };
                        if (signalingReconnectToken && parameters) {
                            isReconnect = true;
                            callOptions.callParameters = parameters;
                            callOptions.reconnectCallSid = parameters.CallSid;
                            callOptions.reconnectToken = signalingReconnectToken;
                            twimlParams = customParameters || twimlParams;
                        }
                        else {
                            twimlParams = options.params || twimlParams;
                        }
                        this._makeCallPromise = this._makeCall(twimlParams, callOptions, isReconnect);
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, , 3, 4]);
                        _a = this;
                        return [4 /*yield*/, this._makeCallPromise];
                    case 2:
                        activeCall = _a._activeCall = _b.sent();
                        return [3 /*break*/, 4];
                    case 3:
                        this._makeCallPromise = null;
                        return [7 /*endfinally*/];
                    case 4:
                        // Make sure any incoming calls are ignored
                        this._calls.splice(0).forEach(function (call) { return call.ignore(); });
                        // Stop the incoming sound if it's playing
                        this._soundcache.get(Device.SoundName.Incoming).stop();
                        activeCall.accept({ rtcConstraints: options.rtcConstraints });
                        this._publishNetworkChange();
                        return [2 /*return*/, activeCall];
                }
            });
        });
    };
    Object.defineProperty(Device.prototype, "calls", {
        /**
         * Return the calls that this {@link Device} is maintaining.
         */
        get: function () {
            return this._calls;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Destroy the {@link Device}, freeing references to be garbage collected.
     */
    Device.prototype.destroy = function () {
        var _a;
        this._log.debug('.destroy');
        this._log.debug('Rejecting any incoming calls');
        var calls = this._calls.slice(0);
        calls.forEach(function (call) { return call.reject(); });
        this.disconnectAll();
        this._stopRegistrationTimer();
        this._destroyStream();
        this._destroyAudioHelper();
        (_a = this._audioProcessorEventObserver) === null || _a === void 0 ? void 0 : _a.destroy();
        this._destroyPublisher();
        if (this._networkInformation && typeof this._networkInformation.removeEventListener === 'function') {
            this._networkInformation.removeEventListener('change', this._publishNetworkChange);
        }
        if (typeof window !== 'undefined' && window.removeEventListener) {
            window.removeEventListener('beforeunload', this._boundConfirmClose);
            window.removeEventListener('unload', this._boundDestroy);
            window.removeEventListener('pagehide', this._boundDestroy);
        }
        this._setState(Device.State.Destroyed);
        events.EventEmitter.prototype.removeAllListeners.call(this);
    };
    /**
     * Disconnect all {@link Call}s.
     */
    Device.prototype.disconnectAll = function () {
        this._log.debug('.disconnectAll');
        var calls = this._calls.splice(0);
        calls.forEach(function (call) { return call.disconnect(); });
        if (this._activeCall) {
            this._activeCall.disconnect();
        }
    };
    Object.defineProperty(Device.prototype, "edge", {
        /**
         * Returns the {@link Edge} value the {@link Device} is currently connected
         * to. The value will be `null` when the {@link Device} is offline.
         */
        get: function () {
            return this._edge;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Device.prototype, "home", {
        /**
         * Returns the home value the {@link Device} is currently connected
         * to. The value will be `null` when the {@link Device} is offline.
         */
        get: function () {
            return this._home;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Device.prototype, "identity", {
        /**
         * Returns the identity associated with the {@link Device} for incoming calls. Only
         * populated when registered.
         */
        get: function () {
            return this._identity;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Device.prototype, "isBusy", {
        /**
         * Whether the Device is currently on an active Call.
         */
        get: function () {
            return !!this._activeCall;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * Register the `Device` to the Twilio backend, allowing it to receive calls.
     */
    Device.prototype.register = function () {
        return tslib.__awaiter(this, void 0, void 0, function () {
            return tslib.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this._log.debug('.register');
                        if (this.state !== Device.State.Unregistered) {
                            throw new index$1.InvalidStateError("Attempt to register when device is in state \"".concat(this.state, "\". ") +
                                "Must be \"".concat(Device.State.Unregistered, "\"."));
                        }
                        this._shouldReRegister = false;
                        this._setState(Device.State.Registering);
                        return [4 /*yield*/, (this._streamConnectedPromise || this._setupStream())];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, this._sendPresence(true)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, util.promisifyEvents(this, Device.State.Registered, Device.State.Unregistered)];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    Object.defineProperty(Device.prototype, "state", {
        /**
         * Get the state of this {@link Device} instance
         */
        get: function () {
            return this._state;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(Device.prototype, "token", {
        /**
         * Get the token used by this {@link Device}.
         */
        get: function () {
            return this._token;
        },
        enumerable: false,
        configurable: true
    });
    /**
     * String representation of {@link Device} instance.
     * @private
     */
    Device.prototype.toString = function () {
        return '[Twilio.Device instance]';
    };
    /**
     * Unregister the `Device` to the Twilio backend, disallowing it to receive
     * calls.
     */
    Device.prototype.unregister = function () {
        return tslib.__awaiter(this, void 0, void 0, function () {
            var stream, streamOfflinePromise;
            return tslib.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        this._log.debug('.unregister');
                        if (this.state !== Device.State.Registered) {
                            throw new index$1.InvalidStateError("Attempt to unregister when device is in state \"".concat(this.state, "\". ") +
                                "Must be \"".concat(Device.State.Registered, "\"."));
                        }
                        this._shouldReRegister = false;
                        return [4 /*yield*/, this._streamConnectedPromise];
                    case 1:
                        stream = _a.sent();
                        streamOfflinePromise = new Promise(function (resolve) {
                            stream.on('offline', resolve);
                        });
                        return [4 /*yield*/, this._sendPresence(false)];
                    case 2:
                        _a.sent();
                        return [4 /*yield*/, streamOfflinePromise];
                    case 3:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Set the options used within the {@link Device}.
     * @param options
     */
    Device.prototype.updateOptions = function (options) {
        if (options === void 0) { options = {}; }
        this._logOptions('updateOptions', options);
        if (this.state === Device.State.Destroyed) {
            throw new index$1.InvalidStateError("Attempt to \"updateOptions\" when device is in state \"".concat(this.state, "\"."));
        }
        this._options = tslib.__assign(tslib.__assign(tslib.__assign({}, this._defaultOptions), this._options), options);
        var originalChunderURIs = new Set(this._chunderURIs);
        var newChunderURIs = this._chunderURIs = (this._getChunderws() || regions.getChunderURIs(this._options.edge)).map(regions.createSignalingEndpointURL);
        var hasChunderURIsChanged = originalChunderURIs.size !== newChunderURIs.length;
        if (!hasChunderURIsChanged) {
            for (var _i = 0, newChunderURIs_1 = newChunderURIs; _i < newChunderURIs_1.length; _i++) {
                var uri = newChunderURIs_1[_i];
                if (!originalChunderURIs.has(uri)) {
                    hasChunderURIsChanged = true;
                    break;
                }
            }
        }
        if (this.isBusy && hasChunderURIsChanged) {
            throw new index$1.InvalidStateError('Cannot change Edge while on an active Call');
        }
        this._setupLoglevel(this._options.logLevel);
        for (var _a = 0, _b = Object.keys(Device._defaultSounds); _a < _b.length; _a++) {
            var name_1 = _b[_a];
            var soundDef = Device._defaultSounds[name_1];
            var defaultUrl = "".concat(constants.SOUNDS_BASE_URL, "/").concat(soundDef.filename, ".").concat(Device.extension)
                + "?cache=".concat(constants.RELEASE_VERSION);
            var soundUrl = this._options.sounds && this._options.sounds[name_1] || defaultUrl;
            var sound$1 = new (this._options.Sound || sound.default)(name_1, soundUrl, {
                audioContext: this._options.disableAudioContextSounds ? null : Device.audioContext,
                maxDuration: soundDef.maxDuration,
                shouldLoop: soundDef.shouldLoop,
            });
            this._soundcache.set(name_1, sound$1);
        }
        this._setupAudioHelper();
        this._setupPublisher();
        if (hasChunderURIsChanged && this._streamConnectedPromise) {
            this._setupStream();
        }
        // Setup close protection and make sure we clean up ongoing calls on unload.
        if (typeof window !== 'undefined' &&
            typeof window.addEventListener === 'function' &&
            this._options.closeProtection) {
            window.removeEventListener('beforeunload', this._boundConfirmClose);
            window.addEventListener('beforeunload', this._boundConfirmClose);
        }
    };
    /**
     * Update the token used by this {@link Device} to connect to Twilio.
     * It is recommended to call this API after [[Device.tokenWillExpireEvent]] is emitted,
     * and before or after a call to prevent a potential ~1s audio loss during the update process.
     * @param token
     */
    Device.prototype.updateToken = function (token) {
        this._log.debug('.updateToken');
        if (this.state === Device.State.Destroyed) {
            throw new index$1.InvalidStateError("Attempt to \"updateToken\" when device is in state \"".concat(this.state, "\"."));
        }
        if (typeof token !== 'string') {
            throw new index$1.InvalidArgumentError(INVALID_TOKEN_MESSAGE);
        }
        this._token = token;
        if (this._stream) {
            this._stream.setToken(this._token);
        }
        if (this._publisher) {
            this._publisher.setToken(this._token);
        }
    };
    /**
     * Called on window's beforeunload event if closeProtection is enabled,
     * preventing users from accidentally navigating away from an active call.
     * @param event
     */
    Device.prototype._confirmClose = function (event) {
        if (!this._activeCall) {
            return '';
        }
        var closeProtection = this._options.closeProtection || false;
        var confirmationMsg = typeof closeProtection !== 'string'
            ? 'A call is currently in-progress. Leaving or reloading this page will end the call.'
            : closeProtection;
        (event || window.event).returnValue = confirmationMsg;
        return confirmationMsg;
    };
    /**
     * Destroy the AudioHelper.
     */
    Device.prototype._destroyAudioHelper = function () {
        if (!this._audio) {
            return;
        }
        this._audio._destroy();
        this._audio = null;
    };
    /**
     * Destroy the publisher.
     */
    Device.prototype._destroyPublisher = function () {
        // Attempt to destroy non-existent publisher.
        if (!this._publisher) {
            return;
        }
        this._publisher = null;
    };
    /**
     * Destroy the connection to the signaling server.
     */
    Device.prototype._destroyStream = function () {
        if (this._stream) {
            this._stream.removeListener('close', this._onSignalingClose);
            this._stream.removeListener('connected', this._onSignalingConnected);
            this._stream.removeListener('error', this._onSignalingError);
            this._stream.removeListener('invite', this._onSignalingInvite);
            this._stream.removeListener('offline', this._onSignalingOffline);
            this._stream.removeListener('ready', this._onSignalingReady);
            this._stream.destroy();
            this._stream = null;
        }
        this._onSignalingOffline();
        this._streamConnectedPromise = null;
    };
    /**
     * Find a {@link Call} by its CallSid.
     * @param callSid
     */
    Device.prototype._findCall = function (callSid) {
        return this._calls.find(function (call) { return call.parameters.CallSid === callSid
            || call.outboundConnectionId === callSid; }) || null;
    };
    /**
     * Get chunderws array from the chunderw param
     */
    Device.prototype._getChunderws = function () {
        return typeof this._options.chunderw === 'string' ? [this._options.chunderw]
            : Array.isArray(this._options.chunderw) ? this._options.chunderw : null;
    };
    /**
     * Utility function to log device options
     */
    Device.prototype._logOptions = function (caller, options) {
        if (options === void 0) { options = {}; }
        // Selectively log options that users can modify.
        // Also, convert user overrides.
        // This prevents potential app crash when calling JSON.stringify
        // and when sending log strings remotely
        var userOptions = [
            'allowIncomingWhileBusy',
            'appName',
            'appVersion',
            'closeProtection',
            'codecPreferences',
            'disableAudioContextSounds',
            'dscp',
            'edge',
            'enableImprovedSignalingErrorPrecision',
            'forceAggressiveIceNomination',
            'logLevel',
            'maxAverageBitrate',
            'maxCallSignalingTimeoutMs',
            'sounds',
            'tokenRefreshMs',
        ];
        var userOptionOverrides = [
            'RTCPeerConnection',
            'enumerateDevices',
            'getUserMedia',
            'MediaStream',
        ];
        if (typeof options === 'object') {
            var toLog_1 = tslib.__assign({}, options);
            Object.keys(toLog_1).forEach(function (key) {
                if (!userOptions.includes(key) && !userOptionOverrides.includes(key)) {
                    delete toLog_1[key];
                }
                if (userOptionOverrides.includes(key)) {
                    toLog_1[key] = true;
                }
            });
            this._log.debug(".".concat(caller), JSON.stringify(toLog_1));
        }
    };
    /**
     * Create a new {@link Call}.
     * @param twimlParams - A flat object containing key:value pairs to be sent to the TwiML app.
     * @param options - Options to be used to instantiate the {@link Call}.
     */
    Device.prototype._makeCall = function (twimlParams_1, options_1) {
        return tslib.__awaiter(this, arguments, void 0, function (twimlParams, options, isReconnect) {
            var inputDevicePromise, config, maybeUnsetPreferredUri, call$1;
            var _a;
            var _this = this;
            var _b;
            if (isReconnect === void 0) { isReconnect = false; }
            return tslib.__generator(this, function (_c) {
                switch (_c.label) {
                    case 0:
                        inputDevicePromise = (_b = this._audio) === null || _b === void 0 ? void 0 : _b._getInputDevicePromise();
                        if (!inputDevicePromise) return [3 /*break*/, 2];
                        this._log.debug('inputDevicePromise detected, waiting...');
                        return [4 /*yield*/, inputDevicePromise];
                    case 1:
                        _c.sent();
                        this._log.debug('inputDevicePromise resolved');
                        _c.label = 2;
                    case 2:
                        _a = {
                            audioHelper: this._audio,
                            onIgnore: function () {
                                _this._soundcache.get(Device.SoundName.Incoming).stop();
                            }
                        };
                        return [4 /*yield*/, (this._streamConnectedPromise || this._setupStream())];
                    case 3:
                        config = (_a.pstream = _c.sent(),
                            _a.publisher = this._publisher,
                            _a.soundcache = this._soundcache,
                            _a);
                        options = Object.assign({
                            MediaStream: this._options.MediaStream,
                            RTCPeerConnection: this._options.RTCPeerConnection,
                            beforeAccept: function (currentCall) {
                                if (!_this._activeCall || _this._activeCall === currentCall) {
                                    return;
                                }
                                _this._activeCall.disconnect();
                                _this._removeCall(_this._activeCall);
                            },
                            codecPreferences: this._options.codecPreferences,
                            customSounds: this._options.sounds,
                            dialtonePlayer: Device._dialtonePlayer,
                            dscp: this._options.dscp,
                            // TODO(csantos): Remove forceAggressiveIceNomination option in 3.x
                            forceAggressiveIceNomination: this._options.forceAggressiveIceNomination,
                            getInputStream: function () { return _this._options.fileInputStream || _this._callInputStream; },
                            getSinkIds: function () { return _this._callSinkIds; },
                            maxAverageBitrate: this._options.maxAverageBitrate,
                            preflight: this._options.preflight,
                            rtcConstraints: this._options.rtcConstraints,
                            shouldPlayDisconnect: function () { var _a; return (_a = _this._audio) === null || _a === void 0 ? void 0 : _a.disconnect(); },
                            twimlParams: twimlParams,
                            voiceEventSidGenerator: this._options.voiceEventSidGenerator,
                        }, options);
                        maybeUnsetPreferredUri = function () {
                            if (!_this._stream) {
                                _this._log.warn('UnsetPreferredUri called without a stream');
                                return;
                            }
                            if (_this._activeCall === null && _this._calls.length === 0) {
                                _this._stream.updatePreferredURI(null);
                            }
                        };
                        call$1 = new (this._options.Call || call.default)(config, options);
                        this._publisher.info('settings', 'init', {
                            MediaStream: !!this._options.MediaStream,
                            RTCPeerConnection: !!this._options.RTCPeerConnection,
                            enumerateDevices: !!this._options.enumerateDevices,
                            getUserMedia: !!this._options.getUserMedia,
                        }, call$1);
                        call$1.once('accept', function () {
                            var _a, _b, _c;
                            _this._stream.updatePreferredURI(_this._preferredURI);
                            _this._removeCall(call$1);
                            _this._activeCall = call$1;
                            if (_this._audio) {
                                _this._audio._maybeStartPollingVolume();
                            }
                            if (call$1.direction === call.default.CallDirection.Outgoing && ((_a = _this._audio) === null || _a === void 0 ? void 0 : _a.outgoing()) && !isReconnect) {
                                _this._soundcache.get(Device.SoundName.Outgoing).play();
                            }
                            var data = { edge: _this._edge || _this._region };
                            if (_this._options.edge) {
                                data['selected_edge'] = Array.isArray(_this._options.edge)
                                    ? _this._options.edge
                                    : [_this._options.edge];
                            }
                            _this._publisher.info('settings', 'edge', data, call$1);
                            if ((_b = _this._audio) === null || _b === void 0 ? void 0 : _b.processedStream) {
                                (_c = _this._audioProcessorEventObserver) === null || _c === void 0 ? void 0 : _c.emit('enabled');
                            }
                        });
                        call$1.addListener('error', function (error) {
                            if (call$1.status() === 'closed') {
                                _this._removeCall(call$1);
                                maybeUnsetPreferredUri();
                            }
                            if (_this._audio) {
                                _this._audio._maybeStopPollingVolume();
                            }
                            _this._maybeStopIncomingSound();
                        });
                        call$1.once('cancel', function () {
                            _this._log.info("Canceled: ".concat(call$1.parameters.CallSid));
                            _this._removeCall(call$1);
                            maybeUnsetPreferredUri();
                            if (_this._audio) {
                                _this._audio._maybeStopPollingVolume();
                            }
                            _this._maybeStopIncomingSound();
                        });
                        call$1.once('disconnect', function () {
                            if (_this._audio) {
                                _this._audio._maybeStopPollingVolume();
                            }
                            _this._removeCall(call$1);
                            maybeUnsetPreferredUri();
                            /**
                             * NOTE(kamalbennani): We need to stop the incoming sound when the call is
                             * disconnected right after the user has accepted the call (activeCall.accept()), and before
                             * the call has been fully connected (i.e. before the `pstream.answer` event)
                             */
                            _this._maybeStopIncomingSound();
                        });
                        call$1.once('reject', function () {
                            _this._log.info("Rejected: ".concat(call$1.parameters.CallSid));
                            if (_this._audio) {
                                _this._audio._maybeStopPollingVolume();
                            }
                            _this._removeCall(call$1);
                            maybeUnsetPreferredUri();
                            _this._maybeStopIncomingSound();
                        });
                        call$1.on('transportClose', function () {
                            if (call$1.status() !== call.default.State.Pending) {
                                return;
                            }
                            if (_this._audio) {
                                _this._audio._maybeStopPollingVolume();
                            }
                            _this._removeCall(call$1);
                            /**
                             * NOTE(mhuynh): We don't want to call `maybeUnsetPreferredUri` because
                             * a `transportClose` will happen during signaling reconnection.
                             */
                            _this._maybeStopIncomingSound();
                        });
                        return [2 /*return*/, call$1];
                }
            });
        });
    };
    /**
     * Stop the incoming sound if no {@link Call}s remain.
     */
    Device.prototype._maybeStopIncomingSound = function () {
        if (!this._calls.length) {
            this._soundcache.get(Device.SoundName.Incoming).stop();
        }
    };
    /**
     * Remove a {@link Call} from device.calls by reference
     * @param call
     */
    Device.prototype._removeCall = function (call) {
        if (this._activeCall === call) {
            this._activeCall = null;
            this._makeCallPromise = null;
        }
        for (var i = this._calls.length - 1; i >= 0; i--) {
            if (call === this._calls[i]) {
                this._calls.splice(i, 1);
            }
        }
    };
    /**
     * Register with the signaling server.
     */
    Device.prototype._sendPresence = function (presence) {
        return tslib.__awaiter(this, void 0, void 0, function () {
            var stream;
            return tslib.__generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this._streamConnectedPromise];
                    case 1:
                        stream = _a.sent();
                        if (!stream) {
                            return [2 /*return*/];
                        }
                        stream.register({ audio: presence });
                        if (presence) {
                            this._startRegistrationTimer();
                        }
                        else {
                            this._stopRegistrationTimer();
                        }
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Helper function that sets and emits the state of the device.
     * @param state The new state of the device.
     */
    Device.prototype._setState = function (state) {
        if (state === this.state) {
            return;
        }
        this._state = state;
        var name = this._stateEventMapping[state];
        this._log.debug("#".concat(name));
        this.emit(name);
    };
    /**
     * Set up an audio helper for usage by this {@link Device}.
     */
    Device.prototype._setupAudioHelper = function () {
        var _this = this;
        if (!this._audioProcessorEventObserver) {
            this._audioProcessorEventObserver = new audioprocessoreventobserver.AudioProcessorEventObserver();
            this._audioProcessorEventObserver.on('event', function (_a) {
                var name = _a.name, group = _a.group;
                _this._publisher.info(group, name, {}, _this._activeCall);
            });
        }
        var audioOptions = {
            audioContext: Device.audioContext,
            audioProcessorEventObserver: this._audioProcessorEventObserver,
            beforeSetInputDevice: function () {
                if (_this._makeCallPromise) {
                    _this._log.debug('beforeSetInputDevice pause detected');
                    return _this._makeCallPromise;
                }
                else {
                    _this._log.debug('beforeSetInputDevice pause not detected, setting default');
                    return Promise.resolve();
                }
            },
            enumerateDevices: this._options.enumerateDevices,
            getUserMedia: this._options.getUserMedia || getusermedia.default,
        };
        if (this._audio) {
            this._log.info('Found existing audio helper; updating options...');
            this._audio._updateUserOptions(audioOptions);
            return;
        }
        this._audio = new (this._options.AudioHelper || audiohelper.default)(this._updateSinkIds, this._updateInputStream, audioOptions);
        this._audio.on('deviceChange', function (lostActiveDevices) {
            var activeCall = _this._activeCall;
            var deviceIds = lostActiveDevices.map(function (device) { return device.deviceId; });
            _this._publisher.info('audio', 'device-change', {
                lost_active_device_ids: deviceIds,
            }, activeCall);
            if (activeCall) {
                activeCall['_mediaHandler']._onInputDevicesChanged();
            }
        });
    };
    /**
     * Setup logger's loglevel
     */
    Device.prototype._setupLoglevel = function (logLevel) {
        var level = typeof logLevel === 'number' ||
            typeof logLevel === 'string' ?
            logLevel : loglevel.levels.ERROR;
        this._log.setDefaultLevel(level);
        this._log.info('Set logger default level to', level);
    };
    /**
     * Create and set a publisher for the {@link Device} to use.
     */
    Device.prototype._setupPublisher = function () {
        var _this = this;
        if (this._publisher) {
            this._log.info('Found existing publisher; destroying...');
            this._destroyPublisher();
        }
        var publisherOptions = {
            defaultPayload: this._createDefaultPayload,
            metadata: {
                app_name: this._options.appName,
                app_version: this._options.appVersion,
            },
        };
        if (this._options.eventgw) {
            publisherOptions.host = this._options.eventgw;
        }
        if (this._home) {
            publisherOptions.host = regions.createEventGatewayURI(this._home);
        }
        this._publisher = new (this._options.Publisher || eventpublisher.default)(PUBLISHER_PRODUCT_NAME, this.token, publisherOptions);
        if (this._options.publishEvents === false) {
            this._publisher.disable();
        }
        else {
            this._publisher.on('error', function (error) {
                _this._log.warn('Cannot connect to insights.', error);
            });
        }
        return this._publisher;
    };
    /**
     * Set up the connection to the signaling server. Tears down an existing
     * stream if called while a stream exists.
     */
    Device.prototype._setupStream = function () {
        var _this = this;
        if (this._stream) {
            this._log.info('Found existing stream; destroying...');
            this._destroyStream();
        }
        this._log.info('Setting up VSP');
        this._stream = new (this._options.PStream || pstream.default)(this.token, this._chunderURIs, {
            backoffMaxMs: this._options.backoffMaxMs,
            maxPreferredDurationMs: this._options.maxCallSignalingTimeoutMs,
        });
        this._stream.addListener('close', this._onSignalingClose);
        this._stream.addListener('connected', this._onSignalingConnected);
        this._stream.addListener('error', this._onSignalingError);
        this._stream.addListener('invite', this._onSignalingInvite);
        this._stream.addListener('offline', this._onSignalingOffline);
        this._stream.addListener('ready', this._onSignalingReady);
        return this._streamConnectedPromise =
            util.promisifyEvents(this._stream, 'connected', 'close').then(function () { return _this._stream; });
    };
    /**
     * Start playing the incoming ringtone, and subsequently emit the incoming event.
     * @param call
     * @param play - The function to be used to play the sound. Must return a Promise.
     */
    Device.prototype._showIncomingCall = function (call, play) {
        var _this = this;
        var timeout;
        return Promise.race([
            play(),
            new Promise(function (resolve, reject) {
                timeout = setTimeout(function () {
                    var msg = 'Playing incoming ringtone took too long; it might not play. Continuing execution...';
                    reject(new Error(msg));
                }, RINGTONE_PLAY_TIMEOUT);
            }),
        ]).catch(function (reason) {
            _this._log.warn(reason.message);
        }).then(function () {
            clearTimeout(timeout);
            _this._log.debug('#incoming', JSON.stringify({
                customParameters: call.customParameters,
                parameters: call.parameters,
            }));
            _this.emit(Device.EventName.Incoming, call);
        });
    };
    /**
     * Set a timeout to send another register message to the signaling server.
     */
    Device.prototype._startRegistrationTimer = function () {
        var _this = this;
        this._stopRegistrationTimer();
        this._regTimer = setTimeout(function () {
            _this._sendPresence(true);
        }, REGISTRATION_INTERVAL);
    };
    /**
     * Stop sending registration messages to the signaling server.
     */
    Device.prototype._stopRegistrationTimer = function () {
        if (this._regTimer) {
            clearTimeout(this._regTimer);
        }
    };
    /**
     * Throw an error if the {@link Device} is destroyed.
     */
    Device.prototype._throwIfDestroyed = function () {
        if (this.state === Device.State.Destroyed) {
            throw new index$1.InvalidStateError('Device has been destroyed.');
        }
    };
    /**
     * Update the device IDs of output devices being used to play the incoming ringtone through.
     * @param sinkIds - An array of device IDs
     */
    Device.prototype._updateRingtoneSinkIds = function (sinkIds) {
        return Promise.resolve(this._soundcache.get(Device.SoundName.Incoming).setSinkIds(sinkIds));
    };
    /**
     * Update the device IDs of output devices being used to play the non-ringtone sounds
     * and Call audio through.
     * @param sinkIds - An array of device IDs
     */
    Device.prototype._updateSpeakerSinkIds = function (sinkIds) {
        Array.from(this._soundcache.entries())
            .filter(function (entry) { return entry[0] !== Device.SoundName.Incoming; })
            .forEach(function (entry) { return entry[1].setSinkIds(sinkIds); });
        this._callSinkIds = sinkIds;
        var call = this._activeCall;
        return call
            ? call._setSinkIds(sinkIds)
            : Promise.resolve();
    };
    Device._defaultSounds = {
        disconnect: { filename: 'disconnect', maxDuration: 3000 },
        dtmf0: { filename: 'dtmf-0', maxDuration: 1000 },
        dtmf1: { filename: 'dtmf-1', maxDuration: 1000 },
        dtmf2: { filename: 'dtmf-2', maxDuration: 1000 },
        dtmf3: { filename: 'dtmf-3', maxDuration: 1000 },
        dtmf4: { filename: 'dtmf-4', maxDuration: 1000 },
        dtmf5: { filename: 'dtmf-5', maxDuration: 1000 },
        dtmf6: { filename: 'dtmf-6', maxDuration: 1000 },
        dtmf7: { filename: 'dtmf-7', maxDuration: 1000 },
        dtmf8: { filename: 'dtmf-8', maxDuration: 1000 },
        dtmf9: { filename: 'dtmf-9', maxDuration: 1000 },
        dtmfh: { filename: 'dtmf-hash', maxDuration: 1000 },
        dtmfs: { filename: 'dtmf-star', maxDuration: 1000 },
        incoming: { filename: 'incoming', shouldLoop: true },
        outgoing: { filename: 'outgoing', maxDuration: 3000 },
    };
    return Device;
}(events.EventEmitter));
/**
 * @mergeModuleWith Device
 */
(function (Device) {
    (function (EventName) {
        EventName["Error"] = "error";
        EventName["Incoming"] = "incoming";
        EventName["Destroyed"] = "destroyed";
        EventName["Unregistered"] = "unregistered";
        EventName["Registering"] = "registering";
        EventName["Registered"] = "registered";
        EventName["TokenWillExpire"] = "tokenWillExpire";
    })(Device.EventName || (Device.EventName = {}));
    (function (State) {
        State["Destroyed"] = "destroyed";
        State["Unregistered"] = "unregistered";
        State["Registering"] = "registering";
        State["Registered"] = "registered";
    })(Device.State || (Device.State = {}));
    (function (SoundName) {
        SoundName["Incoming"] = "incoming";
        SoundName["Outgoing"] = "outgoing";
        SoundName["Disconnect"] = "disconnect";
        SoundName["Dtmf0"] = "dtmf0";
        SoundName["Dtmf1"] = "dtmf1";
        SoundName["Dtmf2"] = "dtmf2";
        SoundName["Dtmf3"] = "dtmf3";
        SoundName["Dtmf4"] = "dtmf4";
        SoundName["Dtmf5"] = "dtmf5";
        SoundName["Dtmf6"] = "dtmf6";
        SoundName["Dtmf7"] = "dtmf7";
        SoundName["Dtmf8"] = "dtmf8";
        SoundName["Dtmf9"] = "dtmf9";
        SoundName["DtmfS"] = "dtmfs";
        SoundName["DtmfH"] = "dtmfh";
    })(Device.SoundName || (Device.SoundName = {}));
})(exports.default || (exports.default = {}));


},{"./audiohelper.js":3,"./audioprocessoreventobserver.js":7,"./call.js":9,"./constants.js":10,"./dialtonePlayer.js":13,"./errors/generated.js":14,"./errors/index.js":15,"./eventpublisher.js":17,"./log.js":18,"./preflight/preflight.js":20,"./pstream.js":21,"./regions.js":22,"./rtc/getusermedia.js":24,"./rtc/index.js":26,"./sid.js":34,"./sound.js":35,"./util.js":37,"events":39,"loglevel":40,"tslib":41}],13:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var index = require('./errors/index.js');

/**
 * A Map of DTMF Sound Names to their mock frequency pairs.
 */
var bandFrequencies = {
    dtmf0: [1360, 960],
    dtmf1: [1230, 720],
    dtmf2: [1360, 720],
    dtmf3: [1480, 720],
    dtmf4: [1230, 790],
    dtmf5: [1360, 790],
    dtmf6: [1480, 790],
    dtmf7: [1230, 870],
    dtmf8: [1360, 870],
    dtmf9: [1480, 870],
    dtmfh: [1480, 960],
    dtmfs: [1230, 960],
};
var DialtonePlayer = /** @class */ (function () {
    function DialtonePlayer(_context) {
        var _this = this;
        this._context = _context;
        /**
         * Gain nodes, reducing the frequency.
         */
        this._gainNodes = [];
        this._gainNodes = [
            this._context.createGain(),
            this._context.createGain(),
        ];
        this._gainNodes.forEach(function (gainNode) {
            gainNode.connect(_this._context.destination);
            gainNode.gain.value = 0.1;
            _this._gainNodes.push(gainNode);
        });
    }
    DialtonePlayer.prototype.cleanup = function () {
        this._gainNodes.forEach(function (gainNode) {
            gainNode.disconnect();
        });
    };
    /**
     * Play the dual frequency tone for the passed DTMF name.
     * @param sound
     */
    DialtonePlayer.prototype.play = function (sound) {
        var _this = this;
        var frequencies = bandFrequencies[sound];
        if (!frequencies) {
            throw new index.InvalidArgumentError('Invalid DTMF sound name');
        }
        var oscillators = [
            this._context.createOscillator(),
            this._context.createOscillator(),
        ];
        oscillators.forEach(function (oscillator, i) {
            oscillator.type = 'sine';
            oscillator.frequency.value = frequencies[i];
            oscillator.connect(_this._gainNodes[i]);
            oscillator.start();
            oscillator.stop(_this._context.currentTime + 0.1);
            oscillator.addEventListener('ended', function () { return oscillator.disconnect(); });
        });
    };
    return DialtonePlayer;
}());

exports.default = DialtonePlayer;


},{"./errors/index.js":15}],14:[function(require,module,exports){
'use strict';

var tslib = require('tslib');
var twilioError = require('./twilioError.js');

exports.AuthorizationErrors = void 0;
(function (AuthorizationErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var AccessTokenInvalid = /** @class */ (function (_super) {
        tslib.__extends(AccessTokenInvalid, _super);
        /**
         * @internal
         */
        function AccessTokenInvalid(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 20101;
            _this.description = 'Invalid access token';
            _this.explanation = 'Twilio was unable to validate your Access Token';
            _this.name = 'AccessTokenInvalid';
            _this.solutions = [];
            Object.setPrototypeOf(_this, AuthorizationErrors.AccessTokenInvalid.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return AccessTokenInvalid;
    }(twilioError.default));
    AuthorizationErrors.AccessTokenInvalid = AccessTokenInvalid;
    /**
     * Error received from the Twilio backend.
     */
    var AccessTokenExpired = /** @class */ (function (_super) {
        tslib.__extends(AccessTokenExpired, _super);
        /**
         * @internal
         */
        function AccessTokenExpired(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 20104;
            _this.description = 'Access token expired or expiration date invalid';
            _this.explanation = 'The Access Token provided to the Twilio API has expired, the expiration time specified in the token was invalid, or the expiration time specified was too far in the future';
            _this.name = 'AccessTokenExpired';
            _this.solutions = [];
            Object.setPrototypeOf(_this, AuthorizationErrors.AccessTokenExpired.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return AccessTokenExpired;
    }(twilioError.default));
    AuthorizationErrors.AccessTokenExpired = AccessTokenExpired;
    /**
     * Error received from the Twilio backend.
     */
    var AuthenticationFailed = /** @class */ (function (_super) {
        tslib.__extends(AuthenticationFailed, _super);
        /**
         * @internal
         */
        function AuthenticationFailed(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 20151;
            _this.description = 'Authentication Failed';
            _this.explanation = 'The Authentication with the provided JWT failed';
            _this.name = 'AuthenticationFailed';
            _this.solutions = [];
            Object.setPrototypeOf(_this, AuthorizationErrors.AuthenticationFailed.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return AuthenticationFailed;
    }(twilioError.default));
    AuthorizationErrors.AuthenticationFailed = AuthenticationFailed;
})(exports.AuthorizationErrors || (exports.AuthorizationErrors = {}));
exports.SignatureValidationErrors = void 0;
(function (SignatureValidationErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var AccessTokenSignatureValidationFailed = /** @class */ (function (_super) {
        tslib.__extends(AccessTokenSignatureValidationFailed, _super);
        /**
         * @internal
         */
        function AccessTokenSignatureValidationFailed(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The access token has an invalid Account SID, API Key, or API Key Secret.',
            ];
            _this.code = 31202;
            _this.description = 'Signature validation failed.';
            _this.explanation = 'The provided access token failed signature validation.';
            _this.name = 'AccessTokenSignatureValidationFailed';
            _this.solutions = [
                'Ensure the Account SID, API Key, and API Key Secret are valid when generating your access token.',
            ];
            Object.setPrototypeOf(_this, SignatureValidationErrors.AccessTokenSignatureValidationFailed.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return AccessTokenSignatureValidationFailed;
    }(twilioError.default));
    SignatureValidationErrors.AccessTokenSignatureValidationFailed = AccessTokenSignatureValidationFailed;
})(exports.SignatureValidationErrors || (exports.SignatureValidationErrors = {}));
exports.ClientErrors = void 0;
(function (ClientErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var BadRequest = /** @class */ (function (_super) {
        tslib.__extends(BadRequest, _super);
        /**
         * @internal
         */
        function BadRequest(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31400;
            _this.description = 'Bad Request (HTTP/SIP)';
            _this.explanation = 'The request could not be understood due to malformed syntax.';
            _this.name = 'BadRequest';
            _this.solutions = [];
            Object.setPrototypeOf(_this, ClientErrors.BadRequest.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return BadRequest;
    }(twilioError.default));
    ClientErrors.BadRequest = BadRequest;
    /**
     * Error received from the Twilio backend.
     */
    var NotFound = /** @class */ (function (_super) {
        tslib.__extends(NotFound, _super);
        /**
         * @internal
         */
        function NotFound(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The outbound call was made to an invalid phone number.',
                'The TwiML application sid is missing a Voice URL.',
            ];
            _this.code = 31404;
            _this.description = 'Not Found (HTTP/SIP)';
            _this.explanation = 'The server has not found anything matching the request.';
            _this.name = 'NotFound';
            _this.solutions = [
                'Ensure the phone number dialed is valid.',
                'Ensure the TwiML application is configured correctly with a Voice URL link.',
            ];
            Object.setPrototypeOf(_this, ClientErrors.NotFound.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return NotFound;
    }(twilioError.default));
    ClientErrors.NotFound = NotFound;
    /**
     * Error received from the Twilio backend.
     */
    var TemporarilyUnavailable = /** @class */ (function (_super) {
        tslib.__extends(TemporarilyUnavailable, _super);
        /**
         * @internal
         */
        function TemporarilyUnavailable(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31480;
            _this.description = 'Temporarily Unavailable (SIP)';
            _this.explanation = 'The callee is currently unavailable.';
            _this.name = 'TemporarilyUnavailable';
            _this.solutions = [];
            Object.setPrototypeOf(_this, ClientErrors.TemporarilyUnavailable.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return TemporarilyUnavailable;
    }(twilioError.default));
    ClientErrors.TemporarilyUnavailable = TemporarilyUnavailable;
    /**
     * Error received from the Twilio backend.
     */
    var BusyHere = /** @class */ (function (_super) {
        tslib.__extends(BusyHere, _super);
        /**
         * @internal
         */
        function BusyHere(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31486;
            _this.description = 'Busy Here (SIP)';
            _this.explanation = 'The callee is busy.';
            _this.name = 'BusyHere';
            _this.solutions = [];
            Object.setPrototypeOf(_this, ClientErrors.BusyHere.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return BusyHere;
    }(twilioError.default));
    ClientErrors.BusyHere = BusyHere;
})(exports.ClientErrors || (exports.ClientErrors = {}));
exports.SIPServerErrors = void 0;
(function (SIPServerErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var Decline = /** @class */ (function (_super) {
        tslib.__extends(Decline, _super);
        /**
         * @internal
         */
        function Decline(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31603;
            _this.description = 'Decline (SIP)';
            _this.explanation = 'The callee does not wish to participate in the call.';
            _this.name = 'Decline';
            _this.solutions = [];
            Object.setPrototypeOf(_this, SIPServerErrors.Decline.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return Decline;
    }(twilioError.default));
    SIPServerErrors.Decline = Decline;
})(exports.SIPServerErrors || (exports.SIPServerErrors = {}));
exports.GeneralErrors = void 0;
(function (GeneralErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var UnknownError = /** @class */ (function (_super) {
        tslib.__extends(UnknownError, _super);
        /**
         * @internal
         */
        function UnknownError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31000;
            _this.description = 'Unknown Error';
            _this.explanation = 'An unknown error has occurred. See error details for more information.';
            _this.name = 'UnknownError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, GeneralErrors.UnknownError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return UnknownError;
    }(twilioError.default));
    GeneralErrors.UnknownError = UnknownError;
    /**
     * Error received from the Twilio backend.
     */
    var ApplicationNotFoundError = /** @class */ (function (_super) {
        tslib.__extends(ApplicationNotFoundError, _super);
        /**
         * @internal
         */
        function ApplicationNotFoundError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31001;
            _this.description = 'Application Not Found';
            _this.explanation = '';
            _this.name = 'ApplicationNotFoundError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, GeneralErrors.ApplicationNotFoundError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ApplicationNotFoundError;
    }(twilioError.default));
    GeneralErrors.ApplicationNotFoundError = ApplicationNotFoundError;
    /**
     * Error received from the Twilio backend.
     */
    var ConnectionDeclinedError = /** @class */ (function (_super) {
        tslib.__extends(ConnectionDeclinedError, _super);
        /**
         * @internal
         */
        function ConnectionDeclinedError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31002;
            _this.description = 'Connection Declined';
            _this.explanation = '';
            _this.name = 'ConnectionDeclinedError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, GeneralErrors.ConnectionDeclinedError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ConnectionDeclinedError;
    }(twilioError.default));
    GeneralErrors.ConnectionDeclinedError = ConnectionDeclinedError;
    /**
     * Error received from the Twilio backend.
     */
    var ConnectionTimeoutError = /** @class */ (function (_super) {
        tslib.__extends(ConnectionTimeoutError, _super);
        /**
         * @internal
         */
        function ConnectionTimeoutError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31003;
            _this.description = 'Connection Timeout';
            _this.explanation = 'The server could not produce a response within a suitable amount of time.';
            _this.name = 'ConnectionTimeoutError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, GeneralErrors.ConnectionTimeoutError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ConnectionTimeoutError;
    }(twilioError.default));
    GeneralErrors.ConnectionTimeoutError = ConnectionTimeoutError;
    /**
     * Error received from the Twilio backend.
     */
    var ConnectionError = /** @class */ (function (_super) {
        tslib.__extends(ConnectionError, _super);
        /**
         * @internal
         */
        function ConnectionError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31005;
            _this.description = 'Connection error';
            _this.explanation = 'A connection error occurred during the call';
            _this.name = 'ConnectionError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, GeneralErrors.ConnectionError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ConnectionError;
    }(twilioError.default));
    GeneralErrors.ConnectionError = ConnectionError;
    /**
     * Error received from the Twilio backend.
     */
    var CallCancelledError = /** @class */ (function (_super) {
        tslib.__extends(CallCancelledError, _super);
        /**
         * @internal
         */
        function CallCancelledError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The incoming call was cancelled because it was not answered in time or it was accepted/rejected by another application instance registered with the same identity.',
            ];
            _this.code = 31008;
            _this.description = 'Call cancelled';
            _this.explanation = 'Unable to answer because the call has ended';
            _this.name = 'CallCancelledError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, GeneralErrors.CallCancelledError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return CallCancelledError;
    }(twilioError.default));
    GeneralErrors.CallCancelledError = CallCancelledError;
    /**
     * Error received from the Twilio backend.
     */
    var TransportError = /** @class */ (function (_super) {
        tslib.__extends(TransportError, _super);
        /**
         * @internal
         */
        function TransportError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31009;
            _this.description = 'Transport error';
            _this.explanation = 'No transport available to send or receive messages';
            _this.name = 'TransportError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, GeneralErrors.TransportError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return TransportError;
    }(twilioError.default));
    GeneralErrors.TransportError = TransportError;
})(exports.GeneralErrors || (exports.GeneralErrors = {}));
exports.MalformedRequestErrors = void 0;
(function (MalformedRequestErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var MalformedRequestError = /** @class */ (function (_super) {
        tslib.__extends(MalformedRequestError, _super);
        /**
         * @internal
         */
        function MalformedRequestError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'Invalid content or MessageType passed to sendMessage method.',
            ];
            _this.code = 31100;
            _this.description = 'The request had malformed syntax.';
            _this.explanation = 'The request could not be understood due to malformed syntax.';
            _this.name = 'MalformedRequestError';
            _this.solutions = [
                'Ensure content and MessageType passed to sendMessage method are valid.',
            ];
            Object.setPrototypeOf(_this, MalformedRequestErrors.MalformedRequestError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return MalformedRequestError;
    }(twilioError.default));
    MalformedRequestErrors.MalformedRequestError = MalformedRequestError;
    /**
     * Error received from the Twilio backend.
     */
    var MissingParameterArrayError = /** @class */ (function (_super) {
        tslib.__extends(MissingParameterArrayError, _super);
        /**
         * @internal
         */
        function MissingParameterArrayError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31101;
            _this.description = 'Missing parameter array in request';
            _this.explanation = '';
            _this.name = 'MissingParameterArrayError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, MalformedRequestErrors.MissingParameterArrayError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return MissingParameterArrayError;
    }(twilioError.default));
    MalformedRequestErrors.MissingParameterArrayError = MissingParameterArrayError;
    /**
     * Error received from the Twilio backend.
     */
    var AuthorizationTokenMissingError = /** @class */ (function (_super) {
        tslib.__extends(AuthorizationTokenMissingError, _super);
        /**
         * @internal
         */
        function AuthorizationTokenMissingError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31102;
            _this.description = 'Authorization token missing in request.';
            _this.explanation = '';
            _this.name = 'AuthorizationTokenMissingError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, MalformedRequestErrors.AuthorizationTokenMissingError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return AuthorizationTokenMissingError;
    }(twilioError.default));
    MalformedRequestErrors.AuthorizationTokenMissingError = AuthorizationTokenMissingError;
    /**
     * Error received from the Twilio backend.
     */
    var MaxParameterLengthExceededError = /** @class */ (function (_super) {
        tslib.__extends(MaxParameterLengthExceededError, _super);
        /**
         * @internal
         */
        function MaxParameterLengthExceededError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31103;
            _this.description = 'Maximum parameter length has been exceeded.';
            _this.explanation = 'Length of parameters cannot exceed MAX_PARAM_LENGTH.';
            _this.name = 'MaxParameterLengthExceededError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, MalformedRequestErrors.MaxParameterLengthExceededError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return MaxParameterLengthExceededError;
    }(twilioError.default));
    MalformedRequestErrors.MaxParameterLengthExceededError = MaxParameterLengthExceededError;
    /**
     * Error received from the Twilio backend.
     */
    var InvalidBridgeTokenError = /** @class */ (function (_super) {
        tslib.__extends(InvalidBridgeTokenError, _super);
        /**
         * @internal
         */
        function InvalidBridgeTokenError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31104;
            _this.description = 'Invalid bridge token';
            _this.explanation = '';
            _this.name = 'InvalidBridgeTokenError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, MalformedRequestErrors.InvalidBridgeTokenError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return InvalidBridgeTokenError;
    }(twilioError.default));
    MalformedRequestErrors.InvalidBridgeTokenError = InvalidBridgeTokenError;
    /**
     * Error received from the Twilio backend.
     */
    var InvalidClientNameError = /** @class */ (function (_super) {
        tslib.__extends(InvalidClientNameError, _super);
        /**
         * @internal
         */
        function InvalidClientNameError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'Client name contains invalid characters.',
            ];
            _this.code = 31105;
            _this.description = 'Invalid client name';
            _this.explanation = 'Client name should not contain control, space, delims, or unwise characters.';
            _this.name = 'InvalidClientNameError';
            _this.solutions = [
                'Make sure that client name does not contain any of the invalid characters.',
            ];
            Object.setPrototypeOf(_this, MalformedRequestErrors.InvalidClientNameError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return InvalidClientNameError;
    }(twilioError.default));
    MalformedRequestErrors.InvalidClientNameError = InvalidClientNameError;
    /**
     * Error received from the Twilio backend.
     */
    var ReconnectParameterInvalidError = /** @class */ (function (_super) {
        tslib.__extends(ReconnectParameterInvalidError, _super);
        /**
         * @internal
         */
        function ReconnectParameterInvalidError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31107;
            _this.description = 'The reconnect parameter is invalid';
            _this.explanation = '';
            _this.name = 'ReconnectParameterInvalidError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, MalformedRequestErrors.ReconnectParameterInvalidError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ReconnectParameterInvalidError;
    }(twilioError.default));
    MalformedRequestErrors.ReconnectParameterInvalidError = ReconnectParameterInvalidError;
})(exports.MalformedRequestErrors || (exports.MalformedRequestErrors = {}));
(function (AuthorizationErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var AuthorizationError = /** @class */ (function (_super) {
        tslib.__extends(AuthorizationError, _super);
        /**
         * @internal
         */
        function AuthorizationError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31201;
            _this.description = 'Authorization error';
            _this.explanation = 'The request requires user authentication. The server understood the request, but is refusing to fulfill it.';
            _this.name = 'AuthorizationError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, AuthorizationErrors.AuthorizationError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return AuthorizationError;
    }(twilioError.default));
    AuthorizationErrors.AuthorizationError = AuthorizationError;
    /**
     * Error received from the Twilio backend.
     */
    var NoValidAccountError = /** @class */ (function (_super) {
        tslib.__extends(NoValidAccountError, _super);
        /**
         * @internal
         */
        function NoValidAccountError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31203;
            _this.description = 'No valid account';
            _this.explanation = '';
            _this.name = 'NoValidAccountError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, AuthorizationErrors.NoValidAccountError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return NoValidAccountError;
    }(twilioError.default));
    AuthorizationErrors.NoValidAccountError = NoValidAccountError;
    /**
     * Error received from the Twilio backend.
     */
    var InvalidJWTTokenError = /** @class */ (function (_super) {
        tslib.__extends(InvalidJWTTokenError, _super);
        /**
         * @internal
         */
        function InvalidJWTTokenError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31204;
            _this.description = 'Invalid JWT token';
            _this.explanation = '';
            _this.name = 'InvalidJWTTokenError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, AuthorizationErrors.InvalidJWTTokenError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return InvalidJWTTokenError;
    }(twilioError.default));
    AuthorizationErrors.InvalidJWTTokenError = InvalidJWTTokenError;
    /**
     * Error received from the Twilio backend.
     */
    var JWTTokenExpiredError = /** @class */ (function (_super) {
        tslib.__extends(JWTTokenExpiredError, _super);
        /**
         * @internal
         */
        function JWTTokenExpiredError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31205;
            _this.description = 'JWT token expired';
            _this.explanation = '';
            _this.name = 'JWTTokenExpiredError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, AuthorizationErrors.JWTTokenExpiredError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return JWTTokenExpiredError;
    }(twilioError.default));
    AuthorizationErrors.JWTTokenExpiredError = JWTTokenExpiredError;
    /**
     * Error received from the Twilio backend.
     */
    var RateExceededError = /** @class */ (function (_super) {
        tslib.__extends(RateExceededError, _super);
        /**
         * @internal
         */
        function RateExceededError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'Rate limit exceeded.',
            ];
            _this.code = 31206;
            _this.description = 'Rate exceeded authorized limit.';
            _this.explanation = 'The request performed exceeds the authorized limit.';
            _this.name = 'RateExceededError';
            _this.solutions = [
                'Ensure message send rate does not exceed authorized limits.',
            ];
            Object.setPrototypeOf(_this, AuthorizationErrors.RateExceededError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return RateExceededError;
    }(twilioError.default));
    AuthorizationErrors.RateExceededError = RateExceededError;
    /**
     * Error received from the Twilio backend.
     */
    var JWTTokenExpirationTooLongError = /** @class */ (function (_super) {
        tslib.__extends(JWTTokenExpirationTooLongError, _super);
        /**
         * @internal
         */
        function JWTTokenExpirationTooLongError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31207;
            _this.description = 'JWT token expiration too long';
            _this.explanation = '';
            _this.name = 'JWTTokenExpirationTooLongError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, AuthorizationErrors.JWTTokenExpirationTooLongError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return JWTTokenExpirationTooLongError;
    }(twilioError.default));
    AuthorizationErrors.JWTTokenExpirationTooLongError = JWTTokenExpirationTooLongError;
    /**
     * Error received from the Twilio backend.
     */
    var ReconnectAttemptError = /** @class */ (function (_super) {
        tslib.__extends(ReconnectAttemptError, _super);
        /**
         * @internal
         */
        function ReconnectAttemptError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 31209;
            _this.description = 'Reconnect attempt is not authorized.';
            _this.explanation = '';
            _this.name = 'ReconnectAttemptError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, AuthorizationErrors.ReconnectAttemptError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ReconnectAttemptError;
    }(twilioError.default));
    AuthorizationErrors.ReconnectAttemptError = ReconnectAttemptError;
    /**
     * Error received from the Twilio backend.
     */
    var CallMessageEventTypeInvalidError = /** @class */ (function (_super) {
        tslib.__extends(CallMessageEventTypeInvalidError, _super);
        /**
         * @internal
         */
        function CallMessageEventTypeInvalidError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The Call Message Event Type is invalid and is not understood by Twilio Voice.',
            ];
            _this.code = 31210;
            _this.description = 'Call Message Event Type is invalid.';
            _this.explanation = 'The Call Message Event Type is invalid and is not understood by Twilio Voice.';
            _this.name = 'CallMessageEventTypeInvalidError';
            _this.solutions = [
                'Ensure the Call Message Event Type is Valid and understood by Twilio Voice and try again.',
            ];
            Object.setPrototypeOf(_this, AuthorizationErrors.CallMessageEventTypeInvalidError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return CallMessageEventTypeInvalidError;
    }(twilioError.default));
    AuthorizationErrors.CallMessageEventTypeInvalidError = CallMessageEventTypeInvalidError;
    /**
     * Error received from the Twilio backend.
     */
    var PayloadSizeExceededError = /** @class */ (function (_super) {
        tslib.__extends(PayloadSizeExceededError, _super);
        /**
         * @internal
         */
        function PayloadSizeExceededError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The payload size of Call Message Event exceeds the authorized limit.',
            ];
            _this.code = 31212;
            _this.description = 'Call Message Event Payload size exceeded authorized limit.';
            _this.explanation = 'The request performed to send a Call Message Event exceeds the payload size authorized limit';
            _this.name = 'PayloadSizeExceededError';
            _this.solutions = [
                'Reduce payload size of Call Message Event to be within the authorized limit and try again.',
            ];
            Object.setPrototypeOf(_this, AuthorizationErrors.PayloadSizeExceededError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return PayloadSizeExceededError;
    }(twilioError.default));
    AuthorizationErrors.PayloadSizeExceededError = PayloadSizeExceededError;
})(exports.AuthorizationErrors || (exports.AuthorizationErrors = {}));
exports.UserMediaErrors = void 0;
(function (UserMediaErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var PermissionDeniedError = /** @class */ (function (_super) {
        tslib.__extends(PermissionDeniedError, _super);
        /**
         * @internal
         */
        function PermissionDeniedError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The user denied the getUserMedia request.',
                'The browser denied the getUserMedia request.',
            ];
            _this.code = 31401;
            _this.description = 'UserMedia Permission Denied Error';
            _this.explanation = 'The browser or end-user denied permissions to user media. Therefore we were unable to acquire input audio.';
            _this.name = 'PermissionDeniedError';
            _this.solutions = [
                'The user should accept the request next time prompted. If the browser saved the deny, the user should change that permission in their browser.',
                'The user should to verify that the browser has permission to access the microphone at this address.',
            ];
            Object.setPrototypeOf(_this, UserMediaErrors.PermissionDeniedError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return PermissionDeniedError;
    }(twilioError.default));
    UserMediaErrors.PermissionDeniedError = PermissionDeniedError;
    /**
     * Error received from the Twilio backend.
     */
    var AcquisitionFailedError = /** @class */ (function (_super) {
        tslib.__extends(AcquisitionFailedError, _super);
        /**
         * @internal
         */
        function AcquisitionFailedError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'NotFoundError - The deviceID specified was not found.',
                'The getUserMedia constraints were overconstrained and no devices matched.',
            ];
            _this.code = 31402;
            _this.description = 'UserMedia Acquisition Failed Error';
            _this.explanation = 'The browser and end-user allowed permissions, however getting the media failed. Usually this is due to bad constraints, but can sometimes fail due to browser, OS or hardware issues.';
            _this.name = 'AcquisitionFailedError';
            _this.solutions = [
                'Ensure the deviceID being specified exists.',
                'Try acquiring media with fewer constraints.',
            ];
            Object.setPrototypeOf(_this, UserMediaErrors.AcquisitionFailedError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return AcquisitionFailedError;
    }(twilioError.default));
    UserMediaErrors.AcquisitionFailedError = AcquisitionFailedError;
})(exports.UserMediaErrors || (exports.UserMediaErrors = {}));
exports.SignalingErrors = void 0;
(function (SignalingErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var ConnectionError = /** @class */ (function (_super) {
        tslib.__extends(ConnectionError, _super);
        /**
         * @internal
         */
        function ConnectionError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [];
            _this.code = 53000;
            _this.description = 'Signaling connection error';
            _this.explanation = 'Raised whenever a signaling connection error occurs that is not covered by a more specific error code.';
            _this.name = 'ConnectionError';
            _this.solutions = [];
            Object.setPrototypeOf(_this, SignalingErrors.ConnectionError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ConnectionError;
    }(twilioError.default));
    SignalingErrors.ConnectionError = ConnectionError;
    /**
     * Error received from the Twilio backend.
     */
    var ConnectionDisconnected = /** @class */ (function (_super) {
        tslib.__extends(ConnectionDisconnected, _super);
        /**
         * @internal
         */
        function ConnectionDisconnected(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The device running your application lost its Internet connection.',
            ];
            _this.code = 53001;
            _this.description = 'Signaling connection disconnected';
            _this.explanation = 'Raised whenever the signaling connection is unexpectedly disconnected.';
            _this.name = 'ConnectionDisconnected';
            _this.solutions = [
                'Ensure the device running your application has access to a stable Internet connection.',
            ];
            Object.setPrototypeOf(_this, SignalingErrors.ConnectionDisconnected.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ConnectionDisconnected;
    }(twilioError.default));
    SignalingErrors.ConnectionDisconnected = ConnectionDisconnected;
})(exports.SignalingErrors || (exports.SignalingErrors = {}));
exports.MediaErrors = void 0;
(function (MediaErrors) {
    /**
     * Error received from the Twilio backend.
     */
    var ClientLocalDescFailed = /** @class */ (function (_super) {
        tslib.__extends(ClientLocalDescFailed, _super);
        /**
         * @internal
         */
        function ClientLocalDescFailed(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The Client may not be using a supported WebRTC implementation.',
                'The Client may not have the necessary resources to create or apply a new media description.',
            ];
            _this.code = 53400;
            _this.description = 'Client is unable to create or apply a local media description';
            _this.explanation = 'Raised whenever a Client is unable to create or apply a local media description.';
            _this.name = 'ClientLocalDescFailed';
            _this.solutions = [
                'If you are experiencing this error using the JavaScript SDK, ensure you are running it with a supported WebRTC implementation.',
            ];
            Object.setPrototypeOf(_this, MediaErrors.ClientLocalDescFailed.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ClientLocalDescFailed;
    }(twilioError.default));
    MediaErrors.ClientLocalDescFailed = ClientLocalDescFailed;
    /**
     * Error received from the Twilio backend.
     */
    var ClientRemoteDescFailed = /** @class */ (function (_super) {
        tslib.__extends(ClientRemoteDescFailed, _super);
        /**
         * @internal
         */
        function ClientRemoteDescFailed(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The Client may not be using a supported WebRTC implementation.',
                'The Client may be connecting peer-to-peer with another Participant that is not using a supported WebRTC implementation.',
                'The Client may not have the necessary resources to apply a new media description.',
            ];
            _this.code = 53402;
            _this.description = 'Client is unable to apply a remote media description';
            _this.explanation = 'Raised whenever the Client receives a remote media description but is unable to apply it.';
            _this.name = 'ClientRemoteDescFailed';
            _this.solutions = [
                'If you are experiencing this error using the JavaScript SDK, ensure you are running it with a supported WebRTC implementation.',
            ];
            Object.setPrototypeOf(_this, MediaErrors.ClientRemoteDescFailed.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ClientRemoteDescFailed;
    }(twilioError.default));
    MediaErrors.ClientRemoteDescFailed = ClientRemoteDescFailed;
    /**
     * Error received from the Twilio backend.
     */
    var ConnectionError = /** @class */ (function (_super) {
        tslib.__extends(ConnectionError, _super);
        /**
         * @internal
         */
        function ConnectionError(messageOrError, error) {
            var _this = _super.call(this, messageOrError, error) || this;
            _this.causes = [
                'The Client was unable to establish a media connection.',
                'A media connection which was active failed liveliness checks.',
            ];
            _this.code = 53405;
            _this.description = 'Media connection failed';
            _this.explanation = 'Raised by the Client or Server whenever a media connection fails.';
            _this.name = 'ConnectionError';
            _this.solutions = [
                'If the problem persists, try connecting to another region.',
                'Check your Client\'s network connectivity.',
                'If you\'ve provided custom ICE Servers then ensure that the URLs and credentials are valid.',
            ];
            Object.setPrototypeOf(_this, MediaErrors.ConnectionError.prototype);
            var message = typeof messageOrError === 'string'
                ? messageOrError
                : _this.explanation;
            var originalError = typeof messageOrError === 'object'
                ? messageOrError
                : error;
            _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
            _this.originalError = originalError;
            return _this;
        }
        return ConnectionError;
    }(twilioError.default));
    MediaErrors.ConnectionError = ConnectionError;
})(exports.MediaErrors || (exports.MediaErrors = {}));
/**
 * @private
 */
var errorsByCode = new Map([
    [20101, exports.AuthorizationErrors.AccessTokenInvalid],
    [20104, exports.AuthorizationErrors.AccessTokenExpired],
    [20151, exports.AuthorizationErrors.AuthenticationFailed],
    [31202, exports.SignatureValidationErrors.AccessTokenSignatureValidationFailed],
    [31400, exports.ClientErrors.BadRequest],
    [31404, exports.ClientErrors.NotFound],
    [31480, exports.ClientErrors.TemporarilyUnavailable],
    [31486, exports.ClientErrors.BusyHere],
    [31603, exports.SIPServerErrors.Decline],
    [31000, exports.GeneralErrors.UnknownError],
    [31001, exports.GeneralErrors.ApplicationNotFoundError],
    [31002, exports.GeneralErrors.ConnectionDeclinedError],
    [31003, exports.GeneralErrors.ConnectionTimeoutError],
    [31005, exports.GeneralErrors.ConnectionError],
    [31008, exports.GeneralErrors.CallCancelledError],
    [31009, exports.GeneralErrors.TransportError],
    [31100, exports.MalformedRequestErrors.MalformedRequestError],
    [31101, exports.MalformedRequestErrors.MissingParameterArrayError],
    [31102, exports.MalformedRequestErrors.AuthorizationTokenMissingError],
    [31103, exports.MalformedRequestErrors.MaxParameterLengthExceededError],
    [31104, exports.MalformedRequestErrors.InvalidBridgeTokenError],
    [31105, exports.MalformedRequestErrors.InvalidClientNameError],
    [31107, exports.MalformedRequestErrors.ReconnectParameterInvalidError],
    [31201, exports.AuthorizationErrors.AuthorizationError],
    [31203, exports.AuthorizationErrors.NoValidAccountError],
    [31204, exports.AuthorizationErrors.InvalidJWTTokenError],
    [31205, exports.AuthorizationErrors.JWTTokenExpiredError],
    [31206, exports.AuthorizationErrors.RateExceededError],
    [31207, exports.AuthorizationErrors.JWTTokenExpirationTooLongError],
    [31209, exports.AuthorizationErrors.ReconnectAttemptError],
    [31210, exports.AuthorizationErrors.CallMessageEventTypeInvalidError],
    [31212, exports.AuthorizationErrors.PayloadSizeExceededError],
    [31401, exports.UserMediaErrors.PermissionDeniedError],
    [31402, exports.UserMediaErrors.AcquisitionFailedError],
    [53000, exports.SignalingErrors.ConnectionError],
    [53001, exports.SignalingErrors.ConnectionDisconnected],
    [53400, exports.MediaErrors.ClientLocalDescFailed],
    [53402, exports.MediaErrors.ClientRemoteDescFailed],
    [53405, exports.MediaErrors.ConnectionError],
]);
Object.freeze(errorsByCode);

exports.TwilioError = twilioError.default;
exports.errorsByCode = errorsByCode;


},{"./twilioError.js":16,"tslib":41}],15:[function(require,module,exports){
'use strict';

var tslib = require('tslib');
var generated = require('./generated.js');
var twilioError = require('./twilioError.js');

/* tslint:disable max-classes-per-file */
/**
 * NOTE(mhuynh): Replacing generic error codes with new (more specific) codes,
 * is a breaking change. If an error code is found in this set, we only perform
 * the transformation if the feature flag is enabled.
 *
 * With every major version bump, such that we are allowed to introduce breaking
 * changes as per semver specification, this array should be cleared.
 *
 * TODO: [VBLOCKS-2295] Remove this in 3.x
 */
var PRECISE_SIGNALING_ERROR_CODES = new Set([
    /**
     * 310XX Errors
     */
    31001,
    31002,
    31003,
    /**
     * 311XX Errors
     */
    31101,
    31102,
    31103,
    31104,
    31105,
    31107,
    /**
     * 312XX Errors
     */
    31201,
    31202,
    31203,
    31204,
    31205,
    31207,
    /**
     * 314XX Errors
     */
    31404,
    31480,
    31486,
    /**
     * 316XX Errors
     */
    31603,
]);
/**
 * Get an error constructor using the [[PRECISE_SIGNALING_ERROR_CODES]] set.
 * @internal
 * @param enableImprovedSignalingErrorPrecision - A boolean representing the
 * optional flag whether or not to use more precise error codes.
 * @param errorCode - The error code.
 * @returns This function returns `undefined` if the passed error code does not
 * correlate to an error or should not be constructed with a more precise error
 * constructor. A sub-class of {@link TwilioError} if the code does correlate to
 * an error.
 */
function getPreciseSignalingErrorByCode(enableImprovedSignalingErrorPrecision, errorCode) {
    if (typeof errorCode !== 'number') {
        return;
    }
    if (!hasErrorByCode(errorCode)) {
        return;
    }
    var shouldTransform = enableImprovedSignalingErrorPrecision
        ? true
        : !PRECISE_SIGNALING_ERROR_CODES.has(errorCode);
    if (!shouldTransform) {
        return;
    }
    return getErrorByCode(errorCode);
}
/**
 * The error that is thrown when an invalid argument is passed to a library API.
 */
var InvalidArgumentError = /** @class */ (function (_super) {
    tslib.__extends(InvalidArgumentError, _super);
    /**
     * @internal
     */
    function InvalidArgumentError(message) {
        var _this = _super.call(this, message) || this;
        _this.name = 'InvalidArgumentError';
        return _this;
    }
    return InvalidArgumentError;
}(Error));
/**
 * The error that is thrown when the library has entered an invalid state.
 */
var InvalidStateError = /** @class */ (function (_super) {
    tslib.__extends(InvalidStateError, _super);
    /**
     * @internal
     */
    function InvalidStateError(message) {
        var _this = _super.call(this, message) || this;
        _this.name = 'InvalidStateError';
        return _this;
    }
    return InvalidStateError;
}(Error));
/**
 * The error that is thrown when an attempt is made to use an API that is not
 * supported on the current platform.
 */
var NotSupportedError = /** @class */ (function (_super) {
    tslib.__extends(NotSupportedError, _super);
    /**
     * @internal
     */
    function NotSupportedError(message) {
        var _this = _super.call(this, message) || this;
        _this.name = 'NotSupportedError';
        return _this;
    }
    return NotSupportedError;
}(Error));
/**
 * This should only be used to look up error codes returned by a server
 * using the same repo of error codes.
 * @internal
 */
function getErrorByCode(code) {
    var error = generated.errorsByCode.get(code);
    if (!error) {
        throw new InvalidArgumentError("Error code ".concat(code, " not found"));
    }
    return error;
}
/**
 * This should only be used to look up error codes returned by a server
 * using the same repo of error codes.
 * @internal
 */
function hasErrorByCode(code) {
    return generated.errorsByCode.has(code);
}

Object.defineProperty(exports, "AuthorizationErrors", {
    enumerable: true,
    get: function () { return generated.AuthorizationErrors; }
});
Object.defineProperty(exports, "ClientErrors", {
    enumerable: true,
    get: function () { return generated.ClientErrors; }
});
Object.defineProperty(exports, "GeneralErrors", {
    enumerable: true,
    get: function () { return generated.GeneralErrors; }
});
Object.defineProperty(exports, "MalformedRequestErrors", {
    enumerable: true,
    get: function () { return generated.MalformedRequestErrors; }
});
Object.defineProperty(exports, "MediaErrors", {
    enumerable: true,
    get: function () { return generated.MediaErrors; }
});
Object.defineProperty(exports, "SIPServerErrors", {
    enumerable: true,
    get: function () { return generated.SIPServerErrors; }
});
Object.defineProperty(exports, "SignalingErrors", {
    enumerable: true,
    get: function () { return generated.SignalingErrors; }
});
Object.defineProperty(exports, "SignatureValidationErrors", {
    enumerable: true,
    get: function () { return generated.SignatureValidationErrors; }
});
Object.defineProperty(exports, "UserMediaErrors", {
    enumerable: true,
    get: function () { return generated.UserMediaErrors; }
});
exports.TwilioError = twilioError.default;
exports.InvalidArgumentError = InvalidArgumentError;
exports.InvalidStateError = InvalidStateError;
exports.NotSupportedError = NotSupportedError;
exports.getErrorByCode = getErrorByCode;
exports.getPreciseSignalingErrorByCode = getPreciseSignalingErrorByCode;
exports.hasErrorByCode = hasErrorByCode;


},{"./generated.js":14,"./twilioError.js":16,"tslib":41}],16:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');

/**
 * Base class for all possible errors that the library can receive from the
 * Twilio backend.
 */
var TwilioError = /** @class */ (function (_super) {
    tslib.__extends(TwilioError, _super);
    /**
     * @internal
     */
    function TwilioError(messageOrError, error) {
        var _this = _super.call(this) || this;
        Object.setPrototypeOf(_this, TwilioError.prototype);
        var message = typeof messageOrError === 'string'
            ? messageOrError
            : _this.explanation;
        var originalError = typeof messageOrError === 'object'
            ? messageOrError
            : error;
        _this.message = "".concat(_this.name, " (").concat(_this.code, "): ").concat(message);
        _this.originalError = originalError;
        return _this;
    }
    return TwilioError;
}(Error));

exports.default = TwilioError;


},{"tslib":41}],17:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var events = require('events');
var log = require('./log.js');
var request = require('./request.js');

/**
 * Builds Endpoint Analytics (EA) event payloads and sends them to
 *   the EA server.
 * @constructor
 * @param {String} productName - Name of the product publishing events.
 * @param {String} token - The JWT token to use to authenticate with
 *   the EA server.
 * @param {EventPublisher.Options} options
 * @property {Boolean} isEnabled - Whether or not this publisher is publishing
 *   to the server. Currently ignores the request altogether, in the future this
 *   may store them in case publishing is re-enabled later. Defaults to true.
 */
/**
 * @typedef {Object} EventPublisher.Options
 * @property {Object} [metadata=undefined] - A publisher_metadata object to send
 *   with each payload.
 * @property {String} [host='eventgw.twilio.com'] - The host address of the EA
 *   server to publish to.
 * @property {Object|Function} [defaultPayload] - A default payload to extend
 *   when creating and sending event payloads. Also takes a function that
 *   should return an object representing the default payload. This is
 *   useful for fields that should always be present when they are
 *   available, but are not always available.
 */
var EventPublisher = /** @class */ (function (_super) {
    tslib.__extends(EventPublisher, _super);
    function EventPublisher(productName, token, options) {
        var _this = _super.call(this) || this;
        if (!(_this instanceof EventPublisher)) {
            return new EventPublisher(productName, token, options);
        }
        // Apply default options
        options = Object.assign({ defaultPayload: function () { return {}; } }, options);
        var defaultPayload = options.defaultPayload;
        if (typeof defaultPayload !== 'function') {
            defaultPayload = function () { return Object.assign({}, options.defaultPayload); };
        }
        var isEnabled = true;
        var metadata = Object.assign({ app_name: undefined, app_version: undefined }, options.metadata);
        Object.defineProperties(_this, {
            _defaultPayload: { value: defaultPayload },
            _host: { value: options.host, writable: true },
            _isEnabled: {
                get: function () { return isEnabled; },
                set: function (_isEnabled) { isEnabled = _isEnabled; },
            },
            _log: { value: new log.default('EventPublisher') },
            _request: { value: options.request || request.default, writable: true },
            _token: { value: token, writable: true },
            isEnabled: {
                enumerable: true,
                get: function () { return isEnabled; },
            },
            metadata: {
                enumerable: true,
                get: function () { return metadata; },
            },
            productName: { enumerable: true, value: productName },
            token: {
                enumerable: true,
                get: function () { return this._token; },
            },
        });
        return _this;
    }
    return EventPublisher;
}(events.EventEmitter));
/**
 * Post to an EA server.
 * @private
 * @param {String} endpointName - Endpoint to post the event to
 * @param {String} level - ['debug', 'info', 'warning', 'error']
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {?Object} [payload=null] - The payload to pass. This will be extended
 *    onto the default payload object, if one exists.
 * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
 * @param {?Boolean} [force=false] - Whether or not to send this even if
 *    publishing is disabled.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype._post = function _post(endpointName, level, group, name, payload, connection, force) {
    var _this = this;
    if ((!this.isEnabled && !force) || !this._host) {
        this._log.debug('Publishing cancelled', JSON.stringify({ isEnabled: this.isEnabled, force: force, host: this._host }));
        return Promise.resolve();
    }
    if (!connection || ((!connection.parameters || !connection.parameters.CallSid) && !connection.outboundConnectionId)) {
        if (!connection) {
            this._log.debug('Publishing cancelled. Missing connection object');
        }
        else {
            this._log.debug('Publishing cancelled. Missing connection info', JSON.stringify({
                outboundConnectionId: connection.outboundConnectionId, parameters: connection.parameters,
            }));
        }
        return Promise.resolve();
    }
    var event = {
        group: group,
        level: level.toUpperCase(),
        name: name,
        payload: (payload && payload.forEach) ?
            payload.slice(0) : Object.assign(this._defaultPayload(connection), payload),
        payload_type: 'application/json',
        private: false,
        publisher: this.productName,
        timestamp: (new Date()).toISOString(),
    };
    if (this.metadata) {
        event.publisher_metadata = this.metadata;
    }
    if (endpointName === 'EndpointEvents') {
        this._log.debug('Publishing insights', JSON.stringify({ endpointName: endpointName, event: event, force: force, host: this._host }));
    }
    var requestParams = {
        body: event,
        headers: {
            'Content-Type': 'application/json',
            'X-Twilio-Token': this.token,
        },
        url: "https://".concat(this._host, "/v4/").concat(endpointName),
    };
    return new Promise(function (resolve, reject) {
        _this._request.post(requestParams, function (err) {
            if (err) {
                _this.emit('error', err);
                reject(err);
            }
            else {
                resolve();
            }
        });
    }).catch(function (e) {
        _this._log.error("Unable to post ".concat(group, " ").concat(name, " event to Insights. Received error: ").concat(e));
    });
};
/**
 * Post an event to the EA server. Use this method when the level
 *  is dynamic. Otherwise, it's better practice to use the sugar
 *  methods named for the specific level.
 * @param {String} level - ['debug', 'info', 'warning', 'error']
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {?Object} [payload=null] - The payload to pass. This will be extended
 *    onto the default payload object, if one exists.
 * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype.post = function post(level, group, name, payload, connection, force) {
    return this._post('EndpointEvents', level, group, name, payload, connection, force);
};
/**
 * Post a debug-level event to the EA server.
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {?Object} [payload=null] - The payload to pass. This will be extended
 *    onto the default payload object, if one exists.
 * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype.debug = function debug(group, name, payload, connection) {
    return this.post('debug', group, name, payload, connection);
};
/**
 * Post an info-level event to the EA server.
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {?Object} [payload=null] - The payload to pass. This will be extended
 *    onto the default payload object, if one exists.
 * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype.info = function info(group, name, payload, connection) {
    return this.post('info', group, name, payload, connection);
};
/**
 * Post a warning-level event to the EA server.
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {?Object} [payload=null] - The payload to pass. This will be extended
 *    onto the default payload object, if one exists.
 * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype.warn = function warn(group, name, payload, connection) {
    return this.post('warning', group, name, payload, connection);
};
/**
 * Post an error-level event to the EA server.
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {?Object} [payload=null] - The payload to pass. This will be extended
 *    onto the default payload object, if one exists.
 * @param {?Connection} [connection=null] - The {@link Connection} which is posting this payload.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype.error = function error(group, name, payload, connection) {
    return this.post('error', group, name, payload, connection);
};
/**
 * Post a metrics event to the EA server.
 * @param {String} group - The name of the group the event belongs to.
 * @param {String} name - The designated event name.
 * @param {Array<Object>} metrics - The metrics to post.
 * @param {?Object} [customFields] - Custom fields to append to each payload.
 * @returns {Promise} Fulfilled if the HTTP response is 20x.
 */
EventPublisher.prototype.postMetrics = function postMetrics(group, name, metrics, customFields, connection) {
    var _this = this;
    return new Promise(function (resolve) {
        var samples = metrics
            .map(formatMetric)
            .map(function (sample) { return Object.assign(sample, customFields); });
        resolve(_this._post('EndpointMetrics', 'info', group, name, samples, connection));
    });
};
/**
 * Update the host address of the insights server to publish to.
 * @param {String} host - The new host address of the insights server.
 */
EventPublisher.prototype.setHost = function setHost(host) {
    this._host = host;
};
/**
 * Update the token to use to authenticate requests.
 * @param {string} token
 * @returns {void}
 */
EventPublisher.prototype.setToken = function setToken(token) {
    this._token = token;
};
/**
 * Enable the publishing of events.
 */
EventPublisher.prototype.enable = function enable() {
    this._isEnabled = true;
};
/**
 * Disable the publishing of events.
 */
EventPublisher.prototype.disable = function disable() {
    this._isEnabled = false;
};
function formatMetric(sample) {
    return {
        audio_codec: sample.codecName,
        audio_level_in: sample.audioInputLevel,
        audio_level_out: sample.audioOutputLevel,
        bytes_received: sample.bytesReceived,
        bytes_sent: sample.bytesSent,
        call_volume_input: sample.inputVolume,
        call_volume_output: sample.outputVolume,
        jitter: sample.jitter,
        mos: sample.mos && (Math.round(sample.mos * 100) / 100),
        packets_lost: sample.packetsLost,
        packets_lost_fraction: sample.packetsLostFraction &&
            (Math.round(sample.packetsLostFraction * 100) / 100),
        packets_received: sample.packetsReceived,
        rtt: sample.rtt,
        timestamp: (new Date(sample.timestamp)).toISOString(),
        total_bytes_received: sample.totals.bytesReceived,
        total_bytes_sent: sample.totals.bytesSent,
        total_packets_lost: sample.totals.packetsLost,
        total_packets_received: sample.totals.packetsReceived,
        total_packets_sent: sample.totals.packetsSent,
    };
}

exports.default = EventPublisher;


},{"./log.js":18,"./request.js":23,"events":39,"tslib":41}],18:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var loglevel = require('loglevel');
var constants = require('./constants.js');

/**
 * {@link Log} provides logging features throughout the sdk using loglevel module
 * See https://github.com/pimterry/loglevel for documentation
 * @private
 */
var Log = /** @class */ (function () {
    /**
     * @constructor
     * @param [tag] - tag name for the logs
     * @param [options] - Optional settings
     */
    function Log(tag, options) {
        this._log = Log.getLogLevelInstance(options);
        this._prefix = "[TwilioVoice][".concat(tag, "]");
    }
    /**
     * Return the `loglevel` instance maintained internally.
     * @param [options] - Optional settings
     * @returns The `loglevel` instance.
     */
    Log.getLogLevelInstance = function (options) {
        if (!Log.loglevelInstance) {
            try {
                Log.loglevelInstance = (options && options.LogLevelModule ? options.LogLevelModule : loglevel).getLogger(constants.PACKAGE_NAME);
            }
            catch (_a) {
                // tslint:disable-next-line
                console.warn('Cannot create custom logger');
                Log.loglevelInstance = console;
            }
        }
        return Log.loglevelInstance;
    };
    /**
     * Log a debug message
     * @param args - Any number of arguments to be passed to loglevel.debug
     */
    Log.prototype.debug = function () {
        var _a;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        (_a = this._log).debug.apply(_a, tslib.__spreadArray([this._prefix], args, false));
    };
    /**
     * Log an error message
     * @param args - Any number of arguments to be passed to loglevel.error
     */
    Log.prototype.error = function () {
        var _a;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        (_a = this._log).error.apply(_a, tslib.__spreadArray([this._prefix], args, false));
    };
    /**
     * Log an info message
     * @param args - Any number of arguments to be passed to loglevel.info
     */
    Log.prototype.info = function () {
        var _a;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        (_a = this._log).info.apply(_a, tslib.__spreadArray([this._prefix], args, false));
    };
    /**
     * Set a default log level to disable all logging below the given level
     */
    Log.prototype.setDefaultLevel = function (level) {
        if (this._log.setDefaultLevel) {
            this._log.setDefaultLevel(level);
        }
        else {
            // tslint:disable-next-line
            console.warn('Logger cannot setDefaultLevel');
        }
    };
    /**
     * Log a warning message
     * @param args - Any number of arguments to be passed to loglevel.warn
     */
    Log.prototype.warn = function () {
        var _a;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        (_a = this._log).warn.apply(_a, tslib.__spreadArray([this._prefix], args, false));
    };
    /**
     * Log levels
     */
    Log.levels = loglevel.levels;
    return Log;
}());
var Logger = Log.getLogLevelInstance();

exports.Logger = Logger;
exports.default = Log;


},{"./constants.js":10,"loglevel":40,"tslib":41}],19:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var constants = require('./constants.js');
var index = require('./errors/index.js');
var log = require('./log.js');

var DEFAULT_TEST_SOUND_URL = "".concat(constants.SOUNDS_BASE_URL, "/outgoing.mp3");
/**
 * A smart collection containing a Set of active output devices.
 */
var OutputDeviceCollection = /** @class */ (function () {
    /**
     * @internal
     */
    function OutputDeviceCollection(_name, _availableDevices, _beforeChange, _isSupported) {
        this._name = _name;
        this._availableDevices = _availableDevices;
        this._beforeChange = _beforeChange;
        this._isSupported = _isSupported;
        /**
         * The currently active output devices.
         */
        this._activeDevices = new Set();
        /**
         * An instance of Logger to use.
         */
        this._log = new log.default('OutputDeviceCollection');
    }
    /**
     * Delete a device from the collection. If no devices remain, the 'default'
     * device will be added as the sole device. If no `default` device exists,
     * the first available device will be used.
     * @param device - The device to delete from the collection
     * @returns whether the device was present before it was deleted
     */
    OutputDeviceCollection.prototype.delete = function (device) {
        this._log.debug('.delete', device);
        var wasDeleted = !!(this._activeDevices.delete(device));
        var defaultDevice = this._availableDevices.get('default')
            || Array.from(this._availableDevices.values())[0];
        if (!this._activeDevices.size && defaultDevice) {
            this._activeDevices.add(defaultDevice);
        }
        // Call _beforeChange so that the implementation can react when a device is
        // removed or lost.
        var deviceIds = Array.from(this._activeDevices.values()).map(function (deviceInfo) { return deviceInfo.deviceId; });
        this._beforeChange(this._name, deviceIds);
        return !!wasDeleted;
    };
    /**
     * Get the current set of devices.
     */
    OutputDeviceCollection.prototype.get = function () {
        return this._activeDevices;
    };
    /**
     * Replace the current set of devices with a new set of devices.
     * @param deviceIdOrIds - An ID or array of IDs of devices to replace the existing devices with.
     * @returns Rejects if this feature is not supported, any of the supplied IDs are not found,
     * or no IDs are passed.
     */
    OutputDeviceCollection.prototype.set = function (deviceIdOrIds) {
        var _this = this;
        this._log.debug('.set', deviceIdOrIds);
        if (!this._isSupported) {
            return Promise.reject(new index.NotSupportedError('This browser does not support audio output selection'));
        }
        var deviceIds = Array.isArray(deviceIdOrIds) ? deviceIdOrIds : [deviceIdOrIds];
        if (!deviceIds.length) {
            return Promise.reject(new index.InvalidArgumentError('Must specify at least one device to set'));
        }
        var missingIds = [];
        var devices = deviceIds.map(function (id) {
            var device = _this._availableDevices.get(id);
            if (!device) {
                missingIds.push(id);
            }
            return device;
        });
        if (missingIds.length) {
            return Promise.reject(new index.InvalidArgumentError("Devices not found: ".concat(missingIds.join(', '))));
        }
        return new Promise(function (resolve) {
            resolve(_this._beforeChange(_this._name, deviceIds));
        }).then(function () {
            _this._activeDevices.clear();
            devices.forEach(_this._activeDevices.add, _this._activeDevices);
        });
    };
    /**
     * Test the devices by playing audio through them.
     * @param [soundUrl] - An optional URL. If none is specified, we will
     *   play a default test tone.
     * @returns Resolves with the result of the underlying HTMLAudioElements' play() calls.
     */
    OutputDeviceCollection.prototype.test = function (soundUrl) {
        if (soundUrl === void 0) { soundUrl = DEFAULT_TEST_SOUND_URL; }
        if (!this._isSupported) {
            return Promise.reject(new index.NotSupportedError('This browser does not support audio output selection'));
        }
        if (!this._activeDevices.size) {
            return Promise.reject(new index.InvalidStateError('No active output devices to test'));
        }
        return Promise.all(Array.from(this._activeDevices).map(function (device) {
            var el;
            // (rrowland) We need to wait for the oncanplay event because of a regression introduced
            // in Chrome M72: https://bugs.chromium.org/p/chromium/issues/detail?id=930876
            return new Promise(function (resolve) {
                el = new Audio(soundUrl);
                el.oncanplay = resolve;
            }).then(function () { return el.setSinkId(device.deviceId).then(function () { return el.play(); }); });
        }));
    };
    return OutputDeviceCollection;
}());

exports.default = OutputDeviceCollection;


},{"./constants.js":10,"./errors/index.js":15,"./log.js":18}],20:[function(require,module,exports){
'use strict';

var tslib = require('tslib');
var events = require('events');
var call = require('../call.js');
var device = require('../device.js');
var index = require('../errors/index.js');
var log = require('../log.js');
var stats = require('../rtc/stats.js');
var constants = require('../constants.js');
var generated = require('../errors/generated.js');

/**
 * Runs some tests to identify issues, if any, prohibiting successful calling.
 */
exports.PreflightTest = /** @class */ (function (_super) {
    tslib.__extends(PreflightTest, _super);
    /**
     * Construct a {@link PreflightTest} instance.
     * @param token - A Twilio JWT token string.
     * @param options
     */
    function PreflightTest(token, options) {
        var _this = _super.call(this) || this;
        /**
         * Whether this test has already logged an insights-connection-warning.
         */
        _this._hasInsightsErrored = false;
        /**
         * An instance of Logger to use.
         */
        _this._log = new log.default('PreflightTest');
        /**
         * Network related timing measurements for this test
         */
        _this._networkTiming = {};
        /**
         * The options passed to {@link PreflightTest} constructor
         */
        _this._options = {
            codecPreferences: [call.default.Codec.PCMU, call.default.Codec.Opus],
            edge: 'roaming',
            fakeMicInput: false,
            logLevel: 'error',
            signalingTimeoutMs: 10000,
        };
        /**
         * Current status of this test
         */
        _this._status = PreflightTest.Status.Connecting;
        Object.assign(_this._options, options);
        _this._samples = [];
        _this._warnings = [];
        _this._startTime = Date.now();
        _this._initDevice(token, tslib.__assign(tslib.__assign({}, _this._options), { fileInputStream: _this._options.fakeMicInput ?
                _this._getStreamFromFile() : undefined }));
        // Device sets the loglevel so start logging after initializing the device.
        // Then selectively log options that users can modify.
        var userOptions = [
            'codecPreferences',
            'edge',
            'fakeMicInput',
            'logLevel',
            'signalingTimeoutMs',
        ];
        var userOptionOverrides = [
            'audioContext',
            'deviceFactory',
            'fileInputStream',
            'getRTCIceCandidateStatsReport',
            'iceServers',
            'rtcConfiguration',
        ];
        if (typeof options === 'object') {
            var toLog_1 = tslib.__assign({}, options);
            Object.keys(toLog_1).forEach(function (key) {
                if (!userOptions.includes(key) && !userOptionOverrides.includes(key)) {
                    delete toLog_1[key];
                }
                if (userOptionOverrides.includes(key)) {
                    toLog_1[key] = true;
                }
            });
            _this._log.debug('.constructor', JSON.stringify(toLog_1));
        }
        return _this;
    }
    /**
     * Stops the current test and raises a failed event.
     */
    PreflightTest.prototype.stop = function () {
        var _this = this;
        this._log.debug('.stop');
        var error = new generated.GeneralErrors.CallCancelledError();
        if (this._device) {
            this._device.once(device.default.EventName.Unregistered, function () { return _this._onFailed(error); });
            this._device.destroy();
        }
        else {
            this._onFailed(error);
        }
    };
    /**
     * Emit a {PreflightTest.Warning}
     */
    PreflightTest.prototype._emitWarning = function (name, description, rtcWarning) {
        var warning = { name: name, description: description };
        if (rtcWarning) {
            warning.rtcWarning = rtcWarning;
        }
        this._warnings.push(warning);
        this._log.debug("#".concat(PreflightTest.Events.Warning), JSON.stringify(warning));
        this.emit(PreflightTest.Events.Warning, warning);
    };
    /**
     * Returns call quality base on the RTC Stats
     */
    PreflightTest.prototype._getCallQuality = function (mos) {
        if (mos > 4.2) {
            return PreflightTest.CallQuality.Excellent;
        }
        else if (mos >= 4.1 && mos <= 4.2) {
            return PreflightTest.CallQuality.Great;
        }
        else if (mos >= 3.7 && mos <= 4) {
            return PreflightTest.CallQuality.Good;
        }
        else if (mos >= 3.1 && mos <= 3.6) {
            return PreflightTest.CallQuality.Fair;
        }
        else {
            return PreflightTest.CallQuality.Degraded;
        }
    };
    /**
     * Returns the report for this test.
     */
    PreflightTest.prototype._getReport = function () {
        var _a, _b, _c;
        var stats = this._getRTCStats();
        var testTiming = { start: this._startTime };
        if (this._endTime) {
            testTiming.end = this._endTime;
            testTiming.duration = this._endTime - this._startTime;
        }
        var report = {
            callSid: this._callSid,
            edge: this._edge,
            iceCandidateStats: (_b = (_a = this._rtcIceCandidateStatsReport) === null || _a === void 0 ? void 0 : _a.iceCandidateStats) !== null && _b !== void 0 ? _b : [],
            networkTiming: this._networkTiming,
            samples: this._samples,
            selectedEdge: this._options.edge,
            stats: stats,
            testTiming: testTiming,
            totals: this._getRTCSampleTotals(),
            warnings: this._warnings,
        };
        var selectedIceCandidatePairStats = (_c = this._rtcIceCandidateStatsReport) === null || _c === void 0 ? void 0 : _c.selectedIceCandidatePairStats;
        if (selectedIceCandidatePairStats) {
            report.selectedIceCandidatePairStats = selectedIceCandidatePairStats;
            report.isTurnRequired = selectedIceCandidatePairStats.localCandidate.candidateType === 'relay'
                || selectedIceCandidatePairStats.remoteCandidate.candidateType === 'relay';
        }
        if (stats) {
            report.callQuality = this._getCallQuality(stats.mos.average);
        }
        return report;
    };
    /**
     * Returns RTC stats totals for this test
     */
    PreflightTest.prototype._getRTCSampleTotals = function () {
        if (!this._latestSample) {
            return;
        }
        return tslib.__assign({}, this._latestSample.totals);
    };
    /**
     * Returns RTC related stats captured during the test call
     */
    PreflightTest.prototype._getRTCStats = function () {
        var firstMosSampleIdx = this._samples.findIndex(function (sample) { return typeof sample.mos === 'number' && sample.mos > 0; });
        var samples = firstMosSampleIdx >= 0
            ? this._samples.slice(firstMosSampleIdx)
            : [];
        if (!samples || !samples.length) {
            return;
        }
        return ['jitter', 'mos', 'rtt'].reduce(function (statObj, stat) {
            var _a;
            var values = samples.map(function (s) { return s[stat]; });
            return tslib.__assign(tslib.__assign({}, statObj), (_a = {}, _a[stat] = {
                average: Number((values.reduce(function (total, value) { return total + value; }) / values.length).toPrecision(5)),
                max: Math.max.apply(Math, values),
                min: Math.min.apply(Math, values),
            }, _a));
        }, {});
    };
    /**
     * Returns a MediaStream from a media file
     */
    PreflightTest.prototype._getStreamFromFile = function () {
        var audioContext = this._options.audioContext;
        if (!audioContext) {
            throw new index.NotSupportedError('Cannot fake input audio stream: AudioContext is not supported by this browser.');
        }
        var audioEl = new Audio(constants.COWBELL_AUDIO_URL);
        audioEl.addEventListener('canplaythrough', function () { return audioEl.play(); });
        if (typeof audioEl.setAttribute === 'function') {
            audioEl.setAttribute('crossorigin', 'anonymous');
        }
        var src = audioContext.createMediaElementSource(audioEl);
        var dest = audioContext.createMediaStreamDestination();
        src.connect(dest);
        return dest.stream;
    };
    /**
     * Initialize the device
     */
    PreflightTest.prototype._initDevice = function (token, options) {
        var _this = this;
        try {
            this._device = new (options.deviceFactory || device.default)(token, {
                chunderw: options.chunderw,
                codecPreferences: options.codecPreferences,
                edge: options.edge,
                eventgw: options.eventgw,
                fileInputStream: options.fileInputStream,
                logLevel: options.logLevel,
                preflight: true,
            });
            this._device.once(device.default.EventName.Registered, function () {
                _this._onDeviceRegistered();
            });
            this._device.once(device.default.EventName.Error, function (error) {
                _this._onDeviceError(error);
            });
            this._device.register();
        }
        catch (error) {
            // We want to return before failing so the consumer can capture the event
            setTimeout(function () {
                _this._onFailed(error);
            });
            return;
        }
        this._signalingTimeoutTimer = setTimeout(function () {
            _this._onDeviceError(new generated.SignalingErrors.ConnectionError('WebSocket Connection Timeout'));
        }, options.signalingTimeoutMs);
    };
    /**
     * Called on {@link Device} error event
     * @param error
     */
    PreflightTest.prototype._onDeviceError = function (error) {
        this._device.destroy();
        this._onFailed(error);
    };
    /**
     * Called on {@link Device} ready event
     */
    PreflightTest.prototype._onDeviceRegistered = function () {
        return tslib.__awaiter(this, void 0, void 0, function () {
            var _a, audio, publisher;
            var _this = this;
            return tslib.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        clearTimeout(this._echoTimer);
                        clearTimeout(this._signalingTimeoutTimer);
                        _a = this;
                        return [4 /*yield*/, this._device.connect({
                                rtcConfiguration: this._options.rtcConfiguration,
                            })];
                    case 1:
                        _a._call = _b.sent();
                        this._networkTiming.signaling = { start: Date.now() };
                        this._setupCallHandlers(this._call);
                        this._edge = this._device.edge || undefined;
                        if (this._options.fakeMicInput) {
                            this._echoTimer = setTimeout(function () { return _this._device.disconnectAll(); }, constants.ECHO_TEST_DURATION);
                            audio = this._device.audio;
                            if (audio) {
                                audio.disconnect(false);
                                audio.outgoing(false);
                            }
                        }
                        this._call.once('disconnect', function () {
                            _this._device.once(device.default.EventName.Unregistered, function () { return _this._onUnregistered(); });
                            _this._device.destroy();
                        });
                        publisher = this._call['_publisher'];
                        publisher.on('error', function () {
                            if (!_this._hasInsightsErrored) {
                                _this._emitWarning('insights-connection-error', 'Received an error when attempting to connect to Insights gateway');
                            }
                            _this._hasInsightsErrored = true;
                        });
                        return [2 /*return*/];
                }
            });
        });
    };
    /**
     * Called when there is a fatal error
     * @param error
     */
    PreflightTest.prototype._onFailed = function (error) {
        clearTimeout(this._echoTimer);
        clearTimeout(this._signalingTimeoutTimer);
        this._releaseHandlers();
        this._endTime = Date.now();
        this._status = PreflightTest.Status.Failed;
        this._log.debug("#".concat(PreflightTest.Events.Failed), error);
        this.emit(PreflightTest.Events.Failed, error);
    };
    /**
     * Called when the device goes offline.
     * This indicates that the test has been completed, but we won't know if it failed or not.
     * The onError event will be the indicator whether the test failed.
     */
    PreflightTest.prototype._onUnregistered = function () {
        var _this = this;
        // We need to make sure we always execute preflight.on('completed') last
        // as client SDK sometimes emits 'offline' event before emitting fatal errors.
        setTimeout(function () {
            if (_this._status === PreflightTest.Status.Failed) {
                return;
            }
            clearTimeout(_this._echoTimer);
            clearTimeout(_this._signalingTimeoutTimer);
            _this._releaseHandlers();
            _this._endTime = Date.now();
            _this._status = PreflightTest.Status.Completed;
            _this._report = _this._getReport();
            _this._log.debug("#".concat(PreflightTest.Events.Completed), JSON.stringify(_this._report));
            _this.emit(PreflightTest.Events.Completed, _this._report);
        }, 10);
    };
    /**
     * Clean up all handlers for device and call
     */
    PreflightTest.prototype._releaseHandlers = function () {
        [this._device, this._call].forEach(function (emitter) {
            if (emitter) {
                emitter.eventNames().forEach(function (name) { return emitter.removeAllListeners(name); });
            }
        });
    };
    /**
     * Setup the event handlers for the {@link Call} of the test call
     * @param call
     */
    PreflightTest.prototype._setupCallHandlers = function (call) {
        var _this = this;
        if (this._options.fakeMicInput) {
            // When volume events start emitting, it means all audio outputs have been created.
            // Let's mute them if we're using fake mic input.
            call.once('volume', function () {
                call['_mediaHandler'].outputs
                    .forEach(function (output) { return output.audio.muted = true; });
            });
        }
        call.on('warning', function (name, data) {
            _this._emitWarning(name, 'Received an RTCWarning. See .rtcWarning for the RTCWarning', data);
        });
        call.once('accept', function () {
            _this._callSid = call['_mediaHandler'].callSid;
            _this._status = PreflightTest.Status.Connected;
            _this._log.debug("#".concat(PreflightTest.Events.Connected));
            _this.emit(PreflightTest.Events.Connected);
        });
        call.on('sample', function (sample) { return tslib.__awaiter(_this, void 0, void 0, function () {
            var _a;
            return tslib.__generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!!this._latestSample) return [3 /*break*/, 2];
                        _a = this;
                        return [4 /*yield*/, (this._options.getRTCIceCandidateStatsReport || stats.getRTCIceCandidateStatsReport)(call['_mediaHandler'].version.pc)];
                    case 1:
                        _a._rtcIceCandidateStatsReport = _b.sent();
                        _b.label = 2;
                    case 2:
                        this._latestSample = sample;
                        this._samples.push(sample);
                        this._log.debug("#".concat(PreflightTest.Events.Sample), JSON.stringify(sample));
                        this.emit(PreflightTest.Events.Sample, sample);
                        return [2 /*return*/];
                }
            });
        }); });
        // TODO: Update the following once the SDK supports emitting these events
        // Let's shim for now
        [{
                reportLabel: 'peerConnection',
                type: 'pcconnection',
            }, {
                reportLabel: 'ice',
                type: 'iceconnection',
            }, {
                reportLabel: 'dtls',
                type: 'dtlstransport',
            }, {
                reportLabel: 'signaling',
                type: 'signaling',
            }].forEach(function (_a) {
            var type = _a.type, reportLabel = _a.reportLabel;
            var handlerName = "on".concat(type, "statechange");
            var originalHandler = call['_mediaHandler'][handlerName];
            call['_mediaHandler'][handlerName] = function (state) {
                var timing = _this._networkTiming[reportLabel]
                    = _this._networkTiming[reportLabel] || { start: 0 };
                if (state === 'connecting' || state === 'checking') {
                    timing.start = Date.now();
                }
                else if ((state === 'connected' || state === 'stable') && !timing.duration) {
                    timing.end = Date.now();
                    timing.duration = timing.end - timing.start;
                }
                originalHandler(state);
            };
        });
    };
    Object.defineProperty(PreflightTest.prototype, "callSid", {
        /**
         * The callsid generated for the test call.
         */
        get: function () {
            return this._callSid;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PreflightTest.prototype, "endTime", {
        /**
         * A timestamp in milliseconds of when the test ended.
         */
        get: function () {
            return this._endTime;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PreflightTest.prototype, "latestSample", {
        /**
         * The latest WebRTC sample collected.
         */
        get: function () {
            return this._latestSample;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PreflightTest.prototype, "report", {
        /**
         * The report for this test.
         */
        get: function () {
            return this._report;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PreflightTest.prototype, "startTime", {
        /**
         * A timestamp in milliseconds of when the test started.
         */
        get: function () {
            return this._startTime;
        },
        enumerable: false,
        configurable: true
    });
    Object.defineProperty(PreflightTest.prototype, "status", {
        /**
         * The status of the test.
         */
        get: function () {
            return this._status;
        },
        enumerable: false,
        configurable: true
    });
    return PreflightTest;
}(events.EventEmitter));
/**
 * @mergeModuleWith PreflightTest
 */
(function (PreflightTest) {
    (function (CallQuality) {
        /**
         * If the average mos is over 4.2.
         */
        CallQuality["Excellent"] = "excellent";
        /**
         * If the average mos is between 4.1 and 4.2 both inclusive.
         */
        CallQuality["Great"] = "great";
        /**
         * If the average mos is between 3.7 and 4.0 both inclusive.
         */
        CallQuality["Good"] = "good";
        /**
         * If the average mos is between 3.1 and 3.6 both inclusive.
         */
        CallQuality["Fair"] = "fair";
        /**
         * If the average mos is 3.0 or below.
         */
        CallQuality["Degraded"] = "degraded";
    })(PreflightTest.CallQuality || (PreflightTest.CallQuality = {}));
    (function (Events) {
        /**
         * See [[PreflightTest.completedEvent]]
         */
        Events["Completed"] = "completed";
        /**
         * See [[PreflightTest.connectedEvent]]
         */
        Events["Connected"] = "connected";
        /**
         * See [[PreflightTest.failedEvent]]
         */
        Events["Failed"] = "failed";
        /**
         * See [[PreflightTest.sampleEvent]]
         */
        Events["Sample"] = "sample";
        /**
         * See [[PreflightTest.warningEvent]]
         */
        Events["Warning"] = "warning";
    })(PreflightTest.Events || (PreflightTest.Events = {}));
    (function (Status) {
        /**
         * Call to Twilio has initiated.
         */
        Status["Connecting"] = "connecting";
        /**
         * Call to Twilio has been established.
         */
        Status["Connected"] = "connected";
        /**
         * The connection to Twilio has been disconnected and the test call has completed.
         */
        Status["Completed"] = "completed";
        /**
         * The test has stopped and failed.
         */
        Status["Failed"] = "failed";
    })(PreflightTest.Status || (PreflightTest.Status = {}));
})(exports.PreflightTest || (exports.PreflightTest = {}));


},{"../call.js":9,"../constants.js":10,"../device.js":12,"../errors/generated.js":14,"../errors/index.js":15,"../log.js":18,"../rtc/stats.js":32,"events":39,"tslib":41}],21:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var events = require('events');
var constants = require('./constants.js');
require('./errors/index.js');
var log = require('./log.js');
var wstransport = require('./wstransport.js');
var generated = require('./errors/generated.js');

var PSTREAM_VERSION = '1.6';
// In seconds
var MAX_RECONNECT_TIMEOUT_ALLOWED = 30;
/**
 * Constructor for PStream objects.
 *
 * @exports PStream as Twilio.PStream
 * @memberOf Twilio
 * @borrows EventEmitter#addListener as #addListener
 * @borrows EventEmitter#removeListener as #removeListener
 * @borrows EventEmitter#emit as #emit
 * @borrows EventEmitter#hasListener as #hasListener
 * @constructor
 * @param {string} token The Twilio capabilities JWT
 * @param {string[]} uris An array of PStream endpoint URIs
 * @param {object} [options]
 * @config {boolean} [options.backoffMaxMs=20000] Enable debugging
 */
var PStream = /** @class */ (function (_super) {
    tslib.__extends(PStream, _super);
    function PStream(token, uris, options) {
        var _this = _super.call(this) || this;
        if (!(_this instanceof PStream)) {
            return new PStream(token, uris, options);
        }
        var defaults = {
            TransportFactory: wstransport.default,
        };
        options = options || {};
        for (var prop in defaults) {
            if (prop in options) {
                continue;
            }
            options[prop] = defaults[prop];
        }
        _this.options = options;
        _this.token = token || '';
        _this.status = 'disconnected';
        _this.gateway = null;
        _this.region = null;
        _this._messageQueue = [];
        _this._preferredUri = null;
        _this._uris = uris;
        _this._handleTransportClose = _this._handleTransportClose.bind(_this);
        _this._handleTransportError = _this._handleTransportError.bind(_this);
        _this._handleTransportMessage = _this._handleTransportMessage.bind(_this);
        _this._handleTransportOpen = _this._handleTransportOpen.bind(_this);
        _this._log = new log.default('PStream');
        // NOTE(mroberts): EventEmitter requires that we catch all errors.
        _this.on('error', function () {
            _this._log.warn('Unexpected error handled in pstream');
        });
        /*
         *events used by device
         *'invite',
         *'ready',
         *'error',
         *'offline',
         *
         *'cancel',
         *'presence',
         *'roster',
         *'answer',
         *'candidate',
         *'hangup'
         */
        var self = _this;
        _this.addListener('ready', function () {
            self.status = 'ready';
        });
        _this.addListener('offline', function () {
            self.status = 'offline';
        });
        _this.addListener('close', function () {
            self._log.info('Received "close" from server. Destroying PStream...');
            self._destroy();
        });
        _this.transport = new _this.options.TransportFactory(_this._uris, {
            backoffMaxMs: _this.options.backoffMaxMs,
            maxPreferredDurationMs: _this.options.maxPreferredDurationMs,
        });
        Object.defineProperties(_this, {
            uri: {
                enumerable: true,
                get: function () {
                    return this.transport.uri;
                },
            },
        });
        _this.transport.on('close', _this._handleTransportClose);
        _this.transport.on('error', _this._handleTransportError);
        _this.transport.on('message', _this._handleTransportMessage);
        _this.transport.on('open', _this._handleTransportOpen);
        _this.transport.open();
        return _this;
    }
    return PStream;
}(events.EventEmitter));
PStream.prototype._handleTransportClose = function () {
    this.emit('transportClose');
    if (this.status !== 'disconnected') {
        if (this.status !== 'offline') {
            this.emit('offline', this);
        }
        this.status = 'disconnected';
    }
};
PStream.prototype._handleTransportError = function (error) {
    if (!error) {
        this.emit('error', { error: {
                code: 31000,
                message: 'Websocket closed without a provided reason',
                twilioError: new generated.SignalingErrors.ConnectionDisconnected(),
            } });
        return;
    }
    // We receive some errors without call metadata (just the error). We need to convert these
    // to be contained within the 'error' field so that these errors match the expected format.
    this.emit('error', typeof error.code !== 'undefined' ? { error: error } : error);
};
PStream.prototype._handleTransportMessage = function (msg) {
    if (!msg || !msg.data || typeof msg.data !== 'string') {
        return;
    }
    var _a = JSON.parse(msg.data), type = _a.type, _b = _a.payload, payload = _b === void 0 ? {} : _b;
    this.gateway = payload.gateway || this.gateway;
    this.region = payload.region || this.region;
    if (type === 'error' && payload.error) {
        payload.error.twilioError = new generated.SignalingErrors.ConnectionError();
    }
    this.emit(type, payload);
};
PStream.prototype._handleTransportOpen = function () {
    var _this = this;
    this.status = 'connected';
    this.setToken(this.token);
    this.emit('transportOpen');
    var messages = this._messageQueue.splice(0, this._messageQueue.length);
    messages.forEach(function (message) { return _this._publish.apply(_this, message); });
};
/**
 * @return {string}
 */
PStream.toString = function () { return '[Twilio.PStream class]'; };
PStream.prototype.toString = function () { return '[Twilio.PStream instance]'; };
PStream.prototype.setToken = function (token) {
    this._log.info('Setting token and publishing listen');
    this.token = token;
    var reconnectTimeout = 0;
    var t = this.options.maxPreferredDurationMs;
    this._log.info("maxPreferredDurationMs:".concat(t));
    if (typeof t === 'number' && t >= 0) {
        reconnectTimeout = Math.min(Math.ceil(t / 1000), MAX_RECONNECT_TIMEOUT_ALLOWED);
    }
    this._log.info("reconnectTimeout:".concat(reconnectTimeout));
    var payload = {
        browserinfo: getBrowserInfo(),
        reconnectTimeout: reconnectTimeout,
        token: token,
    };
    this._publish('listen', payload);
};
PStream.prototype.sendMessage = function (callsid, content, contenttype, messagetype, voiceeventsid) {
    if (contenttype === void 0) { contenttype = 'application/json'; }
    var payload = {
        callsid: callsid,
        content: content,
        contenttype: contenttype,
        messagetype: messagetype,
        voiceeventsid: voiceeventsid,
    };
    this._publish('message', payload, true);
};
PStream.prototype.register = function (mediaCapabilities) {
    var regPayload = { media: mediaCapabilities };
    this._publish('register', regPayload, true);
};
PStream.prototype.invite = function (sdp, callsid, params) {
    var payload = {
        callsid: callsid,
        sdp: sdp,
        twilio: params ? { params: params } : {},
    };
    this._publish('invite', payload, true);
};
PStream.prototype.reconnect = function (sdp, callsid, reconnect) {
    var payload = {
        callsid: callsid,
        reconnect: reconnect,
        sdp: sdp,
        twilio: {},
    };
    this._publish('invite', payload, true);
};
PStream.prototype.answer = function (sdp, callsid) {
    this._publish('answer', { sdp: sdp, callsid: callsid }, true);
};
PStream.prototype.dtmf = function (callsid, digits) {
    this._publish('dtmf', { callsid: callsid, dtmf: digits }, true);
};
PStream.prototype.hangup = function (callsid, message) {
    var payload = message ? { callsid: callsid, message: message } : { callsid: callsid };
    this._publish('hangup', payload, true);
};
PStream.prototype.reject = function (callsid) {
    this._publish('reject', { callsid: callsid }, true);
};
PStream.prototype.reinvite = function (sdp, callsid) {
    this._publish('reinvite', { sdp: sdp, callsid: callsid }, false);
};
PStream.prototype._destroy = function () {
    this.transport.removeListener('close', this._handleTransportClose);
    this.transport.removeListener('error', this._handleTransportError);
    this.transport.removeListener('message', this._handleTransportMessage);
    this.transport.removeListener('open', this._handleTransportOpen);
    this.transport.close();
    this.emit('offline', this);
};
PStream.prototype.destroy = function () {
    this._log.info('PStream.destroy() called...');
    this._destroy();
    return this;
};
PStream.prototype.updatePreferredURI = function (uri) {
    this._preferredUri = uri;
    this.transport.updatePreferredURI(uri);
};
PStream.prototype.updateURIs = function (uris) {
    this._uris = uris;
    this.transport.updateURIs(this._uris);
};
PStream.prototype.publish = function (type, payload) {
    return this._publish(type, payload, true);
};
PStream.prototype._publish = function (type, payload, shouldRetry) {
    var msg = JSON.stringify({
        payload: payload,
        type: type,
        version: PSTREAM_VERSION,
    });
    var isSent = !!this.transport.send(msg);
    if (!isSent) {
        this.emit('error', { error: {
                code: 31009,
                message: 'No transport available to send or receive messages',
                twilioError: new generated.GeneralErrors.TransportError(),
            } });
        if (shouldRetry) {
            this._messageQueue.push([type, payload, true]);
        }
    }
};
function getBrowserInfo() {
    var nav = typeof navigator !== 'undefined' ? navigator : {};
    var info = {
        browser: {
            platform: nav.platform || 'unknown',
            userAgent: nav.userAgent || 'unknown',
        },
        p: 'browser',
        plugin: 'rtc',
        v: constants.RELEASE_VERSION,
    };
    return info;
}

exports.default = PStream;


},{"./constants.js":10,"./errors/generated.js":14,"./errors/index.js":15,"./log.js":18,"./wstransport.js":38,"events":39,"tslib":41}],22:[function(require,module,exports){
'use strict';

var index = require('./errors/index.js');

var _a;
/**
 * Valid edges.
 */
exports.Edge = void 0;
(function (Edge) {
    /**
     * Public edges
     */
    Edge["Sydney"] = "sydney";
    Edge["SaoPaulo"] = "sao-paulo";
    Edge["Dublin"] = "dublin";
    Edge["Frankfurt"] = "frankfurt";
    Edge["Tokyo"] = "tokyo";
    Edge["Singapore"] = "singapore";
    Edge["Ashburn"] = "ashburn";
    Edge["Umatilla"] = "umatilla";
    Edge["Roaming"] = "roaming";
    /**
     * Interconnect edges
     */
    Edge["AshburnIx"] = "ashburn-ix";
    Edge["SanJoseIx"] = "san-jose-ix";
    Edge["LondonIx"] = "london-ix";
    Edge["FrankfurtIx"] = "frankfurt-ix";
    Edge["SingaporeIx"] = "singapore-ix";
    Edge["SydneyIx"] = "sydney-ix";
    Edge["TokyoIx"] = "tokyo-ix";
})(exports.Edge || (exports.Edge = {}));
/**
 * Valid current regions.
 *
 * @deprecated
 *
 * CLIENT-6831
 * This is no longer used or updated for checking validity of regions in the
 * SDK. We now allow any string to be passed for region. Invalid regions won't
 * be able to connect, and won't throw an exception.
 *
 * CLIENT-7519
 * This is used again to temporarily convert edge values to regions as part of
 * Phase 1 Regional. This is still considered deprecated.
 *
 * @private
 */
exports.Region = void 0;
(function (Region) {
    Region["Au1"] = "au1";
    Region["Au1Ix"] = "au1-ix";
    Region["Br1"] = "br1";
    Region["De1"] = "de1";
    Region["De1Ix"] = "de1-ix";
    Region["Gll"] = "gll";
    Region["Ie1"] = "ie1";
    Region["Ie1Ix"] = "ie1-ix";
    Region["Ie1Tnx"] = "ie1-tnx";
    Region["Jp1"] = "jp1";
    Region["Jp1Ix"] = "jp1-ix";
    Region["Sg1"] = "sg1";
    Region["Sg1Ix"] = "sg1-ix";
    Region["Sg1Tnx"] = "sg1-tnx";
    Region["Us1"] = "us1";
    Region["Us1Ix"] = "us1-ix";
    Region["Us1Tnx"] = "us1-tnx";
    Region["Us2"] = "us2";
    Region["Us2Ix"] = "us2-ix";
    Region["Us2Tnx"] = "us2-tnx";
})(exports.Region || (exports.Region = {}));
/**
 * Region shortcodes. Maps the full region name from AWS to the Twilio shortcode.
 * @private
 */
var regionShortcodes = {
    ASIAPAC_SINGAPORE: exports.Region.Sg1,
    ASIAPAC_SYDNEY: exports.Region.Au1,
    ASIAPAC_TOKYO: exports.Region.Jp1,
    EU_FRANKFURT: exports.Region.De1,
    EU_IRELAND: exports.Region.Ie1,
    SOUTH_AMERICA_SAO_PAULO: exports.Region.Br1,
    US_EAST_VIRGINIA: exports.Region.Us1,
    US_WEST_OREGON: exports.Region.Us2,
};
/**
 * Region to edge mapping, as part of Phase 1 Regional (CLIENT-7519).
 * Temporary.
 * @private
 */
var regionToEdge = (_a = {},
    _a[exports.Region.Au1] = exports.Edge.Sydney,
    _a[exports.Region.Br1] = exports.Edge.SaoPaulo,
    _a[exports.Region.Ie1] = exports.Edge.Dublin,
    _a[exports.Region.De1] = exports.Edge.Frankfurt,
    _a[exports.Region.Jp1] = exports.Edge.Tokyo,
    _a[exports.Region.Sg1] = exports.Edge.Singapore,
    _a[exports.Region.Us1] = exports.Edge.Ashburn,
    _a[exports.Region.Us2] = exports.Edge.Umatilla,
    _a[exports.Region.Gll] = exports.Edge.Roaming,
    /**
     * Interconnect edges
     */
    _a[exports.Region.Us1Ix] = exports.Edge.AshburnIx,
    _a[exports.Region.Us2Ix] = exports.Edge.SanJoseIx,
    _a[exports.Region.Ie1Ix] = exports.Edge.LondonIx,
    _a[exports.Region.De1Ix] = exports.Edge.FrankfurtIx,
    _a[exports.Region.Sg1Ix] = exports.Edge.SingaporeIx,
    _a[exports.Region.Au1Ix] = exports.Edge.SydneyIx,
    _a[exports.Region.Jp1Ix] = exports.Edge.TokyoIx,
    /**
     * Tnx regions
     */
    _a[exports.Region.Us1Tnx] = exports.Edge.AshburnIx,
    _a[exports.Region.Us2Tnx] = exports.Edge.AshburnIx,
    _a[exports.Region.Ie1Tnx] = exports.Edge.LondonIx,
    _a[exports.Region.Sg1Tnx] = exports.Edge.SingaporeIx,
    _a);
/**
 * The default edge to connect to and create a chunder uri from, if the edge
 * parameter is not specified during setup in `Device`.
 * @constant
 */
var defaultEdge = exports.Edge.Roaming;
/**
 * The default event gateway URI to publish to.
 * @constant
 * @private
 */
var defaultEventGatewayURI = 'eventgw.twilio.com';
/**
 * String template for an edge chunder URI
 * @param edge - The edge.
 */
function createChunderEdgeURI(edge) {
    return "voice-js.".concat(edge, ".twilio.com");
}
/**
 * String template for a region insights URI
 * @param region - The region.
 */
function createEventGatewayURI(region) {
    return region
        ? "eventgw.".concat(region, ".twilio.com")
        : defaultEventGatewayURI;
}
/**
 * Create a signaling endpoint URL to connect a websocket to from a chunder URI.
 * @param uri the chunder URI to create a signaling endpoint URL for
 */
function createSignalingEndpointURL(uri) {
    return "wss://".concat(uri, "/signal");
}
/**
 * Get the URI associated with the passed edge.
 * @private
 * @param edge - A string or an array of edge values
 * @returns An array of chunder URIs
 */
function getChunderURIs(edge) {
    if (!!edge && typeof edge !== 'string' && !Array.isArray(edge)) {
        throw new index.InvalidArgumentError('If `edge` is provided, it must be of type `string` or an array of strings.');
    }
    var uris;
    if (edge) {
        var edgeParams = Array.isArray(edge) ? edge : [edge];
        uris = edgeParams.map(function (param) { return createChunderEdgeURI(param); });
    }
    else {
        uris = [createChunderEdgeURI(defaultEdge)];
    }
    return uris;
}
/**
 * Get the region shortcode by its full AWS region string.
 *
 * @private
 * @param region - The region's full AWS string.
 */
function getRegionShortcode(region) {
    return regionShortcodes[region] || null;
}

exports.createEventGatewayURI = createEventGatewayURI;
exports.createSignalingEndpointURL = createSignalingEndpointURL;
exports.defaultEdge = defaultEdge;
exports.getChunderURIs = getChunderURIs;
exports.getRegionShortcode = getRegionShortcode;
exports.regionShortcodes = regionShortcodes;
exports.regionToEdge = regionToEdge;


},{"./errors/index.js":15}],23:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

// @ts-nocheck
function request(method, params, callback) {
    var body = JSON.stringify(params.body || {});
    var headers = new Headers();
    params.headers = params.headers || [];
    Object.entries(params.headers).forEach(function (_a) {
        var headerName = _a[0], headerBody = _a[1];
        return headers.append(headerName, headerBody);
    });
    fetch(params.url, { body: body, headers: headers, method: method })
        .then(function (response) { return response.text(); }, callback)
        .then(function (responseText) { return callback(null, responseText); }, callback);
}
/**
 * Use XMLHttpRequest to get a network resource.
 * @param {String} method - HTTP Method
 * @param {Object} params - Request parameters
 * @param {String} params.url - URL of the resource
 * @param {Array}  params.headers - An array of headers to pass [{ headerName : headerBody }]
 * @param {Object} params.body - A JSON body to send to the resource
 * @returns {response}
 */
var Request = request;
/**
 * Sugar function for request('GET', params, callback);
 * @param {Object} params - Request parameters
 * @param {Request~get} callback - The callback that handles the response.
 */
Request.get = function get(params, callback) {
    return new this('GET', params, callback);
};
/**
 * Sugar function for request('POST', params, callback);
 * @param {Object} params - Request parameters
 * @param {Request~post} callback - The callback that handles the response.
 */
Request.post = function post(params, callback) {
    return new this('POST', params, callback);
};

exports.default = Request;


},{}],24:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var index = require('../errors/index.js');
var util = require('../util.js');

// @ts-nocheck
function getUserMedia(constraints, options) {
    options = options || {};
    options.util = options.util || util;
    options.navigator = options.navigator
        || (typeof navigator !== 'undefined' ? navigator : null);
    return new Promise(function (resolve, reject) {
        if (!options.navigator) {
            throw new index.NotSupportedError('getUserMedia is not supported');
        }
        switch ('function') {
            case typeof (options.navigator.mediaDevices && options.navigator.mediaDevices.getUserMedia):
                return resolve(options.navigator.mediaDevices.getUserMedia(constraints));
            case typeof options.navigator.webkitGetUserMedia:
                return options.navigator.webkitGetUserMedia(constraints, resolve, reject);
            case typeof options.navigator.mozGetUserMedia:
                return options.navigator.mozGetUserMedia(constraints, resolve, reject);
            case typeof options.navigator.getUserMedia:
                return options.navigator.getUserMedia(constraints, resolve, reject);
            default:
                throw new index.NotSupportedError('getUserMedia is not supported');
        }
    }).catch(function (e) {
        throw (options.util.isFirefox() && e.name === 'NotReadableError')
            ? new index.NotSupportedError('Firefox does not currently support opening multiple audio input tracks' +
                'simultaneously, even across different tabs.\n' +
                'Related Bugzilla thread: https://bugzilla.mozilla.org/show_bug.cgi?id=1299324')
            : e;
    });
}

exports.default = getUserMedia;


},{"../errors/index.js":15,"../util.js":37}],25:[function(require,module,exports){
'use strict';

/**
 * {@link RTCIceCandidate} parses an ICE candidate gathered by the browser
 * and returns a IceCandidate object
 */
var IceCandidate = /** @class */ (function () {
    /**
     * @constructor
     * @param iceCandidate RTCIceCandidate coming from the browser
     */
    function IceCandidate(iceCandidate, isRemote) {
        if (isRemote === void 0) { isRemote = false; }
        /**
         * Whether this is deleted from the list of candidate gathered
         */
        this.deleted = false;
        var cost;
        var parts = iceCandidate.candidate.split('network-cost ');
        if (parts[1]) {
            cost = parseInt(parts[1], 10);
        }
        this.candidateType = iceCandidate.type;
        this.ip = iceCandidate.ip || iceCandidate.address;
        this.isRemote = isRemote;
        this.networkCost = cost;
        this.port = iceCandidate.port;
        this.priority = iceCandidate.priority;
        this.protocol = iceCandidate.protocol;
        this.relatedAddress = iceCandidate.relatedAddress;
        this.relatedPort = iceCandidate.relatedPort;
        this.tcpType = iceCandidate.tcpType;
        this.transportId = iceCandidate.sdpMid;
    }
    /**
     * Get the payload object for insights
     */
    IceCandidate.prototype.toPayload = function () {
        return {
            'candidate_type': this.candidateType,
            'deleted': this.deleted,
            'ip': this.ip,
            'is_remote': this.isRemote,
            'network-cost': this.networkCost,
            'port': this.port,
            'priority': this.priority,
            'protocol': this.protocol,
            'related_address': this.relatedAddress,
            'related_port': this.relatedPort,
            'tcp_type': this.tcpType,
            'transport_id': this.transportId,
        };
    };
    return IceCandidate;
}());

exports.IceCandidate = IceCandidate;


},{}],26:[function(require,module,exports){
'use strict';

var peerconnection = require('./peerconnection.js');
var rtcpc = require('./rtcpc.js');

// @ts-nocheck
function enabled() {
    return rtcpc.default.test();
}
function getMediaEngine() {
    return typeof RTCIceGatherer !== 'undefined' ? 'ORTC' : 'WebRTC';
}

exports.PeerConnection = peerconnection.default;
exports.enabled = enabled;
exports.getMediaEngine = getMediaEngine;


},{"./peerconnection.js":29,"./rtcpc.js":30}],27:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

// @ts-nocheck
/**
 * This file was imported from another project. If making changes to this file, please don't
 * make them here. Make them on the linked repo below, then copy back:
 * https://code.hq.twilio.com/client/MockRTCStatsReport
 */
// The legacy max volume, which is the positive half of a signed short integer.
var OLD_MAX_VOLUME = 32767;
var NativeRTCStatsReport = typeof window !== 'undefined'
    ? window.RTCStatsReport : undefined;
/**
 * Create a MockRTCStatsReport wrapper around a Map of RTCStats objects. If RTCStatsReport is available
 *   natively, it will be inherited so that instanceof checks pass.
 * @constructor
 * @extends RTCStatsReport
 * @param {Map<string, RTCStats>} statsMap - A Map of RTCStats objects to wrap
 *   with a MockRTCStatsReport object.
 */
function MockRTCStatsReport(statsMap) {
    if (!(this instanceof MockRTCStatsReport)) {
        return new MockRTCStatsReport(statsMap);
    }
    var self = this;
    Object.defineProperties(this, {
        _map: { value: statsMap },
        size: {
            enumerable: true,
            get: function () {
                return self._map.size;
            },
        },
    });
    this[Symbol.iterator] = statsMap[Symbol.iterator];
}
// If RTCStatsReport is available natively, inherit it. Keep our constructor.
if (NativeRTCStatsReport) {
    MockRTCStatsReport.prototype = Object.create(NativeRTCStatsReport.prototype);
    MockRTCStatsReport.prototype.constructor = MockRTCStatsReport;
}
// Map the Map-like read methods to the underlying Map
['entries', 'forEach', 'get', 'has', 'keys', 'values'].forEach(function (key) {
    MockRTCStatsReport.prototype[key] = function () {
        var _a;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return (_a = this._map)[key].apply(_a, args);
    };
});
/**
 * Convert an array of RTCStats objects into a mock RTCStatsReport object.
 * @param {Array<RTCStats>}
 * @return {MockRTCStatsReport}
 */
MockRTCStatsReport.fromArray = function fromArray(array) {
    return new MockRTCStatsReport(array.reduce(function (map, rtcStats) {
        map.set(rtcStats.id, rtcStats);
        return map;
    }, new Map()));
};
/**
 * Convert a legacy RTCStatsResponse object into a mock RTCStatsReport object.
 * @param {RTCStatsResponse} statsResponse - An RTCStatsResponse object returned by the
 *   legacy getStats(callback) method in Chrome.
 * @return {MockRTCStatsReport} A mock RTCStatsReport object.
 */
MockRTCStatsReport.fromRTCStatsResponse = function fromRTCStatsResponse(statsResponse) {
    var activeCandidatePairId;
    var transportIds = new Map();
    var statsMap = statsResponse.result().reduce(function (map, report) {
        var id = report.id;
        switch (report.type) {
            case 'googCertificate':
                map.set(id, createRTCCertificateStats(report));
                break;
            case 'datachannel':
                map.set(id, createRTCDataChannelStats(report));
                break;
            case 'googCandidatePair':
                if (getBoolean(report, 'googActiveConnection')) {
                    activeCandidatePairId = id;
                }
                map.set(id, createRTCIceCandidatePairStats(report));
                break;
            case 'localcandidate':
                map.set(id, createRTCIceCandidateStats(report, false));
                break;
            case 'remotecandidate':
                map.set(id, createRTCIceCandidateStats(report, true));
                break;
            case 'ssrc':
                if (isPresent(report, 'packetsReceived')) {
                    map.set("rtp-".concat(id), createRTCInboundRTPStreamStats(report));
                }
                else {
                    map.set("rtp-".concat(id), createRTCOutboundRTPStreamStats(report));
                }
                map.set("track-".concat(id), createRTCMediaStreamTrackStats(report));
                map.set("codec-".concat(id), createRTCCodecStats(report));
                break;
            case 'googComponent':
                var transportReport = createRTCTransportStats(report);
                transportIds.set(transportReport.selectedCandidatePairId, id);
                map.set(id, createRTCTransportStats(report));
                break;
        }
        return map;
    }, new Map());
    if (activeCandidatePairId) {
        var activeTransportId = transportIds.get(activeCandidatePairId);
        if (activeTransportId) {
            statsMap.get(activeTransportId).dtlsState = 'connected';
        }
    }
    return new MockRTCStatsReport(statsMap);
};
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCTransportStats}
 */
function createRTCTransportStats(report) {
    return {
        bytesReceived: undefined,
        bytesSent: undefined,
        dtlsState: undefined,
        id: report.id,
        localCertificateId: report.stat('localCertificateId'),
        remoteCertificateId: report.stat('remoteCertificateId'),
        rtcpTransportStatsId: undefined,
        selectedCandidatePairId: report.stat('selectedCandidatePairId'),
        timestamp: Date.parse(report.timestamp),
        type: 'transport',
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCCodecStats}
 */
function createRTCCodecStats(report) {
    return {
        channels: undefined,
        clockRate: undefined,
        id: report.id,
        implementation: undefined,
        mimeType: "".concat(report.stat('mediaType'), "/").concat(report.stat('googCodecName')),
        payloadType: undefined,
        sdpFmtpLine: undefined,
        timestamp: Date.parse(report.timestamp),
        type: 'codec',
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCMediaStreamTrackStats}
 */
function createRTCMediaStreamTrackStats(report) {
    return {
        audioLevel: isPresent(report, 'audioOutputLevel')
            ? getInt(report, 'audioOutputLevel') / OLD_MAX_VOLUME
            : (getInt(report, 'audioInputLevel') || 0) / OLD_MAX_VOLUME,
        detached: undefined,
        echoReturnLoss: getFloat(report, 'googEchoCancellationReturnLoss'),
        echoReturnLossEnhancement: getFloat(report, 'googEchoCancellationReturnLossEnhancement'),
        ended: undefined,
        frameHeight: isPresent(report, 'googFrameHeightReceived')
            ? getInt(report, 'googFrameHeightReceived')
            : getInt(report, 'googFrameHeightSent'),
        frameWidth: isPresent(report, 'googFrameWidthReceived')
            ? getInt(report, 'googFrameWidthReceived')
            : getInt(report, 'googFrameWidthSent'),
        framesCorrupted: undefined,
        framesDecoded: getInt(report, 'framesDecoded'),
        framesDropped: undefined,
        framesPerSecond: undefined,
        framesReceived: undefined,
        framesSent: getInt(report, 'framesEncoded'),
        fullFramesLost: undefined,
        id: report.id,
        kind: report.stat('mediaType'),
        partialFramesLost: undefined,
        remoteSource: undefined,
        ssrcIds: undefined,
        timestamp: Date.parse(report.timestamp),
        trackIdentifier: report.stat('googTrackId'),
        type: 'track',
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @param {boolean} isInbound - Whether to create an inbound stats object, or outbound.
 * @returns {RTCRTPStreamStats}
 */
function createRTCRTPStreamStats(report, isInbound) {
    return {
        associateStatsId: undefined,
        codecId: "codec-".concat(report.id),
        firCount: isInbound
            ? getInt(report, 'googFirsSent')
            : undefined,
        id: report.id,
        isRemote: undefined,
        mediaType: report.stat('mediaType'),
        nackCount: isInbound
            ? getInt(report, 'googNacksSent')
            : getInt(report, 'googNacksReceived'),
        pliCount: isInbound
            ? getInt(report, 'googPlisSent')
            : getInt(report, 'googPlisReceived'),
        qpSum: getInt(report, 'qpSum'),
        sliCount: undefined,
        ssrc: report.stat('ssrc'),
        timestamp: Date.parse(report.timestamp),
        trackId: "track-".concat(report.id),
        transportId: report.stat('transportId'),
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCInboundRTPStreamStats}
 */
function createRTCInboundRTPStreamStats(report) {
    var rtp = createRTCRTPStreamStats(report, true);
    Object.assign(rtp, {
        burstDiscardCount: undefined,
        burstDiscardRate: undefined,
        burstLossCount: undefined,
        burstLossRate: undefined,
        burstPacketsDiscarded: undefined,
        burstPacketsLost: undefined,
        bytesReceived: getInt(report, 'bytesReceived'),
        fractionLost: undefined,
        framesDecoded: getInt(report, 'framesDecoded'),
        gapDiscardRate: undefined,
        gapLossRate: undefined,
        jitter: convertMsToSeconds(report.stat('googJitterReceived')),
        packetsDiscarded: undefined,
        packetsLost: getInt(report, 'packetsLost'),
        packetsReceived: getInt(report, 'packetsReceived'),
        packetsRepaired: undefined,
        roundTripTime: convertMsToSeconds(report.stat('googRtt')),
        type: 'inbound-rtp',
    });
    return rtp;
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCOutboundRTPStreamStats}
 */
function createRTCOutboundRTPStreamStats(report) {
    var rtp = createRTCRTPStreamStats(report, false);
    Object.assign(rtp, {
        bytesSent: getInt(report, 'bytesSent'),
        framesEncoded: getInt(report, 'framesEncoded'),
        packetsSent: getInt(report, 'packetsSent'),
        remoteTimestamp: undefined,
        targetBitrate: undefined,
        type: 'outbound-rtp',
    });
    return rtp;
}
/**
 * @param {RTCLegacyStatsReport} report
 * @param {boolean} isRemote - Whether to create for a remote candidate, or local candidate.
 * @returns {RTCIceCandidateStats}
 */
function createRTCIceCandidateStats(report, isRemote) {
    return {
        candidateType: translateCandidateType(report.stat('candidateType')),
        deleted: undefined,
        id: report.id,
        ip: report.stat('ipAddress'),
        isRemote: isRemote,
        port: getInt(report, 'portNumber'),
        priority: getFloat(report, 'priority'),
        protocol: report.stat('transport'),
        relayProtocol: undefined,
        timestamp: Date.parse(report.timestamp),
        transportId: undefined,
        type: isRemote
            ? 'remote-candidate'
            : 'local-candidate',
        url: undefined,
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCIceCandidatePairStats}
 */
function createRTCIceCandidatePairStats(report) {
    return {
        availableIncomingBitrate: undefined,
        availableOutgoingBitrate: undefined,
        bytesReceived: getInt(report, 'bytesReceived'),
        bytesSent: getInt(report, 'bytesSent'),
        consentRequestsSent: getInt(report, 'consentRequestsSent'),
        currentRoundTripTime: convertMsToSeconds(report.stat('googRtt')),
        id: report.id,
        lastPacketReceivedTimestamp: undefined,
        lastPacketSentTimestamp: undefined,
        localCandidateId: report.stat('localCandidateId'),
        nominated: undefined,
        priority: undefined,
        readable: undefined,
        remoteCandidateId: report.stat('remoteCandidateId'),
        requestsReceived: getInt(report, 'requestsReceived'),
        requestsSent: getInt(report, 'requestsSent'),
        responsesReceived: getInt(report, 'responsesReceived'),
        responsesSent: getInt(report, 'responsesSent'),
        retransmissionsReceived: undefined,
        retransmissionsSent: undefined,
        state: undefined,
        timestamp: Date.parse(report.timestamp),
        totalRoundTripTime: undefined,
        transportId: report.stat('googChannelId'),
        type: 'candidate-pair',
        writable: getBoolean(report, 'googWritable'),
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCIceCertificateStats}
 */
function createRTCCertificateStats(report) {
    return {
        base64Certificate: report.stat('googDerBase64'),
        fingerprint: report.stat('googFingerprint'),
        fingerprintAlgorithm: report.stat('googFingerprintAlgorithm'),
        id: report.id,
        issuerCertificateId: report.stat('googIssuerId'),
        timestamp: Date.parse(report.timestamp),
        type: 'certificate',
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCDataChannelStats}
 */
function createRTCDataChannelStats(report) {
    return {
        bytesReceived: undefined,
        bytesSent: undefined,
        datachannelid: report.stat('datachannelid'),
        id: report.id,
        label: report.stat('label'),
        messagesReceived: undefined,
        messagesSent: undefined,
        protocol: report.stat('protocol'),
        state: report.stat('state'),
        timestamp: Date.parse(report.timestamp),
        transportId: report.stat('transportId'),
        type: 'data-channel',
    };
}
/**
 * @param {number} inMs - A time in milliseconds
 * @returns {number} The time in seconds
 */
function convertMsToSeconds(inMs) {
    return isNaN(inMs) || inMs === ''
        ? undefined
        : parseInt(inMs, 10) / 1000;
}
/**
 * @param {string} type - A type in the legacy format
 * @returns {string} The type adjusted to new standards for known naming changes
 */
function translateCandidateType(type) {
    switch (type) {
        case 'peerreflexive':
            return 'prflx';
        case 'serverreflexive':
            return 'srflx';
        case 'host':
        case 'relay':
        default:
            return type;
    }
}
function getInt(report, statName) {
    var stat = report.stat(statName);
    return isPresent(report, statName)
        ? parseInt(stat, 10)
        : undefined;
}
function getFloat(report, statName) {
    var stat = report.stat(statName);
    return isPresent(report, statName)
        ? parseFloat(stat)
        : undefined;
}
function getBoolean(report, statName) {
    var stat = report.stat(statName);
    return isPresent(report, statName)
        ? (stat === 'true' || stat === true)
        : undefined;
}
function isPresent(report, statName) {
    var stat = report.stat(statName);
    return typeof stat !== 'undefined' && stat !== '';
}

exports.default = MockRTCStatsReport;


},{}],28:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var r0 = 94.768; // Constant used in computing "rFactor".
/**
 * Calculate the mos score of a stats object
 * @param {number} rtt
 * @param {number} jitter
 * @param {number} fractionLost - The fraction of packets that have been lost.
 * Calculated by packetsLost / totalPackets
 * @return {number | null} mos - Calculated MOS, `1.0` through roughly `4.5`.
 * Returns `null` when any of the input parameters are not a `non-negative`
 * number.
 */
function calculate(rtt, jitter, fractionLost) {
    if (typeof rtt !== 'number' ||
        typeof jitter !== 'number' ||
        typeof fractionLost !== 'number' ||
        !isNonNegativeNumber(rtt) ||
        !isNonNegativeNumber(jitter) ||
        !isNonNegativeNumber(fractionLost)) {
        return null;
    }
    // Compute the effective latency.
    var effectiveLatency = rtt + (jitter * 2) + 10;
    // Compute the initial "rFactor" from effective latency.
    var rFactor = 0;
    switch (true) {
        case effectiveLatency < 160:
            rFactor = r0 - (effectiveLatency / 40);
            break;
        case effectiveLatency < 1000:
            rFactor = r0 - ((effectiveLatency - 120) / 10);
            break;
    }
    // Adjust "rFactor" with the fraction of packets lost.
    switch (true) {
        case fractionLost <= (rFactor / 2.5):
            rFactor = Math.max(rFactor - fractionLost * 2.5, 6.52);
            break;
        default:
            rFactor = 0;
            break;
    }
    // Compute MOS from "rFactor".
    var mos = 1 +
        (0.035 * rFactor) +
        (0.000007 * rFactor) *
            (rFactor - 60) *
            (100 - rFactor);
    return mos;
}
/**
 * Returns true if and only if the parameter passed is a number, is not `NaN`,
 * is finite, and is greater than or equal to `0`.
 * @param n
 */
function isNonNegativeNumber(n) {
    return typeof n === 'number' && !isNaN(n) && isFinite(n) && n >= 0;
}
var Mos = {
    calculate: calculate,
    isNonNegativeNumber: isNonNegativeNumber,
};

exports.calculate = calculate;
exports.default = Mos;
exports.isNonNegativeNumber = isNonNegativeNumber;


},{}],29:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var index = require('../errors/index.js');
var log = require('../log.js');
var util = require('../util.js');
var rtcpc = require('./rtcpc.js');
var sdp = require('./sdp.js');
var generated = require('../errors/generated.js');

// @ts-nocheck
var ICE_GATHERING_TIMEOUT = 15000;
var ICE_GATHERING_FAIL_NONE = 'none';
var ICE_GATHERING_FAIL_TIMEOUT = 'timeout';
var INITIAL_ICE_CONNECTION_STATE = 'new';
var VOLUME_INTERVAL_MS = 50;
/**
 * @typedef {Object} PeerConnection
 * @param audioHelper
 * @param pstream
 * @param options
 * @return {PeerConnection}
 * @constructor
 */
function PeerConnection(audioHelper, pstream, options) {
    if (!audioHelper || !pstream) {
        throw new index.InvalidArgumentError('Audiohelper, and pstream are required arguments');
    }
    if (!(this instanceof PeerConnection)) {
        return new PeerConnection(audioHelper, pstream, options);
    }
    this._log = new log.default('PeerConnection');
    function noop() {
        this._log.warn('Unexpected noop call in peerconnection');
    }
    this.onaudio = noop;
    this.onopen = noop;
    this.onerror = noop;
    this.onclose = noop;
    this.ondisconnected = noop;
    this.onfailed = noop;
    this.onconnected = noop;
    this.onreconnected = noop;
    this.onsignalingstatechange = noop;
    this.ondtlstransportstatechange = noop;
    this.onicegatheringfailure = noop;
    this.onicegatheringstatechange = noop;
    this.oniceconnectionstatechange = noop;
    this.onpcconnectionstatechange = noop;
    this.onicecandidate = noop;
    this.onselectedcandidatepairchange = noop;
    this.onvolume = noop;
    this.version = null;
    this.pstream = pstream;
    this.stream = null;
    this.sinkIds = new Set(['default']);
    this.outputs = new Map();
    this.status = 'connecting';
    this.callSid = null;
    this.isMuted = false;
    var AudioContext = typeof window !== 'undefined'
        && (window.AudioContext || window.webkitAudioContext);
    this._isSinkSupported = !!AudioContext &&
        typeof HTMLAudioElement !== 'undefined' && HTMLAudioElement.prototype.setSinkId;
    // NOTE(mmalavalli): Since each Connection creates its own AudioContext,
    // after 6 instances an exception is thrown. Refer https://www.w3.org/2011/audio/track/issues/3.
    // In order to get around it, we are re-using the Device's AudioContext.
    this._audioContext = AudioContext && audioHelper._audioContext;
    this._audioHelper = audioHelper;
    this._hasIceCandidates = false;
    this._hasIceGatheringFailures = false;
    this._iceGatheringTimeoutId = null;
    this._masterAudio = null;
    this._masterAudioDeviceId = null;
    this._mediaStreamSource = null;
    this._dtmfSender = null;
    this._dtmfSenderUnsupported = false;
    this._callEvents = [];
    this._nextTimeToPublish = Date.now();
    this._onAnswerOrRinging = noop;
    this._onHangup = noop;
    this._remoteStream = null;
    this._shouldManageStream = true;
    this._iceState = INITIAL_ICE_CONNECTION_STATE;
    this.options = options = options || {};
    this.navigator = options.navigator
        || (typeof navigator !== 'undefined' ? navigator : null);
    this.util = options.util || util;
    this.codecPreferences = options.codecPreferences;
    return this;
}
PeerConnection.prototype.uri = function () {
    return this._uri;
};
/**
 * Open the underlying RTCPeerConnection with a MediaStream obtained by
 *   passed constraints. The resulting MediaStream is created internally
 *   and will therefore be managed and destroyed internally.
 * @param {MediaStreamConstraints} constraints
 */
PeerConnection.prototype.openDefaultDeviceWithConstraints = function (constraints) {
    return this._audioHelper._openDefaultDeviceWithConstraints(constraints)
        .then(this._setInputTracksFromStream.bind(this, false));
};
/**
 * Replace the existing input audio tracks with the audio tracks from the
 *   passed input audio stream. We re-use the existing stream because
 *   the AnalyzerNode is bound to the stream.
 * @param {MediaStream} stream
 */
PeerConnection.prototype.setInputTracksFromStream = function (stream) {
    var self = this;
    return this._setInputTracksFromStream(true, stream).then(function () {
        self._shouldManageStream = false;
    });
};
PeerConnection.prototype._createAnalyser = function (audioContext, options) {
    options = Object.assign({
        fftSize: 32,
        smoothingTimeConstant: 0.3,
    }, options);
    var analyser = audioContext.createAnalyser();
    // tslint:disable-next-line
    for (var field in options) {
        analyser[field] = options[field];
    }
    return analyser;
};
PeerConnection.prototype._setVolumeHandler = function (handler) {
    this.onvolume = handler;
};
PeerConnection.prototype._startPollingVolume = function () {
    if (!this._audioContext || !this.stream || !this._remoteStream) {
        return;
    }
    var audioContext = this._audioContext;
    var inputAnalyser = this._inputAnalyser = this._createAnalyser(audioContext);
    var inputBufferLength = inputAnalyser.frequencyBinCount;
    var inputDataArray = new Uint8Array(inputBufferLength);
    this._inputAnalyser2 = this._createAnalyser(audioContext, {
        maxDecibels: 0,
        minDecibels: -127,
        smoothingTimeConstant: 0,
    });
    var outputAnalyser = this._outputAnalyser = this._createAnalyser(audioContext);
    var outputBufferLength = outputAnalyser.frequencyBinCount;
    var outputDataArray = new Uint8Array(outputBufferLength);
    this._outputAnalyser2 = this._createAnalyser(audioContext, {
        maxDecibels: 0,
        minDecibels: -127,
        smoothingTimeConstant: 0,
    });
    this._updateInputStreamSource(this.stream);
    this._updateOutputStreamSource(this._remoteStream);
    var self = this;
    setTimeout(function emitVolume() {
        if (!self._audioContext) {
            return;
        }
        else if (self.status === 'closed') {
            self._inputAnalyser.disconnect();
            self._outputAnalyser.disconnect();
            self._inputAnalyser2.disconnect();
            self._outputAnalyser2.disconnect();
            return;
        }
        self._inputAnalyser.getByteFrequencyData(inputDataArray);
        var inputVolume = self.util.average(inputDataArray);
        self._inputAnalyser2.getByteFrequencyData(inputDataArray);
        var inputVolume2 = self.util.average(inputDataArray);
        self._outputAnalyser.getByteFrequencyData(outputDataArray);
        var outputVolume = self.util.average(outputDataArray);
        self._outputAnalyser2.getByteFrequencyData(outputDataArray);
        var outputVolume2 = self.util.average(outputDataArray);
        self.onvolume(inputVolume / 255, outputVolume / 255, inputVolume2, outputVolume2);
        setTimeout(emitVolume, VOLUME_INTERVAL_MS);
    }, VOLUME_INTERVAL_MS);
};
PeerConnection.prototype._stopStream = function _stopStream() {
    // We shouldn't stop the tracks if they were not created inside
    //   this PeerConnection.
    if (!this._shouldManageStream) {
        return;
    }
    this._audioHelper._stopDefaultInputDeviceStream();
};
/**
 * Update the stream source with the new input audio stream.
 * @param {MediaStream} stream
 * @private
 */
PeerConnection.prototype._updateInputStreamSource = function (stream) {
    if (this._inputStreamSource) {
        this._inputStreamSource.disconnect();
    }
    try {
        this._inputStreamSource = this._audioContext.createMediaStreamSource(stream);
        this._inputStreamSource.connect(this._inputAnalyser);
        this._inputStreamSource.connect(this._inputAnalyser2);
    }
    catch (ex) {
        this._log.warn('Unable to update input MediaStreamSource', ex);
        this._inputStreamSource = null;
    }
};
/**
 * Update the stream source with the new ouput audio stream.
 * @param {MediaStream} stream
 * @private
 */
PeerConnection.prototype._updateOutputStreamSource = function (stream) {
    if (this._outputStreamSource) {
        this._outputStreamSource.disconnect();
    }
    try {
        this._outputStreamSource = this._audioContext.createMediaStreamSource(stream);
        this._outputStreamSource.connect(this._outputAnalyser);
        this._outputStreamSource.connect(this._outputAnalyser2);
    }
    catch (ex) {
        this._log.warn('Unable to update output MediaStreamSource', ex);
        this._outputStreamSource = null;
    }
};
/**
 * Replace the tracks of the current stream with new tracks. We do this rather than replacing the
 *   whole stream because AnalyzerNodes are bound to a stream.
 * @param {Boolean} shouldClone - Whether the stream should be cloned if it is the first
 *   stream, or set directly. As a rule of thumb, streams that are passed in externally may have
 *   their lifecycle managed externally, and should be cloned so that we do not tear it or its tracks
 *   down when the call ends. Streams that we create internally (inside PeerConnection) should be set
 *   directly so that when the call ends it is disposed of.
 * @param {MediaStream} newStream - The new stream to copy the tracks over from.
 * @private
 */
PeerConnection.prototype._setInputTracksFromStream = function (shouldClone, newStream) {
    var _this = this;
    if (!newStream) {
        return Promise.reject(new index.InvalidArgumentError('Can not set input stream to null while in a call'));
    }
    if (!newStream.getAudioTracks().length) {
        return Promise.reject(new index.InvalidArgumentError('Supplied input stream has no audio tracks'));
    }
    var localStream = this.stream;
    var getStreamPromise = function () {
        // Apply mute settings to new input track
        _this.mute(_this.isMuted);
        return Promise.resolve(_this.stream);
    };
    if (!localStream) {
        // We can't use MediaStream.clone() here because it stopped copying over tracks
        //   as of Chrome 61. https://bugs.chromium.org/p/chromium/issues/detail?id=770908
        this.stream = shouldClone ? cloneStream(newStream, this.options.MediaStream) : newStream;
    }
    else {
        // If the call was started with gUM, and we are now replacing that track with an
        // external stream's tracks, we should stop the old managed track.
        if (this._shouldManageStream) {
            this._stopStream();
        }
        if (!this._sender) {
            this._sender = this.version.pc.getSenders()[0];
        }
        return this._sender.replaceTrack(newStream.getAudioTracks()[0]).then(function () {
            _this._updateInputStreamSource(newStream);
            _this.stream = shouldClone ? cloneStream(newStream, _this.options.MediaStream) : newStream;
            return getStreamPromise();
        });
    }
    return getStreamPromise();
};
PeerConnection.prototype._onInputDevicesChanged = function () {
    if (!this.stream) {
        return;
    }
    // If all of our active tracks are ended, then our active input was lost
    var activeInputWasLost = this.stream.getAudioTracks().every(function (track) { return track.readyState === 'ended'; });
    // We only want to act if we manage the stream in PeerConnection (It was created
    // here, rather than passed in.)
    if (activeInputWasLost && this._shouldManageStream) {
        this.openDefaultDeviceWithConstraints({ audio: true });
    }
};
PeerConnection.prototype._onIceGatheringFailure = function (type) {
    this._hasIceGatheringFailures = true;
    this.onicegatheringfailure(type);
};
PeerConnection.prototype._onMediaConnectionStateChange = function (newState) {
    var previousState = this._iceState;
    if (previousState === newState
        || (newState !== 'connected'
            && newState !== 'disconnected'
            && newState !== 'failed')) {
        return;
    }
    this._iceState = newState;
    var message;
    switch (newState) {
        case 'connected':
            if (previousState === 'disconnected' || previousState === 'failed') {
                message = 'ICE liveliness check succeeded. Connection with Twilio restored';
                this._log.info(message);
                this.onreconnected(message);
            }
            else {
                message = 'Media connection established.';
                this._log.info(message);
                this.onconnected(message);
            }
            this._stopIceGatheringTimeout();
            this._hasIceGatheringFailures = false;
            break;
        case 'disconnected':
            message = 'ICE liveliness check failed. May be having trouble connecting to Twilio';
            this._log.warn(message);
            this.ondisconnected(message);
            break;
        case 'failed':
            message = 'Connection with Twilio was interrupted.';
            this._log.warn(message);
            this.onfailed(message);
            break;
    }
};
PeerConnection.prototype._setSinkIds = function (sinkIds) {
    if (!this._isSinkSupported) {
        return Promise.reject(new index.NotSupportedError('Audio output selection is not supported by this browser'));
    }
    this.sinkIds = new Set(sinkIds.forEach ? sinkIds : [sinkIds]);
    return this.version
        ? this._updateAudioOutputs()
        : Promise.resolve();
};
/**
 * Start timeout for ICE Gathering
 */
PeerConnection.prototype._startIceGatheringTimeout = function startIceGatheringTimeout() {
    var _this = this;
    this._stopIceGatheringTimeout();
    this._iceGatheringTimeoutId = setTimeout(function () {
        _this._onIceGatheringFailure(ICE_GATHERING_FAIL_TIMEOUT);
    }, ICE_GATHERING_TIMEOUT);
};
/**
 * Stop timeout for ICE Gathering
 */
PeerConnection.prototype._stopIceGatheringTimeout = function stopIceGatheringTimeout() {
    clearInterval(this._iceGatheringTimeoutId);
};
PeerConnection.prototype._updateAudioOutputs = function updateAudioOutputs() {
    var addedOutputIds = Array.from(this.sinkIds).filter(function (id) {
        return !this.outputs.has(id);
    }, this);
    var removedOutputIds = Array.from(this.outputs.keys()).filter(function (id) {
        return !this.sinkIds.has(id);
    }, this);
    var self = this;
    var createOutputPromises = addedOutputIds.map(this._createAudioOutput, this);
    return Promise.all(createOutputPromises).then(function () { return Promise.all(removedOutputIds.map(self._removeAudioOutput, self)); });
};
PeerConnection.prototype._createAudio = function createAudio(arr) {
    var audio = new Audio(arr);
    this.onaudio(audio);
    return audio;
};
PeerConnection.prototype._createAudioOutput = function createAudioOutput(id) {
    var dest = null;
    if (this._mediaStreamSource) {
        dest = this._audioContext.createMediaStreamDestination();
        this._mediaStreamSource.connect(dest);
    }
    var audio = this._createAudio();
    setAudioSource(audio, dest && dest.stream ? dest.stream : this.pcStream);
    var self = this;
    return audio.setSinkId(id).then(function () { return audio.play(); }).then(function () {
        self.outputs.set(id, {
            audio: audio,
            dest: dest,
        });
    });
};
PeerConnection.prototype._removeAudioOutputs = function removeAudioOutputs() {
    if (this._masterAudio && typeof this._masterAudioDeviceId !== 'undefined') {
        this._disableOutput(this, this._masterAudioDeviceId);
        this.outputs.delete(this._masterAudioDeviceId);
        this._masterAudioDeviceId = null;
        // Release the audio resources before deleting the audio
        if (!this._masterAudio.paused) {
            this._masterAudio.pause();
        }
        if (typeof this._masterAudio.srcObject !== 'undefined') {
            this._masterAudio.srcObject = null;
        }
        else {
            this._masterAudio.src = '';
        }
        this._masterAudio = null;
    }
    return Array.from(this.outputs.keys()).map(this._removeAudioOutput, this);
};
PeerConnection.prototype._disableOutput = function disableOutput(pc, id) {
    var output = pc.outputs.get(id);
    if (!output) {
        return;
    }
    if (output.audio) {
        output.audio.pause();
        output.audio.src = '';
    }
    if (output.dest) {
        output.dest.disconnect();
    }
};
/**
 * Disable a non-master output, and update the master output to assume its state. This
 *   is called when the device ID assigned to the master output has been removed from
 *   active devices. We can not simply remove the master audio output, so we must
 *   instead reassign it.
 * @private
 * @param {PeerConnection} pc
 * @param {string} masterId - The current device ID assigned to the master audio element.
 */
PeerConnection.prototype._reassignMasterOutput = function reassignMasterOutput(pc, masterId) {
    var masterOutput = pc.outputs.get(masterId);
    pc.outputs.delete(masterId);
    var self = this;
    var activeDeviceId = Array.from(pc.outputs.keys())[0];
    // The audio device key could also be '' on Chrome if no media device permissions are allowed
    var idToReplace = typeof activeDeviceId === 'string' ? activeDeviceId : 'default';
    return masterOutput.audio.setSinkId(idToReplace).then(function () {
        self._disableOutput(pc, idToReplace);
        pc.outputs.set(idToReplace, masterOutput);
        pc._masterAudioDeviceId = idToReplace;
    }).catch(function rollback() {
        pc.outputs.set(masterId, masterOutput);
        self._log.info('Could not reassign master output. Attempted to roll back.');
    });
};
PeerConnection.prototype._removeAudioOutput = function removeAudioOutput(id) {
    if (this._masterAudioDeviceId === id) {
        return this._reassignMasterOutput(this, id);
    }
    this._disableOutput(this, id);
    this.outputs.delete(id);
    return Promise.resolve();
};
/**
 * Use an AudioContext to potentially split our audio output stream to multiple
 *   audio devices. This is only available to browsers with AudioContext and
 *   HTMLAudioElement.setSinkId() available. We save the source stream in
 *   _masterAudio, and use it for one of the active audio devices. We keep
 *   track of its ID because we must replace it if we lose its initial device.
 */
PeerConnection.prototype._onAddTrack = function onAddTrack(pc, stream) {
    var audio = pc._masterAudio = this._createAudio();
    setAudioSource(audio, stream);
    audio.play();
    // Assign the initial master audio element to a random active output device
    var activeDeviceId = Array.from(pc.outputs.keys())[0];
    // The audio device key could also be '' on Chrome if no media device permissions are allowed
    var deviceId = typeof activeDeviceId === 'string' ? activeDeviceId : 'default';
    pc._masterAudioDeviceId = deviceId;
    pc.outputs.set(deviceId, { audio: audio });
    try {
        pc._mediaStreamSource = pc._audioContext.createMediaStreamSource(stream);
    }
    catch (ex) {
        this._log.warn('Unable to create a MediaStreamSource from onAddTrack', ex);
        this._mediaStreamSource = null;
    }
    pc.pcStream = stream;
    pc._updateAudioOutputs();
};
/**
 * Use a single audio element to play the audio output stream. This does not
 *   support multiple output devices, and is a fallback for when AudioContext
 *   and/or HTMLAudioElement.setSinkId() is not available to the client.
 */
PeerConnection.prototype._fallbackOnAddTrack = function fallbackOnAddTrack(pc, stream) {
    var audio = document && document.createElement('audio');
    audio.autoplay = true;
    if (!setAudioSource(audio, stream)) {
        pc._log.info('Error attaching stream to element.');
    }
    pc.outputs.set('default', { audio: audio });
};
PeerConnection.prototype._setEncodingParameters = function (enableDscp) {
    if (!enableDscp
        || !this._sender
        || typeof this._sender.getParameters !== 'function'
        || typeof this._sender.setParameters !== 'function') {
        return;
    }
    var params = this._sender.getParameters();
    if (!params.priority && !(params.encodings && params.encodings.length)) {
        return;
    }
    // This is how MDN's RTPSenderParameters defines priority
    params.priority = 'high';
    // And this is how it's currently implemented in Chrome M72+
    if (params.encodings && params.encodings.length) {
        params.encodings.forEach(function (encoding) {
            encoding.priority = 'high';
            encoding.networkPriority = 'high';
        });
    }
    this._sender.setParameters(params);
};
PeerConnection.prototype._setupPeerConnection = function (rtcConfiguration) {
    var _this = this;
    var self = this;
    var version = new (this.options.rtcpcFactory || rtcpc.default)({ RTCPeerConnection: this.options.RTCPeerConnection });
    version.create(rtcConfiguration);
    addStream(version.pc, this.stream);
    var supportedCodecs = RTCRtpReceiver.getCapabilities('audio').codecs;
    this._log.debug('sorting codecs', supportedCodecs, this.codecPreferences);
    var sortedCodecs = util.sortByMimeTypes(supportedCodecs, this.codecPreferences);
    var transceiver = version.pc.getTransceivers()[0];
    this._log.debug('setting sorted codecs', sortedCodecs);
    transceiver.setCodecPreferences(sortedCodecs);
    var eventName = 'ontrack' in version.pc
        ? 'ontrack' : 'onaddstream';
    version.pc[eventName] = function (event) {
        var stream = self._remoteStream = event.stream || event.streams[0];
        if (typeof version.pc.getSenders === 'function') {
            _this._sender = version.pc.getSenders()[0];
        }
        if (self._isSinkSupported) {
            self._onAddTrack(self, stream);
        }
        else {
            self._fallbackOnAddTrack(self, stream);
        }
        self._startPollingVolume();
    };
    return version;
};
PeerConnection.prototype._maybeSetIceAggressiveNomination = function (sdp$1) {
    return this.options.forceAggressiveIceNomination ? sdp.setIceAggressiveNomination(sdp$1) : sdp$1;
};
PeerConnection.prototype._setupChannel = function () {
    var _this = this;
    var pc = this.version.pc;
    // Chrome 25 supports onopen
    this.version.pc.onopen = function () {
        _this.status = 'open';
        _this.onopen();
    };
    // Chrome 26 doesn't support onopen so must detect state change
    this.version.pc.onstatechange = function () {
        if (_this.version.pc && _this.version.pc.readyState === 'stable') {
            _this.status = 'open';
            _this.onopen();
        }
    };
    // Chrome 27 changed onstatechange to onsignalingstatechange
    this.version.pc.onsignalingstatechange = function () {
        var state = pc.signalingState;
        _this._log.info("signalingState is \"".concat(state, "\""));
        if (_this.version.pc && _this.version.pc.signalingState === 'stable') {
            _this.status = 'open';
            _this.onopen();
        }
        _this.onsignalingstatechange(pc.signalingState);
    };
    // Chrome 72+
    pc.onconnectionstatechange = function (event) {
        var state = pc.connectionState;
        if (!state && event && event.target) {
            // VDI environment
            var targetPc = event.target;
            state = targetPc.connectionState || targetPc.connectionState_;
            _this._log.info("pc.connectionState not detected. Using target PC. State=".concat(state));
        }
        if (!state) {
            _this._log.warn("onconnectionstatechange detected but state is \"".concat(state, "\""));
        }
        else {
            _this._log.info("pc.connectionState is \"".concat(state, "\""));
        }
        _this.onpcconnectionstatechange(state);
        _this._onMediaConnectionStateChange(state);
    };
    pc.onicecandidate = function (event) {
        var candidate = event.candidate;
        if (candidate) {
            _this._hasIceCandidates = true;
            _this.onicecandidate(candidate);
            _this._setupRTCIceTransportListener();
        }
        _this._log.info("ICE Candidate: ".concat(JSON.stringify(candidate)));
    };
    pc.onicegatheringstatechange = function () {
        var state = pc.iceGatheringState;
        if (state === 'gathering') {
            _this._startIceGatheringTimeout();
        }
        else if (state === 'complete') {
            _this._stopIceGatheringTimeout();
            // Fail if no candidates found
            if (!_this._hasIceCandidates) {
                _this._onIceGatheringFailure(ICE_GATHERING_FAIL_NONE);
            }
            // There was a failure mid-gathering phase. We want to start our timer and issue
            // an ice restart if we don't get connected after our timeout
            if (_this._hasIceCandidates && _this._hasIceGatheringFailures) {
                _this._startIceGatheringTimeout();
            }
        }
        _this._log.info("pc.iceGatheringState is \"".concat(pc.iceGatheringState, "\""));
        _this.onicegatheringstatechange(state);
    };
    pc.oniceconnectionstatechange = function () {
        _this._log.info("pc.iceConnectionState is \"".concat(pc.iceConnectionState, "\""));
        _this.oniceconnectionstatechange(pc.iceConnectionState);
        _this._onMediaConnectionStateChange(pc.iceConnectionState);
    };
};
PeerConnection.prototype._initializeMediaStream = function (rtcConfiguration) {
    // if mediastream already open then do nothing
    if (this.status === 'open') {
        return false;
    }
    if (this.pstream.status === 'disconnected') {
        this.onerror({ info: {
                code: 31000,
                message: 'Cannot establish connection. Client is disconnected',
                twilioError: new generated.SignalingErrors.ConnectionDisconnected(),
            } });
        this.close();
        return false;
    }
    this.version = this._setupPeerConnection(rtcConfiguration);
    this._setupChannel();
    return true;
};
/**
 * Remove reconnection-related listeners
 * @private
 */
PeerConnection.prototype._removeReconnectionListeners = function () {
    if (this.pstream) {
        this.pstream.removeListener('answer', this._onAnswerOrRinging);
        this.pstream.removeListener('hangup', this._onHangup);
    }
};
/**
 * Setup a listener for RTCDtlsTransport to capture state changes events
 * @private
 */
PeerConnection.prototype._setupRTCDtlsTransportListener = function () {
    var _this = this;
    var dtlsTransport = this.getRTCDtlsTransport();
    if (!dtlsTransport || dtlsTransport.onstatechange) {
        return;
    }
    var handler = function () {
        _this._log.info("dtlsTransportState is \"".concat(dtlsTransport.state, "\""));
        _this.ondtlstransportstatechange(dtlsTransport.state);
    };
    // Publish initial state
    handler();
    dtlsTransport.onstatechange = handler;
};
/**
 * Setup a listener for RTCIceTransport to capture selected candidate pair changes
 * @private
 */
PeerConnection.prototype._setupRTCIceTransportListener = function () {
    var _this = this;
    var iceTransport = this._getRTCIceTransport();
    if (!iceTransport || iceTransport.onselectedcandidatepairchange) {
        return;
    }
    iceTransport.onselectedcandidatepairchange = function () {
        return _this.onselectedcandidatepairchange(iceTransport.getSelectedCandidatePair());
    };
};
/**
 * Restarts ICE for the current connection
 * ICE Restart failures are ignored. Retries are managed in Connection
 * @private
 */
PeerConnection.prototype.iceRestart = function () {
    var _this = this;
    this._log.info('Attempting to restart ICE...');
    this._hasIceCandidates = false;
    this.version.createOffer(this.options.maxAverageBitrate, { iceRestart: true }).then(function () {
        _this._removeReconnectionListeners();
        _this._onAnswerOrRinging = function (payload) {
            _this._removeReconnectionListeners();
            if (!payload.sdp || _this.version.pc.signalingState !== 'have-local-offer') {
                var message = 'Invalid state or param during ICE Restart:'
                    + "hasSdp:".concat(!!payload.sdp, ", signalingState:").concat(_this.version.pc.signalingState);
                _this._log.warn(message);
                return;
            }
            var sdp = _this._maybeSetIceAggressiveNomination(payload.sdp);
            _this._answerSdp = sdp;
            if (_this.status !== 'closed') {
                _this.version.processAnswer(_this.codecPreferences, sdp, null, function (err) {
                    var message = err && err.message ? err.message : err;
                    _this._log.error("Failed to process answer during ICE Restart. Error: ".concat(message));
                });
            }
        };
        _this._onHangup = function () {
            _this._log.info('Received hangup during ICE Restart');
            _this._removeReconnectionListeners();
        };
        _this.pstream.on('answer', _this._onAnswerOrRinging);
        _this.pstream.on('hangup', _this._onHangup);
        _this.pstream.reinvite(_this.version.getSDP(), _this.callSid);
    }).catch(function (err) {
        var message = err && err.message ? err.message : err;
        _this._log.error("Failed to createOffer during ICE Restart. Error: ".concat(message));
        // CreateOffer failures doesn't transition ice state to failed
        // We need trigger it so it can be picked up by retries
        _this.onfailed(message);
    });
};
PeerConnection.prototype.makeOutgoingCall = function (params, signalingReconnectToken, callsid, rtcConfiguration, onMediaStarted) {
    var _this = this;
    if (!this._initializeMediaStream(rtcConfiguration)) {
        return;
    }
    var self = this;
    this.callSid = callsid;
    function onAnswerSuccess() {
        if (self.options) {
            self._setEncodingParameters(self.options.dscp);
        }
        onMediaStarted(self.version.pc);
    }
    function onAnswerError(err) {
        var errMsg = err.message || err;
        self.onerror({ info: {
                code: 31000,
                message: "Error processing answer: ".concat(errMsg),
                twilioError: new generated.MediaErrors.ClientRemoteDescFailed(),
            } });
    }
    this._onAnswerOrRinging = function (payload) {
        if (!payload.sdp) {
            return;
        }
        var sdp = _this._maybeSetIceAggressiveNomination(payload.sdp);
        self._answerSdp = sdp;
        if (self.status !== 'closed') {
            self.version.processAnswer(_this.codecPreferences, sdp, onAnswerSuccess, onAnswerError);
        }
        self.pstream.removeListener('answer', self._onAnswerOrRinging);
        self.pstream.removeListener('ringing', self._onAnswerOrRinging);
    };
    this.pstream.on('answer', this._onAnswerOrRinging);
    this.pstream.on('ringing', this._onAnswerOrRinging);
    function onOfferSuccess() {
        if (self.status !== 'closed') {
            if (signalingReconnectToken) {
                self.pstream.reconnect(self.version.getSDP(), self.callSid, signalingReconnectToken);
            }
            else {
                self.pstream.invite(self.version.getSDP(), self.callSid, params);
            }
            self._setupRTCDtlsTransportListener();
        }
    }
    function onOfferError(err) {
        var errMsg = err.message || err;
        self.onerror({ info: {
                code: 31000,
                message: "Error creating the offer: ".concat(errMsg),
                twilioError: new generated.MediaErrors.ClientLocalDescFailed(),
            } });
    }
    this.version.createOffer(this.options.maxAverageBitrate, { audio: true }, onOfferSuccess, onOfferError);
};
PeerConnection.prototype.answerIncomingCall = function (callSid, sdp, rtcConfiguration, onMediaStarted) {
    if (!this._initializeMediaStream(rtcConfiguration)) {
        return;
    }
    sdp = this._maybeSetIceAggressiveNomination(sdp);
    this._answerSdp = sdp.replace(/^a=setup:actpass$/gm, 'a=setup:passive');
    this.callSid = callSid;
    var self = this;
    function onAnswerSuccess() {
        if (self.status !== 'closed') {
            self.pstream.answer(self.version.getSDP(), callSid);
            if (self.options) {
                self._setEncodingParameters(self.options.dscp);
            }
            onMediaStarted(self.version.pc);
            self._setupRTCDtlsTransportListener();
        }
    }
    function onAnswerError(err) {
        var errMsg = err.message || err;
        self.onerror({ info: {
                code: 31000,
                message: "Error creating the answer: ".concat(errMsg),
                twilioError: new generated.MediaErrors.ClientRemoteDescFailed(),
            } });
    }
    this.version.processSDP(this.options.maxAverageBitrate, this.codecPreferences, sdp, { audio: true }, onAnswerSuccess, onAnswerError);
};
PeerConnection.prototype.close = function () {
    if (this.version && this.version.pc) {
        if (this.version.pc.signalingState !== 'closed') {
            this.version.pc.close();
        }
        this.version.pc = null;
    }
    if (this.stream) {
        this.mute(false);
        this._stopStream();
    }
    this.stream = null;
    this._removeReconnectionListeners();
    this._stopIceGatheringTimeout();
    Promise.all(this._removeAudioOutputs()).catch(function () {
        // We don't need to alert about failures here.
    });
    if (this._mediaStreamSource) {
        this._mediaStreamSource.disconnect();
    }
    if (this._inputAnalyser) {
        this._inputAnalyser.disconnect();
    }
    if (this._outputAnalyser) {
        this._outputAnalyser.disconnect();
    }
    if (this._inputAnalyser2) {
        this._inputAnalyser2.disconnect();
    }
    if (this._outputAnalyser2) {
        this._outputAnalyser2.disconnect();
    }
    this.status = 'closed';
    this.onclose();
};
PeerConnection.prototype.reject = function (callSid) {
    this.callSid = callSid;
};
PeerConnection.prototype.ignore = function (callSid) {
    this.callSid = callSid;
};
/**
 * Mute or unmute input audio. If the stream is not yet present, the setting
 *   is saved and applied to future streams/tracks.
 * @params {boolean} shouldMute - Whether the input audio should
 *   be muted or unmuted.
 */
PeerConnection.prototype.mute = function (shouldMute) {
    this.isMuted = shouldMute;
    if (!this.stream) {
        return;
    }
    if (this._sender && this._sender.track) {
        this._sender.track.enabled = !shouldMute;
    }
    else {
        var audioTracks = typeof this.stream.getAudioTracks === 'function'
            ? this.stream.getAudioTracks()
            : this.stream.audioTracks;
        audioTracks.forEach(function (track) {
            track.enabled = !shouldMute;
        });
    }
};
/**
 * Get or create an RTCDTMFSender for the first local audio MediaStreamTrack
 * we can get from the RTCPeerConnection. Return null if unsupported.
 * @instance
 * @returns ?RTCDTMFSender
 */
PeerConnection.prototype.getOrCreateDTMFSender = function getOrCreateDTMFSender() {
    if (this._dtmfSender || this._dtmfSenderUnsupported) {
        return this._dtmfSender || null;
    }
    var self = this;
    var pc = this.version.pc;
    if (!pc) {
        this._log.warn('No RTCPeerConnection available to call createDTMFSender on');
        return null;
    }
    if (typeof pc.getSenders === 'function' && (typeof RTCDTMFSender === 'function' || typeof RTCDtmfSender === 'function')) {
        var chosenSender = pc.getSenders().find(function (sender) { return sender.dtmf; });
        if (chosenSender) {
            this._log.info('Using RTCRtpSender#dtmf');
            this._dtmfSender = chosenSender.dtmf;
            return this._dtmfSender;
        }
    }
    if (typeof pc.createDTMFSender === 'function' && typeof pc.getLocalStreams === 'function') {
        var track = pc.getLocalStreams().map(function (stream) {
            var tracks = self._getAudioTracks(stream);
            return tracks && tracks[0];
        })[0];
        if (!track) {
            this._log.warn('No local audio MediaStreamTrack available on the RTCPeerConnection to pass to createDTMFSender');
            return null;
        }
        this._log.info('Creating RTCDTMFSender');
        this._dtmfSender = pc.createDTMFSender(track);
        return this._dtmfSender;
    }
    this._log.info('RTCPeerConnection does not support RTCDTMFSender');
    this._dtmfSenderUnsupported = true;
    return null;
};
/**
 * Get the RTCDtlTransport object from the PeerConnection
 * @returns RTCDtlTransport
 */
PeerConnection.prototype.getRTCDtlsTransport = function getRTCDtlsTransport() {
    var sender = this.version && this.version.pc
        && typeof this.version.pc.getSenders === 'function'
        && this.version.pc.getSenders()[0];
    return sender && sender.transport || null;
};
PeerConnection.prototype._canStopMediaStreamTrack = function () { return typeof MediaStreamTrack.prototype.stop === 'function'; };
PeerConnection.prototype._getAudioTracks = function (stream) { return typeof stream.getAudioTracks === 'function' ?
    stream.getAudioTracks() : stream.audioTracks; };
/**
 * Get the RTCIceTransport object from the PeerConnection
 * @returns RTCIceTransport
 */
PeerConnection.prototype._getRTCIceTransport = function _getRTCIceTransport() {
    var dtlsTransport = this.getRTCDtlsTransport();
    return dtlsTransport && dtlsTransport.iceTransport || null;
};
// Is PeerConnection.protocol used outside of our SDK? We should remove this if not.
PeerConnection.protocol = ((function () { return rtcpc.default.test() ? new rtcpc.default() : null; }))();
function addStream(pc, stream) {
    if (typeof pc.addTrack === 'function') {
        stream.getAudioTracks().forEach(function (track) {
            // The second parameters, stream, should not be necessary per the latest editor's
            //   draft, but FF requires it. https://bugzilla.mozilla.org/show_bug.cgi?id=1231414
            pc.addTrack(track, stream);
        });
    }
    else {
        pc.addStream(stream);
    }
}
function cloneStream(oldStream, _MediaStream) {
    var newStream;
    if (_MediaStream) {
        newStream = new _MediaStream();
    }
    else if (typeof MediaStream !== 'undefined') {
        newStream = new MediaStream();
    }
    else {
        newStream = new webkitMediaStream();
    }
    oldStream.getAudioTracks().forEach(newStream.addTrack, newStream);
    return newStream;
}
/**
 * Set the source of an HTMLAudioElement to the specified MediaStream
 * @param {HTMLAudioElement} audio
 * @param {MediaStream} stream
 * @returns {boolean} Whether the audio source was set successfully
 */
function setAudioSource(audio, stream) {
    if (typeof audio.srcObject !== 'undefined') {
        audio.srcObject = stream;
    }
    else if (typeof audio.mozSrcObject !== 'undefined') {
        audio.mozSrcObject = stream;
    }
    else if (typeof audio.src !== 'undefined') {
        var _window = audio.options.window || window;
        audio.src = (_window.URL || _window.webkitURL).createObjectURL(stream);
    }
    else {
        return false;
    }
    return true;
}
PeerConnection.enabled = rtcpc.default.test();

exports.default = PeerConnection;


},{"../errors/generated.js":14,"../errors/index.js":15,"../log.js":18,"../util.js":37,"./rtcpc.js":30,"./sdp.js":31}],30:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var log = require('../log.js');
var util = require('../util.js');
var sdp = require('./sdp.js');

// @ts-nocheck
// tslint:disable only-arrow-functions
/* global webkitRTCPeerConnection, mozRTCPeerConnection, mozRTCSessionDescription, mozRTCIceCandidate */
function RTCPC(options) {
    this.log = new log.default('RTCPC');
    if (typeof window === 'undefined') {
        this.log.info('No RTCPeerConnection implementation available. The window object was not found.');
        return;
    }
    if (options && options.RTCPeerConnection) {
        this.RTCPeerConnection = options.RTCPeerConnection;
    }
    else if (typeof window.RTCPeerConnection === 'function') {
        this.RTCPeerConnection = window.RTCPeerConnection;
    }
    else if (typeof window.webkitRTCPeerConnection === 'function') {
        this.RTCPeerConnection = webkitRTCPeerConnection;
    }
    else if (typeof window.mozRTCPeerConnection === 'function') {
        this.RTCPeerConnection = mozRTCPeerConnection;
        window.RTCSessionDescription = mozRTCSessionDescription;
        window.RTCIceCandidate = mozRTCIceCandidate;
    }
    else {
        this.log.info('No RTCPeerConnection implementation available');
    }
}
RTCPC.prototype.create = function (rtcConfiguration) {
    this.pc = new this.RTCPeerConnection(rtcConfiguration);
};
RTCPC.prototype.createModernConstraints = function (c) {
    // createOffer differs between Chrome 23 and Chrome 24+.
    // See https://groups.google.com/forum/?fromgroups=#!topic/discuss-webrtc/JBDZtrMumyU
    // Unfortunately I haven't figured out a way to detect which format
    // is required ahead of time, so we'll first try the old way, and
    // if we get an exception, then we'll try the new way.
    if (typeof c === 'undefined') {
        return null;
    }
    // NOTE(mroberts): As of Chrome 38, Chrome still appears to expect
    // constraints under the 'mandatory' key, and with the first letter of each
    // constraint capitalized. Firefox, on the other hand, has deprecated the
    // 'mandatory' key and does not expect the first letter of each constraint
    // capitalized.
    var nc = Object.assign({}, c);
    if (typeof webkitRTCPeerConnection !== 'undefined' && !util.isLegacyEdge()) {
        nc.mandatory = {};
        if (typeof c.audio !== 'undefined') {
            nc.mandatory.OfferToReceiveAudio = c.audio;
        }
        if (typeof c.video !== 'undefined') {
            nc.mandatory.OfferToReceiveVideo = c.video;
        }
    }
    else {
        if (typeof c.audio !== 'undefined') {
            nc.offerToReceiveAudio = c.audio;
        }
        if (typeof c.video !== 'undefined') {
            nc.offerToReceiveVideo = c.video;
        }
    }
    delete nc.audio;
    delete nc.video;
    return nc;
};
RTCPC.prototype.createOffer = function (maxAverageBitrate, constraints, onSuccess, onError) {
    var _this = this;
    constraints = this.createModernConstraints(constraints);
    return promisifyCreate(this.pc.createOffer, this.pc)(constraints).then(function (offer) {
        if (!_this.pc) {
            return Promise.resolve();
        }
        var sdp$1 = sdp.setMaxAverageBitrate(offer.sdp, maxAverageBitrate);
        return promisifySet(_this.pc.setLocalDescription, _this.pc)(new RTCSessionDescription({
            sdp: sdp$1,
            type: 'offer',
        }));
    }).then(onSuccess, onError);
};
RTCPC.prototype.createAnswer = function (maxAverageBitrate, constraints, onSuccess, onError) {
    var _this = this;
    constraints = this.createModernConstraints(constraints);
    return promisifyCreate(this.pc.createAnswer, this.pc)(constraints).then(function (answer) {
        if (!_this.pc) {
            return Promise.resolve();
        }
        var sdp$1 = sdp.setMaxAverageBitrate(answer.sdp, maxAverageBitrate);
        return promisifySet(_this.pc.setLocalDescription, _this.pc)(new RTCSessionDescription({
            sdp: sdp$1,
            type: 'answer',
        }));
    }).then(onSuccess, onError);
};
RTCPC.prototype.processSDP = function (maxAverageBitrate, codecPreferences, sdp$1, constraints, onSuccess, onError) {
    var _this = this;
    sdp$1 = sdp.setCodecPreferences(sdp$1, codecPreferences);
    var desc = new RTCSessionDescription({ sdp: sdp$1, type: 'offer' });
    return promisifySet(this.pc.setRemoteDescription, this.pc)(desc).then(function () {
        _this.createAnswer(maxAverageBitrate, constraints, onSuccess, onError);
    });
};
RTCPC.prototype.getSDP = function () {
    return this.pc.localDescription.sdp;
};
RTCPC.prototype.processAnswer = function (codecPreferences, sdp$1, onSuccess, onError) {
    if (!this.pc) {
        return Promise.resolve();
    }
    sdp$1 = sdp.setCodecPreferences(sdp$1, codecPreferences);
    return promisifySet(this.pc.setRemoteDescription, this.pc)(new RTCSessionDescription({ sdp: sdp$1, type: 'answer' })).then(onSuccess, onError);
};
/* NOTE(mroberts): Firefox 18 through 21 include a `mozRTCPeerConnection`
   object, but attempting to instantiate it will throw the error

       Error: PeerConnection not enabled (did you set the pref?)

   unless the `media.peerconnection.enabled` pref is enabled. So we need to test
   if we can actually instantiate `mozRTCPeerConnection`; however, if the user
   *has* enabled `media.peerconnection.enabled`, we need to perform the same
   test that we use to detect Firefox 24 and above, namely:

       typeof (new mozRTCPeerConnection()).getLocalStreams === 'function'

    NOTE(rrowland): We no longer support Legacy Edge as of Sep 1, 2020.
*/
RTCPC.test = function () {
    if (typeof navigator === 'object') {
        var getUserMedia = (navigator.mediaDevices && navigator.mediaDevices.getUserMedia)
            || navigator.webkitGetUserMedia
            || navigator.mozGetUserMedia
            || navigator.getUserMedia;
        if (util.isLegacyEdge(navigator)) {
            return false;
        }
        if (getUserMedia && typeof window.RTCPeerConnection === 'function') {
            return true;
        }
        else if (getUserMedia && typeof window.webkitRTCPeerConnection === 'function') {
            return true;
        }
        else if (getUserMedia && typeof window.mozRTCPeerConnection === 'function') {
            try {
                var test_1 = new window.mozRTCPeerConnection();
                if (typeof test_1.getLocalStreams !== 'function') {
                    return false;
                }
            }
            catch (e) {
                return false;
            }
            return true;
        }
        else if (typeof RTCIceGatherer !== 'undefined') {
            return true;
        }
    }
    return false;
};
function promisify(fn, ctx, areCallbacksFirst, checkRval) {
    return function () {
        var args = Array.prototype.slice.call(arguments);
        return new Promise(function (resolve) {
            var returnValue = fn.apply(ctx, args);
            if (!checkRval) {
                resolve(returnValue);
                return;
            }
            if (typeof returnValue === 'object' && typeof returnValue.then === 'function') {
                resolve(returnValue);
            }
            else {
                throw new Error();
            }
        }).catch(function () { return new Promise(function (resolve, reject) {
            fn.apply(ctx, areCallbacksFirst
                ? [resolve, reject].concat(args)
                : args.concat([resolve, reject]));
        }); });
    };
}
function promisifyCreate(fn, ctx) {
    return promisify(fn, ctx, true, true);
}
function promisifySet(fn, ctx) {
    return promisify(fn, ctx, false, false);
}

exports.default = RTCPC;


},{"../log.js":18,"../util.js":37,"./sdp.js":31}],31:[function(require,module,exports){
'use strict';

var util = require('../util.js');

// @ts-nocheck
var ptToFixedBitrateAudioCodecName = {
    0: 'PCMU',
    8: 'PCMA',
};
var defaultOpusId = 111;
var BITRATE_MAX = 510000;
var BITRATE_MIN = 6000;
function getPreferredCodecInfo(sdp) {
    var _a = /a=rtpmap:(\d+) (\S+)/m.exec(sdp) || [null, '', ''], codecId = _a[1], codecName = _a[2];
    var regex = new RegExp("a=fmtp:".concat(codecId, " (\\S+)"), 'm');
    var _b = regex.exec(sdp) || [null, ''], codecParams = _b[1];
    return { codecName: codecName, codecParams: codecParams };
}
function setIceAggressiveNomination(sdp) {
    // This only works on Chrome. We don't want any side effects on other browsers
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1024096
    // https://issues.corp.twilio.com/browse/CLIENT-6911
    if (!util.isChrome(window, window.navigator)) {
        return sdp;
    }
    return sdp.split('\n')
        .filter(function (line) { return line.indexOf('a=ice-lite') === -1; })
        .join('\n');
}
function setMaxAverageBitrate(sdp, maxAverageBitrate) {
    if (typeof maxAverageBitrate !== 'number'
        || maxAverageBitrate < BITRATE_MIN
        || maxAverageBitrate > BITRATE_MAX) {
        return sdp;
    }
    var matches = /a=rtpmap:(\d+) opus/m.exec(sdp);
    var opusId = matches && matches.length ? matches[1] : defaultOpusId;
    var regex = new RegExp("a=fmtp:".concat(opusId));
    var lines = sdp.split('\n').map(function (line) { return regex.test(line)
        ? line + ";maxaveragebitrate=".concat(maxAverageBitrate)
        : line; });
    return lines.join('\n');
}
/**
 * Return a new SDP string with the re-ordered codec preferences.
 * @param {string} sdp
 * @param {Array<AudioCodec>} preferredCodecs - If empty, the existing order
 *   of audio codecs is preserved
 * @returns {string} Updated SDP string
 */
function setCodecPreferences(sdp, preferredCodecs) {
    var mediaSections = getMediaSections(sdp);
    var session = sdp.split('\r\nm=')[0];
    return [session].concat(mediaSections.map(function (section) {
        // Codec preferences should not be applied to m=application sections.
        if (!/^m=(audio|video)/.test(section)) {
            return section;
        }
        var kind = section.match(/^m=(audio|video)/)[1];
        var codecMap = createCodecMapForMediaSection(section);
        var payloadTypes = getReorderedPayloadTypes(codecMap, preferredCodecs);
        var newSection = setPayloadTypesInMediaSection(payloadTypes, section);
        var pcmaPayloadTypes = codecMap.get('pcma') || [];
        var pcmuPayloadTypes = codecMap.get('pcmu') || [];
        var fixedBitratePayloadTypes = kind === 'audio'
            ? new Set(pcmaPayloadTypes.concat(pcmuPayloadTypes))
            : new Set();
        return fixedBitratePayloadTypes.has(payloadTypes[0])
            ? newSection.replace(/\r\nb=(AS|TIAS):([0-9]+)/g, '')
            : newSection;
    })).join('\r\n');
}
/**
 * Get the m= sections of a particular kind and direction from an sdp.
 * @param {string} sdp - SDP string
 * @param {string} [kind] - Pattern for matching kind
 * @param {string} [direction] - Pattern for matching direction
 * @returns {Array<string>} mediaSections
 */
function getMediaSections(sdp, kind, direction) {
    return sdp.replace(/\r\n\r\n$/, '\r\n').split('\r\nm=').slice(1).map(function (mediaSection) { return "m=".concat(mediaSection); }).filter(function (mediaSection) {
        var kindPattern = new RegExp("m=".concat('.*'), 'gm');
        var directionPattern = new RegExp("a=".concat('.*'), 'gm');
        return kindPattern.test(mediaSection) && directionPattern.test(mediaSection);
    });
}
/**
 * Create a Codec Map for the given m= section.
 * @param {string} section - The given m= section
 * @returns {Map<Codec, Array<PT>>}
 */
function createCodecMapForMediaSection(section) {
    return Array.from(createPtToCodecName(section)).reduce(function (codecMap, pair) {
        var pt = pair[0];
        var codecName = pair[1];
        var pts = codecMap.get(codecName) || [];
        return codecMap.set(codecName, pts.concat(pt));
    }, new Map());
}
/**
 * Create the reordered Codec Payload Types based on the preferred Codec Names.
 * @param {Map<Codec, Array<PT>>} codecMap - Codec Map
 * @param {Array<Codec>} preferredCodecs - Preferred Codec Names
 * @returns {Array<PT>} Reordered Payload Types
 */
function getReorderedPayloadTypes(codecMap, preferredCodecs) {
    preferredCodecs = preferredCodecs.map(function (codecName) { return codecName.toLowerCase(); });
    var preferredPayloadTypes = util.flatMap(preferredCodecs, function (codecName) { return codecMap.get(codecName) || []; });
    var remainingCodecs = util.difference(Array.from(codecMap.keys()), preferredCodecs);
    var remainingPayloadTypes = util.flatMap(remainingCodecs, function (codecName) { return codecMap.get(codecName); });
    return preferredPayloadTypes.concat(remainingPayloadTypes);
}
/**
 * Set the given Codec Payload Types in the first line of the given m= section.
 * @param {Array<PT>} payloadTypes - Payload Types
 * @param {string} section - Given m= section
 * @returns {string} - Updated m= section
 */
function setPayloadTypesInMediaSection(payloadTypes, section) {
    var lines = section.split('\r\n');
    var mLine = lines[0];
    var otherLines = lines.slice(1);
    mLine = mLine.replace(/([0-9]+\s?)+$/, payloadTypes.join(' '));
    return [mLine].concat(otherLines).join('\r\n');
}
/**
 * Create a Map from PTs to codec names for the given m= section.
 * @param {string} mediaSection - The given m= section.
 * @returns {Map<PT, Codec>} ptToCodecName
 */
function createPtToCodecName(mediaSection) {
    return getPayloadTypesInMediaSection(mediaSection).reduce(function (ptToCodecName, pt) {
        var rtpmapPattern = new RegExp("a=rtpmap:".concat(pt, " ([^/]+)"));
        var matches = mediaSection.match(rtpmapPattern);
        var codecName = matches
            ? matches[1].toLowerCase()
            : ptToFixedBitrateAudioCodecName[pt]
                ? ptToFixedBitrateAudioCodecName[pt].toLowerCase()
                : '';
        return ptToCodecName.set(pt, codecName);
    }, new Map());
}
/**
 * Get the Codec Payload Types present in the first line of the given m= section
 * @param {string} section - The m= section
 * @returns {Array<PT>} Payload Types
 */
function getPayloadTypesInMediaSection(section) {
    var mLine = section.split('\r\n')[0];
    // In "m=<kind> <port> <proto> <payload_type_1> <payload_type_2> ... <payload_type_n>",
    // the regex matches <port> and the PayloadTypes.
    var matches = mLine.match(/([0-9]+)/g);
    // This should not happen, but in case there are no PayloadTypes in
    // the m= line, return an empty array.
    if (!matches) {
        return [];
    }
    // Since only the PayloadTypes are needed, we discard the <port>.
    return matches.slice(1).map(function (match) { return parseInt(match, 10); });
}

exports.getPreferredCodecInfo = getPreferredCodecInfo;
exports.setCodecPreferences = setCodecPreferences;
exports.setIceAggressiveNomination = setIceAggressiveNomination;
exports.setMaxAverageBitrate = setMaxAverageBitrate;


},{"../util.js":37}],32:[function(require,module,exports){
'use strict';

var tslib = require('tslib');
var index = require('../errors/index.js');
var mockrtcstatsreport = require('./mockrtcstatsreport.js');

var ERROR_PEER_CONNECTION_NULL = 'PeerConnection is null';
var ERROR_WEB_RTC_UNSUPPORTED = 'WebRTC statistics are unsupported';
/**
 * Helper function to find a specific stat from a report.
 * Some environment provide the stats report as a map (regular browsers)
 * but some provide stats report as an array (citrix vdi)
 * @private
 */
function findStatById(report, id) {
    if (typeof report.get === 'function') {
        return report.get(id);
    }
    return report.find(function (s) { return s.id === id; });
}
/**
 * Generate WebRTC statistics report for the given {@link PeerConnection}
 * @param {PeerConnection} peerConnection - Target connection.
 * @return {Promise<RTCStatsReport>} WebRTC RTCStatsReport object
 */
function getRTCStatsReport(peerConnection) {
    if (!peerConnection) {
        return Promise.reject(new index.InvalidArgumentError(ERROR_PEER_CONNECTION_NULL));
    }
    if (typeof peerConnection.getStats !== 'function') {
        return Promise.reject(new index.NotSupportedError(ERROR_WEB_RTC_UNSUPPORTED));
    }
    var promise;
    try {
        promise = peerConnection.getStats();
    }
    catch (e) {
        promise = new Promise(function (resolve) { return peerConnection.getStats(resolve); }).then(mockrtcstatsreport.default.fromRTCStatsResponse);
    }
    return promise;
}
/**
 * @typedef {Object} StatsOptions
 * Used for testing to inject and extract methods.
 * @property {function} [createRTCSample] - Method for parsing an RTCStatsReport
 */
/**
 * Collects any WebRTC statistics for the given {@link PeerConnection}
 * @param {PeerConnection} peerConnection - Target connection.
 * @param {StatsOptions} options - List of custom options.
 * @return {Promise<RTCSample>} Universally-formatted version of RTC stats.
 */
function getRTCStats(peerConnection, options) {
    options = Object.assign({ createRTCSample: createRTCSample }, options);
    return getRTCStatsReport(peerConnection).then(options.createRTCSample);
}
/**
 * Generate WebRTC stats report containing relevant information about ICE candidates for the given {@link PeerConnection}
 * @param {PeerConnection} peerConnection - Target connection.
 * @return {Promise<RTCIceCandidateStatsReport>} RTCIceCandidateStatsReport object
 */
function getRTCIceCandidateStatsReport(peerConnection) {
    return getRTCStatsReport(peerConnection).then(function (report) {
        // Find the relevant information needed to determine selected candidates later
        var _a = Array.from(report.values()).reduce(function (rval, stat) {
            ['candidatePairs', 'localCandidates', 'remoteCandidates'].forEach(function (prop) {
                if (!rval[prop]) {
                    rval[prop] = [];
                }
            });
            switch (stat.type) {
                case 'candidate-pair':
                    rval.candidatePairs.push(stat);
                    break;
                case 'local-candidate':
                    rval.localCandidates.push(stat);
                    break;
                case 'remote-candidate':
                    rval.remoteCandidates.push(stat);
                    break;
                case 'transport':
                    // This transport is the one being used if selectedCandidatePairId is populated
                    if (stat.selectedCandidatePairId) {
                        rval.transport = stat;
                    }
                    break;
            }
            return rval;
        }, {}), candidatePairs = _a.candidatePairs, localCandidates = _a.localCandidates, remoteCandidates = _a.remoteCandidates, transport = _a.transport;
        // This is a report containing information about the selected candidates, such as IDs
        // This is coming from WebRTC stats directly and doesn't contain the actual ICE Candidates info
        var selectedCandidatePairReport = candidatePairs.find(function (pair) {
            // Firefox
            return pair.selected ||
                // Spec-compliant way
                (transport && pair.id === transport.selectedCandidatePairId);
        });
        var selectedIceCandidatePairStats;
        if (selectedCandidatePairReport) {
            selectedIceCandidatePairStats = {
                localCandidate: localCandidates.find(function (candidate) { return candidate.id === selectedCandidatePairReport.localCandidateId; }),
                remoteCandidate: remoteCandidates.find(function (candidate) { return candidate.id === selectedCandidatePairReport.remoteCandidateId; }),
            };
        }
        // Build the return object
        return {
            iceCandidateStats: tslib.__spreadArray(tslib.__spreadArray([], localCandidates, true), remoteCandidates, true),
            selectedIceCandidatePairStats: selectedIceCandidatePairStats,
        };
    });
}
/**
 * @typedef {Object} RTCSample - A sample containing relevant WebRTC stats information.
 * @property {Number} [timestamp]
 * @property {String} [codecName] - MimeType name of the codec being used by the outbound audio stream
 * @property {Number} [rtt] - Round trip time
 * @property {Number} [jitter]
 * @property {Number} [packetsSent]
 * @property {Number} [packetsLost]
 * @property {Number} [packetsReceived]
 * @property {Number} [bytesReceived]
 * @property {Number} [bytesSent]
 * @property {Number} [localAddress]
 * @property {Number} [remoteAddress]
 */
function RTCSample() { }
/**
 * Create an RTCSample object from an RTCStatsReport
 * @private
 * @param {RTCStatsReport} statsReport
 * @returns {RTCSample}
 */
function createRTCSample(statsReport) {
    var activeTransportId = null;
    var sample = new RTCSample();
    var fallbackTimestamp;
    Array.from(statsReport.values()).forEach(function (stats) {
        // Skip isRemote tracks which will be phased out completely and break in FF66.
        if (stats.isRemote) {
            return;
        }
        // Firefox hack -- Older firefox doesn't have dashes in type names
        var type = stats.type.replace('-', '');
        fallbackTimestamp = fallbackTimestamp || stats.timestamp;
        // (rrowland) As I understand it, this is supposed to come in on remote-inbound-rtp but it's
        // currently coming in on remote-outbound-rtp, so I'm leaving this outside the switch until
        // the appropriate place to look is cleared up.
        if (stats.remoteId) {
            var remote = findStatById(statsReport, stats.remoteId);
            if (remote && remote.roundTripTime) {
                sample.rtt = remote.roundTripTime * 1000;
            }
        }
        switch (type) {
            case 'inboundrtp':
                sample.timestamp = sample.timestamp || stats.timestamp;
                sample.jitter = stats.jitter * 1000;
                sample.packetsLost = stats.packetsLost;
                sample.packetsReceived = stats.packetsReceived;
                sample.bytesReceived = stats.bytesReceived;
                break;
            case 'outboundrtp':
                sample.timestamp = stats.timestamp;
                sample.packetsSent = stats.packetsSent;
                sample.bytesSent = stats.bytesSent;
                if (stats.codecId) {
                    var codec = findStatById(statsReport, stats.codecId);
                    sample.codecName = codec
                        ? codec.mimeType && codec.mimeType.match(/(.*\/)?(.*)/)[2]
                        : stats.codecId;
                }
                break;
            case 'transport':
                activeTransportId = stats.id;
                break;
        }
    });
    if (!sample.timestamp) {
        sample.timestamp = fallbackTimestamp;
    }
    var activeTransport = findStatById(statsReport, activeTransportId);
    if (!activeTransport) {
        return sample;
    }
    var selectedCandidatePair = findStatById(statsReport, activeTransport.selectedCandidatePairId);
    if (!selectedCandidatePair) {
        return sample;
    }
    var localCandidate = findStatById(statsReport, selectedCandidatePair.localCandidateId);
    var remoteCandidate = findStatById(statsReport, selectedCandidatePair.remoteCandidateId);
    if (!sample.rtt) {
        sample.rtt = selectedCandidatePair &&
            (selectedCandidatePair.currentRoundTripTime * 1000);
    }
    Object.assign(sample, {
        // ip is deprecated. use address first then ip if on older versions of browser
        localAddress: localCandidate && (localCandidate.address || localCandidate.ip),
        remoteAddress: remoteCandidate && (remoteCandidate.address || remoteCandidate.ip),
    });
    return sample;
}

exports.getRTCIceCandidateStatsReport = getRTCIceCandidateStatsReport;
exports.getRTCStats = getRTCStats;


},{"../errors/index.js":15,"./mockrtcstatsreport.js":27,"tslib":41}],33:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

// @ts-nocheck
var MediaDeviceInfoShim = /** @class */ (function () {
    function MediaDeviceInfoShim(options) {
        Object.defineProperties(this, {
            deviceId: { get: function () { return options.deviceId; } },
            groupId: { get: function () { return options.groupId; } },
            kind: { get: function () { return options.kind; } },
            label: { get: function () { return options.label; } },
        });
    }
    return MediaDeviceInfoShim;
}());

exports.default = MediaDeviceInfoShim;


},{}],34:[function(require,module,exports){
'use strict';

var index = require('./errors/index.js');

/**
 * Generates a 128-bit long random string that is formatted as a 32 long string
 * of characters where each character is from the set:
 * [0,1,2,3,4,5,6,7,8,9,a,b,c,d,e,f].
 */
function generateRandomizedString() {
    if (typeof window !== 'object') {
        throw new index.NotSupportedError('This platform is not supported.');
    }
    var crypto = window.crypto;
    if (typeof crypto !== 'object') {
        throw new index.NotSupportedError('The `crypto` module is not available on this platform.');
    }
    if (typeof crypto.getRandomValues !== 'function') {
        throw new index.NotSupportedError('The function `crypto.getRandomValues` is not available on this ' +
            'platform.');
    }
    if (typeof window.Uint8Array !== 'function') {
        throw new index.NotSupportedError('The `Uint8Array` module is not available on this platform.');
    }
    return crypto
        .getRandomValues(new window.Uint8Array(16))
        .reduce(function (r, n) { return "".concat(r).concat(n.toString(16).padStart(2, '0')); }, '');
}
function generateVoiceEventSid() {
    return "KX".concat(generateRandomizedString());
}

exports.generateVoiceEventSid = generateVoiceEventSid;


},{"./errors/index.js":15}],35:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var asyncQueue = require('./asyncQueue.js');
var audioplayer = require('./audioplayer/audioplayer.js');
var index = require('./errors/index.js');

// @ts-nocheck
/**
 * @class
 * @param {string} name - Name of the sound
 * @param {string} url - URL of the sound
 * @param {Sound#ConstructorOptions} options
 * @property {boolean} isPlaying - Whether the Sound is currently playing audio.
 * @property {string} name - Name of the sound
 * @property {string} url - URL of the sound
 * @property {AudioContext} audioContext - The AudioContext to use if available for AudioPlayer.
 */
/**
 * @typedef {Object} Sound#ConstructorOptions
 * @property {number} [maxDuration=0] - The maximum length of time to play the sound
 *   before stopping it.
 * @property {Boolean} [shouldLoop=false] - Whether the sound should be looped.
 */
function Sound(name, url, options) {
    if (!(this instanceof Sound)) {
        return new Sound(name, url, options);
    }
    if (!name || !url) {
        throw new index.InvalidArgumentError('name and url are required arguments');
    }
    options = Object.assign({
        AudioFactory: typeof Audio !== 'undefined' ? Audio : null,
        maxDuration: 0,
        shouldLoop: false,
    }, options);
    options.AudioPlayer = options.audioContext
        ? audioplayer.default.bind(audioplayer.default, options.audioContext)
        : options.AudioFactory;
    Object.defineProperties(this, {
        _Audio: { value: options.AudioPlayer },
        _activeEls: { value: new Map() },
        _isSinkSupported: {
            value: options.AudioFactory !== null
                && typeof options.AudioFactory.prototype.setSinkId === 'function',
        },
        _maxDuration: { value: options.maxDuration },
        _maxDurationTimeout: {
            value: null,
            writable: true,
        },
        _operations: { value: new asyncQueue.AsyncQueue() },
        _playPromise: {
            value: null,
            writable: true,
        },
        _shouldLoop: { value: options.shouldLoop },
        _sinkIds: { value: ['default'] },
        isPlaying: {
            enumerable: true,
            get: function () {
                return !!this._playPromise;
            },
        },
        name: {
            enumerable: true,
            value: name,
        },
        url: {
            enumerable: true,
            value: url,
        },
    });
    if (this._Audio) {
        // Play it (muted and should not loop) as soon as possible so that it does not get incorrectly caught by Chrome's
        // "gesture requirement for media playback" feature.
        // https://plus.google.com/+FrancoisBeaufort/posts/6PiJQqJzGqX
        this._play(true, false);
    }
}
function destroyAudioElement(audioElement) {
    if (audioElement) {
        audioElement.pause();
        audioElement.src = '';
        audioElement.srcObject = null;
        audioElement.load();
    }
}
/**
 * Plays the audio element that was initialized using the speficied sinkId
 */
Sound.prototype._playAudioElement = function _playAudioElement(sinkId, isMuted, shouldLoop) {
    var _this = this;
    var audioElement = this._activeEls.get(sinkId);
    if (!audioElement) {
        throw new index.InvalidArgumentError("sinkId: \"".concat(sinkId, "\" doesn't have an audio element"));
    }
    audioElement.muted = !!isMuted;
    audioElement.loop = !!shouldLoop;
    return audioElement.play()
        .then(function () { return audioElement; })
        .catch(function (reason) {
        destroyAudioElement(audioElement);
        _this._activeEls.delete(sinkId);
        throw reason;
    });
};
/**
 * Start playing the sound. Will stop the currently playing sound first.
 * If it exists, the audio element that was initialized for the sinkId will be used
 */
Sound.prototype._play = function _play(forceIsMuted, forceShouldLoop) {
    if (this.isPlaying) {
        this._stop();
    }
    if (this._maxDuration > 0) {
        this._maxDurationTimeout = setTimeout(this._stop.bind(this), this._maxDuration);
    }
    forceShouldLoop = typeof forceShouldLoop === 'boolean' ? forceShouldLoop : this._shouldLoop;
    var self = this;
    var playPromise = this._playPromise = Promise.all(this._sinkIds.map(function createAudioElement(sinkId) {
        if (!self._Audio) {
            return Promise.resolve();
        }
        var audioElement = self._activeEls.get(sinkId);
        if (audioElement) {
            return self._playAudioElement(sinkId, forceIsMuted, forceShouldLoop);
        }
        audioElement = new self._Audio(self.url);
        // Make sure the browser always retrieves the resource using CORS.
        // By default when using media tags, origin header is not sent to server
        // which causes the server to not return CORS headers. When this caches
        // on the CDN or browser, it causes issues to future requests that needs CORS,
        // which is true when using AudioContext. Please note that we won't have to do this
        // once we migrate to CloudFront.
        if (typeof audioElement.setAttribute === 'function') {
            audioElement.setAttribute('crossorigin', 'anonymous');
        }
        /**
         * (rrowland) Bug in Chrome 53 & 54 prevents us from calling Audio.setSinkId without
         *   crashing the tab. https://bugs.chromium.org/p/chromium/issues/detail?id=655342
         */
        return new Promise(function (resolve) {
            audioElement.addEventListener('canplaythrough', resolve);
        }).then(function () {
            return (self._isSinkSupported
                ? audioElement.setSinkId(sinkId)
                : Promise.resolve()).then(function setSinkIdSuccess() {
                self._activeEls.set(sinkId, audioElement);
                // Stop has been called, bail out
                if (!self._playPromise) {
                    return Promise.resolve();
                }
                return self._playAudioElement(sinkId, forceIsMuted, forceShouldLoop);
            });
        });
    }));
    return playPromise;
};
/**
 * Stop playing the sound.
 */
Sound.prototype._stop = function _stop() {
    var _this = this;
    this._activeEls.forEach(function (audioEl, sinkId) {
        if (_this._sinkIds.includes(sinkId)) {
            audioEl.pause();
            audioEl.currentTime = 0;
        }
        else {
            // Destroy the ones that are not used anymore
            destroyAudioElement(audioEl);
            _this._activeEls.delete(sinkId);
        }
    });
    clearTimeout(this._maxDurationTimeout);
    this._playPromise = null;
    this._maxDurationTimeout = null;
};
/**
 * Update the sinkIds of the audio output devices this sound should play through.
 */
Sound.prototype.setSinkIds = function setSinkIds(ids) {
    if (!this._isSinkSupported) {
        return;
    }
    ids = ids.forEach ? ids : [ids];
    [].splice.apply(this._sinkIds, [0, this._sinkIds.length].concat(ids));
};
/**
 * Add a stop operation to the queue
 */
Sound.prototype.stop = function stop() {
    var _this = this;
    this._operations.enqueue(function () {
        _this._stop();
        return Promise.resolve();
    });
};
/**
 * Add a play operation to the queue
 */
Sound.prototype.play = function play() {
    var _this = this;
    return this._operations.enqueue(function () { return _this._play(); });
};

exports.default = Sound;


},{"./asyncQueue.js":2,"./audioplayer/audioplayer.js":4,"./errors/index.js":15}],36:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var events = require('events');
var index = require('./errors/index.js');
var mos = require('./rtc/mos.js');
var stats = require('./rtc/stats.js');
var util = require('./util.js');

// How many samples we use when testing metric thresholds
var SAMPLE_COUNT_METRICS = 5;
// How many samples that need to cross the threshold to
// raise or clear a warning.
var SAMPLE_COUNT_CLEAR = 0;
var SAMPLE_COUNT_RAISE = 3;
var SAMPLE_INTERVAL = 1000;
var WARNING_TIMEOUT = 5 * 1000;
var DEFAULT_THRESHOLDS = {
    audioInputLevel: { minStandardDeviation: 327.67, sampleCount: 10 },
    audioOutputLevel: { minStandardDeviation: 327.67, sampleCount: 10 },
    bytesReceived: { clearCount: 2, min: 1, raiseCount: 3, sampleCount: 3 },
    bytesSent: { clearCount: 2, min: 1, raiseCount: 3, sampleCount: 3 },
    jitter: { max: 30 },
    mos: { min: 3 },
    packetsLostFraction: [{
            max: 1,
        }, {
            clearValue: 1,
            maxAverage: 3,
            sampleCount: 7,
        }],
    rtt: { max: 400 },
};
/**
 * Count the number of values that cross the max threshold.
 * @private
 * @param max - The max allowable value.
 * @param values - The values to iterate over.
 * @returns The amount of values in which the stat crossed the threshold.
 */
function countHigh(max, values) {
    return values.reduce(function (highCount, value) { return highCount += (value > max) ? 1 : 0; }, 0);
}
/**
 * Count the number of values that cross the min threshold.
 * @private
 * @param min - The minimum allowable value.
 * @param values - The values to iterate over.
 * @returns The amount of values in which the stat crossed the threshold.
 */
function countLow(min, values) {
    return values.reduce(function (lowCount, value) { return lowCount += (value < min) ? 1 : 0; }, 0);
}
/**
 * Calculate the standard deviation from a list of numbers.
 * @private
 * @param values The list of numbers to calculate the standard deviation from.
 * @returns The standard deviation of a list of numbers.
 */
function calculateStandardDeviation(values) {
    if (values.length <= 0) {
        return null;
    }
    var valueAverage = values.reduce(function (partialSum, value) { return partialSum + value; }, 0) / values.length;
    var diffSquared = values.map(function (value) { return Math.pow(value - valueAverage, 2); });
    var stdDev = Math.sqrt(diffSquared.reduce(function (partialSum, value) { return partialSum + value; }, 0) / diffSquared.length);
    return stdDev;
}
/**
 * Flatten a set of numerical sample sets into a single array of samples.
 * @param sampleSets
 */
function flattenSamples(sampleSets) {
    return sampleSets.reduce(function (flat, current) { return tslib.__spreadArray(tslib.__spreadArray([], flat, true), current, true); }, []);
}
/**
 * {@link StatsMonitor} polls a peerConnection via PeerConnection.getStats
 * and emits warnings when stats cross the specified threshold values.
 */
var StatsMonitor = /** @class */ (function (_super) {
    tslib.__extends(StatsMonitor, _super);
    /**
     * @constructor
     * @param [options] - Optional settings
     */
    function StatsMonitor(options) {
        var _this = _super.call(this) || this;
        /**
         * A map of warnings with their raised time
         */
        _this._activeWarnings = new Map();
        /**
         * A map of stats with the number of exceeded thresholds
         */
        _this._currentStreaks = new Map();
        /**
         * Keeps track of input volumes in the last second
         */
        _this._inputVolumes = [];
        /**
         * Keeps track of output volumes in the last second
         */
        _this._outputVolumes = [];
        /**
         * Sample buffer. Saves most recent samples
         */
        _this._sampleBuffer = [];
        /**
         * Keeps track of supplemental sample values.
         *
         * Currently used for constant audio detection. Contains an array of volume
         * samples for each sample interval.
         */
        _this._supplementalSampleBuffers = {
            audioInputLevel: [],
            audioOutputLevel: [],
        };
        /**
         * Whether warnings should be enabled
         */
        _this._warningsEnabled = true;
        options = options || {};
        _this._getRTCStats = options.getRTCStats || stats.getRTCStats;
        _this._mos = options.Mos || mos.default;
        _this._peerConnection = options.peerConnection;
        _this._thresholds = tslib.__assign(tslib.__assign({}, DEFAULT_THRESHOLDS), options.thresholds);
        var thresholdSampleCounts = Object.values(_this._thresholds)
            .map(function (threshold) { return threshold.sampleCount; })
            .filter(function (sampleCount) { return !!sampleCount; });
        _this._maxSampleCount = Math.max.apply(Math, tslib.__spreadArray([SAMPLE_COUNT_METRICS], thresholdSampleCounts, false));
        if (_this._peerConnection) {
            _this.enable(_this._peerConnection);
        }
        return _this;
    }
    /**
     * Called when a volume sample is available
     * @param inputVolume - Input volume level from 0 to 32767
     * @param outputVolume - Output volume level from 0 to 32767
     */
    StatsMonitor.prototype.addVolumes = function (inputVolume, outputVolume) {
        this._inputVolumes.push(inputVolume);
        this._outputVolumes.push(outputVolume);
    };
    /**
     * Stop sampling RTC statistics for this {@link StatsMonitor}.
     * @returns The current {@link StatsMonitor}.
     */
    StatsMonitor.prototype.disable = function () {
        if (this._sampleInterval) {
            clearInterval(this._sampleInterval);
            delete this._sampleInterval;
        }
        return this;
    };
    /**
     * Disable warnings for this {@link StatsMonitor}.
     * @returns The current {@link StatsMonitor}.
     */
    StatsMonitor.prototype.disableWarnings = function () {
        if (this._warningsEnabled) {
            this._activeWarnings.clear();
        }
        this._warningsEnabled = false;
        return this;
    };
    /**
     * Start sampling RTC statistics for this {@link StatsMonitor}.
     * @param peerConnection - A PeerConnection to monitor.
     * @returns The current {@link StatsMonitor}.
     */
    StatsMonitor.prototype.enable = function (peerConnection) {
        if (peerConnection) {
            if (this._peerConnection && peerConnection !== this._peerConnection) {
                throw new index.InvalidArgumentError('Attempted to replace an existing PeerConnection in StatsMonitor.enable');
            }
            this._peerConnection = peerConnection;
        }
        if (!this._peerConnection) {
            throw new index.InvalidArgumentError('Can not enable StatsMonitor without a PeerConnection');
        }
        this._sampleInterval = this._sampleInterval ||
            setInterval(this._fetchSample.bind(this), SAMPLE_INTERVAL);
        return this;
    };
    /**
     * Enable warnings for this {@link StatsMonitor}.
     * @returns The current {@link StatsMonitor}.
     */
    StatsMonitor.prototype.enableWarnings = function () {
        this._warningsEnabled = true;
        return this;
    };
    /**
     * Check if there is an active warning for a specific stat and threshold
     * @param statName - The name of the stat to check
     * @param thresholdName - The name of the threshold to check
     * @returns Whether there is an active warning for a specific stat and threshold
     */
    StatsMonitor.prototype.hasActiveWarning = function (statName, thresholdName) {
        var warningId = "".concat(statName, ":").concat(thresholdName);
        return !!this._activeWarnings.get(warningId);
    };
    /**
     * Add a sample to our sample buffer and remove the oldest if we are over the limit.
     * @param sample - Sample to add
     */
    StatsMonitor.prototype._addSample = function (sample) {
        var samples = this._sampleBuffer;
        samples.push(sample);
        // We store 1 extra sample so that we always have (current, previous)
        // available for all {sampleBufferSize} threshold validations.
        if (samples.length > this._maxSampleCount) {
            samples.splice(0, samples.length - this._maxSampleCount);
        }
    };
    /**
     * Clear an active warning.
     * @param statName - The name of the stat to clear.
     * @param thresholdName - The name of the threshold to clear
     * @param [data] - Any relevant sample data.
     */
    StatsMonitor.prototype._clearWarning = function (statName, thresholdName, data) {
        var warningId = "".concat(statName, ":").concat(thresholdName);
        var activeWarning = this._activeWarnings.get(warningId);
        if (!activeWarning || Date.now() - activeWarning.timeRaised < WARNING_TIMEOUT) {
            return;
        }
        this._activeWarnings.delete(warningId);
        this.emit('warning-cleared', tslib.__assign(tslib.__assign({}, data), { name: statName, threshold: {
                name: thresholdName,
                value: this._thresholds[statName][thresholdName],
            } }));
    };
    /**
     * Create a sample object from a stats object using the previous sample, if available.
     * @param stats - Stats retrieved from getStatistics
     * @param [previousSample=null] - The previous sample to use to calculate deltas.
     * @returns A universally-formatted version of RTC stats.
     */
    StatsMonitor.prototype._createSample = function (stats, previousSample) {
        var previousBytesSent = previousSample && previousSample.totals.bytesSent || 0;
        var previousBytesReceived = previousSample && previousSample.totals.bytesReceived || 0;
        var previousPacketsSent = previousSample && previousSample.totals.packetsSent || 0;
        var previousPacketsReceived = previousSample && previousSample.totals.packetsReceived || 0;
        var previousPacketsLost = previousSample && previousSample.totals.packetsLost || 0;
        var currentBytesSent = stats.bytesSent - previousBytesSent;
        var currentBytesReceived = stats.bytesReceived - previousBytesReceived;
        var currentPacketsSent = stats.packetsSent - previousPacketsSent;
        var currentPacketsReceived = stats.packetsReceived - previousPacketsReceived;
        var currentPacketsLost = stats.packetsLost - previousPacketsLost;
        var currentInboundPackets = currentPacketsReceived + currentPacketsLost;
        var currentPacketsLostFraction = (currentInboundPackets > 0) ?
            (currentPacketsLost / currentInboundPackets) * 100 : 0;
        var totalInboundPackets = stats.packetsReceived + stats.packetsLost;
        var totalPacketsLostFraction = (totalInboundPackets > 0) ?
            (stats.packetsLost / totalInboundPackets) * 100 : 100;
        var rttValue = (typeof stats.rtt === 'number' || !previousSample) ? stats.rtt : previousSample.rtt;
        var audioInputLevelValues = this._inputVolumes.splice(0);
        this._supplementalSampleBuffers.audioInputLevel.push(audioInputLevelValues);
        var audioOutputLevelValues = this._outputVolumes.splice(0);
        this._supplementalSampleBuffers.audioOutputLevel.push(audioOutputLevelValues);
        return {
            audioInputLevel: Math.round(util.average(audioInputLevelValues)),
            audioOutputLevel: Math.round(util.average(audioOutputLevelValues)),
            bytesReceived: currentBytesReceived,
            bytesSent: currentBytesSent,
            codecName: stats.codecName,
            jitter: stats.jitter,
            mos: this._mos.calculate(rttValue, stats.jitter, previousSample && currentPacketsLostFraction),
            packetsLost: currentPacketsLost,
            packetsLostFraction: currentPacketsLostFraction,
            packetsReceived: currentPacketsReceived,
            packetsSent: currentPacketsSent,
            rtt: rttValue,
            timestamp: stats.timestamp,
            totals: {
                bytesReceived: stats.bytesReceived,
                bytesSent: stats.bytesSent,
                packetsLost: stats.packetsLost,
                packetsLostFraction: totalPacketsLostFraction,
                packetsReceived: stats.packetsReceived,
                packetsSent: stats.packetsSent,
            },
        };
    };
    /**
     * Get stats from the PeerConnection and add it to our list of samples.
     */
    StatsMonitor.prototype._fetchSample = function () {
        var _this = this;
        this._getSample().then(function (sample) {
            _this._addSample(sample);
            _this._raiseWarnings();
            _this.emit('sample', sample);
        }).catch(function (error) {
            _this.disable();
            // We only bubble up any errors coming from pc.getStats()
            // No need to attach a twilioError
            _this.emit('error', error);
        });
    };
    /**
     * Get stats from the PeerConnection.
     * @returns A universally-formatted version of RTC stats.
     */
    StatsMonitor.prototype._getSample = function () {
        var _this = this;
        return this._getRTCStats(this._peerConnection).then(function (stats) {
            var previousSample = null;
            if (_this._sampleBuffer.length) {
                previousSample = _this._sampleBuffer[_this._sampleBuffer.length - 1];
            }
            return _this._createSample(stats, previousSample);
        });
    };
    /**
     * Raise a warning and log its raised time.
     * @param statName - The name of the stat to raise.
     * @param thresholdName - The name of the threshold to raise
     * @param [data] - Any relevant sample data.
     */
    StatsMonitor.prototype._raiseWarning = function (statName, thresholdName, data) {
        var warningId = "".concat(statName, ":").concat(thresholdName);
        if (this._activeWarnings.has(warningId)) {
            return;
        }
        this._activeWarnings.set(warningId, { timeRaised: Date.now() });
        var thresholds = this._thresholds[statName];
        var thresholdValue;
        if (Array.isArray(thresholds)) {
            var foundThreshold = thresholds.find(function (threshold) { return thresholdName in threshold; });
            if (foundThreshold) {
                thresholdValue = foundThreshold[thresholdName];
            }
        }
        else {
            thresholdValue = this._thresholds[statName][thresholdName];
        }
        this.emit('warning', tslib.__assign(tslib.__assign({}, data), { name: statName, threshold: {
                name: thresholdName,
                value: thresholdValue,
            } }));
    };
    /**
     * Apply our thresholds to our array of RTCStat samples.
     */
    StatsMonitor.prototype._raiseWarnings = function () {
        var _this = this;
        if (!this._warningsEnabled) {
            return;
        }
        Object.keys(this._thresholds).forEach(function (name) { return _this._raiseWarningsForStat(name); });
    };
    /**
     * Apply thresholds for a given stat name to our array of
     * RTCStat samples and raise or clear any associated warnings.
     * @param statName - Name of the stat to compare.
     */
    StatsMonitor.prototype._raiseWarningsForStat = function (statName) {
        var _this = this;
        var limits = Array.isArray(this._thresholds[statName])
            ? this._thresholds[statName]
            : [this._thresholds[statName]];
        limits.forEach(function (limit) {
            var samples = _this._sampleBuffer;
            var clearCount = limit.clearCount || SAMPLE_COUNT_CLEAR;
            var raiseCount = limit.raiseCount || SAMPLE_COUNT_RAISE;
            var sampleCount = limit.sampleCount || _this._maxSampleCount;
            var relevantSamples = samples.slice(-sampleCount);
            var values = relevantSamples.map(function (sample) { return sample[statName]; });
            // (rrowland) If we have a bad or missing value in the set, we don't
            // have enough information to throw or clear a warning. Bail out.
            var containsNull = values.some(function (value) { return typeof value === 'undefined' || value === null; });
            if (containsNull) {
                return;
            }
            var count;
            if (typeof limit.max === 'number') {
                count = countHigh(limit.max, values);
                if (count >= raiseCount) {
                    _this._raiseWarning(statName, 'max', { values: values, samples: relevantSamples });
                }
                else if (count <= clearCount) {
                    _this._clearWarning(statName, 'max', { values: values, samples: relevantSamples });
                }
            }
            if (typeof limit.min === 'number') {
                count = countLow(limit.min, values);
                if (count >= raiseCount) {
                    _this._raiseWarning(statName, 'min', { values: values, samples: relevantSamples });
                }
                else if (count <= clearCount) {
                    _this._clearWarning(statName, 'min', { values: values, samples: relevantSamples });
                }
            }
            if (typeof limit.maxDuration === 'number' && samples.length > 1) {
                relevantSamples = samples.slice(-2);
                var prevValue = relevantSamples[0][statName];
                var curValue = relevantSamples[1][statName];
                var prevStreak = _this._currentStreaks.get(statName) || 0;
                var streak = (prevValue === curValue) ? prevStreak + 1 : 0;
                _this._currentStreaks.set(statName, streak);
                if (streak >= limit.maxDuration) {
                    _this._raiseWarning(statName, 'maxDuration', { value: streak });
                }
                else if (streak === 0) {
                    _this._clearWarning(statName, 'maxDuration', { value: prevStreak });
                }
            }
            if (typeof limit.minStandardDeviation === 'number') {
                var sampleSets = _this._supplementalSampleBuffers[statName];
                if (!sampleSets || sampleSets.length < limit.sampleCount) {
                    return;
                }
                if (sampleSets.length > limit.sampleCount) {
                    sampleSets.splice(0, sampleSets.length - limit.sampleCount);
                }
                var flatSamples = flattenSamples(sampleSets.slice(-sampleCount));
                var stdDev = calculateStandardDeviation(flatSamples);
                if (typeof stdDev !== 'number') {
                    return;
                }
                if (stdDev < limit.minStandardDeviation) {
                    _this._raiseWarning(statName, 'minStandardDeviation', { value: stdDev });
                }
                else {
                    _this._clearWarning(statName, 'minStandardDeviation', { value: stdDev });
                }
            }
            [
                ['maxAverage', function (x, y) { return x > y; }],
                ['minAverage', function (x, y) { return x < y; }],
            ].forEach(function (_a) {
                var thresholdName = _a[0], comparator = _a[1];
                if (typeof limit[thresholdName] === 'number' && values.length >= sampleCount) {
                    var avg = util.average(values);
                    if (comparator(avg, limit[thresholdName])) {
                        _this._raiseWarning(statName, thresholdName, { values: values, samples: relevantSamples });
                    }
                    else if (!comparator(avg, limit.clearValue || limit[thresholdName])) {
                        _this._clearWarning(statName, thresholdName, { values: values, samples: relevantSamples });
                    }
                }
            });
        });
    };
    return StatsMonitor;
}(events.EventEmitter));

exports.default = StatsMonitor;


},{"./errors/index.js":15,"./rtc/mos.js":28,"./rtc/stats.js":32,"./util.js":37,"events":39,"tslib":41}],37:[function(require,module,exports){
(function (global){(function (){
'use strict';

// @ts-nocheck
/**
 * Exception class.
 * @class
 * @name Exception
 * @exports Exception as Twilio.Exception
 * @memberOf Twilio
 * @param {string} message The exception message
 */
function TwilioException(message) {
    if (!(this instanceof TwilioException)) {
        return new TwilioException(message);
    }
    this.message = message;
}
/**
 * Returns the exception message.
 *
 * @return {string} The exception message.
 */
TwilioException.prototype.toString = function () {
    return "Twilio.Exception: ".concat(this.message);
};
function average(values) {
    return values && values.length ? values.reduce(function (t, v) { return t + v; }) / values.length : 0;
}
function difference(lefts, rights, getKey) {
    getKey = getKey || (function (a) { return a; });
    var rightKeys = new Set(rights.map(getKey));
    return lefts.filter(function (left) { return !rightKeys.has(getKey(left)); });
}
function isElectron(navigator) {
    return !!navigator.userAgent.match('Electron');
}
function isChrome(window, navigator) {
    var isCriOS = !!navigator.userAgent.match('CriOS');
    var isHeadlessChrome = !!navigator.userAgent.match('HeadlessChrome');
    var isGoogle = typeof window.chrome !== 'undefined'
        && navigator.vendor === 'Google Inc.'
        && navigator.userAgent.indexOf('OPR') === -1
        && navigator.userAgent.indexOf('Edge') === -1;
    return isCriOS || isElectron(navigator) || isGoogle || isHeadlessChrome;
}
function isFirefox(navigator) {
    navigator = navigator || (typeof window === 'undefined'
        ? global.navigator : window.navigator);
    return !!(navigator) && typeof navigator.userAgent === 'string'
        && /firefox|fxios/i.test(navigator.userAgent);
}
/**
 * Chromium-based Edge has a user-agent of "Edg/" where legacy Edge has a
 * user-agent of "Edge/".
 */
function isLegacyEdge(navigator) {
    navigator = navigator || (typeof window === 'undefined'
        ? global.navigator : window.navigator);
    return !!(navigator) && typeof navigator.userAgent === 'string'
        && /edge\/\d+/i.test(navigator.userAgent);
}
function isSafari(navigator) {
    return !!(navigator.vendor) && navigator.vendor.indexOf('Apple') !== -1
        && navigator.userAgent
        && navigator.userAgent.indexOf('CriOS') === -1
        && navigator.userAgent.indexOf('FxiOS') === -1;
}
function queryToJson(params) {
    if (!params) {
        return '';
    }
    return params.split('&').reduce(function (output, pair) {
        var parts = pair.split('=');
        var key = parts[0];
        var value = decodeURIComponent((parts[1] || '').replace(/\+/g, '%20'));
        if (key) {
            output[key] = value;
        }
        return output;
    }, {});
}
/**
 * Map a list to an array of arrays, and return the flattened result.
 * @param {Array<*>|Set<*>|Map<*>} list
 * @param {function(*): Array<*>} [mapFn]
 * @returns Array<*>
 */
function flatMap(list, mapFn) {
    var listArray = list instanceof Map || list instanceof Set
        ? Array.from(list.values())
        : list;
    mapFn = mapFn || (function (item) { return item; });
    return listArray.reduce(function (flattened, item) {
        var mapped = mapFn(item);
        return flattened.concat(mapped);
    }, []);
}
/**
 * Converts an EventEmitter's events into a promise and automatically
 * cleans up handlers once the promise is resolved or rejected.
 */
function promisifyEvents(emitter, resolveEventName, rejectEventName) {
    return new Promise(function (resolve, reject) {
        function resolveHandler() {
            emitter.removeListener(rejectEventName, rejectHandler);
            resolve();
        }
        function rejectHandler() {
            emitter.removeListener(resolveEventName, resolveHandler);
            reject();
        }
        emitter.once(resolveEventName, resolveHandler);
        emitter.once(rejectEventName, rejectHandler);
    });
}
function sortByMimeTypes(codecs, preferredOrder) {
    var preferredCodecs = preferredOrder.map(function (codec) { return 'audio/' + codec.toLowerCase(); });
    return codecs.sort(function (a, b) {
        var indexA = preferredCodecs.indexOf(a.mimeType.toLowerCase());
        var indexB = preferredCodecs.indexOf(b.mimeType.toLowerCase());
        var orderA = indexA >= 0 ? indexA : Number.MAX_VALUE;
        var orderB = indexB >= 0 ? indexB : Number.MAX_VALUE;
        return orderA - orderB;
    });
}
var Exception = TwilioException;

exports.Exception = Exception;
exports.average = average;
exports.difference = difference;
exports.flatMap = flatMap;
exports.isChrome = isChrome;
exports.isElectron = isElectron;
exports.isFirefox = isFirefox;
exports.isLegacyEdge = isLegacyEdge;
exports.isSafari = isSafari;
exports.promisifyEvents = promisifyEvents;
exports.queryToJson = queryToJson;
exports.sortByMimeTypes = sortByMimeTypes;


}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}],38:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var events = require('events');
var backoff = require('./backoff.js');
require('./errors/index.js');
var log = require('./log.js');
var generated = require('./errors/generated.js');

var WebSocket = globalThis.WebSocket;
var CONNECT_SUCCESS_TIMEOUT = 10000;
var CONNECT_TIMEOUT = 5000;
var HEARTBEAT_TIMEOUT = 15000;
var MAX_PREFERRED_DURATION = 15000;
var MAX_PRIMARY_DURATION = Infinity;
var MAX_PREFERRED_DELAY = 1000;
var MAX_PRIMARY_DELAY = 20000;
/**
 * All possible states of WSTransport.
 */
exports.WSTransportState = void 0;
(function (WSTransportState) {
    /**
     * The WebSocket is not open but is trying to connect.
     */
    WSTransportState["Connecting"] = "connecting";
    /**
     * The WebSocket is not open and is not trying to connect.
     */
    WSTransportState["Closed"] = "closed";
    /**
     * The underlying WebSocket is open and active.
     */
    WSTransportState["Open"] = "open";
})(exports.WSTransportState || (exports.WSTransportState = {}));
/**
 * WebSocket Transport
 */
var WSTransport = /** @class */ (function (_super) {
    tslib.__extends(WSTransport, _super);
    /**
     * @constructor
     * @param uris - List of URI of the endpoints to connect to.
     * @param [options] - Constructor options.
     */
    function WSTransport(uris, options) {
        if (options === void 0) { options = {}; }
        var _this = _super.call(this) || this;
        /**
         * The current state of the WSTransport.
         */
        _this.state = exports.WSTransportState.Closed;
        /**
         * Start timestamp values for backoffs.
         */
        _this._backoffStartTime = {
            preferred: null,
            primary: null,
        };
        /**
         * The URI that the transport is connecting or connected to. The value of this
         * property is `null` if a connection attempt has not been made yet.
         */
        _this._connectedUri = null;
        /**
         * An instance of Logger to use.
         */
        _this._log = new log.default('WSTransport');
        /**
         * Whether we should attempt to fallback if we receive an applicable error
         * when trying to connect to a signaling endpoint.
         */
        _this._shouldFallback = false;
        /**
         * The current uri index that the transport is connected to.
         */
        _this._uriIndex = 0;
        /**
         * Move the uri index to the next index
         * If the index is at the end, the index goes back to the first one.
         */
        _this._moveUriIndex = function () {
            _this._uriIndex++;
            if (_this._uriIndex >= _this._uris.length) {
                _this._uriIndex = 0;
            }
        };
        /**
         * Called in response to WebSocket#close event.
         */
        _this._onSocketClose = function (event) {
            _this._log.error("Received websocket close event code: ".concat(event.code, ". Reason: ").concat(event.reason));
            // 1006: Abnormal close. When the server is unreacheable
            // 1015: TLS Handshake error
            if (event.code === 1006 || event.code === 1015) {
                _this.emit('error', {
                    code: 31005,
                    message: event.reason ||
                        'Websocket connection to Twilio\'s signaling servers were ' +
                            'unexpectedly ended. If this is happening consistently, there may ' +
                            'be an issue resolving the hostname provided. If a region or an ' +
                            'edge is being specified in Device setup, ensure it is valid.',
                    twilioError: new generated.SignalingErrors.ConnectionError(),
                });
                var wasConnected = (
                // Only in Safari and certain Firefox versions, on network interruption, websocket drops right away with 1006
                // Let's check current state if it's open, meaning we should not fallback
                // because we're coming from a previously connected session
                _this.state === exports.WSTransportState.Open ||
                    // But on other browsers, websocket doesn't drop
                    // but our heartbeat catches it, setting the internal state to "Connecting".
                    // With this, we should check the previous state instead.
                    _this._previousState === exports.WSTransportState.Open);
                // Only fallback if this is not the first error
                // and if we were not connected previously
                if (_this._shouldFallback || !wasConnected) {
                    _this._moveUriIndex();
                }
                _this._shouldFallback = true;
            }
            _this._closeSocket();
        };
        /**
         * Called in response to WebSocket#error event.
         */
        _this._onSocketError = function (err) {
            _this._log.error("WebSocket received error: ".concat(err.message));
            _this.emit('error', {
                code: 31000,
                message: err.message || 'WSTransport socket error',
                twilioError: new generated.SignalingErrors.ConnectionDisconnected(),
            });
        };
        /**
         * Called in response to WebSocket#message event.
         */
        _this._onSocketMessage = function (message) {
            // Clear heartbeat timeout on any incoming message, as they
            // all indicate an active connection.
            _this._setHeartbeatTimeout();
            // Filter and respond to heartbeats
            if (_this._socket && message.data === '\n') {
                _this._socket.send('\n');
                _this._log.debug('heartbeat');
                return;
            }
            if (message && typeof message.data === 'string') {
                _this._log.debug("Received: ".concat(message.data));
            }
            _this.emit('message', message);
        };
        /**
         * Called in response to WebSocket#open event.
         */
        _this._onSocketOpen = function () {
            _this._log.info('WebSocket opened successfully.');
            _this._timeOpened = Date.now();
            _this._shouldFallback = false;
            _this._setState(exports.WSTransportState.Open);
            clearTimeout(_this._connectTimeout);
            _this._resetBackoffs();
            _this._setHeartbeatTimeout();
            _this.emit('open');
        };
        _this._options = tslib.__assign(tslib.__assign({}, WSTransport.defaultConstructorOptions), options);
        _this._uris = uris;
        _this._backoff = _this._setupBackoffs();
        return _this;
    }
    /**
     * Close the WebSocket, and don't try to reconnect.
     */
    WSTransport.prototype.close = function () {
        this._log.info('WSTransport.close() called...');
        this._close();
    };
    /**
     * Attempt to open a WebSocket connection.
     */
    WSTransport.prototype.open = function () {
        this._log.info('WSTransport.open() called...');
        if (this._socket &&
            (this._socket.readyState === WebSocket.CONNECTING ||
                this._socket.readyState === WebSocket.OPEN)) {
            this._log.info('WebSocket already open.');
            return;
        }
        if (this._preferredUri) {
            this._connect(this._preferredUri);
        }
        else {
            this._connect(this._uris[this._uriIndex]);
        }
    };
    /**
     * Send a message through the WebSocket connection.
     * @param message - A message to send to the endpoint.
     * @returns Whether the message was sent.
     */
    WSTransport.prototype.send = function (message) {
        this._log.debug("Sending: ".concat(message));
        // We can't send the message if the WebSocket isn't open
        if (!this._socket || this._socket.readyState !== WebSocket.OPEN) {
            this._log.debug('Cannot send message. WebSocket is not open.');
            return false;
        }
        try {
            this._socket.send(message);
        }
        catch (e) {
            // Some unknown error occurred. Reset the socket to get a fresh session.
            this._log.error('Error while sending message:', e.message);
            this._closeSocket();
            return false;
        }
        return true;
    };
    /**
     * Update the preferred URI to connect to. Useful for Call signaling
     * reconnection, which requires connecting on the same edge. If `null` is
     * passed, the preferred URI is unset and the original `uris` array and
     * `uriIndex` is used to determine the signaling URI to connect to.
     * @param uri
     */
    WSTransport.prototype.updatePreferredURI = function (uri) {
        this._preferredUri = uri;
    };
    /**
     * Update acceptable URIs to reconnect to. Resets the URI index to 0.
     */
    WSTransport.prototype.updateURIs = function (uris) {
        if (typeof uris === 'string') {
            uris = [uris];
        }
        this._uris = uris;
        this._uriIndex = 0;
    };
    /**
     * Close the WebSocket, and don't try to reconnect.
     */
    WSTransport.prototype._close = function () {
        this._setState(exports.WSTransportState.Closed);
        this._closeSocket();
    };
    /**
     * Close the WebSocket and remove all event listeners.
     */
    WSTransport.prototype._closeSocket = function () {
        clearTimeout(this._connectTimeout);
        clearTimeout(this._heartbeatTimeout);
        this._log.info('Closing and cleaning up WebSocket...');
        if (!this._socket) {
            this._log.info('No WebSocket to clean up.');
            return;
        }
        this._socket.removeEventListener('close', this._onSocketClose);
        this._socket.removeEventListener('error', this._onSocketError);
        this._socket.removeEventListener('message', this._onSocketMessage);
        this._socket.removeEventListener('open', this._onSocketOpen);
        if (this._socket.readyState === WebSocket.CONNECTING ||
            this._socket.readyState === WebSocket.OPEN) {
            this._socket.close();
        }
        // Reset backoff counter if connection was open for long enough to be considered successful
        if (this._timeOpened && Date.now() - this._timeOpened > CONNECT_SUCCESS_TIMEOUT) {
            this._resetBackoffs();
        }
        if (this.state !== exports.WSTransportState.Closed) {
            this._performBackoff();
        }
        delete this._socket;
        this.emit('close');
    };
    /**
     * Attempt to connect to the endpoint via WebSocket.
     * @param [uri] - URI string to connect to.
     * @param [retryCount] - Retry number, if this is a retry. Undefined if
     *   first attempt, 1+ if a retry.
     */
    WSTransport.prototype._connect = function (uri, retryCount) {
        var _this = this;
        this._log.info(typeof retryCount === 'number'
            ? "Attempting to reconnect (retry #".concat(retryCount, ")...")
            : 'Attempting to connect...');
        this._closeSocket();
        this._setState(exports.WSTransportState.Connecting);
        this._connectedUri = uri;
        try {
            this._socket = new this._options.WebSocket(this._connectedUri);
        }
        catch (e) {
            this._log.error('Could not connect to endpoint:', e.message);
            this._close();
            this.emit('error', {
                code: 31000,
                message: e.message || "Could not connect to ".concat(this._connectedUri),
                twilioError: new generated.SignalingErrors.ConnectionDisconnected(),
            });
            return;
        }
        this._socket.addEventListener('close', this._onSocketClose);
        this._socket.addEventListener('error', this._onSocketError);
        this._socket.addEventListener('message', this._onSocketMessage);
        this._socket.addEventListener('open', this._onSocketOpen);
        delete this._timeOpened;
        this._connectTimeout = setTimeout(function () {
            _this._log.info('WebSocket connection attempt timed out.');
            _this._moveUriIndex();
            _this._closeSocket();
        }, this._options.connectTimeoutMs);
    };
    /**
     * Perform a backoff. If a preferred URI is set (not null), then backoff
     * using the preferred mechanism. Otherwise, use the primary mechanism.
     */
    WSTransport.prototype._performBackoff = function () {
        if (this._preferredUri) {
            this._log.info('Preferred URI set; backing off.');
            this._backoff.preferred.backoff();
        }
        else {
            this._log.info('Preferred URI not set; backing off.');
            this._backoff.primary.backoff();
        }
    };
    /**
     * Reset both primary and preferred backoff mechanisms.
     */
    WSTransport.prototype._resetBackoffs = function () {
        this._backoff.preferred.reset();
        this._backoff.primary.reset();
        this._backoffStartTime.preferred = null;
        this._backoffStartTime.primary = null;
    };
    /**
     * Set a timeout to reconnect after HEARTBEAT_TIMEOUT milliseconds
     *   have passed without receiving a message over the WebSocket.
     */
    WSTransport.prototype._setHeartbeatTimeout = function () {
        var _this = this;
        clearTimeout(this._heartbeatTimeout);
        this._heartbeatTimeout = setTimeout(function () {
            _this._log.info("No messages received in ".concat(HEARTBEAT_TIMEOUT / 1000, " seconds. Reconnecting..."));
            _this._shouldFallback = true;
            _this._closeSocket();
        }, HEARTBEAT_TIMEOUT);
    };
    /**
     * Set the current and previous state
     */
    WSTransport.prototype._setState = function (state) {
        this._previousState = this.state;
        this.state = state;
    };
    /**
     * Set up the primary and preferred backoff mechanisms.
     */
    WSTransport.prototype._setupBackoffs = function () {
        var _this = this;
        var preferredBackoffConfig = {
            factor: 2.0,
            jitter: 0.40,
            max: this._options.maxPreferredDelayMs,
            min: 100,
        };
        this._log.info('Initializing preferred transport backoff using config: ', preferredBackoffConfig);
        var preferredBackoff = new backoff.default(preferredBackoffConfig);
        preferredBackoff.on('backoff', function (attempt, delay) {
            if (_this.state === exports.WSTransportState.Closed) {
                _this._log.info('Preferred backoff initiated but transport state is closed; not attempting a connection.');
                return;
            }
            _this._log.info("Will attempt to reconnect Websocket to preferred URI in ".concat(delay, "ms"));
            if (attempt === 0) {
                _this._backoffStartTime.preferred = Date.now();
                _this._log.info("Preferred backoff start; ".concat(_this._backoffStartTime.preferred));
            }
        });
        preferredBackoff.on('ready', function (attempt, _delay) {
            if (_this.state === exports.WSTransportState.Closed) {
                _this._log.info('Preferred backoff ready but transport state is closed; not attempting a connection.');
                return;
            }
            if (_this._backoffStartTime.preferred === null) {
                _this._log.info('Preferred backoff start time invalid; not attempting a connection.');
                return;
            }
            if (Date.now() - _this._backoffStartTime.preferred > _this._options.maxPreferredDurationMs) {
                _this._log.info('Max preferred backoff attempt time exceeded; falling back to primary backoff.');
                _this._preferredUri = null;
                _this._backoff.primary.backoff();
                return;
            }
            if (typeof _this._preferredUri !== 'string') {
                _this._log.info('Preferred URI cleared; falling back to primary backoff.');
                _this._preferredUri = null;
                _this._backoff.primary.backoff();
                return;
            }
            _this._connect(_this._preferredUri, attempt + 1);
        });
        var primaryBackoffConfig = {
            factor: 2.0,
            jitter: 0.40,
            max: this._options.maxPrimaryDelayMs,
            // We only want a random initial delay if there are any fallback edges
            // Initial delay between 1s and 5s both inclusive
            min: this._uris && this._uris.length > 1
                ? Math.floor(Math.random() * (5000 - 1000 + 1)) + 1000
                : 100,
        };
        this._log.info('Initializing primary transport backoff using config: ', primaryBackoffConfig);
        var primaryBackoff = new backoff.default(primaryBackoffConfig);
        primaryBackoff.on('backoff', function (attempt, delay) {
            if (_this.state === exports.WSTransportState.Closed) {
                _this._log.info('Primary backoff initiated but transport state is closed; not attempting a connection.');
                return;
            }
            _this._log.info("Will attempt to reconnect WebSocket in ".concat(delay, "ms"));
            if (attempt === 0) {
                _this._backoffStartTime.primary = Date.now();
                _this._log.info("Primary backoff start; ".concat(_this._backoffStartTime.primary));
            }
        });
        primaryBackoff.on('ready', function (attempt, _delay) {
            if (_this.state === exports.WSTransportState.Closed) {
                _this._log.info('Primary backoff ready but transport state is closed; not attempting a connection.');
                return;
            }
            if (_this._backoffStartTime.primary === null) {
                _this._log.info('Primary backoff start time invalid; not attempting a connection.');
                return;
            }
            if (Date.now() - _this._backoffStartTime.primary > _this._options.maxPrimaryDurationMs) {
                _this._log.info('Max primary backoff attempt time exceeded; not attempting a connection.');
                return;
            }
            _this._connect(_this._uris[_this._uriIndex], attempt + 1);
        });
        return {
            preferred: preferredBackoff,
            primary: primaryBackoff,
        };
    };
    Object.defineProperty(WSTransport.prototype, "uri", {
        /**
         * The uri the transport is currently connected to
         */
        get: function () {
            return this._connectedUri;
        },
        enumerable: false,
        configurable: true
    });
    WSTransport.defaultConstructorOptions = {
        WebSocket: WebSocket,
        connectTimeoutMs: CONNECT_TIMEOUT,
        maxPreferredDelayMs: MAX_PREFERRED_DELAY,
        maxPreferredDurationMs: MAX_PREFERRED_DURATION,
        maxPrimaryDelayMs: MAX_PRIMARY_DELAY,
        maxPrimaryDurationMs: MAX_PRIMARY_DURATION,
    };
    return WSTransport;
}(events.EventEmitter));

exports.default = WSTransport;


},{"./backoff.js":8,"./errors/generated.js":14,"./errors/index.js":15,"./log.js":18,"events":39,"tslib":41}],39:[function(require,module,exports){
// Copyright Joyent, Inc. and other Node contributors.
//
// Permission is hereby granted, free of charge, to any person obtaining a
// copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to permit
// persons to whom the Software is furnished to do so, subject to the
// following conditions:
//
// The above copyright notice and this permission notice shall be included
// in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS
// OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN
// NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM,
// DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
// OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE
// USE OR OTHER DEALINGS IN THE SOFTWARE.

var objectCreate = Object.create || objectCreatePolyfill
var objectKeys = Object.keys || objectKeysPolyfill
var bind = Function.prototype.bind || functionBindPolyfill

function EventEmitter() {
  if (!this._events || !Object.prototype.hasOwnProperty.call(this, '_events')) {
    this._events = objectCreate(null);
    this._eventsCount = 0;
  }

  this._maxListeners = this._maxListeners || undefined;
}
module.exports = EventEmitter;

// Backwards-compat with node 0.10.x
EventEmitter.EventEmitter = EventEmitter;

EventEmitter.prototype._events = undefined;
EventEmitter.prototype._maxListeners = undefined;

// By default EventEmitters will print a warning if more than 10 listeners are
// added to it. This is a useful default which helps finding memory leaks.
var defaultMaxListeners = 10;

var hasDefineProperty;
try {
  var o = {};
  if (Object.defineProperty) Object.defineProperty(o, 'x', { value: 0 });
  hasDefineProperty = o.x === 0;
} catch (err) { hasDefineProperty = false }
if (hasDefineProperty) {
  Object.defineProperty(EventEmitter, 'defaultMaxListeners', {
    enumerable: true,
    get: function() {
      return defaultMaxListeners;
    },
    set: function(arg) {
      // check whether the input is a positive number (whose value is zero or
      // greater and not a NaN).
      if (typeof arg !== 'number' || arg < 0 || arg !== arg)
        throw new TypeError('"defaultMaxListeners" must be a positive number');
      defaultMaxListeners = arg;
    }
  });
} else {
  EventEmitter.defaultMaxListeners = defaultMaxListeners;
}

// Obviously not all Emitters should be limited to 10. This function allows
// that to be increased. Set to zero for unlimited.
EventEmitter.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== 'number' || n < 0 || isNaN(n))
    throw new TypeError('"n" argument must be a positive number');
  this._maxListeners = n;
  return this;
};

function $getMaxListeners(that) {
  if (that._maxListeners === undefined)
    return EventEmitter.defaultMaxListeners;
  return that._maxListeners;
}

EventEmitter.prototype.getMaxListeners = function getMaxListeners() {
  return $getMaxListeners(this);
};

// These standalone emit* functions are used to optimize calling of event
// handlers for fast cases because emit() itself often has a variable number of
// arguments and can be deoptimized because of that. These functions always have
// the same number of arguments and thus do not get deoptimized, so the code
// inside them can execute faster.
function emitNone(handler, isFn, self) {
  if (isFn)
    handler.call(self);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self);
  }
}
function emitOne(handler, isFn, self, arg1) {
  if (isFn)
    handler.call(self, arg1);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1);
  }
}
function emitTwo(handler, isFn, self, arg1, arg2) {
  if (isFn)
    handler.call(self, arg1, arg2);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2);
  }
}
function emitThree(handler, isFn, self, arg1, arg2, arg3) {
  if (isFn)
    handler.call(self, arg1, arg2, arg3);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].call(self, arg1, arg2, arg3);
  }
}

function emitMany(handler, isFn, self, args) {
  if (isFn)
    handler.apply(self, args);
  else {
    var len = handler.length;
    var listeners = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      listeners[i].apply(self, args);
  }
}

EventEmitter.prototype.emit = function emit(type) {
  var er, handler, len, args, i, events;
  var doError = (type === 'error');

  events = this._events;
  if (events)
    doError = (doError && events.error == null);
  else if (!doError)
    return false;

  // If there is no 'error' event listener then throw.
  if (doError) {
    if (arguments.length > 1)
      er = arguments[1];
    if (er instanceof Error) {
      throw er; // Unhandled 'error' event
    } else {
      // At least give some kind of context to the user
      var err = new Error('Unhandled "error" event. (' + er + ')');
      err.context = er;
      throw err;
    }
    return false;
  }

  handler = events[type];

  if (!handler)
    return false;

  var isFn = typeof handler === 'function';
  len = arguments.length;
  switch (len) {
      // fast cases
    case 1:
      emitNone(handler, isFn, this);
      break;
    case 2:
      emitOne(handler, isFn, this, arguments[1]);
      break;
    case 3:
      emitTwo(handler, isFn, this, arguments[1], arguments[2]);
      break;
    case 4:
      emitThree(handler, isFn, this, arguments[1], arguments[2], arguments[3]);
      break;
      // slower
    default:
      args = new Array(len - 1);
      for (i = 1; i < len; i++)
        args[i - 1] = arguments[i];
      emitMany(handler, isFn, this, args);
  }

  return true;
};

function _addListener(target, type, listener, prepend) {
  var m;
  var events;
  var existing;

  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');

  events = target._events;
  if (!events) {
    events = target._events = objectCreate(null);
    target._eventsCount = 0;
  } else {
    // To avoid recursion in the case that type === "newListener"! Before
    // adding it to the listeners, first emit "newListener".
    if (events.newListener) {
      target.emit('newListener', type,
          listener.listener ? listener.listener : listener);

      // Re-assign `events` because a newListener handler could have caused the
      // this._events to be assigned to a new object
      events = target._events;
    }
    existing = events[type];
  }

  if (!existing) {
    // Optimize the case of one listener. Don't need the extra array object.
    existing = events[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === 'function') {
      // Adding the second element, need to change to array.
      existing = events[type] =
          prepend ? [listener, existing] : [existing, listener];
    } else {
      // If we've already got an array, just append.
      if (prepend) {
        existing.unshift(listener);
      } else {
        existing.push(listener);
      }
    }

    // Check for listener leak
    if (!existing.warned) {
      m = $getMaxListeners(target);
      if (m && m > 0 && existing.length > m) {
        existing.warned = true;
        var w = new Error('Possible EventEmitter memory leak detected. ' +
            existing.length + ' "' + String(type) + '" listeners ' +
            'added. Use emitter.setMaxListeners() to ' +
            'increase limit.');
        w.name = 'MaxListenersExceededWarning';
        w.emitter = target;
        w.type = type;
        w.count = existing.length;
        if (typeof console === 'object' && console.warn) {
          console.warn('%s: %s', w.name, w.message);
        }
      }
    }
  }

  return target;
}

EventEmitter.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};

EventEmitter.prototype.on = EventEmitter.prototype.addListener;

EventEmitter.prototype.prependListener =
    function prependListener(type, listener) {
      return _addListener(this, type, listener, true);
    };

function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    switch (arguments.length) {
      case 0:
        return this.listener.call(this.target);
      case 1:
        return this.listener.call(this.target, arguments[0]);
      case 2:
        return this.listener.call(this.target, arguments[0], arguments[1]);
      case 3:
        return this.listener.call(this.target, arguments[0], arguments[1],
            arguments[2]);
      default:
        var args = new Array(arguments.length);
        for (var i = 0; i < args.length; ++i)
          args[i] = arguments[i];
        this.listener.apply(this.target, args);
    }
  }
}

function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: undefined, target: target, type: type, listener: listener };
  var wrapped = bind.call(onceWrapper, state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}

EventEmitter.prototype.once = function once(type, listener) {
  if (typeof listener !== 'function')
    throw new TypeError('"listener" argument must be a function');
  this.on(type, _onceWrap(this, type, listener));
  return this;
};

EventEmitter.prototype.prependOnceListener =
    function prependOnceListener(type, listener) {
      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');
      this.prependListener(type, _onceWrap(this, type, listener));
      return this;
    };

// Emits a 'removeListener' event if and only if the listener was removed.
EventEmitter.prototype.removeListener =
    function removeListener(type, listener) {
      var list, events, position, i, originalListener;

      if (typeof listener !== 'function')
        throw new TypeError('"listener" argument must be a function');

      events = this._events;
      if (!events)
        return this;

      list = events[type];
      if (!list)
        return this;

      if (list === listener || list.listener === listener) {
        if (--this._eventsCount === 0)
          this._events = objectCreate(null);
        else {
          delete events[type];
          if (events.removeListener)
            this.emit('removeListener', type, list.listener || listener);
        }
      } else if (typeof list !== 'function') {
        position = -1;

        for (i = list.length - 1; i >= 0; i--) {
          if (list[i] === listener || list[i].listener === listener) {
            originalListener = list[i].listener;
            position = i;
            break;
          }
        }

        if (position < 0)
          return this;

        if (position === 0)
          list.shift();
        else
          spliceOne(list, position);

        if (list.length === 1)
          events[type] = list[0];

        if (events.removeListener)
          this.emit('removeListener', type, originalListener || listener);
      }

      return this;
    };

EventEmitter.prototype.removeAllListeners =
    function removeAllListeners(type) {
      var listeners, events, i;

      events = this._events;
      if (!events)
        return this;

      // not listening for removeListener, no need to emit
      if (!events.removeListener) {
        if (arguments.length === 0) {
          this._events = objectCreate(null);
          this._eventsCount = 0;
        } else if (events[type]) {
          if (--this._eventsCount === 0)
            this._events = objectCreate(null);
          else
            delete events[type];
        }
        return this;
      }

      // emit removeListener for all listeners on all events
      if (arguments.length === 0) {
        var keys = objectKeys(events);
        var key;
        for (i = 0; i < keys.length; ++i) {
          key = keys[i];
          if (key === 'removeListener') continue;
          this.removeAllListeners(key);
        }
        this.removeAllListeners('removeListener');
        this._events = objectCreate(null);
        this._eventsCount = 0;
        return this;
      }

      listeners = events[type];

      if (typeof listeners === 'function') {
        this.removeListener(type, listeners);
      } else if (listeners) {
        // LIFO order
        for (i = listeners.length - 1; i >= 0; i--) {
          this.removeListener(type, listeners[i]);
        }
      }

      return this;
    };

function _listeners(target, type, unwrap) {
  var events = target._events;

  if (!events)
    return [];

  var evlistener = events[type];
  if (!evlistener)
    return [];

  if (typeof evlistener === 'function')
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];

  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}

EventEmitter.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};

EventEmitter.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};

EventEmitter.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === 'function') {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};

EventEmitter.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events = this._events;

  if (events) {
    var evlistener = events[type];

    if (typeof evlistener === 'function') {
      return 1;
    } else if (evlistener) {
      return evlistener.length;
    }
  }

  return 0;
}

EventEmitter.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? Reflect.ownKeys(this._events) : [];
};

// About 1.5x faster than the two-arg version of Array#splice().
function spliceOne(list, index) {
  for (var i = index, k = i + 1, n = list.length; k < n; i += 1, k += 1)
    list[i] = list[k];
  list.pop();
}

function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}

function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}

function objectCreatePolyfill(proto) {
  var F = function() {};
  F.prototype = proto;
  return new F;
}
function objectKeysPolyfill(obj) {
  var keys = [];
  for (var k in obj) if (Object.prototype.hasOwnProperty.call(obj, k)) {
    keys.push(k);
  }
  return k;
}
function functionBindPolyfill(context) {
  var fn = this;
  return function () {
    return fn.apply(context, arguments);
  };
}

},{}],40:[function(require,module,exports){
/*
* loglevel - https://github.com/pimterry/loglevel
*
* Copyright (c) 2013 Tim Perry
* Licensed under the MIT license.
*/
(function (root, definition) {
    "use strict";
    if (typeof define === 'function' && define.amd) {
        define(definition);
    } else if (typeof module === 'object' && module.exports) {
        module.exports = definition();
    } else {
        root.log = definition();
    }
}(this, function () {
    "use strict";

    // Slightly dubious tricks to cut down minimized file size
    var noop = function() {};
    var undefinedType = "undefined";
    var isIE = (typeof window !== undefinedType) && (typeof window.navigator !== undefinedType) && (
        /Trident\/|MSIE /.test(window.navigator.userAgent)
    );

    var logMethods = [
        "trace",
        "debug",
        "info",
        "warn",
        "error"
    ];

    // Cross-browser bind equivalent that works at least back to IE6
    function bindMethod(obj, methodName) {
        var method = obj[methodName];
        if (typeof method.bind === 'function') {
            return method.bind(obj);
        } else {
            try {
                return Function.prototype.bind.call(method, obj);
            } catch (e) {
                // Missing bind shim or IE8 + Modernizr, fallback to wrapping
                return function() {
                    return Function.prototype.apply.apply(method, [obj, arguments]);
                };
            }
        }
    }

    // Trace() doesn't print the message in IE, so for that case we need to wrap it
    function traceForIE() {
        if (console.log) {
            if (console.log.apply) {
                console.log.apply(console, arguments);
            } else {
                // In old IE, native console methods themselves don't have apply().
                Function.prototype.apply.apply(console.log, [console, arguments]);
            }
        }
        if (console.trace) console.trace();
    }

    // Build the best logging method possible for this env
    // Wherever possible we want to bind, not wrap, to preserve stack traces
    function realMethod(methodName) {
        if (methodName === 'debug') {
            methodName = 'log';
        }

        if (typeof console === undefinedType) {
            return false; // No method possible, for now - fixed later by enableLoggingWhenConsoleArrives
        } else if (methodName === 'trace' && isIE) {
            return traceForIE;
        } else if (console[methodName] !== undefined) {
            return bindMethod(console, methodName);
        } else if (console.log !== undefined) {
            return bindMethod(console, 'log');
        } else {
            return noop;
        }
    }

    // These private functions always need `this` to be set properly

    function replaceLoggingMethods(level, loggerName) {
        /*jshint validthis:true */
        for (var i = 0; i < logMethods.length; i++) {
            var methodName = logMethods[i];
            this[methodName] = (i < level) ?
                noop :
                this.methodFactory(methodName, level, loggerName);
        }

        // Define log.log as an alias for log.debug
        this.log = this.debug;
    }

    // In old IE versions, the console isn't present until you first open it.
    // We build realMethod() replacements here that regenerate logging methods
    function enableLoggingWhenConsoleArrives(methodName, level, loggerName) {
        return function () {
            if (typeof console !== undefinedType) {
                replaceLoggingMethods.call(this, level, loggerName);
                this[methodName].apply(this, arguments);
            }
        };
    }

    // By default, we use closely bound real methods wherever possible, and
    // otherwise we wait for a console to appear, and then try again.
    function defaultMethodFactory(methodName, level, loggerName) {
        /*jshint validthis:true */
        return realMethod(methodName) ||
               enableLoggingWhenConsoleArrives.apply(this, arguments);
    }

    function Logger(name, defaultLevel, factory) {
      var self = this;
      var currentLevel;
      var storageKey = "loglevel";
      if (name) {
        storageKey += ":" + name;
      }

      function persistLevelIfPossible(levelNum) {
          var levelName = (logMethods[levelNum] || 'silent').toUpperCase();

          if (typeof window === undefinedType) return;

          // Use localStorage if available
          try {
              window.localStorage[storageKey] = levelName;
              return;
          } catch (ignore) {}

          // Use session cookie as fallback
          try {
              window.document.cookie =
                encodeURIComponent(storageKey) + "=" + levelName + ";";
          } catch (ignore) {}
      }

      function getPersistedLevel() {
          var storedLevel;

          if (typeof window === undefinedType) return;

          try {
              storedLevel = window.localStorage[storageKey];
          } catch (ignore) {}

          // Fallback to cookies if local storage gives us nothing
          if (typeof storedLevel === undefinedType) {
              try {
                  var cookie = window.document.cookie;
                  var location = cookie.indexOf(
                      encodeURIComponent(storageKey) + "=");
                  if (location !== -1) {
                      storedLevel = /^([^;]+)/.exec(cookie.slice(location))[1];
                  }
              } catch (ignore) {}
          }

          // If the stored level is not valid, treat it as if nothing was stored.
          if (self.levels[storedLevel] === undefined) {
              storedLevel = undefined;
          }

          return storedLevel;
      }

      /*
       *
       * Public logger API - see https://github.com/pimterry/loglevel for details
       *
       */

      self.name = name;

      self.levels = { "TRACE": 0, "DEBUG": 1, "INFO": 2, "WARN": 3,
          "ERROR": 4, "SILENT": 5};

      self.methodFactory = factory || defaultMethodFactory;

      self.getLevel = function () {
          return currentLevel;
      };

      self.setLevel = function (level, persist) {
          if (typeof level === "string" && self.levels[level.toUpperCase()] !== undefined) {
              level = self.levels[level.toUpperCase()];
          }
          if (typeof level === "number" && level >= 0 && level <= self.levels.SILENT) {
              currentLevel = level;
              if (persist !== false) {  // defaults to true
                  persistLevelIfPossible(level);
              }
              replaceLoggingMethods.call(self, level, name);
              if (typeof console === undefinedType && level < self.levels.SILENT) {
                  return "No console available for logging";
              }
          } else {
              throw "log.setLevel() called with invalid level: " + level;
          }
      };

      self.setDefaultLevel = function (level) {
          if (!getPersistedLevel()) {
              self.setLevel(level, false);
          }
      };

      self.enableAll = function(persist) {
          self.setLevel(self.levels.TRACE, persist);
      };

      self.disableAll = function(persist) {
          self.setLevel(self.levels.SILENT, persist);
      };

      // Initialize with the right level
      var initialLevel = getPersistedLevel();
      if (initialLevel == null) {
          initialLevel = defaultLevel == null ? "WARN" : defaultLevel;
      }
      self.setLevel(initialLevel, false);
    }

    /*
     *
     * Top-level API
     *
     */

    var defaultLogger = new Logger();

    var _loggersByName = {};
    defaultLogger.getLogger = function getLogger(name) {
        if (typeof name !== "string" || name === "") {
          throw new TypeError("You must supply a name when creating a logger.");
        }

        var logger = _loggersByName[name];
        if (!logger) {
          logger = _loggersByName[name] = new Logger(
            name, defaultLogger.getLevel(), defaultLogger.methodFactory);
        }
        return logger;
    };

    // Grab the current global log variable in case of overwrite
    var _log = (typeof window !== undefinedType) ? window.log : undefined;
    defaultLogger.noConflict = function() {
        if (typeof window !== undefinedType &&
               window.log === defaultLogger) {
            window.log = _log;
        }

        return defaultLogger;
    };

    defaultLogger.getLoggers = function getLoggers() {
        return _loggersByName;
    };

    return defaultLogger;
}));

},{}],41:[function(require,module,exports){
(function (global){(function (){
/******************************************************************************
Copyright (c) Microsoft Corporation.

Permission to use, copy, modify, and/or distribute this software for any
purpose with or without fee is hereby granted.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY
AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM
LOSS OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR
OTHER TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR
PERFORMANCE OF THIS SOFTWARE.
***************************************************************************** */
/* global global, define, Symbol, Reflect, Promise, SuppressedError, Iterator */
var __extends;
var __assign;
var __rest;
var __decorate;
var __param;
var __esDecorate;
var __runInitializers;
var __propKey;
var __setFunctionName;
var __metadata;
var __awaiter;
var __generator;
var __exportStar;
var __values;
var __read;
var __spread;
var __spreadArrays;
var __spreadArray;
var __await;
var __asyncGenerator;
var __asyncDelegator;
var __asyncValues;
var __makeTemplateObject;
var __importStar;
var __importDefault;
var __classPrivateFieldGet;
var __classPrivateFieldSet;
var __classPrivateFieldIn;
var __createBinding;
var __addDisposableResource;
var __disposeResources;
var __rewriteRelativeImportExtension;
(function (factory) {
    var root = typeof global === "object" ? global : typeof self === "object" ? self : typeof this === "object" ? this : {};
    if (typeof define === "function" && define.amd) {
        define("tslib", ["exports"], function (exports) { factory(createExporter(root, createExporter(exports))); });
    }
    else if (typeof module === "object" && typeof module.exports === "object") {
        factory(createExporter(root, createExporter(module.exports)));
    }
    else {
        factory(createExporter(root));
    }
    function createExporter(exports, previous) {
        if (exports !== root) {
            if (typeof Object.create === "function") {
                Object.defineProperty(exports, "__esModule", { value: true });
            }
            else {
                exports.__esModule = true;
            }
        }
        return function (id, v) { return exports[id] = previous ? previous(id, v) : v; };
    }
})
(function (exporter) {
    var extendStatics = Object.setPrototypeOf ||
        ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
        function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };

    __extends = function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };

    __assign = Object.assign || function (t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p)) t[p] = s[p];
        }
        return t;
    };

    __rest = function (s, e) {
        var t = {};
        for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p) && e.indexOf(p) < 0)
            t[p] = s[p];
        if (s != null && typeof Object.getOwnPropertySymbols === "function")
            for (var i = 0, p = Object.getOwnPropertySymbols(s); i < p.length; i++) {
                if (e.indexOf(p[i]) < 0 && Object.prototype.propertyIsEnumerable.call(s, p[i]))
                    t[p[i]] = s[p[i]];
            }
        return t;
    };

    __decorate = function (decorators, target, key, desc) {
        var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
        if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
        else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
        return c > 3 && r && Object.defineProperty(target, key, r), r;
    };

    __param = function (paramIndex, decorator) {
        return function (target, key) { decorator(target, key, paramIndex); }
    };

    __esDecorate = function (ctor, descriptorIn, decorators, contextIn, initializers, extraInitializers) {
        function accept(f) { if (f !== void 0 && typeof f !== "function") throw new TypeError("Function expected"); return f; }
        var kind = contextIn.kind, key = kind === "getter" ? "get" : kind === "setter" ? "set" : "value";
        var target = !descriptorIn && ctor ? contextIn["static"] ? ctor : ctor.prototype : null;
        var descriptor = descriptorIn || (target ? Object.getOwnPropertyDescriptor(target, contextIn.name) : {});
        var _, done = false;
        for (var i = decorators.length - 1; i >= 0; i--) {
            var context = {};
            for (var p in contextIn) context[p] = p === "access" ? {} : contextIn[p];
            for (var p in contextIn.access) context.access[p] = contextIn.access[p];
            context.addInitializer = function (f) { if (done) throw new TypeError("Cannot add initializers after decoration has completed"); extraInitializers.push(accept(f || null)); };
            var result = (0, decorators[i])(kind === "accessor" ? { get: descriptor.get, set: descriptor.set } : descriptor[key], context);
            if (kind === "accessor") {
                if (result === void 0) continue;
                if (result === null || typeof result !== "object") throw new TypeError("Object expected");
                if (_ = accept(result.get)) descriptor.get = _;
                if (_ = accept(result.set)) descriptor.set = _;
                if (_ = accept(result.init)) initializers.unshift(_);
            }
            else if (_ = accept(result)) {
                if (kind === "field") initializers.unshift(_);
                else descriptor[key] = _;
            }
        }
        if (target) Object.defineProperty(target, contextIn.name, descriptor);
        done = true;
    };

    __runInitializers = function (thisArg, initializers, value) {
        var useValue = arguments.length > 2;
        for (var i = 0; i < initializers.length; i++) {
            value = useValue ? initializers[i].call(thisArg, value) : initializers[i].call(thisArg);
        }
        return useValue ? value : void 0;
    };

    __propKey = function (x) {
        return typeof x === "symbol" ? x : "".concat(x);
    };

    __setFunctionName = function (f, name, prefix) {
        if (typeof name === "symbol") name = name.description ? "[".concat(name.description, "]") : "";
        return Object.defineProperty(f, "name", { configurable: true, value: prefix ? "".concat(prefix, " ", name) : name });
    };

    __metadata = function (metadataKey, metadataValue) {
        if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(metadataKey, metadataValue);
    };

    __awaiter = function (thisArg, _arguments, P, generator) {
        function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
        return new (P || (P = Promise))(function (resolve, reject) {
            function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
            function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
            function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
            step((generator = generator.apply(thisArg, _arguments || [])).next());
        });
    };

    __generator = function (thisArg, body) {
        var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
        return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
        function verb(n) { return function (v) { return step([n, v]); }; }
        function step(op) {
            if (f) throw new TypeError("Generator is already executing.");
            while (g && (g = 0, op[0] && (_ = 0)), _) try {
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

    __exportStar = function(m, o) {
        for (var p in m) if (p !== "default" && !Object.prototype.hasOwnProperty.call(o, p)) __createBinding(o, m, p);
    };

    __createBinding = Object.create ? (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        var desc = Object.getOwnPropertyDescriptor(m, k);
        if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
            desc = { enumerable: true, get: function() { return m[k]; } };
        }
        Object.defineProperty(o, k2, desc);
    }) : (function(o, m, k, k2) {
        if (k2 === undefined) k2 = k;
        o[k2] = m[k];
    });

    __values = function (o) {
        var s = typeof Symbol === "function" && Symbol.iterator, m = s && o[s], i = 0;
        if (m) return m.call(o);
        if (o && typeof o.length === "number") return {
            next: function () {
                if (o && i >= o.length) o = void 0;
                return { value: o && o[i++], done: !o };
            }
        };
        throw new TypeError(s ? "Object is not iterable." : "Symbol.iterator is not defined.");
    };

    __read = function (o, n) {
        var m = typeof Symbol === "function" && o[Symbol.iterator];
        if (!m) return o;
        var i = m.call(o), r, ar = [], e;
        try {
            while ((n === void 0 || n-- > 0) && !(r = i.next()).done) ar.push(r.value);
        }
        catch (error) { e = { error: error }; }
        finally {
            try {
                if (r && !r.done && (m = i["return"])) m.call(i);
            }
            finally { if (e) throw e.error; }
        }
        return ar;
    };

    /** @deprecated */
    __spread = function () {
        for (var ar = [], i = 0; i < arguments.length; i++)
            ar = ar.concat(__read(arguments[i]));
        return ar;
    };

    /** @deprecated */
    __spreadArrays = function () {
        for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
        for (var r = Array(s), k = 0, i = 0; i < il; i++)
            for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
                r[k] = a[j];
        return r;
    };

    __spreadArray = function (to, from, pack) {
        if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
            if (ar || !(i in from)) {
                if (!ar) ar = Array.prototype.slice.call(from, 0, i);
                ar[i] = from[i];
            }
        }
        return to.concat(ar || Array.prototype.slice.call(from));
    };

    __await = function (v) {
        return this instanceof __await ? (this.v = v, this) : new __await(v);
    };

    __asyncGenerator = function (thisArg, _arguments, generator) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var g = generator.apply(thisArg, _arguments || []), i, q = [];
        return i = Object.create((typeof AsyncIterator === "function" ? AsyncIterator : Object).prototype), verb("next"), verb("throw"), verb("return", awaitReturn), i[Symbol.asyncIterator] = function () { return this; }, i;
        function awaitReturn(f) { return function (v) { return Promise.resolve(v).then(f, reject); }; }
        function verb(n, f) { if (g[n]) { i[n] = function (v) { return new Promise(function (a, b) { q.push([n, v, a, b]) > 1 || resume(n, v); }); }; if (f) i[n] = f(i[n]); } }
        function resume(n, v) { try { step(g[n](v)); } catch (e) { settle(q[0][3], e); } }
        function step(r) { r.value instanceof __await ? Promise.resolve(r.value.v).then(fulfill, reject) : settle(q[0][2], r); }
        function fulfill(value) { resume("next", value); }
        function reject(value) { resume("throw", value); }
        function settle(f, v) { if (f(v), q.shift(), q.length) resume(q[0][0], q[0][1]); }
    };

    __asyncDelegator = function (o) {
        var i, p;
        return i = {}, verb("next"), verb("throw", function (e) { throw e; }), verb("return"), i[Symbol.iterator] = function () { return this; }, i;
        function verb(n, f) { i[n] = o[n] ? function (v) { return (p = !p) ? { value: __await(o[n](v)), done: false } : f ? f(v) : v; } : f; }
    };

    __asyncValues = function (o) {
        if (!Symbol.asyncIterator) throw new TypeError("Symbol.asyncIterator is not defined.");
        var m = o[Symbol.asyncIterator], i;
        return m ? m.call(o) : (o = typeof __values === "function" ? __values(o) : o[Symbol.iterator](), i = {}, verb("next"), verb("throw"), verb("return"), i[Symbol.asyncIterator] = function () { return this; }, i);
        function verb(n) { i[n] = o[n] && function (v) { return new Promise(function (resolve, reject) { v = o[n](v), settle(resolve, reject, v.done, v.value); }); }; }
        function settle(resolve, reject, d, v) { Promise.resolve(v).then(function(v) { resolve({ value: v, done: d }); }, reject); }
    };

    __makeTemplateObject = function (cooked, raw) {
        if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
        return cooked;
    };

    var __setModuleDefault = Object.create ? (function(o, v) {
        Object.defineProperty(o, "default", { enumerable: true, value: v });
    }) : function(o, v) {
        o["default"] = v;
    };

    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };

    __importStar = function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };

    __importDefault = function (mod) {
        return (mod && mod.__esModule) ? mod : { "default": mod };
    };

    __classPrivateFieldGet = function (receiver, state, kind, f) {
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a getter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot read private member from an object whose class did not declare it");
        return kind === "m" ? f : kind === "a" ? f.call(receiver) : f ? f.value : state.get(receiver);
    };

    __classPrivateFieldSet = function (receiver, state, value, kind, f) {
        if (kind === "m") throw new TypeError("Private method is not writable");
        if (kind === "a" && !f) throw new TypeError("Private accessor was defined without a setter");
        if (typeof state === "function" ? receiver !== state || !f : !state.has(receiver)) throw new TypeError("Cannot write private member to an object whose class did not declare it");
        return (kind === "a" ? f.call(receiver, value) : f ? f.value = value : state.set(receiver, value)), value;
    };

    __classPrivateFieldIn = function (state, receiver) {
        if (receiver === null || (typeof receiver !== "object" && typeof receiver !== "function")) throw new TypeError("Cannot use 'in' operator on non-object");
        return typeof state === "function" ? receiver === state : state.has(receiver);
    };

    __addDisposableResource = function (env, value, async) {
        if (value !== null && value !== void 0) {
            if (typeof value !== "object" && typeof value !== "function") throw new TypeError("Object expected.");
            var dispose, inner;
            if (async) {
                if (!Symbol.asyncDispose) throw new TypeError("Symbol.asyncDispose is not defined.");
                dispose = value[Symbol.asyncDispose];
            }
            if (dispose === void 0) {
                if (!Symbol.dispose) throw new TypeError("Symbol.dispose is not defined.");
                dispose = value[Symbol.dispose];
                if (async) inner = dispose;
            }
            if (typeof dispose !== "function") throw new TypeError("Object not disposable.");
            if (inner) dispose = function() { try { inner.call(this); } catch (e) { return Promise.reject(e); } };
            env.stack.push({ value: value, dispose: dispose, async: async });
        }
        else if (async) {
            env.stack.push({ async: true });
        }
        return value;
    };

    var _SuppressedError = typeof SuppressedError === "function" ? SuppressedError : function (error, suppressed, message) {
        var e = new Error(message);
        return e.name = "SuppressedError", e.error = error, e.suppressed = suppressed, e;
    };

    __disposeResources = function (env) {
        function fail(e) {
            env.error = env.hasError ? new _SuppressedError(e, env.error, "An error was suppressed during disposal.") : e;
            env.hasError = true;
        }
        var r, s = 0;
        function next() {
            while (r = env.stack.pop()) {
                try {
                    if (!r.async && s === 1) return s = 0, env.stack.push(r), Promise.resolve().then(next);
                    if (r.dispose) {
                        var result = r.dispose.call(r.value);
                        if (r.async) return s |= 2, Promise.resolve(result).then(next, function(e) { fail(e); return next(); });
                    }
                    else s |= 1;
                }
                catch (e) {
                    fail(e);
                }
            }
            if (s === 1) return env.hasError ? Promise.reject(env.error) : Promise.resolve();
            if (env.hasError) throw env.error;
        }
        return next();
    };

    __rewriteRelativeImportExtension = function (path, preserveJsx) {
        if (typeof path === "string" && /^\.\.?\//.test(path)) {
            return path.replace(/\.(tsx)$|((?:\.d)?)((?:\.[^./]+?)?)\.([cm]?)ts$/i, function (m, tsx, d, ext, cm) {
                return tsx ? preserveJsx ? ".jsx" : ".js" : d && (!ext || !cm) ? m : (d + ext + "." + cm.toLowerCase() + "js");
            });
        }
        return path;
    };

    exporter("__extends", __extends);
    exporter("__assign", __assign);
    exporter("__rest", __rest);
    exporter("__decorate", __decorate);
    exporter("__param", __param);
    exporter("__esDecorate", __esDecorate);
    exporter("__runInitializers", __runInitializers);
    exporter("__propKey", __propKey);
    exporter("__setFunctionName", __setFunctionName);
    exporter("__metadata", __metadata);
    exporter("__awaiter", __awaiter);
    exporter("__generator", __generator);
    exporter("__exportStar", __exportStar);
    exporter("__createBinding", __createBinding);
    exporter("__values", __values);
    exporter("__read", __read);
    exporter("__spread", __spread);
    exporter("__spreadArrays", __spreadArrays);
    exporter("__spreadArray", __spreadArray);
    exporter("__await", __await);
    exporter("__asyncGenerator", __asyncGenerator);
    exporter("__asyncDelegator", __asyncDelegator);
    exporter("__asyncValues", __asyncValues);
    exporter("__makeTemplateObject", __makeTemplateObject);
    exporter("__importStar", __importStar);
    exporter("__importDefault", __importDefault);
    exporter("__classPrivateFieldGet", __classPrivateFieldGet);
    exporter("__classPrivateFieldSet", __classPrivateFieldSet);
    exporter("__classPrivateFieldIn", __classPrivateFieldIn);
    exporter("__addDisposableResource", __addDisposableResource);
    exporter("__disposeResources", __disposeResources);
    exporter("__rewriteRelativeImportExtension", __rewriteRelativeImportExtension);
});

0 && (module.exports = {
    __extends: __extends,
    __assign: __assign,
    __rest: __rest,
    __decorate: __decorate,
    __param: __param,
    __esDecorate: __esDecorate,
    __runInitializers: __runInitializers,
    __propKey: __propKey,
    __setFunctionName: __setFunctionName,
    __metadata: __metadata,
    __awaiter: __awaiter,
    __generator: __generator,
    __exportStar: __exportStar,
    __createBinding: __createBinding,
    __values: __values,
    __read: __read,
    __spread: __spread,
    __spreadArrays: __spreadArrays,
    __spreadArray: __spreadArray,
    __await: __await,
    __asyncGenerator: __asyncGenerator,
    __asyncDelegator: __asyncDelegator,
    __asyncValues: __asyncValues,
    __makeTemplateObject: __makeTemplateObject,
    __importStar: __importStar,
    __importDefault: __importDefault,
    __classPrivateFieldGet: __classPrivateFieldGet,
    __classPrivateFieldSet: __classPrivateFieldSet,
    __classPrivateFieldIn: __classPrivateFieldIn,
    __addDisposableResource: __addDisposableResource,
    __disposeResources: __disposeResources,
    __rewriteRelativeImportExtension: __rewriteRelativeImportExtension,
});

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {})
},{}]},{},[1]);
;
  var Voice = bundle(1);
  /* globals define */
  if (typeof define === 'function' && define.amd) {
    define([], function() { return Voice; });
  } else {
    var Twilio = root.Twilio = root.Twilio || {};
    Twilio.Call = Twilio.Call || Voice.Call;
    Twilio.Device = Twilio.Device || Voice.Device;
    Twilio.PStream = Twilio.PStream || Voice.PStream;
    Twilio.PreflightTest = Twilio.PreflightTest || Voice.PreflightTest;
    Twilio.Logger = Twilio.Logger || Voice.Logger;
  }
})(globalThis);
