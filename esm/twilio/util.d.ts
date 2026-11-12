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
/**
 * Read the account SID and identity from a Twilio JWT, so two tokens can be
 * compared. Only the payload segment is decoded (base64url -> base64, then
 * `atob` and `JSON.parse`, as Device does for `connectToken`); the signature is
 * not verified.
 *
 * - Access Token: account SID from `sub`, identity from `grants.identity`.
 * - Capability Token: account SID from `iss`, identity from the first
 *   `clientName` parameter in `scope`.
 *
 * Non-ASCII characters are not UTF-8 decoded. The values are only compared,
 * and the same bytes always produce the same string.
 * @param {string} token
 * @returns {{accountSid: string, identity: (string|null)}|null} null when the
 *   token cannot be decoded or has no account SID.
 */
declare function getTokenPrincipal(token: any): {
    accountSid: string;
    identity: any;
} | null;
declare const Exception: typeof TwilioException;
export { Exception, average, difference, isElectron, isChrome, isFirefox, isLegacyEdge, isSafari, queryToJson, flatMap, getTokenPrincipal, promisifyEvents, sortByMimeTypes, };
