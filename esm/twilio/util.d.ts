/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
/**
 * Exception class.
 * @class
 * @name Exception
 * @exports Exception as Twilio.Exception
 * @memberOf Twilio
 * @param {string} message The exception message
 */
declare function TwilioException(message: any): any;
declare function average(values: any): number;
declare function difference(lefts: any, rights: any, getKey?: any): any;
declare function isElectron(navigator: any): boolean;
declare function isChrome(window: any, navigator: any): boolean;
declare function isFirefox(navigator?: any): boolean;
declare function isLegacyEdge(navigator?: any): boolean;
declare function isSafari(navigator: any): boolean;
declare function isUnifiedPlanDefault(window: any, navigator: any, PeerConnection: any, RtpTransceiver: any): boolean;
declare function queryToJson(params: any): any;
/**
 * Map a list to an array of arrays, and return the flattened result.
 * @param {Array<*>|Set<*>|Map<*>} list
 * @param {function(*): Array<*>} [mapFn]
 * @returns Array<*>
 */
declare function flatMap(list: any, mapFn: any): any;
declare const Exception: typeof TwilioException;
export { Exception, average, difference, isElectron, isChrome, isFirefox, isLegacyEdge, isSafari, isUnifiedPlanDefault, queryToJson, flatMap, };
