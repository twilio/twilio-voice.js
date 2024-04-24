/**
 * @packageDocumentation
 * @internalapi
 */
// @ts-nocheck
// NOTE (csantos): This file was taken directly from twilio-video and has been renamed from JS to TS only.
// It needs to be re-written as part of the overall updating of the files to TS.
import { EventEmitter } from 'events';
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
export default Backoff;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYmFja29mZi5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vYmFja29mZi50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7O0dBR0c7QUFDSCxjQUFjO0FBQ2QsMEdBQTBHO0FBQzFHLGdGQUFnRjtBQUNoRixPQUFPLEVBQUUsWUFBWSxFQUFFLE1BQU0sUUFBUSxDQUFDO0FBRXRDLE1BQU0sT0FBUSxTQUFRLFlBQVk7SUFDaEM7Ozs7Ozs7T0FPRztJQUNILFlBQVksT0FBTztRQUNqQixLQUFLLEVBQUUsQ0FBQztRQUNSLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUU7WUFDNUIsU0FBUyxFQUFFO2dCQUNULEtBQUssRUFBRSxDQUFDO2dCQUNSLFFBQVEsRUFBRSxJQUFJO2FBQ2Y7WUFDRCxTQUFTLEVBQUU7Z0JBQ1QsVUFBVSxFQUFFLEtBQUs7Z0JBQ2pCLEdBQUc7b0JBQ0QsSUFBSSxFQUFFLEdBQUcsSUFBSSxDQUFDLElBQUksR0FBRyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO29CQUM1RCxJQUFJLElBQUksQ0FBQyxPQUFPLEVBQUU7d0JBQ2hCLE1BQU0sSUFBSSxHQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsQ0FBQzt3QkFDNUIsTUFBTSxTQUFTLEdBQUcsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLEdBQUcsSUFBSSxDQUFDLE9BQU8sR0FBRyxFQUFFLENBQUMsQ0FBQzt3QkFDdkQsMkJBQTJCO3dCQUMzQixFQUFFLEdBQUcsQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksR0FBRyxFQUFFLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUUsQ0FBQyxDQUFDLEVBQUUsR0FBRyxTQUFTLENBQUMsQ0FBQyxDQUFDLEVBQUUsR0FBRyxTQUFTLENBQUM7cUJBQzNFO29CQUNELDJCQUEyQjtvQkFDM0IsT0FBTyxJQUFJLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxDQUFDO2dCQUNyQyxDQUFDO2FBQ0Y7WUFDRCxPQUFPLEVBQUUsRUFBRSxLQUFLLEVBQUUsT0FBTyxDQUFDLE1BQU0sSUFBSSxDQUFDLEVBQUU7WUFDdkMsT0FBTyxFQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxNQUFNLEdBQUcsQ0FBQyxJQUFJLE9BQU8sQ0FBQyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDbEYsSUFBSSxFQUFFLEVBQUUsS0FBSyxFQUFFLE9BQU8sQ0FBQyxHQUFHLElBQUksS0FBSyxFQUFFO1lBQ3JDLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxPQUFPLENBQUMsR0FBRyxJQUFJLEdBQUcsRUFBRTtZQUNuQyxVQUFVLEVBQUU7Z0JBQ1YsS0FBSyxFQUFFLElBQUk7Z0JBQ1gsUUFBUSxFQUFFLElBQUk7YUFDZjtTQUNGLENBQUMsQ0FBQztJQUNMLENBQUM7SUFFRCxPQUFPO1FBQ0wsTUFBTSxRQUFRLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQztRQUNoQyxJQUFJLElBQUksQ0FBQyxVQUFVLEVBQUU7WUFDbkIsWUFBWSxDQUFDLElBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQztZQUM5QixJQUFJLENBQUMsVUFBVSxHQUFHLElBQUksQ0FBQztTQUN4QjtRQUVELElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7UUFDL0MsSUFBSSxDQUFDLFVBQVUsR0FBRyxVQUFVLENBQUMsR0FBRyxFQUFFO1lBQ2hDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLElBQUksQ0FBQyxTQUFTLEVBQUUsUUFBUSxDQUFDLENBQUM7WUFDN0MsSUFBSSxDQUFDLFNBQVMsRUFBRSxDQUFDO1FBQ25CLENBQUMsRUFBRSxRQUFRLENBQUMsQ0FBQztJQUNmLENBQUM7SUFFRCxLQUFLO1FBQ0gsSUFBSSxDQUFDLFNBQVMsR0FBRyxDQUFDLENBQUM7UUFDbkIsSUFBSSxJQUFJLENBQUMsVUFBVSxFQUFFO1lBQ25CLFlBQVksQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUM7WUFDOUIsSUFBSSxDQUFDLFVBQVUsR0FBRyxJQUFJLENBQUM7U0FDeEI7SUFDSCxDQUFDO0NBQ0Y7QUFFRCxlQUFlLE9BQU8sQ0FBQyJ9