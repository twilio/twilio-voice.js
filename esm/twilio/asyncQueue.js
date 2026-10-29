import { __awaiter } from 'tslib';
import Deferred from './deferred.js';

/**
 * Queue async operations and executes them synchronously.
 */
class AsyncQueue {
    constructor() {
        /**
         * The list of async operations in this queue
         */
        this._operations = [];
    }
    /**
     * Adds the async operation to the queue
     * @param callback An async callback that returns a promise
     * @returns A promise that will get resolved or rejected after executing the callback
     */
    enqueue(callback) {
        const hasPending = !!this._operations.length;
        const deferred = new Deferred();
        this._operations.push({ deferred, callback });
        if (!hasPending) {
            this._processQueue();
        }
        return deferred.promise;
    }
    /**
     * Start processing the queue. This executes the first item and removes it after.
     * Then do the same for next items until the queue is emptied.
     */
    _processQueue() {
        return __awaiter(this, void 0, void 0, function* () {
            while (this._operations.length) {
                // Grab first item, don't remove from array yet until it's resolved/rejected
                const { deferred, callback } = this._operations[0];
                // We want to capture the result/error first so we can remove the item from the queue later
                let result;
                let error;
                // Sometimes result and error are empty. So let's use a separate flag to determine if the promise has resolved
                let hasResolved;
                try {
                    result = yield callback();
                    hasResolved = true;
                }
                catch (e) {
                    error = e;
                }
                // Remove the item
                this._operations.shift();
                if (hasResolved) {
                    deferred.resolve(result);
                }
                else {
                    deferred.reject(error);
                }
            }
        });
    }
}

export { AsyncQueue };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXN5bmNRdWV1ZS5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9hc3luY1F1ZXVlLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUVBOztBQUVHO01BQ1UsVUFBVSxDQUFBO0FBQXZCLElBQUEsV0FBQSxHQUFBO0FBQ0U7O0FBRUc7UUFDSyxJQUFBLENBQUEsV0FBVyxHQUEyQixFQUFFO0lBbURsRDtBQWpERTs7OztBQUlHO0FBQ0gsSUFBQSxPQUFPLENBQUMsUUFBNEIsRUFBQTtRQUNsQyxNQUFNLFVBQVUsR0FBRyxDQUFDLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNO0FBQzVDLFFBQUEsTUFBTSxRQUFRLEdBQUcsSUFBSSxRQUFRLEVBQUU7UUFFL0IsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLENBQUM7UUFFN0MsSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNmLElBQUksQ0FBQyxhQUFhLEVBQUU7UUFDdEI7UUFFQSxPQUFPLFFBQVEsQ0FBQyxPQUFPO0lBQ3pCO0FBRUE7OztBQUdHO0lBQ1csYUFBYSxHQUFBOztBQUN6QixZQUFBLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUU7O0FBRTlCLGdCQUFBLE1BQU0sRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLEdBQUcsSUFBSSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7O0FBR2xELGdCQUFBLElBQUksTUFBTTtBQUNWLGdCQUFBLElBQUksS0FBSzs7QUFFVCxnQkFBQSxJQUFJLFdBQVc7QUFDZixnQkFBQSxJQUFJO0FBQ0Ysb0JBQUEsTUFBTSxHQUFHLE1BQU0sUUFBUSxFQUFFO29CQUN6QixXQUFXLEdBQUcsSUFBSTtnQkFDcEI7Z0JBQUUsT0FBTyxDQUFDLEVBQUU7b0JBQ1YsS0FBSyxHQUFHLENBQUM7Z0JBQ1g7O0FBR0EsZ0JBQUEsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUU7Z0JBRXhCLElBQUksV0FBVyxFQUFFO0FBQ2Ysb0JBQUEsUUFBUSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUM7Z0JBQzFCO3FCQUFPO0FBQ0wsb0JBQUEsUUFBUSxDQUFDLE1BQU0sQ0FBQyxLQUFLLENBQUM7Z0JBQ3hCO1lBQ0Y7UUFDRixDQUFDLENBQUE7QUFBQSxJQUFBO0FBQ0Y7Ozs7In0=
