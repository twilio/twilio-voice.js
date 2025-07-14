"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
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
Object.defineProperty(exports, "__esModule", { value: true });
// @ts-nocheck
var deferred_1 = require("./deferred");
var eventtarget_1 = require("./eventtarget");
/**
 * An {@link AudioPlayer} is an HTMLAudioElement-like object that uses AudioContext
 *   to circumvent browser limitations.
 * @private
 */
var AudioPlayer = /** @class */ (function (_super) {
    __extends(AudioPlayer, _super);
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
        return __awaiter(this, void 0, void 0, function () {
            var buffer;
            var _this = this;
            return __generator(this, function (_a) {
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
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
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
        var deferred = new deferred_1.default();
        this._pendingPlayDeferreds.push(deferred);
        return deferred;
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
        this._bufferPromise = new Promise(function (resolve, reject) { return __awaiter(_this, void 0, void 0, function () {
            var buffer;
            return __generator(this, function (_a) {
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
}(eventtarget_1.default));
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
    return __awaiter(this, void 0, void 0, function () {
        var request, event;
        return __generator(this, function (_a) {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9wbGF5ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL2F1ZGlvcGxheWVyL2F1ZGlvcGxheWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsY0FBYztBQUNkLHVDQUFrQztBQUNsQyw2Q0FBd0M7QUFtQnhDOzs7O0dBSUc7QUFDSDtJQUEwQiwrQkFBVztJQWlJbkM7O09BRUc7SUFDSCxxQkFBWSxZQUFpQixFQUNqQixZQUFxRSxFQUNyRSxPQUF5RDtRQUR6RCw2QkFBQSxFQUFBLGVBQTJDLEVBQTBCO1FBQ3JFLHdCQUFBLEVBQUEsVUFBK0IsRUFBMEI7UUFDbkUsWUFBQSxNQUFLLFdBQUUsU0FBQztRQTFIVjs7OztXQUlHO1FBQ0ssZ0JBQVUsR0FBK0IsSUFBSSxDQUFDO1FBcUJ0RDs7O1dBR0c7UUFDSyxXQUFLLEdBQVksS0FBSyxDQUFDO1FBRS9COzs7O1dBSUc7UUFDSywyQkFBcUIsR0FBaUMsRUFBRSxDQUFDO1FBRWpFOztXQUVHO1FBQ0ssYUFBTyxHQUFXLFNBQVMsQ0FBQztRQUVwQzs7V0FFRztRQUNLLFVBQUksR0FBVyxFQUFFLENBQUM7UUE2RXhCLElBQUksT0FBTyxZQUFZLEtBQUssUUFBUSxFQUFFLENBQUM7WUFDckMsT0FBTyxHQUFHLFlBQVksQ0FBQztRQUN6QixDQUFDO1FBRUQsS0FBSSxDQUFDLGFBQWEsR0FBRyxZQUFrQyxDQUFDO1FBQ3hELEtBQUksQ0FBQyxhQUFhLEdBQUcsSUFBSSxDQUFDLE9BQU8sQ0FBQyxZQUFZLElBQUksS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUMzRCxLQUFJLENBQUMsY0FBYyxHQUFHLEtBQUksQ0FBQyxtQkFBbUIsRUFBRSxDQUFDLE9BQU8sQ0FBQztRQUN6RCxLQUFJLENBQUMsWUFBWSxHQUFHLEtBQUksQ0FBQyxhQUFhLENBQUMsV0FBVyxDQUFD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