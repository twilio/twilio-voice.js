var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiYXN5bmNRdWV1ZS5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vYXN5bmNRdWV1ZS50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQSxPQUFPLFFBQVEsTUFBTSxZQUFZLENBQUM7QUFFbEM7O0dBRUc7QUFDSCxNQUFNLE9BQU8sVUFBVTtJQUF2QjtRQUNFOztXQUVHO1FBQ0ssZ0JBQVcsR0FBMkIsRUFBRSxDQUFDO0lBbURuRCxDQUFDO0lBakRDOzs7O09BSUc7SUFDSCxPQUFPLENBQUMsUUFBNEI7UUFDbEMsTUFBTSxVQUFVLEdBQUcsQ0FBQyxDQUFDLElBQUksQ0FBQyxXQUFXLENBQUMsTUFBTSxDQUFDO1FBQzdDLE1BQU0sUUFBUSxHQUFHLElBQUksUUFBUSxFQUFFLENBQUM7UUFFaEMsSUFBSSxDQUFDLFdBQVcsQ0FBQyxJQUFJLENBQUMsRUFBRSxRQUFRLEVBQUUsUUFBUSxFQUFFLENBQUMsQ0FBQztRQUU5QyxJQUFJLENBQUMsVUFBVSxFQUFFLENBQUM7WUFDaEIsSUFBSSxDQUFDLGFBQWEsRUFBRSxDQUFDO1FBQ3ZCLENBQUM7UUFFRCxPQUFPLFFBQVEsQ0FBQyxPQUFPLENBQUM7SUFDMUIsQ0FBQztJQUVEOzs7T0FHRztJQUNXLGFBQWE7O1lBQ3pCLE9BQU8sSUFBSSxDQUFDLFdBQVcsQ0FBQyxNQUFNLEVBQUUsQ0FBQztnQkFDL0IsNEVBQTRFO2dCQUM1RSxNQUFNLEVBQUUsUUFBUSxFQUFFLFFBQVEsRUFBRSxHQUFHLElBQUksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7Z0JBRW5ELDJGQUEyRjtnQkFDM0YsSUFBSSxNQUFNLENBQUM7Z0JBQ1gsSUFBSSxLQUFLLENBQUM7Z0JBQ1YsOEdBQThHO2dCQUM5RyxJQUFJLFdBQVcsQ0FBQztnQkFDaEIsSUFBSSxDQUFDO29CQUNILE1BQU0sR0FBRyxNQUFNLFFBQVEsRUFBRSxDQUFDO29CQUMxQixXQUFXLEdBQUcsSUFBSSxDQUFDO2dCQUNyQixDQUFDO2dCQUFDLE9BQU8sQ0FBQyxFQUFFLENBQUM7b0JBQ1gsS0FBSyxHQUFHLENBQUMsQ0FBQztnQkFDWixDQUFDO2dCQUVELGtCQUFrQjtnQkFDbEIsSUFBSSxDQUFDLFdBQVcsQ0FBQyxLQUFLLEVBQUUsQ0FBQztnQkFFekIsSUFBSSxXQUFXLEVBQUUsQ0FBQztvQkFDaEIsUUFBUSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDM0IsQ0FBQztxQkFBTSxDQUFDO29CQUNOLFFBQVEsQ0FBQyxNQUFNLENBQUMsS0FBSyxDQUFDLENBQUM7Z0JBQ3pCLENBQUM7WUFDSCxDQUFDO1FBQ0gsQ0FBQztLQUFBO0NBQ0YifQ==