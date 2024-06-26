var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
import Deferred from './deferred';
import EventTarget from './eventtarget';
/**
 * An {@link AudioPlayer} is an HTMLAudioElement-like object that uses AudioContext
 *   to circumvent browser limitations.
 * @private
 */
class AudioPlayer extends EventTarget {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9wbGF5ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL2F1ZGlvcGxheWVyL2F1ZGlvcGxheWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7Ozs7OztBQUFBOzs7O0dBSUc7QUFDSCxjQUFjO0FBQ2QsT0FBTyxRQUFRLE1BQU0sWUFBWSxDQUFDO0FBQ2xDLE9BQU8sV0FBVyxNQUFNLGVBQWUsQ0FBQztBQW1CeEM7Ozs7R0FJRztBQUNILE1BQU0sV0FBWSxTQUFRLFdBQVc7SUFpSW5DOztPQUVHO0lBQ0gsWUFBWSxZQUFpQixFQUNqQixlQUEyQyxFQUEwQixFQUNyRSxVQUErQixFQUEwQjtRQUNuRSxLQUFLLEVBQUUsQ0FBQztRQTFIVjs7OztXQUlHO1FBQ0ssZUFBVSxHQUErQixJQUFJLENBQUM7UUFxQnREOzs7V0FHRztRQUNLLFVBQUssR0FBWSxLQUFLLENBQUM7UUFFL0I7Ozs7V0FJRztRQUNLLDBCQUFxQixHQUFpQyxFQUFFLENBQUM7UUFFakU7O1dBRUc7UUFDSyxZQUFPLEdBQVcsU0FBUyxDQUFDO1FBRXBDOztXQUVHO1FBQ0ssU0FBSSxHQUFXLEVBQUUsQ0FBQztRQTZFeEIsSUFBSSxPQUFPLFlBQVksS0FBSyxRQUFRLEVBQUU7WUFDcEMsT0FBTyxHQUFHLFlBQVksQ0FBQztTQUN4QjtRQUVELElBQUksQ0FBQyxhQUFhLEdBQUcsWUFBa0MsQ0FBQztRQUN4RCxJQUFJLENBQUMsYUFBYSxHQUFHLElBQUksQ0FBQyxPQUFPLENBQUMsWUFBWSxJQUFJLEtBQUssQ0FBQyxFQUFFLENBQUM7UUFDM0QsSUFBSSxDQUFDLGNBQWMsR0FBRyxJQUFJLENBQUMsbUJBQW1CLEVBQUUsQ0FBQyxPQUFPLENBQUM7UUFDekQsSUFBSSxDQUFDLFlBQVksR0FBRyxJQUFJLENBQUMsYUFBYSxDQUFDLFdBQVcsQ0FBQztRQUNuRCxJQUFJLENBQUMsU0FBUyxHQUFHLElBQUksQ0FBQyxhQUFhLENBQUMsVUFB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