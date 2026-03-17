import { __awaiter } from 'tslib';
import Deferred from './deferred.js';
import EventTarget from './eventtarget.js';

/**
 * An {@link AudioPlayer} is an HTMLAudioElement-like object that uses AudioContext
 *   to circumvent browser limitations.
 * @private
 */
class AudioPlayer extends EventTarget {
    get destination() { return this._destination; }
    get loop() { return this._loop; }
    set loop(shouldLoop) {
        const self = this;
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
    }
    /**
     * Whether the audio element is muted.
     */
    get muted() { return this._gainNode.gain.value === 0; }
    set muted(shouldBeMuted) {
        this._gainNode.gain.value = shouldBeMuted ? 0 : 1;
    }
    /**
     * Whether the sound is paused. this._audioNode only exists when sound is playing;
     *   otherwise AudioPlayer is considered paused.
     */
    get paused() { return this._audioNode === null; }
    get src() { return this._src; }
    set src(src) {
        this._load(src);
    }
    /**
     * The srcObject of the HTMLMediaElement
     */
    get srcObject() {
        return this._audioElement.srcObject;
    }
    set srcObject(srcObject) {
        this._audioElement.srcObject = srcObject;
    }
    get sinkId() { return this._sinkId; }
    /**
     * @private
     */
    constructor(audioContext, srcOrOptions = {}, options = {}) {
        super();
        /**
         * The AudioBufferSourceNode of the actively loaded sound. Null if a sound
         *   has not been loaded yet. This is re-used for each time the sound is
         *   played.
         */
        this._audioNode = null;
        /**
         * Whether or not the audio element should loop. If disabled during playback,
         *   playing continues until the sound ends and then stops looping.
         */
        this._loop = false;
        /**
         * An Array of deferred-like objects for each pending `play` Promise. When
         *   .pause() is called or .src is set, all pending play Promises are
         *   immediately rejected.
         */
        this._pendingPlayDeferreds = [];
        /**
         * The current sinkId of the device audio is being played through.
         */
        this._sinkId = 'default';
        /**
         * The source URL of the sound to play. When set, the currently playing sound will stop.
         */
        this._src = '';
        if (typeof srcOrOptions !== 'string') {
            options = srcOrOptions;
        }
        this._audioContext = audioContext;
        this._audioElement = new (options.AudioFactory || Audio)();
        this._bufferPromise = this._createPlayDeferred().promise;
        this._destination = this._audioContext.destination;
        this._gainNode = this._audioContext.createGain();
        this._gainNode.connect(this._destination);
        this._XMLHttpRequest = options.XMLHttpRequestFactory || XMLHttpRequest;
        this.addEventListener('canplaythrough', () => {
            this._resolvePlayDeferreds();
        });
        if (typeof srcOrOptions === 'string') {
            this.src = srcOrOptions;
        }
    }
    /**
     * Stop any ongoing playback and reload the source file.
     */
    load() {
        this._load(this._src);
    }
    /**
     * Pause the audio coming from this AudioPlayer. This will reject any pending
     *   play Promises.
     */
    pause() {
        if (this.paused) {
            return;
        }
        this._audioElement.pause();
        this._audioNode.stop();
        this._audioNode.disconnect(this._gainNode);
        this._audioNode = null;
        this._rejectPlayDeferreds(new Error('The play() request was interrupted by a call to pause().'));
    }
    /**
     * Play the sound. If the buffer hasn't loaded yet, wait for the buffer to load. If
     *   the source URL is not set yet, this Promise will remain pending until a source
     *   URL is set.
     */
    play() {
        return __awaiter(this, void 0, void 0, function* () {
            if (!this.paused) {
                yield this._bufferPromise;
                if (!this.paused) {
                    return;
                }
                throw new Error('The play() request was interrupted by a call to pause().');
            }
            this._audioNode = this._audioContext.createBufferSource();
            this._audioNode.loop = this.loop;
            this._audioNode.addEventListener('ended', () => {
                if (this._audioNode && this._audioNode.loop) {
                    return;
                }
                this.dispatchEvent('ended');
            });
            const buffer = yield this._bufferPromise;
            if (this.paused) {
                throw new Error('The play() request was interrupted by a call to pause().');
            }
            this._audioNode.buffer = buffer;
            this._audioNode.connect(this._gainNode);
            this._audioNode.start();
            if (this._audioElement.srcObject) {
                return this._audioElement.play();
            }
        });
    }
    /**
     * Change which device the sound should play through.
     * @param sinkId - The sink of the device to play sound through.
     */
    setSinkId(sinkId) {
        return __awaiter(this, void 0, void 0, function* () {
            if (typeof this._audioElement.setSinkId !== 'function') {
                throw new Error('This browser does not support setSinkId.');
            }
            if (sinkId === this.sinkId) {
                return;
            }
            if (sinkId === 'default') {
                if (!this.paused) {
                    this._gainNode.disconnect(this._destination);
                }
                this._audioElement.srcObject = null;
                this._destination = this._audioContext.destination;
                this._gainNode.connect(this._destination);
                this._sinkId = sinkId;
                return;
            }
            yield this._audioElement.setSinkId(sinkId);
            if (this._audioElement.srcObject) {
                return;
            }
            this._gainNode.disconnect(this._audioContext.destination);
            this._destination = this._audioContext.createMediaStreamDestination();
            this._audioElement.srcObject = this._destination.stream;
            this._sinkId = sinkId;
            this._gainNode.connect(this._destination);
        });
    }
    /**
     * Create a Deferred for a Promise that will be resolved when .src is set or rejected
     *   when .pause is called.
     */
    _createPlayDeferred() {
        const deferred = new Deferred();
        this._pendingPlayDeferreds.push(deferred);
        return deferred;
    }
    /**
     * Stop current playback and load a sound file.
     * @param src - The source URL of the file to load
     */
    _load(src) {
        if (this._src && this._src !== src) {
            this.pause();
        }
        this._src = src;
        this._bufferPromise = new Promise((resolve, reject) => __awaiter(this, void 0, void 0, function* () {
            if (!src) {
                return this._createPlayDeferred().promise;
            }
            const buffer = yield bufferSound(this._audioContext, this._XMLHttpRequest, src);
            this.dispatchEvent('canplaythrough');
            resolve(buffer);
        }));
    }
    /**
     * Reject all deferreds for the Play promise.
     * @param reason
     */
    _rejectPlayDeferreds(reason) {
        const deferreds = this._pendingPlayDeferreds;
        deferreds.splice(0, deferreds.length).forEach(({ reject }) => reject(reason));
    }
    /**
     * Resolve all deferreds for the Play promise.
     * @param result
     */
    _resolvePlayDeferreds(result) {
        const deferreds = this._pendingPlayDeferreds;
        deferreds.splice(0, deferreds.length).forEach(({ resolve }) => resolve(result));
    }
}
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
    return __awaiter(this, void 0, void 0, function* () {
        const request = new RequestFactory();
        request.open('GET', src, true);
        request.responseType = 'arraybuffer';
        const event = yield new Promise(resolve => {
            request.addEventListener('load', resolve);
            request.send();
        });
        // Safari uses a callback here instead of a Promise.
        try {
            return context.decodeAudioData(event.target.response);
        }
        catch (e) {
            return new Promise(resolve => {
                context.decodeAudioData(event.target.response, resolve);
            });
        }
    });
}

