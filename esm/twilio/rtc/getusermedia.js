import { NotSupportedError } from '../errors/index.js';
import * as util from '../util.js';

// @ts-nocheck
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

export { getUserMedia as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0dXNlcm1lZGlhLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9nZXR1c2VybWVkaWEudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUE7QUFJQSxTQUFTLFlBQVksQ0FBQyxXQUFXLEVBQUUsT0FBTyxFQUFBO0FBQ3hDLElBQUEsT0FBTyxHQUFHLE9BQU8sSUFBSSxFQUFFO0lBQ3ZCLE9BQU8sQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksSUFBSSxJQUFJO0FBQ25DLElBQUEsT0FBTyxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUM7QUFDdkIsWUFBQyxPQUFPLFNBQVMsS0FBSyxXQUFXLEdBQUcsU0FBUyxHQUFHLElBQUksQ0FBQztJQUUxRCxPQUFPLElBQUksT0FBTyxDQUFDLENBQUMsT0FBTyxFQUFFLE1BQU0sS0FBSTtBQUNyQyxRQUFBLElBQUksQ0FBQyxPQUFPLENBQUMsU0FBUyxFQUFFO0FBQ3RCLFlBQUEsTUFBTSxJQUFJLGlCQUFpQixDQUFDLCtCQUErQixDQUFDO1FBQzlEO1FBRUEsUUFBUSxVQUFVO0FBQ2hCLFlBQUEsS0FBSyxRQUFRLE9BQU8sQ0FBQyxTQUFTLENBQUMsWUFBWSxJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQztBQUN6RixnQkFBQSxPQUFPLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUMsV0FBVyxDQUFDLENBQUM7QUFDMUUsWUFBQSxLQUFLLE9BQU8sT0FBTyxDQUFDLFNBQVMsQ0FBQyxrQkFBa0I7QUFDOUMsZ0JBQUEsT0FBTyxPQUFPLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDO0FBQzNFLFlBQUEsS0FBSyxPQUFPLE9BQU8sQ0FBQyxTQUFTLENBQUMsZUFBZTtBQUMzQyxnQkFBQSxPQUFPLE9BQU8sQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDO0FBQ3hFLFlBQUEsS0FBSyxPQUFPLE9BQU8sQ0FBQyxTQUFTLENBQUMsWUFBWTtBQUN4QyxnQkFBQSxPQUFPLE9BQU8sQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDO0FBQ3JFLFlBQUE7QUFDRSxnQkFBQSxNQUFNLElBQUksaUJBQWlCLENBQUMsK0JBQStCLENBQUM7O0FBRWxFLElBQUEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLENBQUMsSUFBRztBQUNYLFFBQUEsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxrQkFBa0I7QUFDOUQsY0FBRSxJQUFJLGlCQUFpQixDQUFDLHdFQUF3RTtnQkFDOUYsK0NBQStDO0FBQy9DLGdCQUFBLCtFQUErRTtjQUMvRSxDQUFDO0FBQ1AsSUFBQSxDQUFDLENBQUM7QUFDSjs7OzsifQ==
