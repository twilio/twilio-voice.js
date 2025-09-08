'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var events = require('events');

var Backoff = /** @class */ (function (_super) {
    tslib.__extends(Backoff, _super);
    /**
     * Construct a {@link Backoff}.
     * @param {object} options
     * @property {number} min - Initial timeout in milliseconds [100]
     * @property {number} max - Max timeout [10000]
     * @property {boolean} jitter - Apply jitter [0]
     * @property {number} factor - Multiplication factor for Backoff operation [2]
     */
    function Backoff(options) {
        var _this = _super.call(this) || this;
        Object.defineProperties(_this, {
            _attempts: {
                value: 0,
                writable: true,
            },
            _duration: {
                enumerable: false,
                get: function () {
                    var ms = this._min * Math.pow(this._factor, this._attempts);
                    if (this._jitter) {
                        var rand = Math.random();
                        var deviation = Math.floor(rand * this._jitter * ms);
                        // tslint:disable-next-line
                        ms = (Math.floor(rand * 10) & 1) === 0 ? ms - deviation : ms + deviation;
                    }
                    // tslint:disable-next-line
                    return Math.min(ms, this._max) | 0;
                },
            },
            _factor: { value: options.factor || 2 },
            _jitter: { value: options.jitter > 0 && options.jitter <= 1 ? options.jitter : 0 },
            _max: { value: options.max || 10000 },
            _min: { value: options.min || 100 },
            _timeoutID: {
                value: null,
                writable: true,
            },
        });
        return _this;
    }
    Backoff.prototype.backoff = function () {
        var _this = this;
        var duration = this._duration;
        if (this._timeoutID) {
            clearTimeout(this._timeoutID);
            this._timeoutID = null;
        }
        this.emit('backoff', this._attempts, duration);
        this._timeoutID = setTimeout(function () {
            _this.emit('ready', _this._attempts, duration);
            _this._attempts++;
        }, duration);
    };
    Backoff.prototype.reset = function () {
        this._attempts = 0;
        if (this._timeoutID) {
            clearTimeout(this._timeoutID);
            this._timeoutID = null;
        }
    };
    return Backoff;
}(events.EventEmitter));

exports.default = Backoff;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja29mZi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9iYWNrb2ZmLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIl9fZXh0ZW5kcyIsIkV2ZW50RW1pdHRlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUtBLElBQUEsT0FBQSxrQkFBQSxVQUFBLE1BQUEsRUFBQTtJQUFzQkEsZUFBQSxDQUFBLE9BQUEsRUFBQSxNQUFBLENBQUE7QUFDcEI7Ozs7Ozs7QUFPRztBQUNILElBQUEsU0FBQSxPQUFBLENBQVksT0FBTyxFQUFBO1FBQ2pCLElBQUEsS0FBQSxHQUFBLE1BQUssV0FBRSxJQUFBLElBQUE7QUFDUCxRQUFBLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxLQUFJLEVBQUU7QUFDNUIsWUFBQSxTQUFTLEVBQUU7QUFDVCxnQkFBQSxLQUFLLEVBQUUsQ0FBQztBQUNSLGdCQUFBLFFBQVEsRUFBRSxJQUFJO0FBQ2YsYUFBQTtBQUNELFlBQUEsU0FBUyxFQUFFO0FBQ1QsZ0JBQUEsVUFBVSxFQUFFLEtBQUs7Z0JBQ2pCLEdBQUcsRUFBQSxZQUFBO0FBQ0Qsb0JBQUEsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQztBQUMzRCxvQkFBQSxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7QUFDaEIsd0JBQUEsSUFBTSxJQUFJLEdBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtBQUMzQix3QkFBQSxJQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQzs7d0JBRXRELEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUksRUFBRSxHQUFHLFNBQVMsR0FBRyxFQUFFLEdBQUcsU0FBUztvQkFDM0U7O0FBRUEsb0JBQUEsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztnQkFDcEMsQ0FBQztBQUNGLGFBQUE7WUFDRCxPQUFPLEVBQUUsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7WUFDdkMsT0FBTyxFQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQ2xGLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsR0FBRyxJQUFJLEtBQUssRUFBRTtZQUNyQyxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFDbkMsWUFBQSxVQUFVLEVBQUU7QUFDVixnQkFBQSxLQUFLLEVBQUUsSUFBSTtBQUNYLGdCQUFBLFFBQVEsRUFBRSxJQUFJO0FBQ2YsYUFBQTtBQUNGLFNBQUEsQ0FBQzs7SUFDSjtBQUVBLElBQUEsT0FBQSxDQUFBLFNBQUEsQ0FBQSxPQUFPLEdBQVAsWUFBQTtRQUFBLElBQUEsS0FBQSxHQUFBLElBQUE7QUFDRSxRQUFBLElBQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTO0FBQy9CLFFBQUEsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO0FBQ25CLFlBQUEsWUFBWSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7QUFDN0IsWUFBQSxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUk7UUFDeEI7UUFFQSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQztBQUM5QyxRQUFBLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDLFlBQUE7WUFDM0IsS0FBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsS0FBSSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUM7WUFDNUMsS0FBSSxDQUFDLFNBQVMsRUFBRTtRQUNsQixDQUFDLEVBQUUsUUFBUSxDQUFDO0lBQ2QsQ0FBQztBQUVELElBQUEsT0FBQSxDQUFBLFNBQUEsQ0FBQSxLQUFLLEdBQUwsWUFBQTtBQUNFLFFBQUEsSUFBSSxDQUFDLFNBQVMsR0FBRyxDQUFDO0FBQ2xCLFFBQUEsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO0FBQ25CLFlBQUEsWUFBWSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7QUFDN0IsWUFBQSxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUk7UUFDeEI7SUFDRixDQUFDO0lBQ0gsT0FBQSxPQUFDO0FBQUQsQ0E5REEsQ0FBc0JDLG1CQUFZLENBQUE7Ozs7In0=
