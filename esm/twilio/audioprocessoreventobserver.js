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
        this.on('enabled', () => this._reEmitEvent('enabled'));
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

export { AudioProcessorEventObserver };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9wcm9jZXNzb3JldmVudG9ic2VydmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2F1ZGlvcHJvY2Vzc29yZXZlbnRvYnNlcnZlci50cyJdLCJzb3VyY2VzQ29udGVudCI6W251bGxdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFHQTs7OztBQUlHO0FBQ0csTUFBTywyQkFBNEIsU0FBUSxZQUFZLENBQUE7QUFJM0QsSUFBQSxXQUFBLEdBQUE7QUFDRSxRQUFBLEtBQUssRUFBRTtBQUhELFFBQUEsSUFBQSxDQUFBLElBQUksR0FBUSxJQUFJLEdBQUcsQ0FBQyw2QkFBNkIsQ0FBQztBQUl4RCxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLCtDQUErQyxDQUFDO0FBQy9ELFFBQUEsSUFBSSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBQ3RELFFBQUEsSUFBSSxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFDO0FBQzlDLFFBQUEsSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsQ0FBQyxDQUFDO0FBQ3BELFFBQUEsSUFBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsTUFBTSxJQUFJLENBQUMsWUFBWSxDQUFDLHlCQUF5QixDQUFDLENBQUM7QUFDckUsUUFBQSxJQUFJLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxNQUFNLElBQUksQ0FBQyxZQUFZLENBQUMsMEJBQTBCLENBQUMsQ0FBQztJQUN6RTtJQUVBLE9BQU8sR0FBQTtRQUNMLElBQUksQ0FBQyxrQkFBa0IsRUFBRTtJQUMzQjtBQUVRLElBQUEsWUFBWSxDQUFDLElBQVksRUFBQTtRQUMvQixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxDQUFBLGVBQUEsRUFBa0IsSUFBSSxDQUFBLENBQUUsQ0FBQztBQUN4QyxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFFLEtBQUssRUFBRSxpQkFBaUIsRUFBRSxDQUFDO0lBQ3hEO0FBQ0Q7Ozs7In0=
