import EventTarget from './eventtarget';
import { MediaStreamAudioDestinationNode } from './chromeaudiocontext';
/**
 * Options that may be passed to AudioPlayer for dependency injection.
 */
interface IAudioPlayerOptions {
    /**
     * The factory for Audio.
     */
    AudioFactory: any;
    /**
     * The factory for XMLHttpRequest.
     */
    XMLHttpRequestFactory: any;
}
/**
 * An {@link AudioPlayer} is an HTMLAudioElement-like object that uses AudioContext
 *   to circumvent browser limitations.
 * @private
 */
declare class AudioPlayer extends EventTarget {
    /**
     * The AudioContext. This is passed in at construction and used to create
     *   MediaStreamBuffers and AudioNodes for playing sound through.
     */
    private _audioContext;
    /**
     * The Audio element that is used to play sound through when a non-default
     *   sinkId is set.
     */
    private _audioElement;
    /**
     * The AudioBufferSourceNode of the actively loaded sound. Null if a sound
     *   has not been loaded yet. This is re-used for each time the sound is
     *   played.
     */
    private _audioNode;
    /**
     * A Promise for the AudioBuffer. Listening for the resolution of this Promise
     *   delays an operation until after the sound is loaded and ready to be
     *   played.
     */
    private _bufferPromise;
    /**
     * The current destination for audio playback. This is set to context.destination
     *   when default, or a specific MediaStreamAudioDestinationNode when setSinkId
     *   is set.
     */
    private _destination;
    /**
     * The GainNode used to control whether the sound is muted.
     */
    private _gainNode;
    /**
     * Whether or not the audio element should loop. If disabled during playback,
     *   playing continues until the sound ends and then stops looping.
     */
    private _loop;
    /**
     * An Array of deferred-like objects for each pending `play` Promise. When
     *   .pause() is called or .src is set, all pending play Promises are
     *   immediately rejected.
     */
    private _pendingPlayDeferreds;
    /**
     * The current sinkId of the device audio is being played through.
     */
    private _sinkId;
    /**
     * The source URL of the sound to play. When set, the currently playing sound will stop.
     */
    private _src;
    /**
     * The Factory to use to construct an XMLHttpRequest.
     */
    private _XMLHttpRequest;
    get destination(): MediaStreamAudioDestinationNode;
    get loop(): boolean;
    set loop(shouldLoop: boolean);
    /**
     * Whether the audio element is muted.
     */
    get muted(): boolean;
    set muted(shouldBeMuted: boolean);
    /**
     * Whether the sound is paused. this._audioNode only exists when sound is playing;
     *   otherwise AudioPlayer is considered paused.
     */
    get paused(): boolean;
    get src(): string;
    set src(src: string);
    /**
     * The srcObject of the HTMLMediaElement
     */
    get srcObject(): MediaStream | MediaSource | Blob | undefined;
    set srcObject(srcObject: MediaStream | MediaSource | Blob | undefined);
    get sinkId(): string;
    /**
     * @param audioContext - The AudioContext to use for controlling sound the through.
     * @param options
     */
    constructor(audioContext: any, options?: IAudioPlayerOptions);
    /**
     * @param audioContext - The AudioContext to use for controlling sound the through.
     * @param src - The URL of the sound to load.
     * @param options
     */
    constructor(audioContext: any, src: string, options?: IAudioPlayerOptions);
    /**
     * Stop any ongoing playback and reload the source file.
     */
    load(): void;
    /**
     * Pause the audio coming from this AudioPlayer. This will reject any pending
     *   play Promises.
     */
    pause(): void;
    /**
     * Play the sound. If the buffer hasn't loaded yet, wait for the buffer to load. If
     *   the source URL is not set yet, this Promise will remain pending until a source
     *   URL is set.
     */
    play(): Promise<void>;
    /**
     * Change which device the sound should play through.
     * @param sinkId - The sink of the device to play sound through.
     */
    setSinkId(sinkId: string): Promise<void>;
    /**
     * Create a Deferred for a Promise that will be resolved when .src is set or rejected
     *   when .pause is called.
     */
    private _createPlayDeferred;
    /**
     * Stop current playback and load a sound file.
     * @param src - The source URL of the file to load
     */
    private _load;
    /**
     * Reject all deferreds for the Play promise.
     * @param reason
     */
    private _rejectPlayDeferreds;
    /**
     * Resolve all deferreds for the Play promise.
     * @param result
     */
    private _resolvePlayDeferreds;
}
export default AudioPlayer;
