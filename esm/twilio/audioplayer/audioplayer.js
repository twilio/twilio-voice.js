var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
// @ts-nocheck
import Deferred from './deferred';
import EventTarget from './eventtarget';
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
export default AudioPlayer;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9wbGF5ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL2F1ZGlvcGxheWVyL2F1ZGlvcGxheWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBLGNBQWM7QUFDZCxPQUFPLFFBQVEsTUFBTSxZQUFZLENBQUM7QUFDbEMsT0FBTyxXQUFXLE1BQU0sZUFBZSxDQUFDO0FBbUJ4Qzs7OztHQUlHO0FBQ0gsTUFBTSxXQUFZLFNBQVEsV0FBVztJQW1FbkMsSUFBSSxXQUFXLEtBQXNDLE9BQU8sSUFBSSxDQUFDLFlBQVksQ0FBQyxDQUFDLENBQUM7SUFDaEYsSUFBSSxJQUFJLEtBQWMsT0FBTyxJQUFJLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQztJQUMxQyxJQUFJLElBQUksQ0FBQyxVQUFtQjtRQUMxQixNQUFNLElBQUksR0FBRyxJQUFJLENBQUM7UUFDbEIsU0FBUyxxQkFBcUI7WUFDNUIsSUFBSSxDQUFDLFVBQVUsQ0FBQyxtQkFBbUIsQ0FBQyxPQUFPLEVBQUUscUJBQXFCLENBQUMsQ0FBQztZQUNwRSxJQUFJLENBQUMsS0FBSyxFQUFFLENBQUM7UUFDZixDQUFDO1FBQ0QsNERBQTREO1FBQzVELDJDQUEyQztRQUMzQyxJQUFJLENBQUMsVUFBVSxJQUFJLElBQUksQ0FBQyxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsTUFBTSxFQUFFLENBQUM7WUFDN0MsSUFBSSxDQUFDLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUscUJBQXFCLENBQUMsQ0FBQztRQUNuRSxDQUFDO1FBRUQsSUFBSSxDQUFDLEtBQUssR0FBRyxVQUFVLENBQUM7SUFDMUIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsSUFBSSxLQUFLLEtBQWMsT0FBTyxJQUFJLENBQUMsU0FBUyxDQUFDLElBQUksQ0FBQyxLQUFLLEtBQUssQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNoRSxJQUFJLEtBQUssQ0FBQyxhQUFzQjtR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