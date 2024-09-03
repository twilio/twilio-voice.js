const assert = require('assert');
const viewerResponseHandler = require('./handler');

describe('CDN Viewer Response', () => {
  [
    {
      name: 'x-amz-website-redirect-location does not exists',
      testHeaders: {},
      expectedResult: { 
        headers: {
          'access-control-allow-methods': { value: 'GET' },
          'access-control-allow-origin': { value: '*' },
          'access-control-max-age': { value: '3000' }
        }
      }
    },{
      name: 'there is another type of header present',
      testHeaders: { foo: { value: 'foo' } },
      expectedResult: {
        headers: {
          foo: { value: 'foo' },
          'access-control-allow-methods': { value: 'GET' },
          'access-control-allow-origin': { value: '*' },
          'access-control-max-age': { value: '3000' }
        }
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
        headers: {
          foo: { value: 'foo' },
          location: { value: '/js/client/v1.15/twilio.js' },
          'access-control-allow-methods': { value: 'GET' },
          'access-control-allow-origin': { value: '*' },
          'access-control-max-age': { value: '3000' }
        }
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
        headers: {
          foo: { value: 'foo' },
          location: { value: '/js/video/releases/2.28.1/docs' },
          'access-control-allow-methods': { value: 'GET' },
          'access-control-allow-origin': { value: '*' },
          'access-control-max-age': { value: '3000' }
        }
      }
    }
  ].forEach(({ name, testHeaders, expectedResult }) => {
    it(`should return proper response when ${name}`, () => {
      const result = viewerResponseHandler({ response: { headers: testHeaders } });
      assert.deepStrictEqual(result, expectedResult);
    });
  });
});
