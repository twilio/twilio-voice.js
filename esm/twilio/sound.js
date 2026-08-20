import { AsyncQueue } from './asyncQueue.js';
import AudioPlayer from './audioplayer/audioplayer.js';
import { InvalidArgumentError } from './errors/index.js';

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
        throw new InvalidArgumentError('name and url are required arguments');
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
        _operations: { value: new AsyncQueue() },
        _playPromise: {
            value: null,
            writable: true,
        },
        _shouldLoop: { value: options.shouldLoop },
        _sinkIds: { value: ['default'] },
        isPlaying: {
            enumerable: true,
            get() {
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
    const audioElement = this._activeEls.get(sinkId);
    if (!audioElement) {
        throw new InvalidArgumentError(`sinkId: "${sinkId}" doesn't have an audio element`);
    }
    audioElement.muted = !!isMuted;
    audioElement.loop = !!shouldLoop;
    return audioElement.play()
        .then(() => audioElement)
        .catch((reason) => {
        destroyAudioElement(audioElement);
        this._activeEls.delete(sinkId);
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
    const self = this;
    const playPromise = this._playPromise = Promise.all(this._sinkIds.map(function createAudioElement(sinkId) {
        if (!self._Audio) {
            return Promise.resolve();
        }
        let audioElement = self._activeEls.get(sinkId);
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
        return new Promise(resolve => {
            audioElement.addEventListener('canplaythrough', resolve);
        }).then(() => {
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
    this._activeEls.forEach((audioEl, sinkId) => {
        if (this._sinkIds.includes(sinkId)) {
            audioEl.pause();
            audioEl.currentTime = 0;
        }
        else {
            // Destroy the ones that are not used anymore
            destroyAudioElement(audioEl);
            this._activeEls.delete(sinkId);
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
    this._operations.enqueue(() => {
        this._stop();
        return Promise.resolve();
    });
};
/**
 * Add a play operation to the queue
 */
Sound.prototype.play = function play() {
    return this._operations.enqueue(() => this._play());
};

export { Sound as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic291bmQuanMiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vc291bmQudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7OztBQUFBO0FBS0E7Ozs7Ozs7OztBQVNHO0FBQ0g7Ozs7O0FBS0c7QUFDSCxTQUFTLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLE9BQU8sRUFBQTtBQUMvQixJQUFBLElBQUksRUFBRSxJQUFJLFlBQVksS0FBSyxDQUFDLEVBQUU7UUFDNUIsT0FBTyxJQUFJLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLE9BQU8sQ0FBQztJQUN0QztBQUVBLElBQUEsSUFBSSxDQUFDLElBQUksSUFBSSxDQUFDLEdBQUcsRUFBRTtBQUNqQixRQUFBLE1BQU0sSUFBSSxvQkFBb0IsQ0FBQyxxQ0FBcUMsQ0FBQztJQUN2RTtBQUVBLElBQUEsT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7QUFDdEIsUUFBQSxZQUFZLEVBQUUsT0FBTyxLQUFLLEtBQUssV0FBVyxHQUFHLEtBQUssR0FBRyxJQUFJO0FBQ3pELFFBQUEsV0FBVyxFQUFFLENBQUM7QUFDZCxRQUFBLFVBQVUsRUFBRSxLQUFLO0tBQ2xCLEVBQUUsT0FBTyxDQUFDO0FBRVgsSUFBQSxPQUFPLENBQUMsV0FBVyxHQUFHLE9BQU8sQ0FBQztVQUMxQixXQUFXLENBQUMsSUFBSSxDQUFDLFdBQVcsRUFBRSxPQUFPLENBQUMsWUFBWTtBQUNwRCxVQUFFLE9BQU8sQ0FBQyxZQUFZO0FBRXhCLElBQUEsTUFBTSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRTtBQUM1QixRQUFBLE1BQU0sRUFBRSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsV0FBVyxFQUFFO0FBQ3RDLFFBQUEsVUFBVSxFQUFFLEVBQUUsS0FBSyxFQUFFLElBQUksR0FBRyxFQUFFLEVBQUU7QUFDaEMsUUFBQSxnQkFBZ0IsRUFBRTtBQUNoQixZQUFBLEtBQUssRUFB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
