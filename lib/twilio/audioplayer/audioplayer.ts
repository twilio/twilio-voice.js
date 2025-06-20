// @ts-nocheck
import Deferred from './deferred';
import EventTarget from './eventtarget';

import ChromeAudioContext, { ChromeHTMLAudioElement, MediaStreamAudioDestinationNode } from './chromeaudiocontext';

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
class AudioPlayer extends EventTarget {
  /**
   * The AudioContext. This is passed in at construction and used to create
   *   MediaStreamBuffers and AudioNodes for playing sound through.
   */
  private _audioContext: ChromeAudioContext;

  /**
   * The Audio element that is used to play sound through when a non-default
   *   sinkId is set.
   */
  private _audioElement: ChromeHTMLAudioElement;

  /**
   * The AudioBufferSourceNode of the actively loaded sound. Null if a sound
   *   has not been loaded yet. This is re-used for each time the sound is
   *   played.
   */
  private _audioNode: AudioBufferSourceNode|null = null;

  /**
   * A Promise for the AudioBuffer. Listening for the resolution of this Promise
   *   delays an operation until after the sound is loaded and ready to be
   *   played.
   */
  private _bufferPromise: Promise<AudioBuffer>;

  /**
   * The current destination for audio playback. This is set to context.destination
   *   when default, or a specific MediaStreamAudioDestinationNode when setSinkId
   *   is set.
   */
  private _destination: MediaStreamAudioDestinationNode;

  /**
   * The GainNode used to control whether the sound is muted.
   */
  private _gainNode: GainNode;

  /**
   * Whether or not the audio element should loop. If disabled during playback,
   *   playing continues until the sound ends and then stops looping.
   */
  private _loop: boolean = false;

  /**
   * An Array of deferred-like objects for each pending `play` Promise. When
   *   .pause() is called or .src is set, all pending play Promises are
   *   immediately rejected.
   */
  private _pendingPlayDeferreds: Array<Deferred<AudioBuffer>> = [];

  /**
   * The current sinkId of the device audio is being played through.
   */
  private _sinkId: string = 'default';

  /**
   * The source URL of the sound to play. When set, the currently playing sound will stop.
   */
  private _src: string = '';

  /**
   * The Factory to use to construct an XMLHttpRequest.
   */
  private _XMLHttpRequest: any;

  get destination(): MediaStreamAudioDestinationNode { return this._destination; }
  get loop(): boolean { return this._loop; }
  set loop(shouldLoop: boolean) {
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
  get muted(): boolean { return this._gainNode.gain.value === 0; }
  set muted(shouldBeMuted: boolean) {
    this._gainNode.gain.value = shouldBeMuted ? 0 : 1;
  }

  /**
   * Whether the sound is paused. this._audioNode only exists when sound is playing;
   *   otherwise AudioPlayer is considered paused.
   */
  get paused(): boolean { return this._audioNode === null; }
  get src(): string { return this._src; }
  set src(src: string) {
    this._load(src);
  }

  /**
   * The srcObject of the HTMLMediaElement
   */
  get srcObject(): MediaStream | MediaSource | Blob | undefined {
    return this._audioElement.srcObject;
  }
  set srcObject(srcObject: MediaStream | MediaSource | Blob | undefined) {
    this._audioElement.srcObject = srcObject;
  }
  get sinkId(): string { return this._sinkId; }

  /**
   * @param audioContext - The AudioContext to use for controlling sound the through.
   * @param options
   */
  constructor(audioContext: any,
              options?: IAudioPlayerOptions);

  /**
   * @param audioContext - The AudioContext to use for controlling sound the through.
   * @param src - The URL of the sound to load.
   * @param options
   */
  constructor(audioContext: any,
              src: string,
              options?: IAudioPlayerOptions);

  /**
   * @private
   */
  constructor(audioContext: any,
              srcOrOptions: string|IAudioPlayerOptions = { } as IAudioPlayerOptions,
              options: IAudioPlayerOptions = { } as IAudioPlayerOptions) {
    super();

    if (typeof srcOrOptions !== 'string') {
      options = srcOrOptions;
    }

    this._audioContext = audioContext as ChromeAudioContext;
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
  load(): void {
    this._load(this._src);
  }

  /**
   * Pause the audio coming from this AudioPlayer. This will reject any pending
   *   play Promises.
   */
  pause(): void {
    if (this.paused) { return; }

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
  async play(): Promise<void> {
    if (!this.paused) {
      await this._bufferPromise;
      if (!this.paused) { return; }
      throw new Error('The play() request was interrupted by a call to pause().');
    }

    this._audioNode = this._audioContext.createBufferSource();
    this._audioNode.loop = this.loop;

    this._audioNode.addEventListener('ended', () => {
      if (this._audioNode && this._audioNode.loop) { return; }
      this.dispatchEvent('ended');
    });

    const buffer: AudioBuffer = await this._bufferPromise;

    if (this.paused) {
      throw new Error('The play() request was interrupted by a call to pause().');
    }

    this._audioNode.buffer = buffer;
    this._audioNode.connect(this._gainNode);
    this._audioNode.start();

    if (this._audioElement.srcObject) {
      return this._audioElement.play();
    }
  }

  /**
   * Change which device the sound should play through.
   * @param sinkId - The sink of the device to play sound through.
   */
  async setSinkId(sinkId: string): Promise<void> {
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

    await this._audioElement.setSinkId(sinkId);
    if (this._audioElement.srcObject) { return; }

    this._gainNode.disconnect(this._audioContext.destination);
    this._destination = this._audioContext.createMediaStreamDestination();
    this._audioElement.srcObject = this._destination.stream;
    this._sinkId = sinkId;

    this._gainNode.connect(this._destination);
  }

  /**
   * Create a Deferred for a Promise that will be resolved when .src is set or rejected
   *   when .pause is called.
   */
  private _createPlayDeferred(): Deferred<AudioBuffer> {
    const deferred = new Deferred();
    this._pendingPlayDeferreds.push(deferred as Deferred<AudioBuffer>);
    return deferred as Deferred<AudioBuffer>;
  }

  /**
   * Stop current playback and load a sound file.
   * @param src - The source URL of the file to load
   */
  private _load(src: string): void {
    if (this._src && this._src !== src) {
      this.pause();
    }

    this._src = src;
    this._bufferPromise = new Promise(async (resolve, reject) => {
      if (!src) {
        return this._createPlayDeferred().promise;
      }

      const buffer = await bufferSound(this._audioContext, this._XMLHttpRequest, src);
      this.dispatchEvent('canplaythrough');
      resolve(buffer);
    });
  }

  /**
   * Reject all deferreds for the Play promise.
   * @param reason
   */
  private _rejectPlayDeferreds(reason?: any): void {
    const deferreds = this._pendingPlayDeferreds;
    deferreds.splice(0, deferreds.length).forEach(({ reject }) => reject(reason));
  }

  /**
   * Resolve all deferreds for the Play promise.
   * @param result
   */
  private _resolvePlayDeferreds(result?: any): void {
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
async function bufferSound(context: any, RequestFactory: any, src: string): Promise<AudioBuffer> {
  const request: XMLHttpRequest = new RequestFactory();
  request.open('GET', src, true);
  request.responseType = 'arraybuffer';

  const event: any = await new Promise(resolve => {
    request.addEventListener('load', resolve);
    request.send();
  });

  // Safari uses a callback here instead of a Promise.
  try {
    return context.decodeAudioData(event.target.response);
  } catch (e) {
    return new Promise(resolve => {
      context.decodeAudioData(event.target.response, resolve);
    }) as Promise<AudioBuffer>;
  }
}

export default AudioPlayer;
