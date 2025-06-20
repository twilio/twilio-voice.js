// @ts-nocheck

function request(method, params, callback) {
  const body = JSON.stringify(params.body || {});
  const headers = new Headers();

  params.headers = params.headers || [];
  Object.entries(params.headers).forEach(([headerName, headerBody]) =>
    headers.append(headerName, headerBody));

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
