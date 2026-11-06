// @ts-nocheck
import Log from './log';

const log = new Log('Request');

/**
 * Whether a fetch Response is a 2xx response. Uses `response.ok` when it is a
 * boolean, otherwise derives it from `response.status`.
 * @param {Response} response
 * @returns {boolean}
 */
function isOkResponse(response) {
  if (response && typeof response.ok === 'boolean') {
    return response.ok;
  }
  const status = response && response.status;
  return typeof status !== 'number' || (status >= 200 && status < 300);
}

/**
 * Create the error passed to the callback for a non-2xx HTTP response.
 * @param {number} status
 * @param {string} [responseText]
 * @returns {Error} An Error with a numeric `status` property.
 */
function createHttpError(status, responseText) {
  const error = new Error(`Request failed with HTTP status ${status}`);
  error.status = status;
  error.responseText = responseText;
  return error;
}

function request(method, params, callback) {
  const body = JSON.stringify(params.body || {});
  const headers = new Headers();

  params.headers = params.headers || [];
  Object.entries(params.headers).forEach(([headerName, headerBody]) =>
    headers.append(headerName, headerBody));

  // The callback is invoked exactly once: with an error for a network-level
  // rejection or a non-2xx response (the error has a numeric `status`), or
  // with (null, responseText) for a 2xx response. `settle` is only called from
  // the two handlers of the final `.then` below, and a promise runs at most
  // one of them, at most once.
  const settle = (error, responseText) => {
    try {
      callback(error, responseText);
    } catch (e) {
      // Keep a throwing callback from becoming an unhandled rejection.
      log.error('Request callback threw an error', e);
    }
  };

  // `params.signal` (optional) lets the caller abort the request, e.g. on a
  // timeout. An abort rejects fetch and is reported like a network error.
  const init = { body, headers, method };
  if (params.signal) {
    init.signal = params.signal;
  }

  fetch(params.url, init)
    .then(response => {
      if (isOkResponse(response)) {
        return response.text();
      }
      const status = response.status;
      // The body is only diagnostic here; a failed read still reports the status.
      return Promise.resolve()
        .then(() => response.text())
        .then(text => text, () => undefined)
        .then(text => { throw createHttpError(status, text); });
    })
    .then(responseText => settle(null, responseText), error => settle(error));
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
