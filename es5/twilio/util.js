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
exports.Exception = TwilioException;
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
//# sourceMappingURL=util.js.map