const assert = require('assert');
const viewerResponseHandler = require('./handler');

const EXPECTED_CSP =
  "default-src 'self'; " +
  "script-src 'self' 'unsafe-inline'; " +
  "script-src-attr 'none'; " +
  "style-src 'self' 'unsafe-inline'; " +
  "img-src 'self' data:; " +
  "connect-src 'self'; " +
  "font-src 'self' data:; " +
  "object-src 'none'; " +
  "base-uri 'self'; " +
  "frame-ancestors 'none'; " +
  "form-action 'self'";

const SECURITY_HEADERS = {
  'content-security-policy': { value: EXPECTED_CSP },
  'x-frame-options': { value: 'DENY' },
  'cross-origin-opener-policy': { value: 'same-origin' },
  'strict-transport-security': { value: 'max-age=63072000; includeSubDomains' },
  'x-content-type-options': { value: 'nosniff' },
  'referrer-policy': { value: 'strict-origin-when-cross-origin' },
};

const CORS_HEADERS = {
  'access-control-allow-methods': { value: 'GET' },
  'access-control-allow-origin': { value: '*' },
  'access-control-max-age': { value: '3000' },
};

describe('CDN Viewer Response', () => {
  [
    {
      name: 'x-amz-website-redirect-location does not exists',
      testHeaders: {},
      expectedResult: {
        headers: Object.assign({}, CORS_HEADERS)
      }
    },{
      name: 'there is another type of header present',
      testHeaders: { foo: { value: 'foo' } },
      expectedResult: {
        headers: Object.assign({ foo: { value: 'foo' } }, CORS_HEADERS)
      }
    },{
      name: 'x-amz-website-redirect-location is /sdk/js/client/v1.15/twilio.js',
      testHeaders: {
        foo: { value: 'foo' },
        'x-amz-website-redirect-location': { value: '/sdk/js/client/v1.15/twilio.js' },
      },
      expectedResult: {
        statusCode: 301,
        statusDescription: 'Moved Permanently',
        headers: Object.assign({
          foo: { value: 'foo' },
          location: { value: '/js/client/v1.15/twilio.js' },
        }, CORS_HEADERS)
      }
    },{
      name: 'x-amz-website-redirect-location is /sdk/js/video/releases/2.28.1/docs',
      testHeaders: {
        foo: { value: 'foo' },
        'x-amz-website-redirect-location': { value: '/sdk/js/video/releases/2.28.1/docs' },
      },
      expectedResult: {
        statusCode: 301,
        statusDescription: 'Moved Permanently',
        headers: Object.assign({
          foo: { value: 'foo' },
          location: { value: '/js/video/releases/2.28.1/docs' },
        }, CORS_HEADERS)
      }
    }
  ].forEach(({ name, testHeaders, expectedResult }) => {
    it(`should return proper response when ${name}`, () => {
      const result = viewerResponseHandler({ response: { headers: testHeaders } });
      assert.deepStrictEqual(result, expectedResult);
    });
  });

  describe('security headers', () => {
    [
      {
        name: '/js/video/releases/2.35.0/docs/index.html with text/html',
        uri: '/js/video/releases/2.35.0/docs/index.html',
        contentType: 'text/html; charset=utf-8',
        shouldApply: true,
      },
      {
        name: '/js/client/releases/1.15.1/docs/index.html with text/html',
        uri: '/js/client/releases/1.15.1/docs/index.html',
        contentType: 'text/html',
        shouldApply: true,
      },
      {
        name: '/js/videotest/releases/2.14.0/docs/index.html with text/html',
        uri: '/js/videotest/releases/2.14.0/docs/index.html',
        contentType: 'text/html',
        shouldApply: true,
      },
      {
        name: 'text/html content-type but upper-case header value',
        uri: '/js/video/releases/2.35.0/docs/index.html',
        contentType: 'TEXT/HTML',
        shouldApply: true,
      },
      {
        name: 'matching path but content-type is application/javascript',
        uri: '/js/video/releases/2.35.0/twilio-video.min.js',
        contentType: 'application/javascript',
        shouldApply: false,
      },
      {
        name: 'matching path but content-type header absent',
        uri: '/js/video/releases/2.35.0/docs/index.html',
        contentType: null,
        shouldApply: false,
      },
      {
        name: 'out-of-scope path (/js/chat/...) with text/html',
        uri: '/js/chat/releases/1.2.3/docs/index.html',
        contentType: 'text/html',
        shouldApply: false,
      },
      {
        name: 'out-of-scope path (/js/sync/...) with text/html',
        uri: '/js/sync/releases/1.2.3/docs/index.html',
        contentType: 'text/html',
        shouldApply: false,
      },
      {
        name: 'out-of-scope path (/js/flex-sdk/.../storybook/index.html) with text/html',
        uri: '/js/flex-sdk/releases/4.0.0/storybook/index.html',
        contentType: 'text/html',
        shouldApply: false,
      },
      {
        name: 'root path with text/html',
        uri: '/',
        contentType: 'text/html',
        shouldApply: false,
      },
      {
        name: 'no request object on the event',
        uri: undefined,
        contentType: 'text/html',
        shouldApply: false,
      },
    ].forEach(({ name, uri, contentType, shouldApply }) => {
      it(`should ${shouldApply ? '' : 'NOT '}apply security headers when ${name}`, () => {
        const headers = {};
        if (contentType) headers['content-type'] = { value: contentType };

        const event = { response: { headers } };
        if (uri !== undefined) event.request = { uri };

        const result = viewerResponseHandler(event);

        for (const key of Object.keys(SECURITY_HEADERS)) {
          if (shouldApply) {
            assert.deepStrictEqual(result.headers[key], SECURITY_HEADERS[key], `expected ${key} to be set`);
          } else {
            assert.strictEqual(result.headers[key], undefined, `expected ${key} to NOT be set`);
          }
        }

        // CORS headers should be set in every scenario
        for (const key of Object.keys(CORS_HEADERS)) {
          assert.deepStrictEqual(result.headers[key], CORS_HEADERS[key], `expected CORS ${key} to be set`);
        }
      });
    });

    it('should overwrite a weaker CSP already set by origin', () => {
      const event = {
        request: { uri: '/js/video/releases/2.35.0/docs/index.html' },
        response: {
          headers: {
            'content-type': { value: 'text/html' },
            'content-security-policy': { value: "default-src *" },
          }
        }
      };
      const result = viewerResponseHandler(event);
      assert.strictEqual(result.headers['content-security-policy'].value, EXPECTED_CSP);
    });
  });
});
