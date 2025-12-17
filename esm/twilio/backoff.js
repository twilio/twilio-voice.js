import { EventEmitter } from 'events';

// @ts-nocheck
// NOTE (csantos): This file was taken directly from twilio-video and has been renamed from JS to TS only.
// It needs to be re-written as part of the overall updating of the files to TS.
class Backoff extends EventEmitter {
    /**
     * Construct a {@link Backoff}.
     * @param {object} options
     * @property {number} min - Initial timeout in milliseconds [100]
     * @property {number} max - Max timeout [10000]
     * @property {number} jitter - Apply jitter [0]
     * @property {number} factor - Multiplication factor for Backoff operation [2]
     * @property {boolean} useInitialValue - Whether to use the initial value on the first backoff call [false]
     */
    constructor(options) {
        super();
        Object.defineProperties(this, {
            _attempts: {
                value: 0,
                writable: true,
            },
            _duration: {
                enumerable: false,
                get() {
                    if (this._useInitialValue && this._attempts === 0) {
                        return this._min;
                    }
                    let ms = this._min * Math.pow(this._factor, this._attempts);
                    if (this._jitter) {
                        const rand = Math.random();
                        const deviation = Math.floor(rand * this._jitter * ms);
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
    }
    backoff() {
        const duration = this._duration;
        if (this._timeoutID) {
            clearTimeout(this._timeoutID);
            this._timeoutID = null;
        }
        this.emit('backoff', this._attempts, duration);
        this._timeoutID = setTimeout(() => {
            this.emit('ready', this._attempts, duration);
            this._attempts++;
        }, duration);
    }
    reset() {
        this._attempts = 0;
        if (this._timeoutID) {
            clearTimeout(this._timeoutID);
            this._timeoutID = null;
        }
    }
}

export { Backoff as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja29mZi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9iYWNrb2ZmLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBR0EsTUFBTSxPQUFRLFNBQVEsWUFBWSxDQUFBO0FBQ2hDOzs7Ozs7OztBQVFHO0FBQ0gsSUFBQSxXQUFBLENBQVksT0FBTyxFQUFBO0FBQ2pCLFFBQUEsS0FBSyxFQUFFO0FBQ1AsUUFBQSxNQUFNLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFO0FBQzVCLFlBQUEsU0FBUyxFQUFFO0FBQ1QsZ0JBQUEsS0FBSyxFQUFFLENBQUM7QUFDUixnQkFBQSxRQUFRLEVBQUUsSUFBSTtBQUNmLGFBQUE7QUFDRCxZQUFBLFNBQVMsRUFBRTtBQUNULGdCQUFBLFVBQVUsRUFBRSxLQUFLO2dCQUNqQixHQUFHLEdBQUE7b0JBQ0QsSUFBSSxJQUFJLENBQUMsZ0JBQWdCLElBQUksSUFBSSxDQUFDLFNBQVMsS0FBSyxDQUFDLEVBQUU7d0JBQ2pELE9BQU8sSUFBSSxDQUFDLElBQUk7b0JBQ2xCO0FBRUEsb0JBQUEsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQztBQUMzRCxvQkFBQSxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7QUFDaEIsd0JBQUEsTUFBTSxJQUFJLEdBQUksSUFBSSxDQUFDLE1BQU0sRUFBRTtBQUMzQix3QkFBQSxNQUFNLFNBQVMsR0FBRyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsT0FBTyxHQUFHLEVBQUUsQ0FBQzs7d0JBRXRELEVBQUUsR0FBRyxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxHQUFHLEVBQUUsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUksRUFBRSxHQUFHLFNBQVMsR0FBRyxFQUFFLEdBQUcsU0FBUztvQkFDM0U7O0FBRUEsb0JBQUEsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQztnQkFDcEMsQ0FBQztBQUNGLGFBQUE7WUFDRCxPQUFPLEVBQUUsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7WUFDdkMsT0FBTyxFQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyxHQUFHLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFO1lBQ2xGLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsR0FBRyxJQUFJLEtBQUssRUFBRTtZQUNyQyxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLEdBQUcsSUFBSSxHQUFHLEVBQUU7QUFDbkMsWUFBQSxVQUFVLEVBQUU7QUFDVixnQkFBQSxLQUFLLEVBQUUsSUFBSTtBQUNYLGdCQUFBLFFBQVEsRUFBRSxJQUFJO0FBQ2YsYUFBQTtBQUNELFlBQUEsZ0JBQWdCLEVBQUU7QUFDaEIsZ0JBQUEsS0FBSyxFQUFFLE9BQU8sQ0FBQyxlQUFlLElBQUksS0FBSztBQUN4QyxhQUFBO0FBQ0YsU0FBQSxDQUFDO0lBQ0o7SUFFQSxPQUFPLEdBQUE7QUFDTCxRQUFBLE1BQU0sUUFBUSxHQUFHLElBQUksQ0FBQyxTQUFTO0FBQy9CLFFBQUEsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO0FBQ25CLFlBQUEsWUFBWSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7QUFDN0IsWUFBQSxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUk7UUFDeEI7UUFFQSxJQUFJLENBQUMsSUFBSSxDQUFDLFNBQVMsRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQztBQUM5QyxRQUFBLElBQUksQ0FBQyxVQUFVLEdBQUcsVUFBVSxDQUFDLE1BQUs7WUFDaEMsSUFBSSxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFNBQVMsRUFBRSxRQUFRLENBQUM7WUFDNUMsSUFBSSxDQUFDLFNBQVMsRUFBRTtRQUNsQixDQUFDLEVBQUUsUUFBUSxDQUFDO0lBQ2Q7SUFFQSxLQUFLLEdBQUE7QUFDSCxRQUFBLElBQUksQ0FBQyxTQUFTLEdBQUcsQ0FBQztBQUNsQixRQUFBLElBQUksSUFBSSxDQUFDLFVBQVUsRUFBRTtBQUNuQixZQUFBLFlBQVksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO0FBQzdCLFlBQUEsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJO1FBQ3hCO0lBQ0Y7QUFDRDs7OzsifQ==
