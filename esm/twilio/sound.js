/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic291bmQuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL3NvdW5kLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7O0dBSUc7QUFDSCxjQUFjO0FBQ2QsT0FBTyxFQUFFLFVBQVUsRUFBRSxNQUFNLGNBQWMsQ0FBQztBQUMxQyxPQUFPLFdBQVcsTUFBTSwyQkFBMkIsQ0FBQztBQUNwRCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFFaEQ7Ozs7Ozs7OztHQVNHO0FBQ0g7Ozs7O0dBS0c7QUFDSCxTQUFTLEtBQUssQ0FBQyxJQUFJLEVBQUUsR0FBRyxFQUFFLE9BQU87SUFDL0IsSUFBSSxDQUFDLENBQUMsSUFBSSxZQUFZLEtBQUssQ0FBQyxFQUFFO1FBQzVCLE9BQU8sSUFBSSxLQUFLLENBQUMsSUFBSSxFQUFFLEdBQUcsRUFBRSxPQUFPLENBQUMsQ0FBQztLQUN0QztJQUVELElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxHQUFHLEVBQUU7UUFDakIsTUFBTSxJQUFJLG9CQUFvQixDQUFDLHFDQUFxQyxDQUFDLENBQUM7S0FDdkU7SUFFRCxPQUFPLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQztRQUN0QixZQUFZLEVBQUUsT0FBTyxLQUFLLEtBQUssV0FBVyxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsQ0FBQyxDQUFDLElBQUk7UUFDekQsV0FBVyxFQUFFLENBQUM7UUFDZCxVQUFVLEVBQUUsS0FBSztLQUNsQixFQUFFLE9BQU8sQ0FBQyxDQUFDO0lBRVosT0FBTyxDQUFDLFdBQVcsR0FBRyxPQUFPLENBQUMsWUFBWTtRQUN4QyxDQUFDLENBQUMsV0FBVyxDQUFDLElBQUksQ0FBQyxXQUFXLEVBQUUsT0FBTyxDQUFDLFlBQVksQ0FBQztRQUNyRCxDQUFDLENBQUMsT0FBTyxDQUFDLFlBQVksQ0FBQztJQUV6QixNQUFNLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFO1FBQzVCLE1BQU0s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