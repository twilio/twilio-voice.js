import { NotSupportedError } from './errors/index.js';

/**
 * Generates a 128-bit long random string that is formatted as a 32 long string
 * of characters where each character is from the set:
 * [0,1,2,3,4,5,6,7,8,9,a,b,c,d,e,f].
 */
function generateRandomizedString() {
    if (typeof window !== 'object') {
        throw new NotSupportedError('This platform is not supported.');
    }
    const { crypto } = window;
    if (typeof crypto !== 'object') {
        throw new NotSupportedError('The `crypto` module is not available on this platform.');
    }
    if (typeof crypto.getRandomValues !== 'function') {
        throw new NotSupportedError('The function `crypto.getRandomValues` is not available on this ' +
            'platform.');
    }
    if (typeof window.Uint8Array !== 'function') {
        throw new NotSupportedError('The `Uint8Array` module is not available on this platform.');
    }
    return crypto
        .getRandomValues(new window.Uint8Array(16))
        .reduce((r, n) => `${r}${n.toString(16).padStart(2, '0')}`, '');
}
function generateVoiceEventSid() {
    return `KX${generateRandomizedString()}`;
}

export { generateVoiceEventSid };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2lkLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL3NpZC50cyJdLCJzb3VyY2VzQ29udGVudCI6W251bGxdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUVBOzs7O0FBSUc7QUFDSCxTQUFTLHdCQUF3QixHQUFBO0FBQy9CLElBQUEsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLEVBQUU7QUFDOUIsUUFBQSxNQUFNLElBQUksaUJBQWlCLENBQUMsaUNBQWlDLENBQUM7SUFDaEU7QUFFQSxJQUFBLE1BQU0sRUFBRSxNQUFNLEVBQUUsR0FBRyxNQUFNO0FBQ3pCLElBQUEsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLEVBQUU7QUFDOUIsUUFBQSxNQUFNLElBQUksaUJBQWlCLENBQ3pCLHdEQUF3RCxDQUN6RDtJQUNIO0FBRUEsSUFBQSxJQUFJLE9BQU8sTUFBTSxDQUFDLGVBQWUsS0FBSyxVQUFVLEVBQUU7UUFDaEQsTUFBTSxJQUFJLGlCQUFpQixDQUN6QixpRUFBaUU7QUFDakUsWUFBQSxXQUFXLENBQ1o7SUFDSDtBQUVBLElBQUEsSUFBSSxPQUFPLE1BQU0sQ0FBQyxVQUFVLEtBQUssVUFBVSxFQUFFO0FBQzNDLFFBQUEsTUFBTSxJQUFJLGlCQUFpQixDQUN6Qiw0REFBNEQsQ0FDN0Q7SUFDSDtBQUVBLElBQUEsT0FBTztTQUNKLGVBQWUsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO0FBQ3pDLFNBQUEsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsS0FBSyxDQUFBLEVBQUcsQ0FBQyxDQUFBLEVBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFBLENBQUUsRUFBRSxFQUFFLENBQUM7QUFDbkU7U0FFZ0IscUJBQXFCLEdBQUE7QUFDbkMsSUFBQSxPQUFPLENBQUEsRUFBQSxFQUFLLHdCQUF3QixFQUFFLENBQUEsQ0FBRTtBQUMxQzs7OzsifQ==
