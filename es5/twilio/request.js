"use strict";
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVxdWVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vcmVxdWVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiO0FBQUEsY0FBYzs7QUFFZCxTQUFTLE9BQU8sQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLFFBQVE7SUFDdkMsSUFBTSxJQUFJLEdBQUcsSUFBSSxDQUFDLFNBQVMsQ0FBQyxNQUFNLENBQUMsSUFBSSxJQUFJLEVBQUUsQ0FBQyxDQUFDO0lBQy9DLElBQU0sT0FBTyxHQUFHLElBQUksT0FBTyxFQUFFLENBQUM7SUFFOUIsTUFBTSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMsT0FBTyxJQUFJLEVBQUUsQ0FBQztJQUN0QyxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsVUFBQyxFQUF3QjtZQUF2QixVQUFVLFFBQUEsRUFBRSxVQUFVLFFBQUE7UUFDN0QsT0FBQSxPQUFPLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUM7SUFBdEMsQ0FBc0MsQ0FBQyxDQUFDO0lBRTFDLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLEVBQUUsSUFBSSxNQUFBLEVBQUUsT0FBTyxTQUFBLEVBQUUsTUFBTSxRQUFBLEVBQUUsQ0FBQztTQUN6QyxJQUFJLENBQUMsVUFBQSxRQUFRLElBQUksT0FBQSxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQWYsQ0FBZSxFQUFFLFFBQVEsQ0FBQztTQUMzQyxJQUFJLENBQUMsVUFBQSxZQUFZLElBQUksT0FBQSxRQUFRLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxFQUE1QixDQUE0QixFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQ2xFLENBQUM7QUFDRDs7Ozs7Ozs7R0FRRztBQUNILElBQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQztBQUV4Qjs7OztHQUlHO0FBQ0gsT0FBTyxDQUFDLEdBQUcsR0FBRyxTQUFTLEdBQUcsQ0FBQyxNQUFNLEVBQUUsUUFBUTtJQUN6QyxPQUFPLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDM0MsQ0FBQyxDQUFDO0FBRUY7Ozs7R0FJRztBQUNILE9BQU8sQ0FBQyxJQUFJLEdBQUcsU0FBUyxJQUFJLENBQUMsTUFBTSxFQUFFLFFBQVE7SUFDM0MsT0FBTyxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQzVDLENBQUMsQ0FBQztBQUVGLGtCQUFlLE9BQU8sQ0FBQyJ9