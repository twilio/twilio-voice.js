/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
export default class Deferred<T> {
    readonly promise: Promise<T>;
    private _reject;
    get reject(): (e?: any) => void;
    private _resolve;
    get resolve(): (t?: T | undefined) => void;
    constructor();
}