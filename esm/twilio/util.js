/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
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
function isUnifiedPlanDefault(window, navigator, PeerConnection, RtpTransceiver) {
    if (typeof window === 'undefined'
        || typeof navigator === 'undefined'
        || typeof PeerConnection === 'undefined'
        || typeof RtpTransceiver === 'undefined'
        || typeof PeerConnection.prototype === 'undefined'
        || typeof RtpTransceiver.prototype === 'undefined') {
        return false;
    }
    if (isChrome(window, navigator) && PeerConnection.prototype.addTransceiver) {
        const pc = new PeerConnection();
        let isUnifiedPlan = true;
        try {
            pc.addTransceiver('audio');
        }
        catch (e) {
            isUnifiedPlan = false;
        }
        pc.close();
        return isUnifiedPlan;
    }
    else if (isFirefox(navigator)) {
        return true;
    }
    else if (isSafari(navigator)) {
        return 'currentDirection' in RtpTransceiver.prototype;
    }
    // Edge currently does not support unified plan.
    // https://developer.microsoft.com/en-us/microsoft-edge/platform/issues/17733189/
    // https://wpdev.uservoice.com/forums/257854-microsoft-edge-developer/suggestions/34451998-sdp-unified-plan
    return false;
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
const Exception = TwilioException;
export { Exception, average, difference, isElectron, isChrome, isFirefox, isLegacyEdge, isSafari, isUnifiedPlanDefault, queryToJson, flatMap, promisifyEvents, };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7OztHQUlHO0FBQ0gsY0FBYztBQUVkOzs7Ozs7O0dBT0c7QUFDSCxTQUFTLGVBQWUsQ0FBQyxPQUFPO0lBQzlCLElBQUksQ0FBQyxDQUFDLElBQUksWUFBWSxlQUFlLENBQUMsRUFBRTtRQUN0QyxPQUFPLElBQUksZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0tBQ3JDO0lBQ0QsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7QUFDekIsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxlQUFlLENBQUMsU0FBUyxDQUFDLFFBQVEsR0FBRztJQUNuQyxPQUFPLHFCQUFxQixJQUFJLENBQUMsT0FBTyxFQUFFLENBQUM7QUFDN0MsQ0FBQyxDQUFDO0FBRUYsU0FBUyxPQUFPLENBQUMsTUFBTTtJQUNyQixPQUFPLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQyxHQUFHLENBQUMsQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN0RixDQUFDO0FBRUQsU0FBUyxVQUFVLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxNQUFPO0lBQ3hDLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxDQUFDLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQzVCLE1BQU0sU0FBUyxHQUFHLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQztJQUM5QyxPQUFPLEtBQUssQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFNBQVMsQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLElB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