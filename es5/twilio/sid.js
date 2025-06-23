"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateVoiceEventSid = generateVoiceEventSid;
var errors_1 = require("./errors");
/**
 * Generates a 128-bit long random string that is formatted as a 32 long string
 * of characters where each character is from the set:
 * [0,1,2,3,4,5,6,7,8,9,a,b,c,d,e,f].
 */
function generateRandomizedString() {
    if (typeof window !== 'object') {
        throw new errors_1.NotSupportedError('This platform is not supported.');
    }
    var crypto = window.crypto;
    if (typeof crypto !== 'object') {
        throw new errors_1.NotSupportedError('The `crypto` module is not available on this platform.');
    }
    if (typeof crypto.getRandomValues !== 'function') {
        throw new errors_1.NotSupportedError('The function `crypto.getRandomValues` is not available on this ' +
            'platform.');
    }
    if (typeof window.Uint8Array !== 'function') {
        throw new errors_1.NotSupportedError('The `Uint8Array` module is not available on this platform.');
    }
    return crypto
        .getRandomValues(new window.Uint8Array(16))
        .reduce(function (r, n) { return "".concat(r).concat(n.toString(16).padStart(2, '0')); }, '');
}
function generateVoiceEventSid() {
    return "KX".concat(generateRandomizedString());
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2lkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9zaWQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFxQ0Esc0RBRUM7QUF2Q0QsbUNBQTZDO0FBRTdDOzs7O0dBSUc7QUFDSCxTQUFTLHdCQUF3QjtJQUMvQixJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQy9CLE1BQU0sSUFBSSwwQkFBaUIsQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFFTyxJQUFBLE1BQU0sR0FBSyxNQUFNLE9BQVgsQ0FBWTtJQUMxQixJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQy9CLE1BQU0sSUFBSSwwQkFBaUIsQ0FDekIsd0RBQXdELENBQ3pELENBQUM7SUFDSixDQUFDO0lBRUQsSUFBSSxPQUFPLE1BQU0sQ0FBQyxlQUFlLEtBQUssVUFBVSxFQUFFLENBQUM7UUFDakQsTUFBTSxJQUFJLDBCQUFpQixDQUN6QixpRUFBaUU7WUFDakUsV0FBVyxDQUNaLENBQUM7SUFDSixDQUFDO0lBRUQsSUFBSSxPQUFPLE1BQU0sQ0FBQyxVQUFVLEtBQUssVUFBVSxFQUFFLENBQUM7UUFDNUMsTUFBTSxJQUFJLDBCQUFpQixDQUN6Qiw0REFBNEQsQ0FDN0QsQ0FBQztJQUNKLENBQUM7SUFFRCxPQUFPLE1BQU07U0FDVixlQUFlLENBQUMsSUFBSSxNQUFNLENBQUMsVUFBVSxDQUFDLEVBQUUsQ0FBQyxDQUFDO1NBQzFDLE1BQU0sQ0FBQyxVQUFDLENBQUMsRUFBRSxDQUFDLElBQUssT0FBQSxVQUFHLENBQUMsU0FBRyxDQUFDLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxDQUFDLEVBQUUsR0FBRyxDQUFDLENBQUUsRUFBeEMsQ0FBd0MsRUFBRSxFQUFFLENBQUMsQ0FBQztBQUNwRSxDQUFDO0FBRUQsU0FBZ0IscUJBQXFCO0lBQ25DLE9BQU8sWUFBSyx3QkFBd0IsRUFBRSxDQUFFLENBQUM7QUFDM0MsQ0FBQyJ9