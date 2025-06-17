// @ts-nocheck
import { AsyncQueue } from './asyncQueue';
import AudioPlayer from './audioplayer/audioplayer';
import { InvalidArgumentError } from './errors';
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
export default Sound;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic291bmQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL3NvdW5kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGNBQWM7QUFDZCxPQUFPLEVBQUUsVUFBVSxFQUFFLE1BQU0sY0FBYyxDQUFDO0FBQzFDLE9BQU8sV0FBVyxNQUFNLDJCQUEyQixDQUFDO0FBQ3BELE9BQU8sRUFBRSxvQkFBb0IsRUFBRSxNQUFNLFVBQVUsQ0FBQztBQUVoRDs7Ozs7Ozs7O0dBU0c7QUFDSDs7Ozs7R0FLRztBQUNILFNBQVMsS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsT0FBTztJQUMvQixJQUFJLENBQUMsQ0FBQyxJQUFJLFlBQVksS0FBSyxDQUFDLEVBQUUsQ0FBQztRQUM3QixPQUFPLElBQUksS0FBSyxDQUFDLElBQUksRUFBRSxHQUFHLEVBQUUsT0FBTyxDQUFDLENBQUM7SUFDdkMsQ0FBQztJQUVELElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUUsQ0FBQztRQUNsQixNQUFNLElBQUksb0JBQW9CLENBQUMscUNBQXFDLENBQUMsQ0FBQztJQUN4RSxDQUFDO0lBRUQsT0FBTyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUM7UUFDdEIsWUFBWSxFQUFFLE9BQU8sS0FBSyxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxJQUFJO1FBQ3pELFdBQVcsRUFBRSxDQUFDO1FBQ2QsVUFBVSxFQUFFLEtBQUs7S0FDbEIsRUFBRSxPQUFPLENBQUMsQ0FBQztJQUVaLE9BQU8sQ0FBQyxXQUFXLEdBQUcsT0FBTyxDQUFDLFlBQVk7UUFDeEMsQ0FBQyxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsV0FBVyxFQUFFLE9BQU8sQ0FBQyxZQUFZLENBQUM7UUFDckQsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxZQUFZLENBQUM7SUFFekIsTUFBTSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRTtRQUM1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