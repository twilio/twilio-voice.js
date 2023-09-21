/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
function request(method, params, callback) {
    const body = JSON.stringify(params.body || {});
    const headers = new Headers();
    params.headers = params.headers || [];
    Object.entries(params.headers).forEach(([headerName, headerBody]) => headers.append(headerName, headerBody));
    fetch(params.url, { body, headers, method })
        .then(response => response.text(), callback)
        .then(responseText => callback(null, responseText), callback);
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
const Request = request;
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
export default Request;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVxdWVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vcmVxdWVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQTs7OztHQUlHO0FBQ0gsY0FBYztBQUVkLFNBQVMsT0FBTyxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsUUFBUTtJQUN2QyxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDLENBQUM7SUFDL0MsTUFBTSxPQUFPLEdBQUcsSUFBSSxPQUFPLEVBQUUsQ0FBQztJQUU5QixNQUFNLENBQUMsT0FBTyxHQUFHLE1BQU0sQ0FBQyxPQUFPLElBQUksRUFBRSxDQUFDO0lBQ3RDLE1BQU0sQ0FBQyxPQUFPLENBQUMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxDQUFDLE9BQU8sQ0FBQyxDQUFDLENBQUMsVUFBVSxFQUFFLFVBQVUsQ0FBQyxFQUFFLEVBQUUsQ0FDbEUsT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUMsQ0FBQztJQUUxQyxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFLENBQUM7U0FDekMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxFQUFFLENBQUMsUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLFFBQVEsQ0FBQztTQUMzQyxJQUFJLENBQUMsWUFBWSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLFlBQVksQ0FBQyxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQ2xFLENBQUM7QUFDRDs7Ozs7Ozs7R0FRRztBQUNILE1BQU0sT0FBTyxHQUFHLE9BQU8sQ0FBQztBQUV4Qjs7OztHQUlHO0FBQ0gsT0FBTyxDQUFDLEdBQUcsR0FBRyxTQUFTLEdBQUcsQ0FBQyxNQUFNLEVBQUUsUUFBUTtJQUN6QyxPQUFPLElBQUksSUFBSSxDQUFDLEtBQUssRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDM0MsQ0FBQyxDQUFDO0FBRUY7Ozs7R0FJRztBQUNILE9BQU8sQ0FBQyxJQUFJLEdBQUcsU0FBUyxJQUFJLENBQUMsTUFBTSxFQUFFLFFBQVE7SUFDM0MsT0FBTyxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQyxDQUFDO0FBQzVDLENBQUMsQ0FBQztBQUVGLGVBQWUsT0FBTyxDQUFDIn0=