import { EventEmitter } from 'events';
import Log from './log.js';

/**
 * AudioProcessorEventObserver observes {@link AudioProcessor}
 * related operations and re-emits them as generic events.
 * @internal
 */
class AudioProcessorEventObserver extends EventEmitter {
    constructor() {
        super();
        this._log = new Log('AudioProcessorEventObserver');
        this._log.info('Creating AudioProcessorEventObserver instance');
        this.on('enabled', (isRemote) => this._reEmitEvent('enabled', isRemote));
        this.on('add', (isRemote) => this._reEmitEvent('add', isRemote));
        this.on('remove', (isRemote) => this._reEmitEvent('remove', isRemote));
        this.on('create', (isRemote) => this._reEmitEvent('create-processed-stream', isRemote));
        this.on('destroy', (isRemote) => this._reEmitEvent('destroy-processed-stream', isRemote));
    }
    destroy() {
        this.removeAllListeners();
    }
    _reEmitEvent(name, isRemote) {
        this._log.info(`${isRemote ? 'Remote' : 'Local'} AudioProcessor:${name}`);
        this.emit('event', { name, group: 'audio-processor', isRemote });
    }
}

export { AudioProcessorEventObserver };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9wcm9jZXNzb3JldmVudG9ic2VydmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2F1ZGlvcHJvY2Vzc29yZXZlbnRvYnNlcnZlci50cyJdLCJzb3VyY2VzQ29udGVudCI6W251bGxdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFHQTs7OztBQUlHO0FBQ0csTUFBTywyQkFBNEIsU0FBUSxZQUFZLENBQUE7QUFJM0QsSUFBQSxXQUFBLEdBQUE7QUFDRSxRQUFBLEtBQUssRUFBRTtBQUhELFFBQUEsSUFBQSxDQUFBLElBQUksR0FBUSxJQUFJLEdBQUcsQ0FBQyw2QkFBNkIsQ0FBQztBQUl4RCxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLCtDQUErQyxDQUFDO0FBRS9ELFFBQUEsSUFBSSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsQ0FBQyxRQUFRLEtBQUssSUFBSSxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDeEUsUUFBQSxJQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxDQUFDLFFBQVEsS0FBSyxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNoRSxRQUFBLElBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLENBQUMsUUFBUSxLQUFLLElBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQ3RFLFFBQUEsSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsQ0FBQyxRQUFRLEtBQUssSUFBSSxDQUFDLFlBQVksQ0FBQyx5QkFBeUIsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUN2RixRQUFBLElBQUksQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLENBQUMsUUFBUSxLQUFLLElBQUksQ0FBQyxZQUFZLENBQUMsMEJBQTBCLEVBQUUsUUFBUSxDQUFDLENBQUM7SUFDM0Y7SUFFQSxPQUFPLEdBQUE7UUFDTCxJQUFJLENBQUMsa0JBQWtCLEVBQUU7SUFDM0I7SUFFUSxZQUFZLENBQUMsSUFBWSxFQUFFLFFBQWlCLEVBQUE7QUFDbEQsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBLEVBQUcsUUFBUSxHQUFHLFFBQVEsR0FBRyxPQUFPLG1CQUFtQixJQUFJLENBQUEsQ0FBRSxDQUFDO0FBQ3pFLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsRUFBRSxJQUFJLEVBQUUsS0FBSyxFQUFFLGlCQUFpQixFQUFFLFFBQVEsRUFBRSxDQUFDO0lBQ2xFO0FBQ0Q7Ozs7In0=
