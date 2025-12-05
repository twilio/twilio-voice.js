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
   * @property {number} jitter - Apply jitter [0]
   * @property {number} factor - Multiplication factor for Backoff operation [2]
   */
  constructor(options) {
    super();
    this._min = options.min || 100;
    this._isRetryAfterSet = false;
    Object.defineProperties(this, {
      _attempts: {
        value: 0,
        writable: true,
      },
      _duration: {
        enumerable: false,
        get() {
          if (this._isRetryAfterSet) {
            this._isRetryAfterSet = false;
            return this._min;
          }

          let ms = this._min * Math.pow(this._factor, this._attempts);
          if (this._jitter) {
            const rand =  Math.random();
            const deviation = Math.floor(rand * this._jitter * ms);
            // tslint:disable-next-line
            ms = (Math.floor(rand * 10) & 1) === 0  ? ms - deviation : ms + deviation;
          }
          // tslint:disable-next-line
          return Math.min(ms, this._max) | 0;
        },
      },
      _factor: { value: options.factor || 2 },
      _jitter: { value: options.jitter > 0 && options.jitter <= 1 ? options.jitter : 0 },
      _max: { value: options.max || 10000 },
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

  setRetryAfter(retryAfter: number) {
    // retryAfter is in seconds, convert to ms
    this._min = retryAfter * 1000;
    this._isRetryAfterSet = true;
  }
}

export default Backoff;
