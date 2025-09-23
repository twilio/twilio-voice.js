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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9wbGF5ZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vYXVkaW9wbGF5ZXIvYXVkaW9wbGF5ZXIudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOlsiX19leHRlbmRzIiwiZGVmZXJyZWQiLCJEZWZlcnJlZCIsIl9fYXdhaXRlciIsIkV2ZW50VGFyZ2V0Il0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQXFCQTs7OztBQUlHO0FBQ0gsSUFBQSxXQUFBLGtCQUFBLFVBQUEsTUFBQSxFQUFBO0lBQTBCQSxlQUFBLENBQUEsV0FBQSxFQUFBLE1BQUEsQ0FBQTtBQWlJeEI7O0FBRUc7QUFDSCxJQUFBLFNBQUEsV0FBQSxDQUFZLFlBQWlCLEVBQ2pCLFlBQXFFLEVBQ3JFLE9BQXlELEVBQUE7UUFEekQsSUFBQSxZQUFBLEtBQUEsTUFBQSxFQUFBLEVBQUEsZUFBMkMsRUFBMEIsQ0FBQSxDQUFBO1FBQ3JFLElBQUEsT0FBQSxLQUFBLE1BQUEsRUFBQSxFQUFBLFVBQStCLEVBQTBCLENBQUEsQ0FBQTtRQUNuRSxJQUFBLEtBQUEsR0FBQSxNQUFLLFdBQUUsSUFBQSxJQUFBO0FBMUhUOzs7O0FBSUc7UUFDSyxLQUFBLENBQUEsVUFBVSxHQUErQixJQUFJO0FBcUJyRDs7O0FBR0c7UUFDSyxLQUFBLENBQUEsS0FBSyxHQUFZLEtBQUs7QUFFOUI7Ozs7QUFJRztRQUNLLEtBQUEsQ0FBQSxxQkFBcUIsR0FBaUMsRUFBRTtBQUVoRTs7QUFFRztRQUNLLEtBQUEsQ0FBQSxPQUFPLEdBQVcsU0FBUztBQUVuQzs7QUFFRztRQUNLLEtBQUEsQ0FBQSxJQUFJLEdBQVcsRUFBRTtBQTZFdkIsUUFBQSxJQUFJLE9BQU8sWUFBWSxLQUFLLFFBQVEsRUFBRTtZQUNwQyxPQUFPLEdBQUcsWUFBWTtRQUN4QjtBQUVBLFFBQUEsS0FBSSxDQUFDLGFBQWEsR0FBRyxZQUFrQztBQUN2RCxRQUFBLEtBQUksQ0FBQyxhQUFhLEdBQUcsS0FBSyxPQUFPLENBQUMs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
