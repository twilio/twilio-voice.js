import { NotSupportedError } from './errors';
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
export function generateVoiceEventSid() {
    return `KX${generateRandomizedString()}`;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2lkLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9zaWQudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxFQUFFLGlCQUFpQixFQUFFLE1BQU0sVUFBVSxDQUFDO0FBRTdDOzs7O0dBSUc7QUFDSCxTQUFTLHdCQUF3QjtJQUMvQixJQUFJLE9BQU8sTUFBTSxLQUFLLFFBQVEsRUFBRSxDQUFDO1FBQy9CLE1BQU0sSUFBSSxpQkFBaUIsQ0FBQyxpQ0FBaUMsQ0FBQyxDQUFDO0lBQ2pFLENBQUM7SUFFRCxNQUFNLEVBQUUsTUFBTSxFQUFFLEdBQUcsTUFBTSxDQUFDO0lBQzFCLElBQUksT0FBTyxNQUFNLEtBQUssUUFBUSxFQUFFLENBQUM7UUFDL0IsTUFBTSxJQUFJLGlCQUFpQixDQUN6Qix3REFBd0QsQ0FDekQsQ0FBQztJQUNKLENBQUM7SUFFRCxJQUFJLE9BQU8sTUFBTSxDQUFDLGVBQWUsS0FBSyxVQUFVLEVBQUUsQ0FBQztRQUNqRCxNQUFNLElBQUksaUJBQWlCLENBQ3pCLGlFQUFpRTtZQUNqRSxXQUFXLENBQ1osQ0FBQztJQUNKLENBQUM7SUFFRCxJQUFJLE9BQU8sTUFBTSxDQUFDLFVBQVUsS0FBSyxVQUFVLEVBQUUsQ0FBQztRQUM1QyxNQUFNLElBQUksaUJBQWlCLENBQ3pCLDREQUE0RCxDQUM3RCxDQUFDO0lBQ0osQ0FBQztJQUVELE9BQU8sTUFBTTtTQUNWLGVBQWUsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDLENBQUM7U0FDMUMsTUFBTSxDQUFDLENBQUMsQ0FBQyxFQUFFLENBQUMsRUFBRSxFQUFFLENBQUMsR0FBRyxDQUFDLEdBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEVBQUUsRUFBRSxDQUFDLENBQUM7QUFDcEUsQ0FBQztBQUVELE1BQU0sVUFBVSxxQkFBcUI7SUFDbkMsT0FBTyxLQUFLLHdCQUF3QixFQUFFLEVBQUUsQ0FBQztBQUMzQyxDQUFDIn0=