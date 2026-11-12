import { EventEmitter } from 'events';
/**
 * Mark an 'error' payload as raised by the transport.
 * @param payload - The payload to mark.
 * @returns The same payload.
 */
export declare function markTransportErrorPayload(payload: any): any;
/**
 * Whether an 'error' payload was raised by the transport.
 * @param payload - The payload to check.
 */
export declare function isTransportErrorPayload(payload: any): boolean;
/**
 * Constructor for PStream objects.
 *
 * @exports PStream as Twilio.PStream
 * @memberOf Twilio
 * @borrows EventEmitter#addListener as #addListener
 * @borrows EventEmitter#removeListener as #removeListener
 * @borrows EventEmitter#emit as #emit
 * @borrows EventEmitter#hasListener as #hasListener
 * @constructor
 * @param {string} token The Twilio capabilities JWT
 * @param {string[]} uris An array of PStream endpoint URIs
 * @param {object} [options]
 * @config {boolean} [options.backoffMaxMs=20000] Enable debugging
 */
declare class PStream extends EventEmitter {
    constructor(token: any, uris: any, options: any);
}
export default PStream;