export { AudioPlayer as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9wbGF5ZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vYXVkaW9wbGF5ZXIvYXVkaW9wbGF5ZXIudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7OztBQXFCQTs7OztBQUlHO0FBQ0gsTUFBTSxXQUFZLFNBQVEsV0FBVyxDQUFBO0lBbUVuQyxJQUFJLFdBQVcsS0FBc0MsT0FBTyxJQUFJLENBQUMsWUFBWSxDQUFDLENBQUM7SUFDL0UsSUFBSSxJQUFJLEtBQWMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUM7SUFDekMsSUFBSSxJQUFJLENBQUMsVUFBbUIsRUFBQTtRQUMxQixNQUFNLElBQUksR0FBRyxJQUFJO0FBQ2pCLFFBQUEsU0FBUyxxQkFBcUIsR0FBQTtZQUM1QixJQUFJLENBQUMsVUFBVSxDQUFDLG1CQUFtQixDQUFDLE9BQU8sRUFBRSxxQkFBcUIsQ0FBQztZQUNuRSxJQUFJLENBQUMsS0FBSyxFQUFFO1FBQ2Q7OztBQUdBLFFBQUEsSUFBSSxDQUFDLFVBQVUsSUFBSSxJQUFJLENBQUMsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLE1BQU0sRUFBRTtZQUM1QyxJQUFJLENBQUMsVUFBVSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxxQkFBcUIsQ0FBQztRQUNsRTtBQUVBLFFBQUEsSUFBSSxDQUFDLEtBQUssR0FBRyxVQUFVO0lBQ3pCO0FBRUE7O0FBRUc7QUFDSCxJQUFBLElBQUksS0FBSyxHQUFBLEVBQWMsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUM7SUFDL0QsSUFBSSxLQUFLLENBQUMsYUFBc0IsRUFBQTtBQUM5QixRQUFBLElBQUksQ0FBQyxTQUFTLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxhQUFhLEdBQUcsQ0FBQyxHQUFHLENBQUM7SUFDbkQ7QUFFQTs7O0FBR0c7SUFDSCxJQUFJLE1BQU0s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
