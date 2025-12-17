import { EventEmitter } from 'events';
declare class Backoff extends EventEmitter {
    /**
     * Construct a {@link Backoff}.
     * @param {object} options
     * @property {number} min - Initial timeout in milliseconds [100]
     * @property {number} max - Max timeout [10000]
     * @property {number} jitter - Apply jitter [0]
     * @property {number} factor - Multiplication factor for Backoff operation [2]
     * @property {boolean} useInitialValue - Whether to use the initial value on the first backoff call [false]
     */
    constructor(options: any);
    backoff(): void;
    reset(): void;
}
export default Backoff;
