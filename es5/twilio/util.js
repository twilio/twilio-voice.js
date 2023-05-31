"use strict";
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
Object.defineProperty(exports, "__esModule", { value: true });
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
var Exception = TwilioException;
exports.Exception = Exception;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7R0FJRztBQUNILGNBQWM7O0FBRWQ7Ozs7Ozs7R0FPRztBQUNILFNBQVMsZUFBZSxDQUFDLE9BQU87SUFDOUIsSUFBSSxDQUFDLENBQUMsSUFBSSxZQUFZLGVBQWUsQ0FBQyxFQUFFO1FBQ3RDLE9BQU8sSUFBSSxlQUFlLENBQUMsT0FBTyxDQUFDLENBQUM7S0FDckM7SUFDRCxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztBQUN6QixDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILGVBQWUsQ0FBQyxTQUFTLENBQUMsUUFBUSxHQUFHO0lBQ25DLE9BQU8sdUJBQXFCLElBQUksQ0FBQyxPQUFTLENBQUM7QUFDN0MsQ0FBQyxDQUFDO0FBRUYsU0FBUyxPQUFPLENBQUMsTUFBTTtJQUNyQixPQUFPLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSyxPQUFBLENBQUMsR0FBRyxDQUFDLEVBQUwsQ0FBSyxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RGLENBQUM7QUFxSEMsMEJBQU87QUFuSFQsU0FBUyxVQUFVLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxNQUFPO0lBQ3hDLE1BQU0sR0FBRyxNQUFNLElBQUksQ0FBQyxVQUFBLENBQUMsSUFBSSxPQUFBLENBQUMsRUFBRCxDQUFDLENBQUMsQ0FBQztJQUM1QixJQUFNLFNBQVMsR0FBRyxJQUFJLEdBQUcsQ0FBQyxNQUFNLENBQUMsR0FBRyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUM7SUFDOUMsT0FBTyxLQUFLLENBQUMsTUFBTSxDQUFDLFVBQUEsSUFBSSxJQUFJLE9BQUEsQ0FBQyxTQUFTLENB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