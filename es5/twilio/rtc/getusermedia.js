'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var index = require('../errors/index.js');
var util = require('../util.js');

// @ts-nocheck
function getUserMedia(constraints, options) {
    options = options || {};
    options.util = options.util || util;
    options.navigator = options.navigator
        || (typeof navigator !== 'undefined' ? navigator : null);
    return new Promise(function (resolve, reject) {
        if (!options.navigator) {
            throw new index.NotSupportedError('getUserMedia is not supported');
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
                throw new index.NotSupportedError('getUserMedia is not supported');
        }
    }).catch(function (e) {
        throw (options.util.isFirefox() && e.name === 'NotReadableError')
            ? new index.NotSupportedError('Firefox does not currently support opening multiple audio input tracks' +
                'simultaneously, even across different tabs.\n' +
                'Related Bugzilla thread: https://bugzilla.mozilla.org/show_bug.cgi?id=1299324')
            : e;
    });
}

exports.default = getUserMedia;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0dXNlcm1lZGlhLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9nZXR1c2VybWVkaWEudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOlsiTm90U3VwcG9ydGVkRXJyb3IiXSwibWFwcGluZ3MiOiI7Ozs7Ozs7QUFBQTtBQUlBLFNBQVMsWUFBWSxDQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUE7QUFDeEMsSUFBQSxPQUFPLEdBQUcsT0FBTyxJQUFJLEVBQUU7SUFDdkIsT0FBTyxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxJQUFJLElBQUk7QUFDbkMsSUFBQSxPQUFPLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQztBQUN2QixZQUFDLE9BQU8sU0FBUyxLQUFLLFdBQVcsR0FBRyxTQUFTLEdBQUcsSUFBSSxDQUFDO0FBRTFELElBQUEsT0FBTyxJQUFJLE9BQU8sQ0FBQyxVQUFDLE9BQU8sRUFBRSxNQUFNLEVBQUE7QUFDakMsUUFBQSxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRTtBQUN0QixZQUFBLE1BQU0sSUFBSUEsdUJBQWlCLENBQUMsK0JBQStCLENBQUM7UUFDOUQ7UUFFQSxRQUFRLFVBQVU7QUFDaEIsWUFBQSxLQUFLLFFBQVEsT0FBTyxDQUFDLFNBQVMsQ0FBQyxZQUFZLElBQUksT0FBTyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDO0FBQ3pGLGdCQUFBLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQztBQUMxRSxZQUFBLEtBQUssT0FBTyxPQUFPLENBQUMsU0FBUyxDQUFDLGtCQUFrQjtBQUM5QyxnQkFBQSxPQUFPLE9BQU8sQ0FBQyxTQUFTLENBQUMsa0JBQWtCLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUM7QUFDM0UsWUFBQSxLQUFLLE9BQU8sT0FBTyxDQUFDLFNBQVMsQ0FBQyxlQUFlO0FBQzNDLGdCQUFBLE9BQU8sT0FBTyxDQUFDLFNBQVMsQ0FBQyxlQUFlLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUM7QUFDeEUsWUFBQSxLQUFLLE9BQU8sT0FBTyxDQUFDLFNBQVMsQ0FBQyxZQUFZO0FBQ3hDLGdCQUFBLE9BQU8sT0FBTyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUM7QUFDckUsWUFBQTtBQUNFLGdCQUFBLE1BQU0sSUFBSUEsdUJBQWlCLENBQUMsK0JBQStCLENBQUM7O0FBRWxFLElBQUEsQ0FBQyxDQUFDLENBQUMsS0FBSyxDQUFDLFVBQUEsQ0FBQyxFQUFBO0FBQ1IsUUFBQSxNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLGtCQUFrQjtBQUM5RCxjQUFFLElBQUlBLHVCQUFpQixDQUFDLHdFQUF3RTtnQkFDOUYsK0NBQStDO0FBQy9DLGdCQUFBLCtFQUErRTtjQUMvRSxDQUFDO0FBQ1AsSUFBQSxDQUFDLENBQUM7QUFDSjs7OzsifQ==
