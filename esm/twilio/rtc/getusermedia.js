// @ts-nocheck
import { NotSupportedError } from '../errors';
import * as util from '../util';
function getUserMedia(constraints, options) {
    options = options || {};
    options.util = options.util || util;
    options.navigator = options.navigator
        || (typeof navigator !== 'undefined' ? navigator : null);
    return new Promise((resolve, reject) => {
        if (!options.navigator) {
            throw new NotSupportedError('getUserMedia is not supported');
        }
        switch ('function') {
            case typeof (options.navigator.mediaDevices && options.navigator.mediaDevices.getUserMedia):
                return resolve(options.navigator.mediaDevices.getUserMedia(constraints));
            case typeof options.navigator.webkitGetUserMedia:
                return options.navigator.webkitGetUserMedia(constraints, resolve, reject);
            case typeof options.navigator.mozGetUserMedia:
                return options.navigator.mozGetUserMedia(constraints, resolve, reject);
            case typeof options.navigator.getUserMedia:
                return options.navigator.getUserMedia(constraints, resolve, reject);
            default:
                throw new NotSupportedError('getUserMedia is not supported');
        }
    }).catch(e => {
        throw (options.util.isFirefox() && e.name === 'NotReadableError')
            ? new NotSupportedError('Firefox does not currently support opening multiple audio input tracks' +
                'simultaneously, even across different tabs.\n' +
                'Related Bugzilla thread: https://bugzilla.mozilla.org/show_bug.cgi?id=1299324')
            : e;
    });
}
export default getUserMedia;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0dXNlcm1lZGlhLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9ydGMvZ2V0dXNlcm1lZGlhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGNBQWM7QUFDZCxPQUFPLEVBQUUsaUJBQWlCLEVBQUUsTUFBTSxXQUFXLENBQUM7QUFDOUMsT0FBTyxLQUFLLElBQUksTUFBTSxTQUFTLENBQUM7QUFFaEMsU0FBUyxZQUFZLENBQUMsV0FBVyxFQUFFLE9BQU87SUFDeEMsT0FBTyxHQUFHLE9BQU8sSUFBSSxFQUFFLENBQUM7SUFDeEIsT0FBTyxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQztJQUNwQyxPQUFPLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxTQUFTO1dBQ2hDLENBQUMsT0FBTyxTQUFTLEtBQUssV0FBVyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRTNELE9BQU8sSUFBSSxPQUFPLENBQUMsQ0FBQyxPQUFPLEVBQUUsTUFBTSxFQUFFLEVBQUU7UUFDckMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUUsQ0FBQztZQUN2QixNQUFNLElBQUksaUJBQWlCLENBQUMsK0JBQStCLENBQUMsQ0FBQztRQUMvRCxDQUFDO1FBRUQsUUFBUSxVQUFVLEVBQUUsQ0FBQztZQUNuQixLQUFLLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLFlBQVksSUFBSSxPQUFPLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUM7Z0JBQ3pGLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1lBQzNFLEtBQUssT0FBTyxPQUFPLENBQUMsU0FBUyxDQUFDLGtCQUFrQjtnQkFDOUMsT0FBTyxPQUFPLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDNUUsS0FBSyxPQUFPLE9BQU8sQ0FBQyxTQUFTLENBQUMsZUFBZTtnQkFDM0MsT0FBTyxPQUFPLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxXQUFXLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQ3pFLEtBQUssT0FBTyxPQUFPLENBQUMsU0FBUyxDQUFDLFlBQVk7Z0JBQ3hDLE9BQU8sT0FBTyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztZQUN0RTtnQkFDRSxNQUFNLElBQUksaUJBQWlCLENBQUMsK0JBQStCLENBQUMsQ0FBQztRQUNqRSxDQUFDO0lBQ0gsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsQ0FBQyxFQUFFO1FBQ1gsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxrQkFBa0IsQ0FBQztZQUMvRCxDQUFDLENBQUMsSUFBSSxpQkFBaUIsQ0FBQyx3RUFBd0U7Z0JBQzlGLCtDQUErQztnQkFDL0MsK0VBQStFLENBQUM7WUFDbEYsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNSLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELGVBQWUsWUFBWSxDQUFDIn0=