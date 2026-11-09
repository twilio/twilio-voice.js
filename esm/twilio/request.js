import Log from './log.js';

// @ts-nocheck
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
        const headers = response && response.headers;
        const value = headers && typeof headers.get === 'function' ? headers.get('Retry-After') : null;
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
    const error = new Error(`Request failed with HTTP status ${status}`);
    error.status = status;
    error.responseText = responseText;
    if (typeof retryAfter === 'string') {
        error.retryAfter = retryAfter;
    }
    return error;
}
function request(method, params, callback) {
    const body = JSON.stringify(params.body || {});
    const headers = new Headers();
    params.headers = params.headers || [];
    Object.entries(params.headers).forEach(([headerName, headerBody]) => headers.append(headerName, headerBody));
    // The callback is invoked exactly once: with an error for a network-level
    // rejection or a non-2xx response (the error has a numeric `status`), or
    // with (null, responseText) for a 2xx response. `settle` is only called from
    // the two handlers of the final `.then` below, and a promise runs at most
    // one of them, at most once.
    const settle = (error, responseText) => {
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
        const retryAfter = getRetryAfter(response);
        // The body is only diagnostic here; a failed read still reports the status.
        return Promise.resolve()
            .then(() => response.text())
            .then(text => text, () => undefined)
            .then(text => { throw createHttpError(status, text, retryAfter); });
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

export { Request as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVxdWVzdC5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9yZXF1ZXN0LnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUE7QUFHQSxNQUFNLEdBQUcsR0FBRyxJQUFJLEdBQUcsQ0FBQyxTQUFTLENBQUM7QUFFOUI7Ozs7O0FBS0c7QUFDSCxTQUFTLFlBQVksQ0FBQyxRQUFRLEVBQUE7SUFDNUIsSUFBSSxRQUFRLElBQUksT0FBTyxRQUFRLENBQUMsRUFBRSxLQUFLLFNBQVMsRUFBRTtRQUNoRCxPQUFPLFFBQVEsQ0FBQyxFQUFFO0lBQ3BCO0FBQ0EsSUFBQSxNQUFNLE1BQU0sR0FBRyxRQUFRLElBQUksUUFBUSxDQUFDLE1BQU07QUFDMUMsSUFBQSxPQUFPLE9BQU8sTUFBTSxLQUFLLFFBQVEsS0FBSyxNQUFNLElBQUksR0FBRyxJQUFJLE1BQU0sR0FBRyxHQUFHLENBQUM7QUFDdEU7QUFFQTs7Ozs7Ozs7O0FBU0c7QUFDSCxTQUFTLGFBQWEsQ0FBQyxRQUFRLEVBQUE7QUFDN0IsSUFBQSxJQUFJO0FBQ0YsUUFBQSxNQUFNLE9BQU8sR0FBRyxRQUFRLElBQUksUUFBUSxDQUFDLE9BQU87UUFDNUMsTUFBTSxLQUFLLEdBQUcsT0FBTyxJQUFJLE9BQU8sT0FBTyxDQUFDLEdBQUcsS0FBSyxVQUFVLEdBQUcsT0FBTyxDQUFDLEdBQUcsQ0FBQyxhQUFhLENBQUMsR0FBRyxJQUFJO0FBQzlGLFFBQUEsT0FBTyxPQUFPLEtBQUssS0FBSyxRQUFRLEdBQUcsS0FBSyxHQUFHLFNBQVM7SUFDdEQ7SUFBRSxPQUFPLENBQUMsRUFBRTtBQUNWLFFBQUEsT0FBTyxTQUFTO0lBQ2xCO0FBQ0Y7QUFFQTs7Ozs7OztBQU9HO0FBQ0gsU0FBUyxlQUFlLENBQUMsTUFBTSxFQUFFLFlBQVksRUFBRSxVQUFVLEVBQUE7SUFDdkQsTUFBTSxLQUFLLEdBQUcsSUFBSSxLQUFLLENBQUMsQ0FBQSxnQ0FBQSxFQUFtQyxNQUFN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
