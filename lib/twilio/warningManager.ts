import { IPublisher } from './call';
import Log from './log';
import RTCWarning from './rtc/warning';

const MULTIPLE_THRESHOLD_WARNING_NAMES: Record<string, Record<string, string>> = {
  packetsLostFraction: {
    max: 'packet-loss',
    maxAverage: 'packets-lost-fraction',
  },
};

const WARNING_NAMES: Record<string, string> = {
  audioInputLevel: 'audio-input-level',
  audioOutputLevel: 'audio-output-level',
  bytesReceived: 'bytes-received',
  bytesSent: 'bytes-sent',
  jitter: 'jitter',
  mos: 'mos',
  rtt: 'rtt',
};

const WARNING_PREFIXES: Record<string, string> = {
  max: 'high-',
  maxAverage: 'high-',
  maxDuration: 'constant-',
  min: 'low-',
  minStandardDeviation: 'constant-',
};

export interface WarningManagerOptions {
  publisher: IPublisher;
  isMuted: () => boolean;
  onWarning: (warningName: string, warningData: RTCWarning | null) => void;
  onWarningCleared: (warningName: string) => void;
}

/**
 * Manages call quality warnings and volume streak detection.
 * @private
 */
class WarningManager {
  private _log: Log = new Log('WarningManager');
  private _publisher: IPublisher;
  private _isMuted: () => boolean;
  private _onWarning: (warningName: string, warningData: RTCWarning | null) => void;
  private _onWarningCleared: (warningName: string) => void;

  constructor(options: WarningManagerOptions) {
    this._publisher = options.publisher;
    this._isMuted = options.isMuted;
    this._onWarning = options.onWarning;
    this._onWarningCleared = options.onWarningCleared;
  }

  /**
   * Check volume, emitting a warning if one-way audio is detected or cleared.
   * @returns The new streak count.
   */
  checkVolume(currentVolume: number, currentStreak: number,
              lastValue: number, direction: 'input' | 'output'): number {
    const wasWarningRaised: boolean = currentStreak >= 10;
    let newStreak: number = 0;

    if (lastValue === currentVolume) {
      newStreak = currentStreak;
    }

    if (newStreak >= 10) {
      this._emitWarning('audio-level-', `constant-audio-${direction}-level`, 10, newStreak, false);
    } else if (wasWarningRaised) {
      this._emitWarning('audio-level-', `constant-audio-${direction}-level`, 10, newStreak, true);
    }

    return newStreak;
  }

  /**
   * Re-emit a StatsMonitor warning as a warning or warning-cleared event.
   */
  reemitWarning = (warningData: Record<string, any>, wasCleared?: boolean): void => {
    const groupPrefix = /^audio/.test(warningData.name) ?
      'audio-level-' : 'network-quality-';

    const warningPrefix = WARNING_PREFIXES[warningData.threshold.name];

    let warningName: string | undefined;
    if (warningData.name in MULTIPLE_THRESHOLD_WARNING_NAMES) {
      warningName = MULTIPLE_THRESHOLD_WARNING_NAMES[warningData.name][warningData.threshold.name];
    } else if (warningData.name in WARNING_NAMES) {
      warningName = WARNING_NAMES[warningData.name];
    }

    const warning: string = warningPrefix + warningName;

    this._emitWarning(groupPrefix, warning, warningData.threshold.value,
                      warningData.values || warningData.value, wasCleared, warningData);
  }

  /**
   * Re-emit a StatsMonitor warning-cleared event.
   */
  reemitWarningCleared = (warningData: Record<string, any>): void => {
    this.reemitWarning(warningData, true);
  }

  /**
   * Core warning emission logic.
   */
  private _emitWarning(groupPrefix: string, warningName: string, threshold: number,
                       value: number | number[], wasCleared?: boolean, warningData?: RTCWarning): void {
    const groupSuffix = wasCleared ? '-cleared' : '-raised';
    const groupName = `${groupPrefix}warning${groupSuffix}`;

    if (warningName === 'constant-audio-input-level' && this._isMuted()) {
      return;
    }

    let level = wasCleared ? 'info' : 'warning';

    if (warningName === 'constant-audio-output-level') {
      level = 'info';
    }

    const payloadData: Record<string, any> = { threshold };

    if (value) {
      if (value instanceof Array) {
        payloadData.values = value.map((val: any) => {
          if (typeof val === 'number') {
            return Math.round(val * 100) / 100;
          }
          return value;
        });
      } else {
        payloadData.value = value;
      }
    }

    this._publisher.post(level, groupName, warningName, { data: payloadData }, this);

    if (warningName !== 'constant-audio-output-level') {
      if (wasCleared) {
        this._onWarningCleared(warningName);
      } else {
        this._onWarning(warningName, warningData || null);
      }
    }
  }
}

export default WarningManager;
