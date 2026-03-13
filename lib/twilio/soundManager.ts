import * as C from './constants';
import { ISoundDefinition, ISound } from './device';
import Sound from './sound';

/**
 * Options for SoundManager.setupSounds().
 */
export interface SoundManagerOptions {
  Sound?: typeof Sound;
  audioContext?: AudioContext;
  extension: string;
  sounds?: Partial<Record<string, string>>;
}

/**
 * The name used for the incoming sound in the cache.
 * Matches Device.SoundName.Incoming.
 */
const INCOMING_SOUND_NAME = 'incoming';

/**
 * Manages the sound cache and sink ID updates for a Device.
 * @private
 */
class SoundManager {
  private _soundcache: Map<string, ISound> = new Map();

  /**
   * The default sound definitions.
   */
  private static _defaultSounds: Record<string, ISoundDefinition> = {
    disconnect: { filename: 'disconnect', maxDuration: 3000 },
    dtmf0: { filename: 'dtmf-0', maxDuration: 1000 },
    dtmf1: { filename: 'dtmf-1', maxDuration: 1000 },
    dtmf2: { filename: 'dtmf-2', maxDuration: 1000 },
    dtmf3: { filename: 'dtmf-3', maxDuration: 1000 },
    dtmf4: { filename: 'dtmf-4', maxDuration: 1000 },
    dtmf5: { filename: 'dtmf-5', maxDuration: 1000 },
    dtmf6: { filename: 'dtmf-6', maxDuration: 1000 },
    dtmf7: { filename: 'dtmf-7', maxDuration: 1000 },
    dtmf8: { filename: 'dtmf-8', maxDuration: 1000 },
    dtmf9: { filename: 'dtmf-9', maxDuration: 1000 },
    dtmfh: { filename: 'dtmf-hash', maxDuration: 1000 },
    dtmfs: { filename: 'dtmf-star', maxDuration: 1000 },
    incoming: { filename: 'incoming', shouldLoop: true },
    outgoing: { filename: 'outgoing', maxDuration: 3000 },
  };

  get soundcache(): Map<string, ISound> {
    return this._soundcache;
  }

  /**
   * Initialize or re-initialize all sounds using the given options.
   */
  setupSounds(options: SoundManagerOptions): void {
    for (const name of Object.keys(SoundManager._defaultSounds)) {
      const soundDef: ISoundDefinition = SoundManager._defaultSounds[name];

      const defaultUrl: string = `${C.SOUNDS_BASE_URL}/${soundDef.filename}.${options.extension}`
        + `?cache=${C.RELEASE_VERSION}`;

      const soundUrl: string = options.sounds && options.sounds[name] || defaultUrl;
      const sound: any = new (options.Sound || Sound)(name, soundUrl, {
        audioContext: options.audioContext,
        maxDuration: soundDef.maxDuration,
        shouldLoop: soundDef.shouldLoop,
      });

      this._soundcache.set(name, sound);
    }
  }

  /**
   * Stop the incoming sound if there are no remaining calls.
   */
  maybeStopIncomingSound(callsLength: number): void {
    if (!callsLength) {
      this._soundcache.get(INCOMING_SOUND_NAME)!.stop();
    }
  }

  /**
   * Update the device IDs of output devices being used to play the incoming ringtone.
   */
  updateRingtoneSinkIds(sinkIds: string[]): Promise<void> {
    return Promise.resolve(this._soundcache.get(INCOMING_SOUND_NAME)!.setSinkIds(sinkIds));
  }

  /**
   * Update the device IDs of output devices for non-ringtone sounds and active call audio.
   */
  updateSpeakerSinkIds(
    sinkIds: string[],
    callSinkIdsSetter: (ids: string[]) => void,
    activeCall: { _setSinkIds: (ids: string[]) => Promise<void> } | null,
  ): Promise<void> {
    Array.from(this._soundcache.entries())
      .filter(entry => entry[0] !== INCOMING_SOUND_NAME)
      .forEach(entry => entry[1].setSinkIds(sinkIds));

    callSinkIdsSetter(sinkIds);
    return activeCall
      ? activeCall._setSinkIds(sinkIds)
      : Promise.resolve();
  }
}

export default SoundManager;
