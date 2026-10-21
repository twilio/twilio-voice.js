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
     * @property {number} jitter - Apply jitter [0]
     * @property {number} factor - Multiplication factor for Backoff operation [2]
     * @property {boolean} useInitialValue - Whether to use the initial value on the first backoff call [false]
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
                    if (this._useInitialValue && this._attempts === 0) {
                        return this._min;
                    }
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
            _useInitialValue: {
                value: options.useInitialValue || false,
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja29mZi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9iYWNrb2ZmLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIl9fZXh0ZW5kcyIsIkV2ZW50RW1pdHRlciJdLCJtYXBwaW5ncyI6Ijs7Ozs7OztBQUtBLElBQUEsT0FBQSxrQkFBQSxVQUFBLE1BQUEsRUFBQTtJQUFzQkEsZUFBQSxDQUFBLE9BQUEsRUFBQSxNQUFBLENBQUE7QUFDcEI7Ozs7Ozs7O0FBUUc7QUFDSCxJQUFBLFNBQUEsT0FBQSxDQUFZLE9BQU8sRUFBQTtRQUNqQixJQUFBLEtBQUEsR0FBQSxNQUFLLFdBQUUsSUFBQSxJQUFBO0FBQ1AsUUFBQSxNQUFNLENBQUMsZ0JBQWdCLENBQUMsS0FBSSxFQUFFO0FBQzVCLFlBQUEsU0FBUyxFQUFFO0FBQ1QsZ0JBQUEsS0FBSyxFQUFFLENBQUM7QUFDUixnQkFBQSxRQUFRLEVBQUUsSUFBSTtBQUNmLGFBQUE7QUFDRCxZQUFBLFNBQVMsRUFBRTtBQUNULGdCQUFBLFVBQVUsRUFBRSxLQUFLO2dCQUNqQixHQUFHLEVBQUEsWUFBQTtvQkFDRCxJQUFJLElBQUksQ0FBQyxnQkFBZ0IsSUFBSSxJQUFJLENBQUMsU0FBUyxLQUFLLENBQUMsRUFBRTt3QkFDakQsT0FBTyxJQUFJLENBQUMsSUFBSTtvQkFDbEI7QUFFQSxvQkFBQSxJQUFJLEVBQUUsR0FBRyxJQUFJLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsU0FBUyxDQUFDO0FBQzNELG9CQUFBLElBQUksSUFBSSxDQUFDLE9BQU8sRUFBRTtBQUNoQix3QkFBQSxJQUFNLElBQUksR0FBSSxJQUFJLENBQUMsTUFBTSxFQUFFO0FBQzNCLHdCQUFBLElBQU0sU0FBUyxHQUFHLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLElBQUksQ0FBQyxPQUFPLEdBQUcsRUFBRSxDQUFDOzt3QkFFdEQsRUFBRSxHQUFHLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsRUFBRSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBSSxFQUFFLEdBQUcsU0FBUyxHQUFHLEVBQUUsR0FBRyxTQUFTO29CQUMzRTs7QUFFQSxvQkFBQSxPQUFPLElBQUksQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLElBQUksQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDO2dCQUNwQyxDQUFDO0FBQ0YsYUFBQTtZQUNELE9BQU8sRUFBRSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsTUFBTSxJQUFJLENBQUMsRUFBRTtZQUN2QyxPQUFPLEVBQUUsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLElBQUksT0FBTyxDQUFDLE1BQU0sSUFBSSxDQUFDLEdBQUcsT0FBTyxDQUFDLE1BQU0sR0FBRyxDQUFDLEVBQUU7WUFDbEYsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxHQUFHLElBQUksS0FBSyxFQUFFO1lBQ3JDLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtBQUNuQyxZQUFBLFVBQVUsRUFBRTtBQUNWLGdCQUFBLEtBQUssRUFBRSxJQUFJO0FBQ1gsZ0JBQUEsUUFBUSxFQUFFLElBQUk7QUFDZixhQUFBO0FBQ0QsWUFBQSxnQkFBZ0IsRUFBRTtBQUNoQixnQkFBQSxLQUFLLEVBQUUsT0FBTyxDQUFDLGVBQWUsSUFBSSxLQUFLO0FBQ3hDLGFBQUE7QUFDRixTQUFBLENBQUM7O0lBQ0o7QUFFQSxJQUFBLE9BQUEsQ0FBQSxTQUFBLENBQUEsT0FBTyxHQUFQLFlBQUE7UUFBQSxJQUFBLEtBQUEsR0FBQSxJQUFBO0FBQ0UsUUFBQSxJQUFNLFFBQVEsR0FBRyxJQUFJLENBQUMsU0FBUztBQUMvQixRQUFBLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRTtBQUNuQixZQUFBLFlBQVksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO0FBQzdCLFlBQUEsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJO1FBQ3hCO1FBRUEsSUFBSSxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUM7QUFDOUMsUUFBQSxJQUFJLENBQUMsVUFBVSxHQUFHLFVBQVUsQ0FBQyxZQUFBO1lBQzNCLEtBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEtBQUksQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDO1lBQzVDLEtBQUksQ0FBQyxTQUFTLEVBQUU7UUFDbEIsQ0FBQyxFQUFFLFFBQVEsQ0FBQztJQUNkLENBQUM7QUFFRCxJQUFBLE9BQUEsQ0FBQSxTQUFBLENBQUEsS0FBSyxHQUFMLFlBQUE7QUFDRSxRQUFBLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQztBQUNsQixRQUFBLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRTtBQUNuQixZQUFBLFlBQVksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO0FBQzdCLFlBQUEsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJO1FBQ3hCO0lBQ0YsQ0FBQztJQUNILE9BQUEsT0FBQztBQUFELENBdEVBLENBQXNCQyxtQkFBWSxDQUFBOzs7OyJ9
