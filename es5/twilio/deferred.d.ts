/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
/**
 * Deferred Promise
 */
export default class Deferred {
    /**
     * This {@link Deferred} Promise
     */
    private readonly _promise;
    /**
     * The Promise's reject method.
     */
    private _reject;
    /**
     * The Promise's resolve method.
     */
    private _resolve;
    /**
     * @constructor
     */
    constructor();
    /**
     * @returns The {@link Deferred} Promise
     */
    get promise(): Promise<any>;
    /**
     * Rejects this promise
     */
    reject(reason?: any): void;
    /**
     * Resolves this promise
     */
    resolve(value?: any): void;
}
