export var Exception: typeof TwilioException;
export function average(values: any): number;
export function difference(lefts: any, rights: any, getKey: any): any;
export function isElectron(navigator: any): boolean;
export function isChrome(window: any, navigator: any): boolean;
export function isFirefox(navigator: any): boolean;
export function isLegacyEdge(navigator: any): boolean;
export function isSafari(navigator: any): boolean;
export function isUnifiedPlanDefault(window: any, navigator: any, PeerConnection: any, RtpTransceiver: any): boolean;
export function queryToJson(params: any): any;
/**
 * Map a list to an array of arrays, and return the flattened result.
 * @param {Array<*>|Set<*>|Map<*>} list
 * @param {function(*): Array<*>} [mapFn]
 * @returns Array<*>
 */
export function flatMap(list: any[] | Map<any, any> | Set<any>, mapFn?: ((arg0: any) => any[]) | undefined): any;
/**
 * Exception class.
 * @class
 * @name Exception
 * @exports Exception as Twilio.Exception
 * @memberOf Twilio
 * @param {string} message The exception message
 */
declare function TwilioException(message: string): TwilioException;
declare class TwilioException {
    /**
     * Exception class.
     * @class
     * @name Exception
     * @exports Exception as Twilio.Exception
     * @memberOf Twilio
     * @param {string} message The exception message
     */
    constructor(message: string);
    message: string;
    toString(): string;
}
export {};
