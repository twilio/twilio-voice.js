'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

// @ts-nocheck
function request(method, params, callback) {
    var body = JSON.stringify(params.body || {});
    var headers = new Headers();
    params.headers = params.headers || [];
    Object.entries(params.headers).forEach(function (_a) {
        var headerName = _a[0], headerBody = _a[1];
        return headers.append(headerName, headerBody);
    });
    fetch(params.url, { body: body, headers: headers, method: method })
        .then(function (response) { return response.text(); }, callback)
        .then(function (responseText) { return callback(null, responseText); }, callback);
}
/**
 * Use XMLHttpRequest to get a network resource.
 * @param {String} method - HTTP Method
 * @param {Object} params - Request parameters
 * @param {String} params.url - URL of the resource
 * @param {Array}  params.headers - An array of headers to pass [{ headerName : headerBody }]
 * @param {Object} params.body - A JSON body to send to the resource
 * @returns {response}
 */
var Request = request;
/**
 * Sugar function for request('GET', params, callback);
 * @param {Object} params - Request parameters
 * @param {Request~get} callback - The callback that handles the response.
 */
Request.get = function get(params, callback) {
    return new this('GET', params, callback);
};
/**
 * Sugar function for request('POST', params, callback);
 * @param {Object} params - Request parameters
 * @param {Request~post} callback - The callback that handles the response.
 */
Request.post = function post(params, callback) {
    return new this('POST', params, callback);
};

exports.default = Request;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVxdWVzdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9yZXF1ZXN0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7Ozs7QUFBQTtBQUVBLFNBQVMsT0FBTyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsUUFBUSxFQUFBO0FBQ3ZDLElBQUEsSUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQztBQUM5QyxJQUFBLElBQU0sT0FBTyxHQUFHLElBQUksT0FBTyxFQUFFO0lBRTdCLE1BQU0sQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDLE9BQU8sSUFBSSxFQUFFO0lBQ3JDLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxVQUFDLEVBQXdCLEVBQUE7WUFBdkIsVUFBVSxHQUFBLEVBQUEsQ0FBQSxDQUFBLENBQUEsRUFBRSxVQUFVLEdBQUEsRUFBQSxDQUFBLENBQUEsQ0FBQTtBQUM3RCxRQUFBLE9BQUEsT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDO0FBQXRDLElBQUEsQ0FBc0MsQ0FBQztBQUV6QyxJQUFBLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFBLElBQUEsRUFBRSxPQUFPLEVBQUEsT0FBQSxFQUFFLE1BQU0sRUFBQSxNQUFBLEVBQUU7QUFDeEMsU0FBQSxJQUFJLENBQUMsVUFBQSxRQUFRLEVBQUEsRUFBSSxPQUFBLFFBQVEsQ0FBQyxJQUFJLEVBQUUsQ0FBQSxDQUFmLENBQWUsRUFBRSxRQUFRO0FBQzFDLFNBQUEsSUFBSSxDQUFDLFVBQUEsWUFBWSxFQUFBLEVBQUksT0FBQSxRQUFRLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxDQUFBLENBQTVCLENBQTRCLEVBQUUsUUFBUSxDQUFDO0FBQ2pFO0FBQ0E7Ozs7Ozs7O0FBUUc7QUFDSCxJQUFNLE9BQU8sR0FBRztBQUVoQjs7OztBQUlHO0FBQ0gsT0FBTyxDQUFDLEdBQUcsR0FBRyxTQUFTLEdBQUcsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFBO0lBQ3pDLE9BQU8sSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUM7QUFDMUMsQ0FBQztBQUVEOzs7O0FBSUc7QUFDSCxPQUFPLENBQUMsSUFBSSxHQUFHLFNBQVMsSUFBSSxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUE7SUFDM0MsT0FBTyxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQztBQUMzQyxDQUFDOzs7OyJ9
