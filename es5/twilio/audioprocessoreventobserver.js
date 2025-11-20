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
        _this.on('enabled', function (isRemote) { return _this._reEmitEvent('enabled', isRemote); });
        _this.on('add', function (isRemote) { return _this._reEmitEvent('add', isRemote); });
        _this.on('remove', function (isRemote) { return _this._reEmitEvent('remove', isRemote); });
        _this.on('create', function (isRemote) { return _this._reEmitEvent('create-processed-stream', isRemote); });
        _this.on('destroy', function (isRemote) { return _this._reEmitEvent('destroy-processed-stream', isRemote); });
        return _this;
    }
    AudioProcessorEventObserver.prototype.destroy = function () {
        this.removeAllListeners();
    };
    AudioProcessorEventObserver.prototype._reEmitEvent = function (name, isRemote) {
        this._log.info("".concat(isRemote ? 'Remote' : 'Local', " AudioProcessor:").concat(name));
        this.emit('event', { name: name, group: 'audio-processor', isRemote: isRemote });
    };
    return AudioProcessorEventObserver;
}(events.EventEmitter));

exports.AudioProcessorEventObserver = AudioProcessorEventObserver;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9wcm9jZXNzb3JldmVudG9ic2VydmVyLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2F1ZGlvcHJvY2Vzc29yZXZlbnRvYnNlcnZlci50cyJdLCJzb3VyY2VzQ29udGVudCI6W251bGxdLCJuYW1lcyI6WyJfX2V4dGVuZHMiLCJMb2ciLCJFdmVudEVtaXR0ZXIiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUdBOzs7O0FBSUc7QUFDSCxJQUFBLDJCQUFBLGtCQUFBLFVBQUEsTUFBQSxFQUFBO0lBQWlEQSxlQUFBLENBQUEsMkJBQUEsRUFBQSxNQUFBLENBQUE7QUFJL0MsSUFBQSxTQUFBLDJCQUFBLEdBQUE7UUFDRSxJQUFBLEtBQUEsR0FBQSxNQUFLLFdBQUUsSUFBQSxJQUFBO0FBSEQsUUFBQSxLQUFBLENBQUEsSUFBSSxHQUFRLElBQUlDLFdBQUcsQ0FBQyw2QkFBNkIsQ0FBQztBQUl4RCxRQUFBLEtBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLCtDQUErQyxDQUFDO1FBRS9ELEtBQUksQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLFVBQUMsUUFBUSxJQUFLLE9BQUEsS0FBSSxDQUFDLFlBQVksQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUEsQ0FBdEMsQ0FBc0MsQ0FBQztRQUN4RSxLQUFJLENBQUMsRUFBRSxDQUFDLEtBQUssRUFBRSxVQUFDLFFBQVEsSUFBSyxPQUFBLEtBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxFQUFFLFFBQVEsQ0FBQyxDQUFBLENBQWxDLENBQWtDLENBQUM7UUFDaEUsS0FBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsVUFBQyxRQUFRLElBQUssT0FBQSxLQUFJLENBQUMsWUFBWSxDQUFDLFFBQVEsRUFBRSxRQUFRLENBQUMsQ0FBQSxDQUFyQyxDQUFxQyxDQUFDO1FBQ3RFLEtBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLFVBQUMsUUFBUSxJQUFLLE9BQUEsS0FBSSxDQUFDLFlBQVksQ0FBQyx5QkFBeUIsRUFBRSxRQUFRLENBQUMsQ0FBQSxDQUF0RCxDQUFzRCxDQUFDO1FBQ3ZGLEtBQUksQ0FBQyxFQUFFLENBQUMsU0FBUyxFQUFFLFVBQUMsUUFBUSxJQUFLLE9BQUEsS0FBSSxDQUFDLFlBQVksQ0FBQywwQkFBMEIsRUFBRSxRQUFRLENBQUMsQ0FBQSxDQUF2RCxDQUF1RCxDQUFDOztJQUMzRjtBQUVBLElBQUEsMkJBQUEsQ0FBQSxTQUFBLENBQUEsT0FBTyxHQUFQLFlBQUE7UUFDRSxJQUFJLENBQUMsa0JBQWtCLEVBQUU7SUFDM0IsQ0FBQztBQUVPLElBQUEsMkJBQUEsQ0FBQSxTQUFBLENBQUEsWUFBWSxHQUFwQixVQUFxQixJQUFZLEVBQUUsUUFBaUIsRUFBQTtBQUNsRCxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEVBQUEsQ0FBQSxNQUFBLENBQUcsUUFBUSxHQUFHLFFBQVEsR0FBRyxPQUFPLDZCQUFtQixJQUFJLENBQUUsQ0FBQztBQUN6RSxRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxFQUFBLElBQUEsRUFBRSxLQUFLLEVBQUUsaUJBQWlCLEVBQUUsUUFBUSxFQUFBLFFBQUEsRUFBRSxDQUFDO0lBQ2xFLENBQUM7SUFDSCxPQUFBLDJCQUFDO0FBQUQsQ0F2QkEsQ0FBaURDLG1CQUFZLENBQUE7Ozs7In0=
