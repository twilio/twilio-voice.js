"use strict";
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
Object.defineProperty(exports, "__esModule", { value: true });
exports.promisifyEvents = exports.flatMap = exports.queryToJson = exports.isUnifiedPlanDefault = exports.isSafari = exports.isLegacyEdge = exports.isFirefox = exports.isChrome = exports.isElectron = exports.difference = exports.average = exports.Exception = void 0;
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
    return "Twilio.Exception: " + this.message;
};
function average(values) {
    return values && values.length ? values.reduce(function (t, v) { return t + v; }) / values.length : 0;
}
exports.average = average;
function difference(lefts, rights, getKey) {
    getKey = getKey || (function (a) { return a; });
    var rightKeys = new Set(rights.map(getKey));
    return lefts.filter(function (left) { return !rightKeys.has(getKey(left)); });
}
exports.difference = difference;
function isElectron(navigator) {
    return !!navigator.userAgent.match('Electron');
}
exports.isElectron = isElectron;
function isChrome(window, navigator) {
    var isCriOS = !!navigator.userAgent.match('CriOS');
    var isHeadlessChrome = !!navigator.userAgent.match('HeadlessChrome');
    var isGoogle = typeof window.chrome !== 'undefined'
        && navigator.vendor === 'Google Inc.'
        && navigator.userAgent.indexOf('OPR') === -1
        && navigator.userAgent.indexOf('Edge') === -1;
    return isCriOS || isElectron(navigator) || isGoogle || isHeadlessChrome;
}
exports.isChrome = isChrome;
function isFirefox(navigator) {
    navigator = navigator || (typeof window === 'undefined'
        ? global.navigator : window.navigator);
    return !!(navigator) && typeof navigator.userAgent === 'string'
        && /firefox|fxios/i.test(navigator.userAgent);
}
exports.isFirefox = isFirefox;
function isLegacyEdge(navigator) {
    navigator = navigator || (typeof window === 'undefined'
        ? global.navigator : window.navigator);
    return !!(navigator) && typeof navigator.userAgent === 'string'
        && /edge\/\d+/i.test(navigator.userAgent);
}
exports.isLegacyEdge = isLegacyEdge;
function isSafari(navigator) {
    return !!(navigator.vendor) && navigator.vendor.indexOf('Apple') !== -1
        && navigator.userAgent
        && navigator.userAgent.indexOf('CriOS') === -1
        && navigator.userAgent.indexOf('FxiOS') === -1;
}
exports.isSafari = isSafari;
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
        var pc = new PeerConnection();
        var isUnifiedPlan = true;
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
exports.isUnifiedPlanDefault = isUnifiedPlanDefault;
function queryToJson(params) {
    if (!params) {
        return '';
    }
    return params.split('&').reduce(function (output, pair) {
        var parts = pair.split('=');
        var key = parts[0];
        var value = decodeURIComponent((parts[1] || '').replace(/\+/g, '%20'));
        if (key) {
            output[key] = value;
        }
        return output;
    }, {});
}
exports.queryToJson = queryToJson;
/**
 * Map a list to an array of arrays, and return the flattened result.
 * @param {Array<*>|Set<*>|Map<*>} list
 * @param {function(*): Array<*>} [mapFn]
 * @returns Array<*>
 */
function flatMap(list, mapFn) {
    var listArray = list instanceof Map || list instanceof Set
        ? Array.from(list.values())
        : list;
    mapFn = mapFn || (function (item) { return item; });
    return listArray.reduce(function (flattened, item) {
        var mapped = mapFn(item);
        return flattened.concat(mapped);
    }, []);
}
exports.flatMap = flatMap;
/**
 * Converts an EventEmitter's events into a promise and automatically
 * cleans up handlers once the promise is resolved or rejected.
 */
function promisifyEvents(emitter, resolveEventName, rejectEventName) {
    return new Promise(function (resolve, reject) {
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
exports.promisifyEvents = promisifyEvents;
var Exception = TwilioException;
exports.Exception = Exception;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7R0FJRztBQUNILGNBQWM7OztBQUVkOzs7Ozs7O0dBT0c7QUFDSCxTQUFTLGVBQWUsQ0FBQyxPQUFPO0lBQzlCLElBQUksQ0FBQyxDQUFDLElBQUksWUFBWSxlQUFlLENBQUMsRUFBRTtRQUN0QyxPQUFPLElBQUksZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0tBQ3JDO0lBQ0QsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7QUFDekIsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxlQUFlLENBQUMsU0FBUyxDQUFDLFFBQVEsR0FBRztJQUNuQyxPQUFPLHVCQUFxQixJQUFJLENBQUMsT0FBUyxDQUFDO0FBQzdDLENBQUMsQ0FBQztBQUVGLFNBQVMsT0FBTyxDQUFDLE1BQU07SUFDckIsT0FBTyxNQUFNLElBQUksTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFDLENBQUMsRUFBRSxDQUFDLElBQUssT0FBQSxDQUFDLEdBQUcsQ0FBQyxFQUFMLENBQUssQ0FBQyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLENBQUMsQ0FBQztBQUN0RixDQUFDO0FBd0lDLDBCQUFPO0FBdElULFNBQVMsVUFBVSxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTztJQUN4QyxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLEVBQUQsQ0FBQyxDQUFDLENBQUM7SUFDNUIsSUFBTSxTQUFTLEdBQUcsSUFBSSxHQUFHLENBQUMsTUFBTSxDQUFDLEdBQUcsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDO0lBQzlDLE9BQU8sS0FBSyxDQUFDLE1BQU0sQ0FBQyxVQUFBLElBQUksSUFBSSxPQUFBLENBQUMsU0FBUyxD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