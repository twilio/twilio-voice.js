"use strict";
// @ts-nocheck
Object.defineProperty(exports, "__esModule", { value: true });
exports.Exception = void 0;
exports.average = average;
exports.difference = difference;
exports.isElectron = isElectron;
exports.isChrome = isChrome;
exports.isFirefox = isFirefox;
exports.isLegacyEdge = isLegacyEdge;
exports.isSafari = isSafari;
exports.isUnifiedPlanDefault = isUnifiedPlanDefault;
exports.queryToJson = queryToJson;
exports.flatMap = flatMap;
exports.promisifyEvents = promisifyEvents;
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
    return "Twilio.Exception: ".concat(this.message);
};
function average(values) {
    return values && values.length ? values.reduce(function (t, v) { return t + v; }) / values.length : 0;
}
function difference(lefts, rights, getKey) {
    getKey = getKey || (function (a) { return a; });
    var rightKeys = new Set(rights.map(getKey));
    return lefts.filter(function (left) { return !rightKeys.has(getKey(left)); });
}
function isElectron(navigator) {
    return !!navigator.userAgent.match('Electron');
}
function isChrome(window, navigator) {
    var isCriOS = !!navigator.userAgent.match('CriOS');
    var isHeadlessChrome = !!navigator.userAgent.match('HeadlessChrome');
    var isGoogle = typeof window.chrome !== 'undefined'
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
var Exception = TwilioException;
exports.Exception = Exception;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsY0FBYzs7O0FBb0taLDBCQUFPO0FBQ1AsZ0NBQVU7QUFDVixnQ0FBVTtBQUNWLDRCQUFRO0FBQ1IsOEJBQVM7QUFDVCxvQ0FBWTtBQUNaLDRCQUFRO0FBQ1Isb0RBQW9CO0FBQ3BCLGtDQUFXO0FBQ1gsMEJBQU87QUFDUCwwQ0FBZTtBQTVLakI7Ozs7Ozs7R0FPRztBQUNILFNBQVMsZUFBZSxDQUFDLE9BQU87SUFDOUIsSUFBSSxDQUFDLENBQUMsSUFBSSxZQUFZLGVBQWUsQ0FBQyxFQUFFLENBQUM7UUFDdkMsT0FBTyxJQUFJLGVBQWUsQ0FBQyxPQUFPLENBQUMsQ0FBQztJQUN0QyxDQUFDO0lBQ0QsSUFBSSxDQUFDLE9BQU8sR0FBRyxPQUFPLENBQUM7QUFDekIsQ0FBQztBQUVEOzs7O0dBSUc7QUFDSCxlQUFlLENBQUMsU0FBUyxDQUFDLFFBQVEsR0FBRztJQUNuQyxPQUFPLDRCQUFxQixJQUFJLENBQUMsT0FBTyxDQUFFLENBQUM7QUFDN0MsQ0FBQyxDQUFDO0FBRUYsU0FBUyxPQUFPLENBQUMsTUFBTTtJQUNyQixPQUFPLE1BQU0sSUFBSSxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLFVBQUMsQ0FBQyxFQUFFLENBQUMsSUFBSyxPQUFBLENBQUMsR0FBRyxDQUFDLEVBQUwsQ0FBSyxDQUFDLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO0FBQ3RGLENBQUM7QUFFRCxTQUFTLFVBQVUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLE1BQU87SUFDeEMsTUFBTSxHQUFHLE1BQU0sSUFBSSxDQUFDLFVBQUEsQ0FBQyxJQUFJLE9BQUEsQ0FBQyxFQUFELENBQUMsQ0FBQyxDQUFDO0lBQzVCLElBQU0sU0FBUyxHQUFHLElB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