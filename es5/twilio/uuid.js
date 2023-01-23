"use strict";
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
Object.defineProperty(exports, "__esModule", { value: true });
var md5 = require("md5");
var errors_1 = require("../twilio/errors");
function generateUuid() {
    if (typeof window !== 'object') {
        throw new errors_1.NotSupportedError('This platform is not supported.');
    }
    var crypto = window.crypto;
    if (typeof crypto !== 'object') {
        throw new errors_1.NotSupportedError('The `crypto` module is not available on this platform.');
    }
    if (typeof (crypto.randomUUID || crypto.getRandomValues) === 'undefined') {
        throw new errors_1.NotSupportedError('Neither `crypto.randomUUID` or `crypto.getRandomValues` are available ' +
            'on this platform.');
    }
    var uInt32Arr = window.Uint32Array;
    if (typeof uInt32Arr === 'undefined') {
        throw new errors_1.NotSupportedError('The `Uint32Array` module is not available on this platform.');
    }
    var generateRandomValues = typeof crypto.randomUUID === 'function'
        ? function () { return crypto.randomUUID(); }
        : function () { return crypto.getRandomValues(new Uint32Array(32)).toString(); };
    return md5(generateRandomValues());
}
function generateVoiceEventSid() {
    return "KX" + generateUuid();
}
exports.generateVoiceEventSid = generateVoiceEventSid;
//# sourceMappingURL=uuid.js.map