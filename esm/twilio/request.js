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

export { Request as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVxdWVzdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9yZXF1ZXN0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBO0FBRUEsU0FBUyxPQUFPLENBQUMsTUFBTSxFQUFFLE1BQU0sRUFBRSxRQUFRLEVBQUE7QUFDdkMsSUFBQSxNQUFNLElBQUksR0FBRyxJQUFJLENBQUMsU0FBUyxDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUksRUFBRSxDQUFDO0FBQzlDLElBQUEsTUFBTSxPQUFPLEdBQUcsSUFBSSxPQUFPLEVBQUU7SUFFN0IsTUFBTSxDQUFDLE9BQU8sR0FBRyxNQUFNLENBQUMsT0FBTyxJQUFJLEVBQUU7QUFDckMsSUFBQSxNQUFNLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FBQyxPQUFPLENBQUMsQ0FBQyxPQUFPLENBQUMsQ0FBQyxDQUFDLFVBQVUsRUFBRSxVQUFVLENBQUMsS0FDOUQsT0FBTyxDQUFDLE1BQU0sQ0FBQyxVQUFVLEVBQUUsVUFBVSxDQUFDLENBQUM7QUFFekMsSUFBQSxLQUFLLENBQUMsTUFBTSxDQUFDLEdBQUcsRUFBRSxFQUFFLElBQUksRUFBRSxPQUFPLEVBQUUsTUFBTSxFQUFFO1NBQ3hDLElBQUksQ0FBQyxRQUFRLElBQUksUUFBUSxDQUFDLElBQUksRUFBRSxFQUFFLFFBQVE7QUFDMUMsU0FBQSxJQUFJLENBQUMsWUFBWSxJQUFJLFFBQVEsQ0FBQyxJQUFJLEVBQUUsWUFBWSxDQUFDLEVBQUUsUUFBUSxDQUFDO0FBQ2pFO0FBQ0E7Ozs7Ozs7O0FBUUc7QUFDSCxNQUFNLE9BQU8sR0FBRztBQUVoQjs7OztBQUlHO0FBQ0gsT0FBTyxDQUFDLEdBQUcsR0FBRyxTQUFTLEdBQUcsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFBO0lBQ3pDLE9BQU8sSUFBSSxJQUFJLENBQUMsS0FBSyxFQUFFLE1BQU0sRUFBRSxRQUFRLENBQUM7QUFDMUMsQ0FBQztBQUVEOzs7O0FBSUc7QUFDSCxPQUFPLENBQUMsSUFBSSxHQUFHLFNBQVMsSUFBSSxDQUFDLE1BQU0sRUFBRSxRQUFRLEVBQUE7SUFDM0MsT0FBTyxJQUFJLElBQUksQ0FBQyxNQUFNLEVBQUUsTUFBTSxFQUFFLFFBQVEsQ0FBQztBQUMzQyxDQUFDOzs7OyJ9
