import { EventEmitter } from 'events';
import Log from './log';

/**
 * AudioProcessorEventObserver observes {@link AudioProcessor}
 * related operations and re-emits them as generic events.
 * @internal
 */
export class AudioProcessorEventObserver extends EventEmitter {

  private _log: Log = new Log('AudioProcessorEventObserver');

  constructor() {
    super();
    this._log.info('Creating AudioProcessorEventObserver instance');
    this.on('enabled', () => this._reEmitEvent('enabled'));
    this.on('add', () => this._reEmitEvent('add'));
    this.on('remove', () => this._reEmitEvent('remove'));
    this.on('create', () => this._reEmitEvent('create-processed-stream'));
    this.on('destroy', () => this._reEmitEvent('destroy-processed-stream'));
  }

  destroy(): void {
    this.removeAllListeners();
  }

  private _reEmitEvent(name: string): void {
    this._log.info(`AudioProcessor:${name}`);
    this.emit('event', { name, group: 'audio-processor' });
  }
}
