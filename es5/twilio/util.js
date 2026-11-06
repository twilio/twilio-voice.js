'use strict';

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
function sortByMimeTypes(codecs, preferredOrder) {
    var preferredCodecs = preferredOrder.map(function (codec) { return 'audio/' + codec.toLowerCase(); });
    return codecs.sort(function (a, b) {
        var indexA = preferredCodecs.indexOf(a.mimeType.toLowerCase());
        var indexB = preferredCodecs.indexOf(b.mimeType.toLowerCase());
        var orderA = indexA >= 0 ? indexA : Number.MAX_VALUE;
        var orderB = indexB >= 0 ? indexB : Number.MAX_VALUE;
        return orderA - orderB;
    });
}
var Exception = TwilioException;

exports.Exception = Exception;
exports.average = average;
exports.difference = difference;
exports.flatMap = flatMap;
exports.isChrome = isChrome;
exports.isElectron = isElectron;
exports.isFirefox = isFirefox;
exports.isLegacyEdge = isLegacyEdge;
exports.isSafari = isSafari;
exports.promisifyEvents = promisifyEvents;
exports.queryToJson = queryToJson;
exports.sortByMimeTypes = sortByMimeTypes;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby91dGlsLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFFQTs7Ozs7OztBQU9HO0FBQ0gsU0FBUyxlQUFlLENBQUMsT0FBTyxFQUFBO0FBQzlCLElBQUEsSUFBSSxFQUFFLElBQUksWUFBWSxlQUFlLENBQUMsRUFBRTtBQUN0QyxRQUFBLE9BQU8sSUFBSSxlQUFlLENBQUMsT0FBTyxDQUFDO0lBQ3JDO0FBQ0EsSUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU87QUFDeEI7QUFFQTs7OztBQUlHO0FBQ0gsZUFBZSxDQUFDLFNBQVMsQ0FBQyxRQUFRLEdBQUcsWUFBQTtBQUNuQyxJQUFBLE9BQU8sb0JBQUEsQ0FBQSxNQUFBLENBQXFCLElBQUksQ0FBQyxPQUFPLENBQUU7QUFDNUMsQ0FBQztBQUVELFNBQVMsT0FBTyxDQUFDLE1BQU0sRUFBQTtBQUNyQixJQUFBLE9BQU8sTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxVQUFDLENBQUMsRUFBRSxDQUFDLEVBQUEsRUFBSyxPQUFBLENBQUMsR0FBRyxDQUFDLENBQUEsQ0FBTCxDQUFLLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxHQUFHLENBQUM7QUFDckY7QUFFQSxTQUFTLFVBQVUsQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLE1BQU8sRUFBQTtBQUN4QyxJQUFBLE1BQU0sR0FBRyxNQUFNLEtBQUssVUFBQSxDQUFDLEVBQUEsRUFBSSxPQUFBLENBQUMsQ0FBQSxDQUFELENBQUMsQ0FBQztBQUMzQixJQUFBLElBQU0sU0FBUyxHQUFHLElBQUksR0FBRyxDQUFDLE1BQU0sQ0FBQyxHQUFHLENBQUMsTUFBTSxDQUFDLENBQUM7SUFDN0MsT0FBTyxLQUFLLENBQUMsTUFBTSxDQUFDLFVBQUEsSUFBSSxFQUFBLEVBQUksT0FBQSxDQUFDLFNBQVMs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
