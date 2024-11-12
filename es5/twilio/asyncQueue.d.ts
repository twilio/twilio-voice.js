/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
import Deferred from './deferred';
/**
 * Queue async operations and executes them synchronously.
 */
export declare class AsyncQueue {
    /**
     * The list of async operations in this queue
     */
    private _operations;
    /**
     * Adds the async operation to the queue
     * @param callback An async callback that returns a promise
     * @returns A promise that will get resolved or rejected after executing the callback
     */
    enqueue(callback: () => Promise<any>): Promise<any>;
    /**
     * Start processing the queue. This executes the first item and removes it after.
     * Then do the same for next items until the queue is emptied.
     */
    private _processQueue;
}
export declare namespace AsyncQueue {
    /**
     * Represent an [[AsyncQueue]] operation
     */
    interface Operation {
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
