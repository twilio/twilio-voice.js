/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
import * as md5Lib from 'md5';
import { NotSupportedError } from '../twilio/errors';
// If imported as an ESM module, sometimes md5 is available by accessing
// the "default" property of the imported library.
// @ts-ignore
const md5 = typeof md5Lib === 'function' ? md5Lib : md5Lib.default;
function generateUuid() {
    if (typeof window !== 'object') {
        throw new NotSupportedError('This platform is not supported.');
    }
    const crypto = window.crypto;
    if (typeof crypto !== 'object') {
        throw new NotSupportedError('The `crypto` module is not available on this platform.');
    }
    if (typeof (crypto.randomUUID || crypto.getRandomValues) === 'undefined') {
        throw new NotSupportedError('Neither `crypto.randomUUID` or `crypto.getRandomValues` are available ' +
            'on this platform.');
    }
    const uInt32Arr = window.Uint32Array;
    if (typeof uInt32Arr === 'undefined') {
        throw new NotSupportedError('The `Uint32Array` module is not available on this platform.');
    }
    const generateRandomValues = typeof crypto.randomUUID === 'function'
        ? () => crypto.randomUUID()
        : () => crypto.getRandomValues(new Uint32Array(32)).toString();
    return md5(generateRandomValues());
}
export function generateVoiceEventSid() {
    return `KX${generateUuid()}`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXVpZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vdXVpZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7OztHQUlHO0FBRUgsT0FBTyxLQUFLLE1BQU0sTUFBTSxLQUFLLENBQUM7QUFDOUIsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sa0JBQWtCLENBQUM7QUFFckQsd0VBQXdFO0FBQ3hFLGtEQUFrRDtBQUNsRCxhQUFhO0FBQ2IsTUFBTSxHQUFHLEdBQUcsT0FBTyxNQUFNLEtBQUssVUFBVSxDQUFDLENBQUMsQ0FBQyxNQUFNLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUM7QUFFbkUsU0FBUyxZQUFZO0lBQ25CLElBQUksT0FBTyxNQUFNLEtBQUssUUFBUSxFQUFFO1FBQzlCLE1BQU0sSUFBSSxpQkFBaUIsQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO0tBQ2hFO0lBRUQsTUFBTSxNQUFNLEdBQTJDLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDckUsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLEVBQUU7UUFDOUIsTUFBTSxJQUFJLGlCQUFpQixDQUN6Qix3REFBd0QsQ0FDekQsQ0FBQztLQUNIO0lBQ0QsSUFBSSxPQUFPLENBQUMsTUFBTSxDQUFDLFVBQVUsSUFBSSxNQUFNLENBQUMsZUFBZSxDQUFDLEtBQUssV0FBVyxFQUFFO1FBQ3hFLE1BQU0sSUFBSSxpQkFBaUIsQ0FDekIsd0VBQXdFO1lBQ3hFLG1CQUFtQixDQUNwQixDQUFDO0tBQ0g7SUFFRCxNQUFNLFNBQVMsR0FBdUIsTUFBTSxDQUFDLFdBQVcsQ0FBQztJQUN6RCxJQUFJLE9BQU8sU0FBUyxLQUFLLFdBQVcsRUFBRTtRQUNwQyxNQUFNLElBQUksaUJBQWlCLENBQ3pCLDZEQUE2RCxDQUM5RCxDQUFDO0tBQ0g7SUFFRCxNQUFNLG9CQUFvQixHQUN4QixPQUFPLE1BQU0sQ0FBQyxVQUFVLEtBQUssVUFBVTtRQUNyQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDLFVBQVcsRUFBRTtRQUM1QixDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBRW5FLE9BQU8sR0FBRyxDQUFDLG9CQUFvQixFQUFFLENBQUMsQ0FBQztBQUNyQyxDQUFDO0FBRUQsTUFBTSxVQUFVLHFCQUFxQjtJQUNuQyxPQUFPLEtBQUssWUFBWSxFQUFFLEVBQUUsQ0FBQztBQUMvQixDQUFDIn0=