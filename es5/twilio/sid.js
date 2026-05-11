'use strict';

var index = require('./errors/index.js');

/**
 * Generates a 128-bit long random string that is formatted as a 32 long string
 * of characters where each character is from the set:
 * [0,1,2,3,4,5,6,7,8,9,a,b,c,d,e,f].
 */
function generateRandomizedString() {
    if (typeof window !== 'object') {
        throw new index.NotSupportedError('This platform is not supported.');
    }
    var crypto = window.crypto;
    if (typeof crypto !== 'object') {
        throw new index.NotSupportedError('The `crypto` module is not available on this platform.');
    }
    if (typeof crypto.getRandomValues !== 'function') {
        throw new index.NotSupportedError('The function `crypto.getRandomValues` is not available on this ' +
            'platform.');
    }
    if (typeof window.Uint8Array !== 'function') {
        throw new index.NotSupportedError('The `Uint8Array` module is not available on this platform.');
    }
    return crypto
        .getRandomValues(new window.Uint8Array(16))
        .reduce(function (r, n) { return "".concat(r).concat(n.toString(16).padStart(2, '0')); }, '');
}
function generateVoiceEventSid() {
    return "KX".concat(generateRandomizedString());
}

exports.generateVoiceEventSid = generateVoiceEventSid;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2lkLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL3NpZC50cyJdLCJzb3VyY2VzQ29udGVudCI6W251bGxdLCJuYW1lcyI6WyJOb3RTdXBwb3J0ZWRFcnJvciJdLCJtYXBwaW5ncyI6Ijs7OztBQUVBOzs7O0FBSUc7QUFDSCxTQUFTLHdCQUF3QixHQUFBO0FBQy9CLElBQUEsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLEVBQUU7QUFDOUIsUUFBQSxNQUFNLElBQUlBLHVCQUFpQixDQUFDLGlDQUFpQyxDQUFDO0lBQ2hFO0FBRVEsSUFBQSxJQUFBLE1BQU0sR0FBSyxNQUFNLENBQUEsTUFBWDtBQUNkLElBQUEsSUFBSSxPQUFPLE1BQU0sS0FBSyxRQUFRLEVBQUU7QUFDOUIsUUFBQSxNQUFNLElBQUlBLHVCQUFpQixDQUN6Qix3REFBd0QsQ0FDekQ7SUFDSDtBQUVBLElBQUEsSUFBSSxPQUFPLE1BQU0sQ0FBQyxlQUFlLEtBQUssVUFBVSxFQUFFO1FBQ2hELE1BQU0sSUFBSUEsdUJBQWlCLENBQ3pCLGlFQUFpRTtBQUNqRSxZQUFBLFdBQVcsQ0FDWjtJQUNIO0FBRUEsSUFBQSxJQUFJLE9BQU8sTUFBTSxDQUFDLFVBQVUsS0FBSyxVQUFVLEVBQUU7QUFDM0MsUUFBQSxNQUFNLElBQUlBLHVCQUFpQixDQUN6Qiw0REFBNEQsQ0FDN0Q7SUFDSDtBQUVBLElBQUEsT0FBTztTQUNKLGVBQWUsQ0FBQyxJQUFJLE1BQU0sQ0FBQyxVQUFVLENBQUMsRUFBRSxDQUFDO0FBQ3pDLFNBQUEsTUFBTSxDQUFDLFVBQUMsQ0FBQyxFQUFFLENBQUMsRUFBQSxFQUFLLE9BQUEsRUFBQSxDQUFBLE1BQUEsQ0FBRyxDQUFDLENBQUEsQ0FBQSxNQUFBLENBQUcsQ0FBQyxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsQ0FBQyxRQUFRLENBQUMsQ0FBQyxFQUFFLEdBQUcsQ0FBQyxDQUFFLENBQUEsQ0FBeEMsQ0FBd0MsRUFBRSxFQUFFLENBQUM7QUFDbkU7U0FFZ0IscUJBQXFCLEdBQUE7QUFDbkMsSUFBQSxPQUFPLElBQUEsQ0FBQSxNQUFBLENBQUssd0JBQXdCLEVBQUUsQ0FBRTtBQUMxQzs7OzsifQ==
