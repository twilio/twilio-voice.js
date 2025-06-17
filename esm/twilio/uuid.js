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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidXVpZC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vdXVpZC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxPQUFPLEtBQUssTUFBTSxNQUFNLEtBQUssQ0FBQztBQUM5QixPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxrQkFBa0IsQ0FBQztBQUVyRCx3RUFBd0U7QUFDeEUsa0RBQWtEO0FBQ2xELGFBQWE7QUFDYixNQUFNLEdBQUcsR0FBRyxPQUFPLE1BQU0sS0FBSyxVQUFVLENBQUMsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxDQUFDLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQztBQUVuRSxTQUFTLFlBQVk7SUFDbkIsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUMvQixNQUFNLElBQUksaUJBQWlCLENBQUMsaUNBQWlDLENBQUMsQ0FBQztJQUNqRSxDQUFDO0lBRUQsTUFBTSxNQUFNLEdBQTJDLE1BQU0sQ0FBQyxNQUFNLENBQUM7SUFDckUsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLEVBQUUsQ0FBQztRQUMvQixNQUFNLElBQUksaUJBQWlCLENBQ3pCLHdEQUF3RCxDQUN6RCxDQUFDO0lBQ0osQ0FBQztJQUNELElBQUksT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFVLElBQUksTUFBTSxDQUFDLGVBQWUsQ0FBQyxLQUFLLFdBQVcsRUFBRSxDQUFDO1FBQ3pFLE1BQU0sSUFBSSxpQkFBaUIsQ0FDekIsd0VBQXdFO1lBQ3hFLG1CQUFtQixDQUNwQixDQUFDO0lBQ0osQ0FBQztJQUVELE1BQU0sU0FBUyxHQUF1QixNQUFNLENBQUMsV0FBVyxDQUFDO0lBQ3pELElBQUksT0FBTyxTQUFTLEtBQUssV0FBVyxFQUFFLENBQUM7UUFDckMsTUFBTSxJQUFJLGlCQUFpQixDQUN6Qiw2REFBNkQsQ0FDOUQsQ0FBQztJQUNKLENBQUM7SUFFRCxNQUFNLG9CQUFvQixHQUN4QixPQUFPLE1BQU0sQ0FBQyxVQUFVLEtBQUssVUFBVTtRQUNyQyxDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDLFVBQVcsRUFBRTtRQUM1QixDQUFDLENBQUMsR0FBRyxFQUFFLENBQUMsTUFBTSxDQUFDLGVBQWUsQ0FBQyxJQUFJLFdBQVcsQ0FBQyxFQUFFLENBQUMsQ0FBQyxDQUFDLFFBQVEsRUFBRSxDQUFDO0lBRW5FLE9BQU8sR0FBRyxDQUFDLG9CQUFvQixFQUFFLENBQUMsQ0FBQztBQUNyQyxDQUFDO0FBRUQsTUFBTSxVQUFVLHFCQUFxQjtJQUNuQyxPQUFPLEtBQUssWUFBWSxFQUFFLEVBQUUsQ0FBQztBQUMvQixDQUFDIn0=