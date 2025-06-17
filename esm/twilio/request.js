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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVxdWVzdC5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vcmVxdWVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiQUFBQSxjQUFjO0FBRWQsU0FBUyxPQUFPLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxRQUFRO0lBQ3ZDLE1BQU0sSUFBSSxHQUFHLElBQUksQ0FBQyxTQUFTLENBQUMsTUFBTSxDQUFDLElBQUksSUFBSSxFQUFFLENBQUMsQ0FBQztJQUMvQyxNQUFNLE9BQU8sR0FBRyxJQUFJLE9BQU8sRUFBRSxDQUFDO0lBRTlCLE1BQU0sQ0FBQyxPQUFPLEdBQUcsTUFBTSxDQUFDLE9BQU8sSUFBSSxFQUFFLENBQUM7SUFDdEMsTUFBTSxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsT0FBTyxDQUFDLENBQUMsT0FBTyxDQUFDLENBQUMsQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDLEVBQUUsRUFBRSxDQUNsRSxPQUFPLENBQUMsTUFBTSxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsQ0FBQyxDQUFDO0lBRTFDLEtBQUssQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFLEVBQUUsSUFBSSxFQUFFLE9BQU8sRUFBRSxNQUFNLEVBQUUsQ0FBQztTQUN6QyxJQUFJLENBQUMsUUFBUSxDQUFDLEVBQUUsQ0FBQyxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUUsUUFBUSxDQUFDO1NBQzNDLElBQUksQ0FBQyxZQUFZLENBQUMsRUFBRSxDQUFDLFFBQVEsQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDbEUsQ0FBQztBQUNEOzs7Ozs7OztHQVFHO0FBQ0gsTUFBTSxPQUFPLEdBQUcsT0FBTyxDQUFDO0FBRXhCOzs7O0dBSUc7QUFDSCxPQUFPLENBQUMsR0FBRyxHQUFHLFNBQVMsR0FBRyxDQUFDLE1BQU0sRUFBRSxRQUFRO0lBQ3pDLE9BQU8sSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUMsQ0FBQztBQUMzQyxDQUFDLENBQUM7QUFFRjs7OztHQUlHO0FBQ0gsT0FBTyxDQUFDLElBQUksR0FBRyxTQUFTLElBQUksQ0FBQyxNQUFNLEVBQUUsUUFBUTtJQUMzQyxPQUFPLElBQUksSUFBSSxDQUFDLE1BQU0sRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUM7QUFDNUMsQ0FBQyxDQUFDO0FBRUYsZUFBZSxPQUFPLENBQUMifQ==