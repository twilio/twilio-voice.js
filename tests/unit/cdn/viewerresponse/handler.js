function handler(event) {
  // Current CloudFront Function only support ES5
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

  return response;
}

// Do not include the following line when deploying to CloudFront Functions
module.exports = handler;
