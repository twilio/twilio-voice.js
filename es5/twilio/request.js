"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
var xmlhttprequest_1 = require("xmlhttprequest");
function request(method, params, callback) {
    var options = {};
    options.XMLHttpRequest = options.XMLHttpRequest || xmlhttprequest_1.XMLHttpRequest;
    var xhr = new options.XMLHttpRequest();
    xhr.open(method, params.url, true);
    xhr.onreadystatechange = function onreadystatechange() {
        if (xhr.readyState !== 4) {
            return;
        }
        if (200 <= xhr.status && xhr.status < 300) {
            callback(null, xhr.responseText);
            return;
        }
        callback(new Error(xhr.responseText));
    };
    // tslint:disable-next-line
    for (var headerName in params.headers) {
        xhr.setRequestHeader(headerName, params.headers[headerName]);
    }
    xhr.send(JSON.stringify(params.body));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVxdWVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vcmVxdWVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBOzs7O0dBSUc7QUFDSCxjQUFjO0FBQ2QsaURBQXVEO0FBRXZELFNBQVMsT0FBTyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsUUFBUTtJQUN2QyxJQUFNLE9BQU8sR0FBRyxFQUFFLENBQUM7SUFDbkIsT0FBTyxDQUFDLGNBQWMsR0FBRyxPQUFPLENBQUMsY0FBYyxJQUFJLCtCQUFHLENBQUM7SUFDdkQsSUFBTSxHQUFHLEdBQUcsSUFBSSxPQUFPLENBQUMsY0FBYyxFQUFFLENBQUM7SUFFekMsR0FBRyxDQUFDLElBQUksQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLEdBQUcsRUFBRSxJQUFJLENBQUMsQ0FBQztJQUNuQyxHQUFHLENBQUMsa0JBQWtCLEdBQUcsU0FBUyxrQkFBa0I7UUFDbEQsSUFBSSxHQUFHLENBQUMsVUFBVSxLQUFLLENBQUMsRUFBRTtZQUFFLE9BQU87U0FBRTtRQUVyQyxJQUFJLEdBQUcsSUFBSSxHQUFHLENBQUMsTUFBTSxJQUFJLEdBQUcsQ0FBQyxNQUFNLEdBQUcsR0FBRyxFQUFFO1lBQ3pDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDLFlBQVksQ0FBQyxDQUFDO1lBQ2pDLE9BQU87U0FDUjtRQUVELFFBQVEsQ0FBQyxJQUFJLEtBQUssQ0FBQyxHQUFHLENBQUMsWUFBWSxDQUFDLENBQUMsQ0FBQztJQUN4QyxDQUFDLENBQUM7SUFDRiwyQkFBMkI7SUFDM0IsS0FBSyxJQUFNLFVBQVUsSUFBSSxNQUFNLENBQUMsT0FBTyxFQUFFO1FBQ3ZDLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQyxVQUFVLEVBQUUsTUFBTSxDQUFDLE9BQU8sQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDO0tBQzlEO0lBRUQsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsQ0FBQyxDQUFDO0FBQ3hDLENBQUM7QUFDRDs7Ozs7Ozs7R0FRRztBQUNILElBQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQztBQUV4Qjs7OztHQUlHO0FBQ0gsT0FBTyxDQUFDLEdBQUcsR0FBRyxTQUFTLEdBQUcsQ0FBQyxNQUFNLEVBQUUsUUFBUTtJQUN6QyxPQUFPLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDM0MsQ0FBQyxDQUFDO0FBRUY7Ozs7R0FJRztBQUNILE9BQU8sQ0FBQyxJQUFJLEdBQUcsU0FBUyxJQUFJLENBQUMsTUFBTSxFQUFFLFFBQVE7SUFDM0MsT0FBTyxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQzVDLENBQUMsQ0FBQztBQUVGLGtCQUFlLE9BQU8sQ0FBQyJ9