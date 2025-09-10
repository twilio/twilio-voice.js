'use strict';

var tslib = require('tslib');
var events = require('events');
var log = require('./log.js');

/**
 * AudioProcessorEventObserver observes {@link AudioProcessor}
 * related operations and re-emits them as generic events.
 * @internal
 */
var AudioProcessorEventObserver = /** @class */ (function (_super) {
    tslib.__extends(AudioProcessorEventObserver, _super);
    function AudioProcessorEventObserver() {
        var _this = _super.call(this) || this;
        _this._log = new log.default('AudioProcessorEventObserver');
        _this._log.info('Creating AudioProcessorEventObserver instance');
        _this.on('enabled', function () { return _this._reEmitEvent('enabled'); });
        _this.on('add', function () { return _this._reEmitEvent('add'); });
        _this.on('remove', function () { return _this._reEmitEvent('remove'); });
        _this.on('create', function () { return _this._reEmitEvent('create-processed-stream'); });
        _this.on('destroy', function () { return _this._reEmitEvent('destroy-processed-stream'); });
        return _this;
    }
    AudioProcessorEventObserver.prototype.destroy = function () {
        this.removeAllListeners();
    };
    AudioProcessorEventObserver.prototype._reEmitEvent = function (name) {
        this._log.info("AudioProcessor:".concat(name));
        this.emit('event', { name: name, group: 'audio-processor' });
    };
    return AudioProcessorEventObserver;
}(events.EventEmitter));

exports.AudioProcessorEventObserver = AudioProcessorEventObserver;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9wcm9jZXNzb3JldmVudG9ic2VydmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2F1ZGlvcHJvY2Vzc29yZXZlbnRvYnNlcnZlci50cyJdLCJzb3VyY2VzQ29udGVudCI6W251bGxdLCJuYW1lcyI6WyJfX2V4dGVuZHMiLCJMb2ciLCJFdmVudEVtaXR0ZXIiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUdBOzs7O0FBSUc7QUFDSCxJQUFBLDJCQUFBLGtCQUFBLFVBQUEsTUFBQSxFQUFBO0lBQWlEQSxlQUFBLENBQUEsMkJBQUEsRUFBQSxNQUFBLENBQUE7QUFJL0MsSUFBQSxTQUFBLDJCQUFBLEdBQUE7UUFDRSxJQUFBLEtBQUEsR0FBQSxNQUFLLFdBQUUsSUFBQSxJQUFBO0FBSEQsUUFBQSxLQUFBLENBQUEsSUFBSSxHQUFRLElBQUlDLFdBQUcsQ0FBQyw2QkFBNkIsQ0FBQztBQUl4RCxRQUFBLEtBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLCtDQUErQyxDQUFDO0FBQy9ELFFBQUEsS0FBSSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsY0FBTSxPQUFBLEtBQUksQ0FBQyxZQUFZLENBQUMsU0FBUyxDQUFDLENBQUEsQ0FBNUIsQ0FBNEIsQ0FBQztBQUN0RCxRQUFBLEtBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLGNBQU0sT0FBQSxLQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxDQUFBLENBQXhCLENBQXdCLENBQUM7QUFDOUMsUUFBQSxLQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxjQUFNLE9BQUEsS0FBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsQ0FBQSxDQUEzQixDQUEyQixDQUFDO0FBQ3BELFFBQUEsS0FBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsY0FBTSxPQUFBLEtBQUksQ0FBQyxZQUFZLENBQUMseUJBQXlCLENBQUMsQ0FBQSxDQUE1QyxDQUE0QyxDQUFDO0FBQ3JFLFFBQUEsS0FBSSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsY0FBTSxPQUFBLEtBQUksQ0FBQyxZQUFZLENBQUMsMEJBQTBCLENBQUMsQ0FBQSxDQUE3QyxDQUE2QyxDQUFDOztJQUN6RTtBQUVBLElBQUEsMkJBQUEsQ0FBQSxTQUFBLENBQUEsT0FBTyxHQUFQLFlBQUE7UUFDRSxJQUFJLENBQUMsa0JBQWtCLEVBQUU7SUFDM0IsQ0FBQztJQUVPLDJCQUFBLENBQUEsU0FBQSxDQUFBLFlBQVksR0FBcEIsVUFBcUIsSUFBWSxFQUFBO1FBQy9CLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLGlCQUFBLENBQUEsTUFBQSxDQUFrQixJQUFJLENBQUUsQ0FBQztBQUN4QyxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFBLElBQUEsRUFBRSxLQUFLLEVBQUUsaUJBQWlCLEVBQUUsQ0FBQztJQUN4RCxDQUFDO0lBQ0gsT0FBQSwyQkFBQztBQUFELENBdEJBLENBQWlEQyxtQkFBWSxDQUFBOzs7OyJ9
