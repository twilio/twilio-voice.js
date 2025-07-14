"use strict";
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.AudioProcessorEventObserver = void 0;
var events_1 = require("events");
var log_1 = require("./log");
/**
 * AudioProcessorEventObserver observes {@link AudioProcessor}
 * related operations and re-emits them as generic events.
 * @internal
 */
var AudioProcessorEventObserver = /** @class */ (function (_super) {
    __extends(AudioProcessorEventObserver, _super);
    function AudioProcessorEventObserver() {
        var _this = _super.call(this) || this;
        _this._log = new log_1.default('AudioProcessorEventObserver');
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
}(events_1.EventEmitter));
exports.AudioProcessorEventObserver = AudioProcessorEventObserver;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9wcm9jZXNzb3JldmVudG9ic2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9hdWRpb3Byb2Nlc3NvcmV2ZW50b2JzZXJ2ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7Ozs7Ozs7O0FBQUEsaUNBQXNDO0FBQ3RDLDZCQUF3QjtBQUV4Qjs7OztHQUlHO0FBQ0g7SUFBaUQsK0NBQVk7SUFJM0Q7UUFDRSxZQUFBLE1BQUssV0FBRSxTQUFDO1FBSEYsVUFBSSxHQUFRLElBQUksYUFBRyxDQUFDLDZCQUE2QixDQUFDLENBQUM7UUFJekQsS0FBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsK0NBQStDLENBQUMsQ0FBQztRQUNoRSxLQUFJLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxjQUFNLE9BQUEsS0FBSSxDQUFDLFlBQVksQ0FBQyxTQUFTLENBQUMsRUFBNUIsQ0FBNEIsQ0FBQyxDQUFDO1FBQ3ZELEtBQUksQ0FBQyxFQUFFLENBQUMsS0FBSyxFQUFFLGNBQU0sT0FBQSxLQUFJLENBQUMsWUFBWSxDQUFDLEtBQUssQ0FBQyxFQUF4QixDQUF3QixDQUFDLENBQUM7UUFDL0MsS0FBSSxDQUFDLEVBQUUsQ0FBQyxRQUFRLEVBQUUsY0FBTSxPQUFBLEtBQUksQ0FBQyxZQUFZLENBQUMsUUFBUSxDQUFDLEVBQTNCLENBQTJCLENBQUMsQ0FBQztRQUNyRCxLQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxjQUFNLE9BQUEsS0FBSSxDQUFDLFlBQVksQ0FBQyx5QkFBeUIsQ0FBQyxFQUE1QyxDQUE0QyxDQUFDLENBQUM7UUFDdEUsS0FBSSxDQUFDLEVBQUUsQ0FBQyxTQUFTLEVBQUUsY0FBTSxPQUFBLEtBQUksQ0FBQyxZQUFZLENBQUMsMEJBQTBCLENBQUMsRUFBN0MsQ0FBNkMsQ0FBQyxDQUFDOztJQUMxRSxDQUFDO0lBRUQsNkNBQU8sR0FBUDtRQUNFLElBQUksQ0FBQyxrQkFBa0IsRUFBRSxDQUFDO0lBQzVCLENBQUM7SUFFTyxrREFBWSxHQUFwQixVQUFxQixJQUFZO1FBQy9CLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLHlCQUFrQixJQUFJLENBQUUsQ0FBQyxDQUFDO1FBQ3pDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxNQUFBLEVBQUUsS0FBSyxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztJQUN6RCxDQUFDO0lBQ0gsa0NBQUM7QUFBRCxDQUFDLEFBdEJELENBQWlELHFCQUFZLEdBc0I1RDtBQXRCWSxrRUFBMkIifQ==