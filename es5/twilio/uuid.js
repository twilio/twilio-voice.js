"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVoiceEventSid = generateVoiceEventSid;
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
    return "KX".concat(generateUuid());
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXVpZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vdXVpZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQXlDQSxzREFFQztBQTNDRCw0QkFBOEI7QUFDOUIsMkNBQXFEO0FBRXJELHdFQUF3RTtBQUN4RSxrREFBa0Q7QUFDbEQsYUFBYTtBQUNiLElBQU0sR0FBRyxHQUFHLE9BQU8sTUFBTSxLQUFLLFVBQVUsQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDO0FBRW5FLFNBQVMsWUFBWTtJQUNuQixJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQy9CLE1BQU0sSUFBSSwwQkFBaUIsQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFFRCxJQUFNLE1BQU0sR0FBMkMsTUFBTSxDQUFDLE1BQU0sQ0FBQztJQUNyRSxJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQy9CLE1BQU0sSUFBSSwwQkFBaUIsQ0FDekIsd0RBQXdELENBQ3pELENBQUM7SUFDSixDQUFDO0lBQ0QsSUFBSSxPQUFPLENBQUMsTUFBTSxDQUFDLFVBQVUsSUFBSSxNQUFNLENBQUMsZUFBZSxDQUFDLEtBQUssV0FBVyxFQUFFLENBQUM7UUFDekUsTUFBTSxJQUFJLDBCQUFpQixDQUN6Qix3RUFBd0U7WUFDeEUsbUJBQW1CLENBQ3BCLENBQUM7SUFDSixDQUFDO0lBRUQsSUFBTSxTQUFTLEdBQXVCLE1BQU0sQ0FBQyxXQUFXLENBQUM7SUFDekQsSUFBSSxPQUFPLFNBQVMsS0FBSyxXQUFXLEVBQUUsQ0FBQztRQUNyQyxNQUFNLElBQUksMEJBQWlCLENBQ3pCLDZEQUE2RCxDQUM5RCxDQUFDO0lBQ0osQ0FBQztJQUVELElBQU0sb0JBQW9CLEdBQ3hCLE9BQU8sTUFBTSxDQUFDLFVBQVUsS0FBSyxVQUFVO1FBQ3JDLENBQUMsQ0FBQyxjQUFNLE9BQUEsTUFBTSxDQUFDLFVBQVcsRUFBRSxFQUFwQixDQUFvQjtRQUM1QixDQUFDLENBQUMsY0FBTSxPQUFBLE1BQU0sQ0FBQyxlQUFlLENBQUMsSUFBSSxXQUFXLENBQUMsRUFBRSxDQUFDLENBQUMsQ0FBQyxRQUFRLEVBQUUsRUFBdEQsQ0FBc0QsQ0FBQztJQUVuRSxPQUFPLEdBQUcsQ0FBQyxvQkFBb0IsRUFBRSxDQUFDLENBQUM7QUFDckMsQ0FBQztBQUVELFNBQWdCLHFCQUFxQjtJQUNuQyxPQUFPLFlBQUssWUFBWSxFQUFFLENBQUUsQ0FBQztBQUMvQixDQUFDIn0=