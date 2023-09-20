"use strict";
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVoiceEventSid = void 0;
var md5Lib = require("md5");
var errors_1 = require("../twilio/errors");
// If imported as an ESM module, sometimes md5 is available by accessing
// the "default" property of the imported library.
// @ts-ignore
var md5 = typeof md5Lib === 'function' ? md5Lib : md5Lib.default;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXVpZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vdXVpZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7R0FJRzs7O0FBRUgsNEJBQThCO0FBQzlCLDJDQUFxRDtBQUVyRCx3RUFBd0U7QUFDeEUsa0RBQWtEO0FBQ2xELGFBQWE7QUFDYixJQUFNLEdBQUcsR0FBRyxPQUFPLE1BQU0sS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztBQUVuRSxTQUFTLFlBQVk7SUFDbkIsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLEVBQUU7UUFDOUIsTUFBTSxJQUFJLDBCQUFpQixDQUFDLGlDQUFpQyxDQUFDLENBQUM7S0FDaEU7SUFFRCxJQUFNLE1BQU0sR0FBMkMsTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUNyRSxJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsRUFBRTtRQUM5QixNQUFNLElBQUksMEJBQWlCLENBQ3pCLHdEQUF3RCxDQUN6RCxDQUFDO0tBQ0g7SUFDRCxJQUFJLE9BQU8sQ0FBQyxNQUFNLENBQUMsVUFBVSxJQUFJLE1BQU0sQ0FBQyxlQUFlLENBQUMsS0FBSyxXQUFXLEVBQUU7UUFDeEUsTUFBTSxJQUFJLDBCQUFpQixDQUN6Qix3RUFBd0U7WUFDeEUsbUJBQW1CLENBQ3BCLENBQUM7S0FDSDtJQUVELElBQU0sU0FBUyxHQUF1QixNQUFNLENBQUMsV0FBVyxDQUFDO0lBQ3pELElBQUksT0FBTyxTQUFTLEtBQUssV0FBVyxFQUFFO1FBQ3BDLE1BQU0sSUFBSSwwQkFBaUIsQ0FDekIsNkRBQTZELENBQzlELENBQUM7S0FDSDtJQUVELElBQU0sb0JBQW9CLEdBQ3hCLE9BQU8sTUFBTSxDQUFDLFVBQVUsS0FBSyxVQUFVO1FBQ3JDLENBQUMsQ0FBQyxjQUFNLE9BQUEsTUFBTSxDQUFDLFVBQVcsRUFBRSxFQUFwQixDQUFvQjtRQUM1QixDQUFDLENBQUMsY0FBTSxPQUFBLE1BQU0sQ0FBQyxlQUFlLENBQUMsSUFBSSxXQUFXLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBdEQsQ0FBc0QsQ0FBQztJQUVuRSxPQUFPLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDLENBQUM7QUFDckMsQ0FBQztBQUVELFNBQWdCLHFCQUFxQjtJQUNuQyxPQUFPLE9BQUssWUFBWSxFQUFJLENBQUM7QUFDL0IsQ0FBQztBQUZELHNEQUVDIn0=