import Deferred from './deferred';

/**
 * Queue async operations and executes them synchronously.
 */
export class AsyncQueue {
  /**
   * The list of async operations in this queue
   */
  private _operations: AsyncQueue.Operation[] = [];

  /**
   * Adds the async operation to the queue
   * @param callback An async callback that returns a promise
   * @returns A promise that will get resolved or rejected after executing the callback
   */
  enqueue(callback: () => Promise<any>): Promise<any> {
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
  private async _processQueue() {
    while (this._operations.length) {
      // Grab first item, don't remove from array yet until it's resolved/rejected
      const { deferred, callback } = this._operations[0];

      // We want to capture the result/error first so we can remove the item from the queue later
      let result;
      let error;
      // Sometimes result and error are empty. So let's use a separate flag to determine if the promise has resolved
      let hasResolved;
      try {
        result = await callback();
        hasResolved = true;
      } catch (e) {
        error = e;
      }

      // Remove the item
      this._operations.shift();

      if (hasResolved) {
        deferred.resolve(result);
      } else {
        deferred.reject(error);
      }
    }
  }
}

export namespace AsyncQueue {
  /**
   * Represent an [[AsyncQueue]] operation
   */
  export interface Operation {
    /**
     * An async callback that returns a promise. This will get called once it reaches the queue.
     */
    callback: () => Promise<any>;

    /**
     * A deferred promise that gets resolved or rejected after executing the async callback
     */
    deferred: Deferred;
  }
}
