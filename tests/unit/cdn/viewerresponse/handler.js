function isVoiceOrVideoDocs(uri) {
  return /^\/js\/(client|video|videotest)\//.test(uri);
}

function isHtmlResponse(response) {
  var ct = response.headers['content-type'];
  return !!(ct && ct.value && ct.value.toLowerCase().indexOf('text/html') === 0);
}

function handler(event) {
  // Current CloudFront Function only support ES5
  var request = event.request;
  var response = event.response;
  var headers = response.headers;
  var redirectUrl = headers['x-amz-website-redirect-location'];

  if (redirectUrl) {
    response.statusCode = 301;
    response.statusDescription = 'Moved Permanently';
    headers.location = { value: redirectUrl.value.replace(/^\/sdk\//, '/') };
    delete headers['x-amz-website-redirect-location'];
  }

  headers['access-control-allow-methods'] = { value: 'GET' };
  headers['access-control-allow-origin'] = { value: '*' };
  headers['access-control-max-age'] = { value: '3000' };

  if (request && isVoiceOrVideoDocs(request.uri) && isHtmlResponse(response)) {
    headers['content-security-policy'] = {
      value:
        "default-src 'self'; " +
        "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
        "script-src-attr 'none'; " +
        "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; " +
        "img-src 'self' data: https://img.shields.io https://dl.circleci.com; " +
        "connect-src 'self'; " +
        "font-src 'self' data: https://fonts.gstatic.com; " +
        "object-src 'none'; " +
        "base-uri 'self'; " +
        "frame-ancestors 'self'; " +
        "form-action 'self'"
    };
    headers['x-frame-options'] = { value: 'SAMEORIGIN' };
    headers['cross-origin-opener-policy'] = { value: 'same-origin' };
    headers['strict-transport-security'] = { value: 'max-age=63072000; includeSubDomains' };
    headers['x-content-type-options'] = { value: 'nosniff' };
    headers['referrer-policy'] = { value: 'strict-origin-when-cross-origin' };
  }

  return response;
}

// Do not include the following line when deploying to CloudFront Functions
module.exports = handler;
