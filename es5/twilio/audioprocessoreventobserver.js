"use strict";
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
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
 * @private
 */
var AudioProcessorEventObserver = /** @class */ (function (_super) {
    __extends(AudioProcessorEventObserver, _super);
    function AudioProcessorEventObserver() {
        var _this = _super.call(this) || this;
        _this._log = new log_1.default('AudioProcessorEventObserver');
        _this._log.info('Creating AudioProcessorEventObserver instance');
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
        this._log.info("AudioProcessor:" + name);
        this.emit('event', { name: name, group: 'audio-processor' });
    };
    return AudioProcessorEventObserver;
}(events_1.EventEmitter));
exports.AudioProcessorEventObserver = AudioProcessorEventObserver;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXVkaW9wcm9jZXNzb3JldmVudG9ic2VydmVyLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9hdWRpb3Byb2Nlc3NvcmV2ZW50b2JzZXJ2ZXIudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7Ozs7Ozs7Ozs7Ozs7Ozs7QUFFSCxpQ0FBc0M7QUFDdEMsNkJBQXdCO0FBRXhCOzs7O0dBSUc7QUFDSDtJQUFpRCwrQ0FBWTtJQUkzRDtRQUFBLFlBQ0UsaUJBQU8sU0FNUjtRQVRPLFVBQUksR0FBUSxJQUFJLGFBQUcsQ0FBQyw2QkFBNkIsQ0FBQyxDQUFDO1FBSXpELEtBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLCtDQUErQyxDQUFDLENBQUM7UUFDaEUsS0FBSSxDQUFDLEVBQUUsQ0FBQyxLQUFLLEVBQUUsY0FBTSxPQUFBLEtBQUksQ0FBQyxZQUFZLENBQUMsS0FBSyxDQUFDLEVBQXhCLENBQXdCLENBQUMsQ0FBQztRQUMvQyxLQUFJLENBQUMsRUFBRSxDQUFDLFFBQVEsRUFBRSxjQUFNLE9BQUEsS0FBSSxDQUFDLFlBQVksQ0FBQyxRQUFRLENBQUMsRUFBM0IsQ0FBMkIsQ0FBQyxDQUFDO1FBQ3JELEtBQUksQ0FBQyxFQUFFLENBQUMsUUFBUSxFQUFFLGNBQU0sT0FBQSxLQUFJLENBQUMsWUFBWSxDQUFDLHlCQUF5QixDQUFDLEVBQTVDLENBQTRDLENBQUMsQ0FBQztRQUN0RSxLQUFJLENBQUMsRUFBRSxDQUFDLFNBQVMsRUFBRSxjQUFNLE9BQUEsS0FBSSxDQUFDLFlBQVksQ0FBQywwQkFBMEIsQ0FBQyxFQUE3QyxDQUE2QyxDQUFDLENBQUM7O0lBQzFFLENBQUM7SUFFRCw2Q0FBTyxHQUFQO1FBQ0UsSUFBSSxDQUFDLGtCQUFrQixFQUFFLENBQUM7SUFDNUIsQ0FBQztJQUVPLGtEQUFZLEdBQXBCLFVBQXFCLElBQVk7UUFDL0IsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsb0JBQWtCLElBQU0sQ0FBQyxDQUFDO1FBQ3pDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEVBQUUsSUFBSSxNQUFBLEVBQUUsS0FBSyxFQUFFLGlCQUFpQixFQUFFLENBQUMsQ0FBQztJQUN6RCxDQUFDO0lBQ0gsa0NBQUM7QUFBRCxDQUFDLEFBckJELENBQWlELHFCQUFZLEdBcUI1RDtBQXJCWSxrRUFBMkIifQ==