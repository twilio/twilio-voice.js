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

    this.on('enabled', (isRemote) => this._reEmitEvent('enabled', isRemote));
    this.on('add', (isRemote) => this._reEmitEvent('add', isRemote));
    this.on('remove', (isRemote) => this._reEmitEvent('remove', isRemote));
    this.on('create', (isRemote) => this._reEmitEvent('create-processed-stream', isRemote));
    this.on('destroy', (isRemote) => this._reEmitEvent('destroy-processed-stream', isRemote));
  }

  destroy(): void {
    this.removeAllListeners();
  }

  private _reEmitEvent(name: string, isRemote: boolean): void {
    this._log.info(`${isRemote ? 'Remote' : 'Local'} AudioProcessor:${name}`);
    this.emit('event', { name, group: 'audio-processor', isRemote });
  }
}
