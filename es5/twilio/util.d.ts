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
/**
 * Chromium-based Edge has a user-agent of "Edg/" where legacy Edge has a
 * user-agent of "Edge/".
 */
declare function isLegacyEdge(navigator?: any): boolean;
declare function isSafari(navigator: any): any;
declare function isUnifiedPlanDefault(window: any, navigator: any, PeerConnection: any, RtpTransceiver: any): boolean;
declare function queryToJson(params: any): any;
/**
 * Map a list to an array of arrays, and return the flattened result.
 * @param {Array<*>|Set<*>|Map<*>} list
 * @param {function(*): Array<*>} [mapFn]
 * @returns Array<*>
 */
declare function flatMap(list: any, mapFn: any): any;
/**
 * Converts an EventEmitter's events into a promise and automatically
 * cleans up handlers once the promise is resolved or rejected.
 */
declare function promisifyEvents(emitter: any, resolveEventName: any, rejectEventName: any): Promise<unknown>;
declare function sortByMimeTypes(codecs: any, preferredOrder: any): any;
declare const Exception: typeof TwilioException;
export { Exception, average, difference, isElectron, isChrome, isFirefox, isLegacyEdge, isSafari, isUnifiedPlanDefault, queryToJson, flatMap, promisifyEvents, sortByMimeTypes, };
