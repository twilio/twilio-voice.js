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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic291bmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vc291bmQudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOlsiSW52YWxpZEFyZ3VtZW50RXJyb3IiLCJBdWRpb1BsYXllciIsIkFzeW5jUXVldWUiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7O0FBQUE7QUFLQTs7Ozs7Ozs7O0FBU0c7QUFDSDs7Ozs7QUFLRztBQUNILFNBQVMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsT0FBTyxFQUFBO0FBQy9CLElBQUEsSUFBSSxFQUFFLElBQUksWUFBWSxLQUFLLENBQUMsRUFBRTtRQUM1QixPQUFPLElBQUksS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsT0FBTyxDQUFDO0lBQ3RDO0FBRUEsSUFBQSxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsR0FBRyxFQUFFO0FBQ2pCLFFBQUEsTUFBTSxJQUFJQSwwQkFBb0IsQ0FBQyxxQ0FBcUMsQ0FBQztJQUN2RTtBQUVBLElBQUEsT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7QUFDdEIsUUFBQSxZQUFZLEVBQUUsT0FBTyxLQUFLLEtBQUssV0FBVyxHQUFHLEtBQUssR0FBRyxJQUFJO0FBQ3pELFFBQUEsV0FBVyxFQUFFLENBQUM7QUFDZCxRQUFBLFVBQVUsRUFBRSxLQUFLO0tBQ2xCLEVBQUUsT0FBTyxDQUFDO0FBRVgsSUFBQSxPQUFPLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQztVQUMxQkMsbUJBQVcsQ0FBQyxJQUFJLENBQUNBLG1CQUFXLEVBQUUsT0FBTyxDQUFDLFlBQVk7QUFDcEQsVUFBRSxPQUFPLENBQUMsWUFBWTtBQUV4QixJQUFBLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUU7QUFDNUIsUUFBQSxNQUFNLEVBQUUsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLFdBQVcsRUFBRTtBQUN0QyxRQUFBLFVBQVUsRUFBRSxFQUFFLEtBQUssRUFBRSxJQUFJ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
