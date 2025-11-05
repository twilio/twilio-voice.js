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

    this.on('local-enabled', () => this._reEmitLocalEvent('enabled'));
    this.on('local-add', () => this._reEmitLocalEvent('add'));
    this.on('local-remove', () => this._reEmitLocalEvent('remove'));
    this.on('local-create', () => this._reEmitLocalEvent('create-processed-stream'));
    this.on('local-destroy', () => this._reEmitLocalEvent('destroy-processed-stream'));

    this.on('remote-add', () => this._reEmitRemoteEvent('add'));
    this.on('remote-remove', () => this._reEmitRemoteEvent('remove'));
    this.on('remote-create', () => this._reEmitRemoteEvent('create-processed-stream'));
    this.on('remote-destroy', () => this._reEmitRemoteEvent('destroy-processed-stream'));
  }

  destroy(): void {
    this.removeAllListeners();
  }

  private _reEmitLocalEvent(name: string): void {
    this._log.info(`Local AudioProcessor:${name}`);
    this.emit('event', { name, group: 'audio-processor', isRemote: false });
  }

  private _reEmitRemoteEvent(name: string): void {
    this._log.info(`Remote AudioProcessor:${name}`);
    this.emit('event', { name, group: 'audio-processor', isRemote: true });
  }
}
