"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
var errors_1 = require("../errors");
var util = require("../util");
function getUserMedia(constraints, options) {
    options = options || {};
    options.util = options.util || util;
    options.navigator = options.navigator
        || (typeof navigator !== 'undefined' ? navigator : null);
    return new Promise(function (resolve, reject) {
        if (!options.navigator) {
            throw new errors_1.NotSupportedError('getUserMedia is not supported');
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
                throw new errors_1.NotSupportedError('getUserMedia is not supported');
        }
    }).catch(function (e) {
        throw (options.util.isFirefox() && e.name === 'NotReadableError')
            ? new errors_1.NotSupportedError('Firefox does not currently support opening multiple audio input tracks' +
                'simultaneously, even across different tabs.\n' +
                'Related Bugzilla thread: https://bugzilla.mozilla.org/show_bug.cgi?id=1299324')
            : e;
    });
}
exports.default = getUserMedia;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0dXNlcm1lZGlhLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9ydGMvZ2V0dXNlcm1lZGlhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7Ozs7R0FJRztBQUNILGNBQWM7QUFDZCxvQ0FBOEM7QUFDOUMsOEJBQWdDO0FBRWhDLFNBQVMsWUFBWSxDQUFDLFdBQVcsRUFBRSxPQUFPO0lBQ3hDLE9BQU8sR0FBRyxPQUFPLElBQUksRUFBRSxDQUFDO0lBQ3hCLE9BQU8sQ0FBQyxJQUFJLEdBQUcsT0FBTyxDQUFDLElBQUksSUFBSSxJQUFJLENBQUM7SUFDcEMsT0FBTyxDQUFDLFNBQVMsR0FBRyxPQUFPLENBQUMsU0FBUztXQUNoQyxDQUFDLE9BQU8sU0FBUyxLQUFLLFdBQVcsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDLENBQUMsQ0FBQyxJQUFJLENBQUMsQ0FBQztJQUUzRCxPQUFPLElBQUksT0FBTyxDQUFDLFVBQUMsT0FBTyxFQUFFLE1BQU07UUFDakMsSUFBSSxDQUFDLE9BQU8sQ0FBQyxTQUFTLEVBQUU7WUFDdEIsTUFBTSxJQUFJLDBCQUFpQixDQUFDLCtCQUErQixDQUFDLENBQUM7U0FDOUQ7UUFFRCxRQUFRLFVBQVUsRUFBRTtZQUNsQixLQUFLLE9BQU8sQ0FBQyxPQUFPLENBQUMsU0FBUyxDQUFDLFlBQVksSUFBSSxPQUFPLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxZQUFZLENBQUM7Z0JBQ3pGLE9BQU8sT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQyxXQUFXLENBQUMsQ0FBQyxDQUFDO1lBQzNFLEtBQUssT0FBTyxPQUFPLENBQUMsU0FBUyxDQUFDLGtCQUFrQjtnQkFDOUMsT0FBTyxPQUFPLENBQUMsU0FBUyxDQUFDLGtCQUFrQixDQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDNUUsS0FBSyxPQUFPLE9BQU8sQ0FBQyxTQUFTLENBQUMsZUFBZTtnQkFDM0MsT0FBTyxPQUFPLENBQUMsU0FBUyxDQUFDLGVBQWUsQ0FBQyxXQUFXLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQ3pFLEtBQUssT0FBTyxPQUFPLENBQUMsU0FBUyxDQUFDLFlBQVk7Z0JBQ3hDLE9BQU8sT0FBTyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztZQUN0RTtnQkFDRSxNQUFNLElBQUksMEJBQWlCLENBQUMsK0JBQStCLENBQUMsQ0FBQztTQUNoRTtJQUNILENBQUMsQ0FBQyxDQUFDLEtBQUssQ0FBQyxVQUFBLENBQUM7UUFDUixNQUFNLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxTQUFTLEVBQUUsSUFBSSxDQUFDLENBQUMsSUFBSSxLQUFLLGtCQUFrQixDQUFDO1lBQy9ELENBQUMsQ0FBQyxJQUFJLDBCQUFpQixDQUFDLHdFQUF3RTtnQkFDOUYsK0NBQStDO2dCQUMvQywrRUFBK0UsQ0FBQztZQUNsRixDQUFDLENBQUMsQ0FBQyxDQUFDO0lBQ1IsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDO0FBRUQsa0JBQWUsWUFBWSxDQUFDIn0=