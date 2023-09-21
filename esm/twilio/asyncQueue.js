var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
import Deferred from './deferred';
/**
 * Queue async operations and executes them synchronously.
 */
export class AsyncQueue {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXN5bmNRdWV1ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vYXN5bmNRdWV1ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQTs7OztHQUlHO0FBQ0gsT0FBTyxRQUFRLE1BQU0sWUFBWSxDQUFDO0FBRWxDOztHQUVHO0FBQ0gsTUFBTSxPQUFPLFVBQVU7SUFBdkI7UUFDRTs7V0FFRztRQUNLLGdCQUFXLEdBQTJCLEVBQUUsQ0FBQztJQW1EbkQsQ0FBQztJQWpEQzs7OztPQUlHO0lBQ0gsT0FBTyxDQUFDLFFBQTRCO1FBQ2xDLE1BQU0sVUFBVSxHQUFHLENBQUMsQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sQ0FBQztRQUM3QyxNQUFNLFFBQVEsR0FBRyxJQUFJLFFBQVEsRUFBRSxDQUFDO1FBRWhDLElBQUksQ0FBQyxXQUFXLENBQUMsSUFBSSxDQUFDLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxDQUFDLENBQUM7UUFFOUMsSUFBSSxDQUFDLFVBQVUsRUFBRTtZQUNmLElBQUksQ0FBQyxhQUFhLEVBQUUsQ0FBQztTQUN0QjtRQUVELE9BQU8sUUFBUSxDQUFDLE9BQU8sQ0FBQztJQUMxQixDQUFDO0lBRUQ7OztPQUdHO0lBQ1csYUFBYTs7WUFDekIsT0FBTyxJQUFJLENBQUMsV0FBVyxDQUFDLE1BQU0sRUFBRTtnQkFDOUIsNEVBQTRFO2dCQUM1RSxNQUFNLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRW5ELDJGQUEyRjtnQkFDM0YsSUFBSSxNQUFNLENBQUM7Z0JBQ1gsSUFBSSxLQUFLLENBQUM7Z0JBQ1YsOEdBQThHO2dCQUM5RyxJQUFJLFdBQVcsQ0FBQztnQkFDaEIsSUFBSTtvQkFDRixNQUFNLEdBQUcsTUFBTSxRQUFRLEVBQUUsQ0FBQztvQkFDMUIsV0FBVyxHQUFHLElBQUksQ0FBQztpQkFDcEI7Z0JBQUMsT0FBTyxDQUFDLEVBQUU7b0JBQ1YsS0FBSyxHQUFHLENBQUMsQ0FBQztpQkFDWDtnQkFFRCxrQkFBa0I7Z0JBQ2xCLElBQUksQ0FBQyxXQUFXLENBQUMsS0FBSyxFQUFFLENBQUM7Z0JBRXpCLElBQUksV0FBVyxFQUFFO29CQUNmLFFBQVEsQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLENBQUM7aUJBQzFCO3FCQUFNO29CQUNMLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7aUJBQ3hCO2FBQ0Y7UUFDSCxDQUFDO0tBQUE7Q0FDRiJ9