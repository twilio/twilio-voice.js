"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2V0dXNlcm1lZGlhLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9ydGMvZ2V0dXNlcm1lZGlhLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsY0FBYztBQUNkLG9DQUE4QztBQUM5Qyw4QkFBZ0M7QUFFaEMsU0FBUyxZQUFZLENBQUMsV0FBVyxFQUFFLE9BQU87SUFDeEMsT0FBTyxHQUFHLE9BQU8sSUFBSSxFQUFFLENBQUM7SUFDeEIsT0FBTyxDQUFDLElBQUksR0FBRyxPQUFPLENBQUMsSUFBSSxJQUFJLElBQUksQ0FBQztJQUNwQyxPQUFPLENBQUMsU0FBUyxHQUFHLE9BQU8sQ0FBQyxTQUFTO1dBQ2hDLENBQUMsT0FBTyxTQUFTLEtBQUssV0FBVyxDQUFDLENBQUMsQ0FBQyxTQUFTLENBQUMsQ0FBQyxDQUFDLElBQUksQ0FBQyxDQUFDO0lBRTNELE9BQU8sSUFBSSxPQUFPLENBQUMsVUFBQyxPQUFPLEVBQUUsTUFBTTtRQUNqQyxJQUFJLENBQUMsT0FBTyxDQUFDLFNBQVMsRUFBRSxDQUFDO1lBQ3ZCLE1BQU0sSUFBSSwwQkFBaUIsQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO1FBQy9ELENBQUM7UUFFRCxRQUFRLFVBQVUsRUFBRSxDQUFDO1lBQ25CLEtBQUssT0FBTyxDQUFDLE9BQU8sQ0FBQyxTQUFTLENBQUMsWUFBWSxJQUFJLE9BQU8sQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLFlBQVksQ0FBQztnQkFDekYsT0FBTyxPQUFPLENBQUMsT0FBTyxDQUFDLFNBQVMsQ0FBQyxZQUFZLENBQUMsWUFBWSxDQUFDLFdBQVcsQ0FBQyxDQUFDLENBQUM7WUFDM0UsS0FBSyxPQUFPLE9BQU8sQ0FBQyxTQUFTLENBQUMsa0JBQWtCO2dCQUM5QyxPQUFPLE9BQU8sQ0FBQyxTQUFTLENBQUMsa0JBQWtCLENBQUMsV0FBVyxFQUFFLE9BQU8sRUFBRSxNQUFNLENBQUMsQ0FBQztZQUM1RSxLQUFLLE9BQU8sT0FBTyxDQUFDLFNBQVMsQ0FBQyxlQUFlO2dCQUMzQyxPQUFPLE9BQU8sQ0FBQyxTQUFTLENBQUMsZUFBZSxDQUFDLFdBQVcsRUFBRSxPQUFPLEVBQUUsTUFBTSxDQUFDLENBQUM7WUFDekUsS0FBSyxPQUFPLE9BQU8sQ0FBQyxTQUFTLENBQUMsWUFBWTtnQkFDeEMsT0FBTyxPQUFPLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxXQUFXLEVBQUUsT0FBTyxFQUFFLE1BQU0sQ0FBQyxDQUFDO1lBQ3RFO2dCQUNFLE1BQU0sSUFBSSwwQkFBaUIsQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO1FBQ2pFLENBQUM7SUFDSCxDQUFDLENBQUMsQ0FBQyxLQUFLLENBQUMsVUFBQSxDQUFDO1FBQ1IsTUFBTSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsU0FBUyxFQUFFLElBQUksQ0FBQyxDQUFDLElBQUksS0FBSyxrQkFBa0IsQ0FBQztZQUMvRCxDQUFDLENBQUMsSUFBSSwwQkFBaUIsQ0FBQyx3RUFBd0U7Z0JBQzlGLCtDQUErQztnQkFDL0MsK0VBQStFLENBQUM7WUFDbEYsQ0FBQyxDQUFDLENBQUMsQ0FBQztJQUNSLENBQUMsQ0FBQyxDQUFDO0FBQ0wsQ0FBQztBQUVELGtCQUFlLFlBQVksQ0FBQyJ9