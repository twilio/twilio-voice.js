'use strict';

var XHR = require('xmlhttprequest').XMLHttpRequest;

function request(method, params, callback) {
  var options = {};
  options.XMLHttpRequest = options.XMLHttpRequest || XHR;
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
 **/
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

module.exports = Request;