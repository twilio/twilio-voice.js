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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXVpZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vdXVpZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7R0FJRzs7QUFFSCx5QkFBMkI7QUFDM0IsMkNBQXFEO0FBRXJELFNBQVMsWUFBWTtJQUNuQixJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsRUFBRTtRQUM5QixNQUFNLElBQUksMEJBQWlCLENBQUMsaUNBQWlDLENBQUMsQ0FBQztLQUNoRTtJQUVELElBQU0sTUFBTSxHQUEyQyxNQUFNLENBQUMsTUFBTSxDQUFDO0lBQ3JFLElBQUksT0FBTyxNQUFNLEtBQUssUUFBUSxFQUFFO1FBQzlCLE1BQU0sSUFBSSwwQkFBaUIsQ0FDekIsd0RBQXdELENBQ3pELENBQUM7S0FDSDtJQUNELElBQUksT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFVLElBQUksTUFBTSxDQUFDLGVBQWUsQ0FBQyxLQUFLLFdBQVcsRUFBRTtRQUN4RSxNQUFNLElBQUksMEJBQWlCLENBQ3pCLHdFQUF3RTtZQUN4RSxtQkFBbUIsQ0FDcEIsQ0FBQztLQUNIO0lBRUQsSUFBTSxTQUFTLEdBQXVCLE1BQU0sQ0FBQyxXQUFXLENBQUM7SUFDekQsSUFBSSxPQUFPLFNBQVMsS0FBSyxXQUFXLEVBQUU7UUFDcEMsTUFBTSxJQUFJLDBCQUFpQixDQUN6Qiw2REFBNkQsQ0FDOUQsQ0FBQztLQUNIO0lBRUQsSUFBTSxvQkFBb0IsR0FDeEIsT0FBTyxNQUFNLENBQUMsVUFBVSxLQUFLLFVBQVU7UUFDckMsQ0FBQyxDQUFDLGNBQU0sT0FBQSxNQUFNLENBQUMsVUFBVyxFQUFFLEVBQXBCLENBQW9CO1FBQzVCLENBQUMsQ0FBQyxjQUFNLE9BQUEsTUFBTSxDQUFDLGVBQWUsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxFQUF0RCxDQUFzRCxDQUFDO0lBRW5FLE9BQU8sR0FBRyxDQUFDLG9CQUFvQixFQUFFLENBQUMsQ0FBQztBQUNyQyxDQUFDO0FBRUQsU0FBZ0IscUJBQXFCO0lBQ25DLE9BQU8sT0FBSyxZQUFZLEVBQUksQ0FBQztBQUMvQixDQUFDO0FBRkQsc0RBRUMifQ==