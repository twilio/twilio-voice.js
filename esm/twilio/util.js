// @ts-nocheck
/**
 * Exception class.
 * @class
 * @name Exception
 * @exports Exception as Twilio.Exception
 * @memberOf Twilio
 * @param {string} message The exception message
 */
function TwilioException(message) {
    if (!(this instanceof TwilioException)) {
        return new TwilioException(message);
    }
    this.message = message;
}
/**
 * Returns the exception message.
 *
 * @return {string} The exception message.
 */
TwilioException.prototype.toString = function () {
    return `Twilio.Exception: ${this.message}`;
};
function average(values) {
    return values && values.length ? values.reduce((t, v) => t + v) / values.length : 0;
}
function difference(lefts, rights, getKey) {
    getKey = getKey || (a => a);
    const rightKeys = new Set(rights.map(getKey));
    return lefts.filter(left => !rightKeys.has(getKey(left)));
}
function isElectron(navigator) {
    return !!navigator.userAgent.match('Electron');
}
function isChrome(window, navigator) {
    const isCriOS = !!navigator.userAgent.match('CriOS');
    const isHeadlessChrome = !!navigator.userAgent.match('HeadlessChrome');
    const isGoogle = typeof window.chrome !== 'undefined'
        && navigator.vendor === 'Google Inc.'
        && navigator.userAgent.indexOf('OPR') === -1
        && navigator.userAgent.indexOf('Edge') === -1;
    return isCriOS || isElectron(navigator) || isGoogle || isHeadlessChrome;
}
function isFirefox(navigator) {
    navigator = navigator || (typeof window === 'undefined'
        ? global.navigator : window.navigator);
    return !!(navigator) && typeof navigator.userAgent === 'string'
        && /firefox|fxios/i.test(navigator.userAgent);
}
/**
 * Chromium-based Edge has a user-agent of "Edg/" where legacy Edge has a
 * user-agent of "Edge/".
 */
function isLegacyEdge(navigator) {
    navigator = navigator || (typeof window === 'undefined'
        ? global.navigator : window.navigator);
    return !!(navigator) && typeof navigator.userAgent === 'string'
        && /edge\/\d+/i.test(navigator.userAgent);
}
function isSafari(navigator) {
    return !!(navigator.vendor) && navigator.vendor.indexOf('Apple') !== -1
        && navigator.userAgent
        && navigator.userAgent.indexOf('CriOS') === -1
        && navigator.userAgent.indexOf('FxiOS') === -1;
}
function queryToJson(params) {
    if (!params) {
        return '';
    }
    return params.split('&').reduce((output, pair) => {
        const parts = pair.split('=');
        const key = parts[0];
        const value = decodeURIComponent((parts[1] || '').replace(/\+/g, '%20'));
        if (key) {
            output[key] = value;
        }
        return output;
    }, {});
}
/**
 * Map a list to an array of arrays, and return the flattened result.
 * @param {Array<*>|Set<*>|Map<*>} list
 * @param {function(*): Array<*>} [mapFn]
 * @returns Array<*>
 */
function flatMap(list, mapFn) {
    const listArray = list instanceof Map || list instanceof Set
        ? Array.from(list.values())
        : list;
    mapFn = mapFn || (item => item);
    return listArray.reduce((flattened, item) => {
        const mapped = mapFn(item);
        return flattened.concat(mapped);
    }, []);
}
/**
 * Converts an EventEmitter's events into a promise and automatically
 * cleans up handlers once the promise is resolved or rejected.
 */
function promisifyEvents(emitter, resolveEventName, rejectEventName) {
    return new Promise((resolve, reject) => {
        function resolveHandler() {
            emitter.removeListener(rejectEventName, rejectHandler);
            resolve();
        }
        function rejectHandler() {
            emitter.removeListener(resolveEventName, resolveHandler);
            reject();
        }
        emitter.once(resolveEventName, resolveHandler);
        emitter.once(rejectEventName, rejectHandler);
    });
}
function sortByMimeTypes(codecs, preferredOrder) {
    const preferredCodecs = preferredOrder.map(codec => 'audio/' + codec.toLowerCase());
    return codecs.sort((a, b) => {
        const indexA = preferredCodecs.indexOf(a.mimeType.toLowerCase());
        const indexB = preferredCodecs.indexOf(b.mimeType.toLowerCase());
        const orderA = indexA >= 0 ? indexA : Number.MAX_VALUE;
        const orderB = indexB >= 0 ? indexB : Number.MAX_VALUE;
        return orderA - orderB;
    });
}
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
function getTokenPrincipal(token) {
    try {
        const parts = typeof token === 'string' ? token.split('.') : [];
        if (parts.length !== 3) {
            return null;
        }
        const base64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
        const payload = JSON.parse(atob(base64 + '==='.slice((base64.length + 3) % 4)));
        if (!payload || typeof payload !== 'object') {
            return null;
        }
        const accountSid = typeof payload.sub === 'string' ? payload.sub : payload.iss;
        if (typeof accountSid !== 'string' || !accountSid) {
            return null;
        }
        let identity = null;
        if (payload.grants && typeof payload.grants === 'object') {
            identity = typeof payload.grants.identity === 'string' ? payload.grants.identity : null;
        }
        else if (typeof payload.scope === 'string') {
            payload.scope.split(' ').some(scope => {
                const query = scope.split('?')[1];
                const clientName = query ? queryToJson(query).clientName : undefined;
                if (typeof clientName === 'string' && clientName) {
                    identity = clientName;
                    return true;
                }
                return false;
            });
        }
        return { accountSid, identity };
    }
    catch (e) {
        return null;
    }
}
const Exception = TwilioException;

export { Exception, average, difference, flatMap, getTokenPrincipal, isChrome, isElectron, isFirefox, isLegacyEdge, isSafari, promisifyEvents, queryToJson, sortByMimeTypes };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby91dGlsLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBRUE7Ozs7Ozs7QUFPRztBQUNILFNBQVMsZUFBZSxDQUFDLE9BQU8sRUFBQTtBQUM5QixJQUFBLElBQUksRUFBRSxJQUFJLFlBQVksZUFBZSxDQUFDLEVBQUU7QUFDdEMsUUFBQSxPQUFPLElBQUksZUFBZSxDQUFDLE9BQU8sQ0FBQztJQUNyQztBQUNBLElBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPO0FBQ3hCO0FBRUE7Ozs7QUFJRztBQUNILGVBQWUsQ0FBQyxTQUFTLENBQUMsUUFBUSxHQUFHLFlBQUE7QUFDbkMsSUFBQSxPQUFPLENBQUEsa0JBQUEsRUFBcUIsSUFBSSxDQUFDLE9BQU8sRUFBRTtBQUM1QyxDQUFDO0FBRUQsU0FBUyxPQUFPLENBQUMsTUFBTSxFQUFBO0FBQ3JCLElBQUEsT0FBTyxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFDLEdBQUcsQ0FBQyxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sR0FBRyxDQUFDO0FBQ3JGO0FBRUEsU0FBUyxVQUFVLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxNQUFPLEVBQUE7SUFDeEMsTUFBTSxHQUFHLE1BQU0sS0FBSyxDQUFDLElBQUksQ0FBQyxDQUFDO0FBQzNCLElBQUEsTUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQztBQUM3QyxJQUFBLE9BQU8sS0FBSyxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksQ0FBQyxTQUFTLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQzNEO0FBRUEsU0FBUyxVQUFVLENBQUMsU0FBUyxF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
