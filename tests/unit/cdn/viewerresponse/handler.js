function handler(event) {
  const response = event.response;
  const headers = response.headers;
  const redirectUrl = headers['x-amz-website-redirect-location'];

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

module.exports = handler;
