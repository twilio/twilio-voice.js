"use strict";
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
Object.defineProperty(exports, "__esModule", { value: true });
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVxdWVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vcmVxdWVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUE7Ozs7R0FJRztBQUNILGNBQWM7O0FBRWQsU0FBUyxPQUFPLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxRQUFRO0lBQ3ZDLElBQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsQ0FBQztJQUMvQyxJQUFNLE9BQU8sR0FBRyxJQUFJLE9BQU8sRUFBRSxDQUFDO0lBRTlCLE1BQU0sQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUM7SUFDdEMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUMsRUFBd0I7WUFBdkIsVUFBVSxRQUFBLEVBQUUsVUFBVSxRQUFBO1FBQzdELE9BQUEsT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDO0lBQXRDLENBQXNDLENBQUMsQ0FBQztJQUUxQyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxFQUFFLElBQUksTUFBQSxFQUFFLE9BQU8sU0FBQSxFQUFFLE1BQU0sUUFBQSxFQUFFLENBQUM7U0FDekMsSUFBSSxDQUFDLFVBQUEsUUFBUSxJQUFJLE9BQUEsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFmLENBQWUsRUFBRSxRQUFRLENBQUM7U0FDM0MsSUFBSSxDQUFDLFVBQUEsWUFBWSxJQUFJLE9BQUEsUUFBUSxDQUFDLElBQUksRUFBRSxZQUFZLENBQUMsRUFBNUIsQ0FBNEIsRUFBRSxRQUFRLENBQUMsQ0FBQztBQUNsRSxDQUFDO0FBQ0Q7Ozs7Ozs7O0dBUUc7QUFDSCxJQUFNLE9BQU8sR0FBRyxPQUFPLENBQUM7QUFFeEI7Ozs7R0FJRztBQUNILE9BQU8sQ0FBQyxHQUFHLEdBQUcsU0FBUyxHQUFHLENBQUMsTUFBTSxFQUFFLFFBQVE7SUFDekMsT0FBTyxJQUFJLElBQUksQ0FBQyxLQUFLLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQzNDLENBQUMsQ0FBQztBQUVGOzs7O0dBSUc7QUFDSCxPQUFPLENBQUMsSUFBSSxHQUFHLFNBQVMsSUFBSSxDQUFDLE1BQU0sRUFBRSxRQUFRO0lBQzNDLE9BQU8sSUFBSSxJQUFJLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztBQUM1QyxDQUFDLENBQUM7QUFFRixrQkFBZSxPQUFPLENBQUMifQ==