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
exports.sortByMimeTypes = sortByMimeTypes;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXRpbC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vdXRpbC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsY0FBYzs7O0FBbUxaLDBCQUFPO0FBQ1AsZ0NBQVU7QUFDVixnQ0FBVTtBQUNWLDRCQUFRO0FBQ1IsOEJBQVM7QUFDVCxvQ0FBWTtBQUNaLDRCQUFRO0FBQ1Isb0RBQW9CO0FBQ3BCLGtDQUFXO0FBQ1gsMEJBQU87QUFDUCwwQ0FBZTtBQUNmLDBDQUFlO0FBNUxqQjs7Ozs7OztHQU9HO0FBQ0gsU0FBUyxlQUFlLENBQUMsT0FBTztJQUM5QixJQUFJLENBQUMsQ0FBQyxJQUFJLFlBQVksZUFBZSxDQUFDLEVBQUUsQ0FBQztRQUN2QyxPQUFPLElBQUksZUFBZSxDQUFDLE9BQU8sQ0FBQyxDQUFDO0lBQ3RDLENBQUM7SUFDRCxJQUFJLENBQUMsT0FBTyxHQUFHLE9BQU8sQ0FBQztBQUN6QixDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILGVBQWUsQ0FBQyxTQUFTLENBQUMsUUFBUSxHQUFHO0lBQ25DLE9BQU8sNEJBQXFCLElBQUksQ0FBQyxPQUFPLENBQUUsQ0FBQztBQUM3QyxDQUFDLENBQUM7QUFFRixTQUFTLE9BQU8sQ0FBQyxNQUFNO0lBQ3JCLE9BQU8sTUFBTSxJQUFJLE1BQU0sQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxNQUFNLENBQUMsVUFBQyxDQUFDLEVBQUUsQ0FBQyxJQUFLLE9BQUEsQ0FBQyxHQUFHLENBQUMsRUFBTCxDQUFLLENBQUMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7QUFDdEYsQ0FBQztBQUVELFNBQVMsVUFBVSxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsTUFBTztJQUN4QyxNQUFNLEdBQUcsTUFBTSxJQUFJLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLEVBQUQsQ0FBQyxDQUFDLENBQUM7SUFDNUIsSUFBTSxT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