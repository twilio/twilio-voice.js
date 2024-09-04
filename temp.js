function isUnpinned(uri) {
  return /^\/[^/]+\/[^/]+\/releases/.test(uri);
}

function isFolder(uri) {
  return /\/[^/.]+(\/)?$/.test(uri);
}

function handler(event) {
  var request = event.request;
  var uri = event.request.uri;
  var redirectUri = uri;
  
  if (isFolder(uri)) {
      redirectUri = redirectUri.replace(/\/$/, '');
      if (isUnpinned(uri)) {
          redirectUri = `${redirectUri}/index.html`;
      }
  }
  
  redirectUri = redirectUri.replace(/^\/sdk\//, '/');

  if (redirectUri !== uri) {
      return {
          statusCode: 301,
          statusDescription: 'Moved Permanently',
          headers: {
              location: { value: redirectUri },
              'access-control-allow-methods': { value: 'GET' },
              'access-control-allow-origin': { value: '*' },
              'access-control-max-age': { value: '3000' }
          }
      };
  }

  return request;
}
