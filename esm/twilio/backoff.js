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
     * @property {boolean} jitter - Apply jitter [0]
     * @property {number} factor - Multiplication factor for Backoff operation [2]
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja29mZi5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9iYWNrb2ZmLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFDQTtBQUNBO0FBR0EsTUFBTSxPQUFRLFNBQVEsWUFBWSxDQUFBO0FBQ2hDOzs7Ozs7O0FBT0c7QUFDSCxJQUFBLFdBQUEsQ0FBWSxPQUFPLEVBQUE7QUFDakIsUUFBQSxLQUFLLEVBQUU7QUFDUCxRQUFBLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUU7QUFDNUIsWUFBQSxTQUFTLEVBQUU7QUFDVCxnQkFBQSxLQUFLLEVBQUUsQ0FBQztBQUNSLGdCQUFBLFFBQVEsRUFBRSxJQUFJO0FBQ2YsYUFBQTtBQUNELFlBQUEsU0FBUyxFQUFFO0FBQ1QsZ0JBQUEsVUFBVSxFQUFFLEtBQUs7Z0JBQ2pCLEdBQUcsR0FBQTtBQUNELG9CQUFBLElBQUksRUFBRSxHQUFHLElBQUksQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLENBQUM7QUFDM0Qsb0JBQUEsSUFBSSxJQUFJLENBQUMsT0FBTyxFQUFFO0FBQ2hCLHdCQUFBLE1BQU0sSUFBSSxHQUFJLElBQUksQ0FBQyxNQUFNLEVBQUU7QUFDM0Isd0JBQUEsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUM7O3dCQUV0RCxFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFJLEVBQUUsR0FBRyxTQUFTLEdBQUcsRUFBRSxHQUFHLFNBQVM7b0JBQzNFOztBQUVBLG9CQUFBLE9BQU8sSUFBSSxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUM7Z0JBQ3BDLENBQUM7QUFDRixhQUFBO1lBQ0QsT0FBTyxFQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyxFQUFFO1lBQ3ZDLE9BQU8sRUFBRSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsSUFBSSxPQUFPLENBQUMsTUFBTSxJQUFJLENBQUMsR0FBRyxPQUFPLENBQUMsTUFBTSxHQUFHLENBQUMsRUFBRTtZQUNsRixJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLEdBQUcsSUFBSSxLQUFLLEVBQUU7WUFDckMsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxHQUFHLElBQUksR0FBRyxFQUFFO0FBQ25DLFlBQUEsVUFBVSxFQUFFO0FBQ1YsZ0JBQUEsS0FBSyxFQUFFLElBQUk7QUFDWCxnQkFBQSxRQUFRLEVBQUUsSUFBSTtBQUNmLGFBQUE7QUFDRixTQUFBLENBQUM7SUFDSjtJQUVBLE9BQU8sR0FBQTtBQUNMLFFBQUEsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVM7QUFDL0IsUUFBQSxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUU7QUFDbkIsWUFBQSxZQUFZLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQztBQUM3QixZQUFBLElBQUksQ0FBQyxVQUFVLEdBQUcsSUFBSTtRQUN4QjtRQUVBLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDO0FBQzlDLFFBQUEsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUMsTUFBSztZQUNoQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxJQUFJLENBQUMsU0FBUyxFQUFFLFFBQVEsQ0FBQztZQUM1QyxJQUFJLENBQUMsU0FBUyxFQUFFO1FBQ2xCLENBQUMsRUFBRSxRQUFRLENBQUM7SUFDZDtJQUVBLEtBQUssR0FBQTtBQUNILFFBQUEsSUFBSSxDQUFDLFNBQVMsR0FBRyxDQUFDO0FBQ2xCLFFBQUEsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO0FBQ25CLFlBQUEsWUFBWSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUM7QUFDN0IsWUFBQSxJQUFJLENBQUMsVUFBVSxHQUFHLElBQUk7UUFDeEI7SUFDRjtBQUNEOzs7OyJ9
