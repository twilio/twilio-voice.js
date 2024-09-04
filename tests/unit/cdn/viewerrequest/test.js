const assert = require('assert');
const viewerRequestHandler = require('./handler');

describe('CDN Viewer Request', () => {
  [
    {
      testUri: '/js/client/v1.15/twilio.js',
      expectedUri: '/js/client/v1.15/twilio.js',
      unmodified: true,
    },{
      testUri: '/js/client/releases/1.15.1/twilio.js',
      expectedUri: '/js/client/releases/1.15.1/twilio.js',
      unmodified: true,
    },{
      testUri: '/js/video/latest/docs',
      expectedUri: '/js/video/latest/docs',
      unmodified: true,
    },{
      testUri: '//foo/bar/',
      expectedUri: '/foo/bar',
    },{
      testUri: '///foo/bar/',
      expectedUri: '/foo/bar',
    },{
      testUri: '////foo//bar//',
      expectedUri: '/foo/bar/',
    },{
      testUri: '//sdk/foo/bar/',
      expectedUri: '/foo/bar',
    },{
      testUri: '/sdk///foo/bar/',
      expectedUri: '/foo/bar',
    },{
      testUri: '//sdk//foo//bar//',
      expectedUri: '/foo/bar/',
    },{
      testUri: '/js/video/latest/docs/',
      expectedUri: '/js/video/latest/docs',
    },{
      testUri: '/js/video/releases/2.28.1/docs',
      expectedUri: '/js/video/releases/2.28.1/docs/index.html',
    },{
      testUri: '/js/video/releases/2.28.1/docs/',
      expectedUri: '/js/video/releases/2.28.1/docs/index.html',
    },{
      testUri: '/sdk/js/client/v1.15/twilio.js',
      expectedUri: '/js/client/v1.15/twilio.js',
    },{
      testUri: '/sdk/js/client/releases/1.15.1/twilio.js',
      expectedUri: '/js/client/releases/1.15.1/twilio.js',
    },{
      testUri: '/sdk/js/video/latest/docs',
      expectedUri: '/js/video/latest/docs',
    },{
      testUri: '/sdk/js/video/latest/docs/',
      expectedUri: '/js/video/latest/docs',
    },{
      testUri: '/sdk/js/video/releases/2.28.1/docs',
      expectedUri: '/js/video/releases/2.28.1/docs',
    },{
      testUri: '/sdk/js/video/releases/2.28.1/docs/',
      expectedUri: '/js/video/releases/2.28.1/docs',
    }
  ].forEach(({ testUri, expectedUri, unmodified }) => {
    it(testUri, () => {
      const result = viewerRequestHandler({ request: { uri: testUri }});
      assert.strictEqual(unmodified ? result.uri : result.headers.location.value, expectedUri);
    });
  });
});
