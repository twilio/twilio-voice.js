"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
var AudioPlayer = require("@twilio/audioplayer");
var asyncQueue_1 = require("./asyncQueue");
var errors_1 = require("./errors");
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
        throw new errors_1.InvalidArgumentError('name and url are required arguments');
    }
    options = Object.assign({
        AudioFactory: typeof Audio !== 'undefined' ? Audio : null,
        maxDuration: 0,
        shouldLoop: false,
    }, options);
    options.AudioPlayer = options.audioContext
        ? AudioPlayer.bind(AudioPlayer, options.audioContext)
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
        _operations: { value: new asyncQueue_1.AsyncQueue() },
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
        throw new errors_1.InvalidArgumentError("sinkId: \"" + sinkId + "\" doesn't have an audio element");
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic291bmQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL3NvdW5kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7R0FJRztBQUNILGNBQWM7QUFDZCxpREFBbUQ7QUFDbkQsMkNBQTBDO0FBQzFDLG1DQUFnRDtBQUVoRDs7Ozs7Ozs7O0dBU0c7QUFDSDs7Ozs7R0FLRztBQUNILFNBQVMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsT0FBTztJQUMvQixJQUFJLENBQUMsQ0FBQyxJQUFJLFlBQVksS0FBSyxDQUFDLEVBQUU7UUFDNUIsT0FBTyxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLE9BQU8sQ0FBQyxDQUFDO0tBQ3RDO0lBRUQsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRTtRQUNqQixNQUFNLElBQUksNkJBQW9CLENBQUMscUNBQXFDLENBQUMsQ0FBQztLQUN2RTtJQUVELE9BQU8sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDO1FBQ3RCLFlBQVksRUFBRSxPQUFPLEtBQUssS0FBSyxXQUFXLENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsSUFBSTtRQUN6RCxXQUFXLEVBQUUsQ0FBQztRQUNkLFVBQVUsRUFBRSxLQUFLO0tBQ2xCLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFFWixPQUFPLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQyxZQUFZO1FBQ3hDLENBQUMsQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsWUFBWSxDQUFDO1FBQ3JELENBQUMsQ0FBQyxPQUFPLENBQUMsWUFBWSxDQUFDO0lBRXpCLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUU7UUFDNUIsTUFBTSxFQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxXQUFXLEVBQUU7UUFDdEMsVUFBVSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUks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