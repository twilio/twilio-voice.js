/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
import { EventEmitter } from 'events';
import Log from './log';
/**
 * AudioProcessorEventObserver observes {@link AudioProcessor}
 * related operations and re-emits them as generic events.
 * @private
 */
export class AudioProcessorEventObserver extends EventEmitter {
    constructor() {
        super();
        this._log = new Log('AudioProcessorEventObserver');
        this._log.info('Creating AudioProcessorEventObserver instance');
        this.on('add', () => this._reEmitEvent('add'));
        this.on('remove', () => this._reEmitEvent('remove'));
        this.on('create', () => this._reEmitEvent('create-processed-stream'));
        this.on('destroy', () => this._reEmitEvent('destroy-processed-stream'));
    }
    destroy() {
        this.removeAllListeners();
    }
    _reEmitEvent(name) {
        this._log.info(`AudioProcessor:${name}`);
        this.emit('event', { name, group: 'audio-processor' });
    }
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9wcm9jZXNzb3JldmVudG9ic2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9hdWRpb3Byb2Nlc3NvcmV2ZW50b2JzZXJ2ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7R0FJRztBQUVILE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxRQUFRLENBQUM7QUFDdEMsT0FBTyxHQUFHLE1BQU0sT0FBTyxDQUFDO0FBRXhCOzs7O0dBSUc7QUFDSCxNQUFNLE9BQU8sMkJBQTRCLFNBQVEsWUFBWTtJQUkzRDtRQUNFLEtBQUssRUFBRSxDQUFDO1FBSEYsU0FBSSxHQUFRLElBQUksR0FBRyxDQUFDLDZCQUE2QixDQUFDLENBQUM7UUFJekQsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsK0NBQStDLENBQUMsQ0FBQztRQUNoRSxJQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxHQUFHLEVBQUUsQ0FBQyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUM7UUFDL0MsSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsR0FBRyxFQUFFLENBQUMsSUFBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQyxDQUFDO1FBQ3JELElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMseUJBQXlCLENBQUMsQ0FBQyxDQUFDO1FBQ3RFLElBQUksQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLEdBQUcsRUFBRSxDQUFDLElBQUksQ0FBQyxZQUFZLENBQUMsMEJBQTBCLENBQUMsQ0FBQyxDQUFDO0lBQzFFLENBQUM7SUFFRCxPQUFPO1FBQ0wsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7SUFDNUIsQ0FBQztJQUVPLFlBQVksQ0FBQyxJQUFZO1FBQy9CLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGtCQUFrQixJQUFJLEVBQUUsQ0FBQyxDQUFDO1FBQ3pDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxpQkFBaUIsRUFBRSxDQUFDLENBQUM7SUFDekQsQ0FBQztDQUNGIn0=