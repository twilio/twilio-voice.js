import { AsyncQueue } from './asyncQueue';
import AudioPlayer from './audioplayer/audioplayer';
import { InvalidArgumentError } from './errors';

/**
 * @typedef {Object} Sound#ConstructorOptions
 * @property {number} [maxDuration=0] - The maximum length of time to play the sound
 *   before stopping it.
 * @property {Boolean} [shouldLoop=false] - Whether the sound should be looped.
 */
interface SoundOptions {
  AudioFactory?: any;
  audioContext?: AudioContext;
  maxDuration?: number;
  shouldLoop?: boolean;
}

function destroyAudioElement(audioElement: any): void {
  if (audioElement) {
    audioElement.pause();
    audioElement.src = '';
    audioElement.srcObject = null;
    audioElement.load();
  }
}

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
class Sound {
  _Audio: any;
  _activeEls: Map<string, any> = new Map();
  _isSinkSupported: boolean;
  _maxDuration: number;
  _maxDurationTimeout: any = null;
  _operations: AsyncQueue = new AsyncQueue();
  _playPromise: Promise<any> | null = null;
  _shouldLoop: boolean;
  _sinkIds: string[] = ['default'];
  name: string;
  url: string;

  get isPlaying(): boolean {
    return !!this._playPromise;
  }

  constructor(name: string, url: string, options?: SoundOptions) {
    if (!name || !url) {
      throw new InvalidArgumentError('name and url are required arguments');
    }

    const opts: any = Object.assign({
      AudioFactory: typeof Audio !== 'undefined' ? Audio : null,
      maxDuration: 0,
      shouldLoop: false,
    }, options);

    opts.AudioPlayer = opts.audioContext
      ? AudioPlayer.bind(AudioPlayer, opts.audioContext)
      : opts.AudioFactory;

    this._Audio = opts.AudioPlayer;
    this._isSinkSupported = opts.AudioFactory !== null
      && typeof opts.AudioFactory.prototype.setSinkId === 'function';
    this._maxDuration = opts.maxDuration;
    this._shouldLoop = opts.shouldLoop;
    this.name = name;
    this.url = url;

    if (this._Audio) {
      // Play it (muted and should not loop) as soon as possible so that it does not get incorrectly caught by Chrome's
      // "gesture requirement for media playback" feature.
      // https://plus.google.com/+FrancoisBeaufort/posts/6PiJQqJzGqX
      this._play(true, false);
    }
  }

  /**
   * Plays the audio element that was initialized using the speficied sinkId
   */
  _playAudioElement(sinkId: string, isMuted?: boolean, shouldLoop?: boolean): Promise<any> {
    const audioElement = this._activeEls.get(sinkId);

    if (!audioElement) {
      throw new InvalidArgumentError(`sinkId: "${sinkId}" doesn't have an audio element`);
    }

    audioElement.muted = !!isMuted;
    audioElement.loop = !!shouldLoop;

    return audioElement.play()
      .then(() => audioElement)
      .catch((reason: any) => {
        destroyAudioElement(audioElement);
        this._activeEls.delete(sinkId);
        throw reason;
      });
  }

  /**
   * Start playing the sound. Will stop the currently playing sound first.
   * If it exists, the audio element that was initialized for the sinkId will be used
   */
  _play(forceIsMuted?: boolean, forceShouldLoop?: boolean): Promise<any> {
    if (this.isPlaying) {
      this._stop();
    }

    if (this._maxDuration > 0) {
      this._maxDurationTimeout = setTimeout(this._stop.bind(this), this._maxDuration);
    }

    forceShouldLoop = typeof forceShouldLoop === 'boolean' ? forceShouldLoop : this._shouldLoop;
    const self = this;
    const playPromise = this._playPromise = Promise.all(this._sinkIds.map(function createAudioElement(sinkId: string) {
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
  }

  /**
   * Stop playing the sound.
   */
  _stop(): void {
    this._activeEls.forEach((audioEl: any, sinkId: string) => {
      if (this._sinkIds.includes(sinkId)) {
        audioEl.pause();
        audioEl.currentTime = 0;
      } else {
        // Destroy the ones that are not used anymore
        destroyAudioElement(audioEl);
        this._activeEls.delete(sinkId);
      }
    });

    clearTimeout(this._maxDurationTimeout);

    this._playPromise = null;
    this._maxDurationTimeout = null;
  }

  /**
   * Update the sinkIds of the audio output devices this sound should play through.
   */
  setSinkIds(ids: string[] | string): void {
    if (!this._isSinkSupported) { return; }

    ids = (ids as any).forEach ? ids as string[] : [ids as string];
    [].splice.apply(this._sinkIds, [0, this._sinkIds.length].concat(ids as any) as any);
  }

  /**
   * Add a stop operation to the queue
   */
  stop(): void {
    this._operations.enqueue(() => {
      this._stop();
      return Promise.resolve();
    });
  }

  /**
   * Add a play operation to the queue
   */
  play(): Promise<any> {
    return this._operations.enqueue(() => this._play());
  }
}

export default Sound;
