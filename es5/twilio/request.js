'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var log$1 = require('./log.js');

// @ts-nocheck
var log = new log$1.default('Request');
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
    var status = response && response.status;
    return typeof status !== 'number' || (status >= 200 && status < 300);
}
/**
 * The raw `Retry-After` header of a fetch Response, if it can be read.
 *
 * In browsers a cross-origin response exposes `Retry-After` only when the
 * server sends `Access-Control-Expose-Headers: Retry-After`; otherwise
 * `headers.get` returns null. eventgw.twilio.com did not expose it when this
 * was written (checked 2026-11-09).
 * @param {Response} response
 * @returns {string|undefined}
 */
function getRetryAfter(response) {
    try {
        var headers = response && response.headers;
        var value = headers && typeof headers.get === 'function' ? headers.get('Retry-After') : null;
        return typeof value === 'string' ? value : undefined;
    }
    catch (e) {
        return undefined;
    }
}
/**
 * Create the error passed to the callback for a non-2xx HTTP response.
 * @param {number} status
 * @param {string} [responseText]
 * @param {string} [retryAfter] - The raw `Retry-After` header, if any.
 * @returns {Error} An Error with a numeric `status` property, and a
 *   `retryAfter` string property when the response had `Retry-After`.
 */
function createHttpError(status, responseText, retryAfter) {
    var error = new Error("Request failed with HTTP status ".concat(status));
    error.status = status;
    error.responseText = responseText;
    if (typeof retryAfter === 'string') {
        error.retryAfter = retryAfter;
    }
    return error;
}
function request(method, params, callback) {
    var body = JSON.stringify(params.body || {});
    var headers = new Headers();
    params.headers = params.headers || [];
    Object.entries(params.headers).forEach(function (_a) {
        var headerName = _a[0], headerBody = _a[1];
        return headers.append(headerName, headerBody);
    });
    // The callback is invoked exactly once: with an error for a network-level
    // rejection or a non-2xx response (the error has a numeric `status`), or
    // with (null, responseText) for a 2xx response. `settle` is only called from
    // the two handlers of the final `.then` below, and a promise runs at most
    // one of them, at most once.
    var settle = function (error, responseText) {
        try {
            callback(error, responseText);
        }
        catch (e) {
            // Keep a throwing callback from becoming an unhandled rejection.
            log.error('Request callback threw an error', e);
        }
    };
    // `params.signal` (optional) lets the caller abort the request, e.g. on a
    // timeout. An abort rejects fetch and is reported like a network error.
    var init = { body: body, headers: headers, method: method };
    if (params.signal) {
        init.signal = params.signal;
    }
    fetch(params.url, init)
        .then(function (response) {
        if (isOkResponse(response)) {
            return response.text();
        }
        var status = response.status;
        var retryAfter = getRetryAfter(response);
        // The body is only diagnostic here; a failed read still reports the status.
        return Promise.resolve()
            .then(function () { return response.text(); })
            .then(function (text) { return text; }, function () { return undefined; })
            .then(function (text) { throw createHttpError(status, text, retryAfter); });
    })
        .then(function (responseText) { return settle(null, responseText); }, function (error) { return settle(error); });
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVxdWVzdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9yZXF1ZXN0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIkxvZyJdLCJtYXBwaW5ncyI6Ijs7Ozs7O0FBQUE7QUFHQSxJQUFNLEdBQUcsR0FBRyxJQUFJQSxhQUFHLENBQUMsU0FBUyxDQUFDO0FBRTlCOzs7OztBQUtHO0FBQ0gsU0FBUyxZQUFZLENBQUMsUUFBUSxFQUFBO0lBQzVCLElBQUksUUFBUSxJQUFJLE9BQU8sUUFBUSxDQUFDLEVBQUUsS0FBSyxTQUFTLEVBQUU7UUFDaEQsT0FBTyxRQUFRLENBQUMsRUFBRTtJQUNwQjtBQUNBLElBQUEsSUFBTSxNQUFNLEdBQUcsUUFBUSxJQUFJLFFBQVEsQ0FBQyxNQUFNO0FBQzFDLElBQUEsT0FBTyxPQUFPLE1BQU0sS0FBSyxRQUFRLEtBQUssTUFBTSxJQUFJLEdBQUcsSUFBSSxNQUFNLEdBQUcsR0FBRyxDQUFDO0FBQ3RFO0FBRUE7Ozs7Ozs7OztBQVNHO0FBQ0gsU0FBUyxhQUFhLENBQUMsUUFBUSxFQUFBO0FBQzdCLElBQUEsSUFBSTtBQUNGLFFBQUEsSUFBTSxPQUFPLEdBQUcsUUFBUSxJQUFJLFFBQVEsQ0FBQyxPQUFPO1FBQzVDLElBQU0sS0FBSyxHQUFHLE9BQU8sSUFBSSxPQUFPLE9BQU8sQ0FBQyxHQUFHLEtBQUssVUFBVSxHQUFHLE9BQU8sQ0FBQyxHQUFHLENBQUMsYUFBYSxDQUFDLEdBQUcsSUFBSTtBQUM5RixRQUFBLE9BQU8sT0FBTyxLQUFLLEtBQUssUUFBUSxHQUFHLEtBQUssR0FBRyxTQUFTO0lBQ3REO0lBQUUsT0FBTyxDQUFDLEVBQUU7QUFDVixRQUFBLE9BQU8sU0FBUztJQUNsQjtBQUNGO0FBRUE7Ozs7Ozs7QUFPRztBQUNILFNBQVMsZUFBZSxDQUFDLE1BQU0sRUFBRSxZQUFZLEVBQUUsVUFBVSxFQUFBO0lBQ3ZELElBQU0sS0FBSyxHQUFHLElBQUksS0FBSyxDQUFDLGtDQUFBLENBQUEs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
