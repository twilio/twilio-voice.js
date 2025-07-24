const assert = require('assert');
const sinon = require('sinon');
const { EventEmitter } = require('events');

const util = require('../lib/twilio/util');

describe('Util', () => {
  describe('isFirefox', () => {
    it('correctly parses non firefox user agent strings', () => {
      assert(!util.isFirefox({ userAgent: 'Mozilla/5.0 (Linux; U; Android 4.1.1; en-gb; Build/KLP) AppleWebKit/534.30 (KHTML, like Gecko) Version/4.0 Safari/534.30' }));
      assert(!util.isFirefox({ userAgent: 'Mozilla/5.0 (Linux; Android 4.4; Nexus 5 Build/_BuildID_) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/30.0.0.0 Mobile Safari/537.36' }));
      assert(!util.isFirefox({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 Safari/537.36' }));
      assert(!util.isFirefox({ userAgent: 'Mozilla/5.0 (Windows NT 6.1; WOW64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 Safari/537.36' }));
      assert(!util.isFirefox({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_2) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.95 Safari/537.36' }));
      assert(!util.isFirefox({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_2) AppleWebKit/602.3.12 (KHTML, like Gecko) Version/10.0.2 Safari/602.3.12' }));
      assert(!util.isFirefox({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/55.0.2883.87 Safari/537.36' }));
      assert(!util.isFirefox({ userAgent: 'Mozilla/5.0 (Windows NT 6.1; WOW64; Trident/7.0; rv:11.0) like Gecko' }));
      assert(!util.isFirefox({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246' }));
      assert(!util.isFirefox({ userAgent: 'Mozilla/5.0 (X11; CrOS x86_64 6783.1.0) AppleWebKit/537.36 (KHTML, like Gecko) Edge/12.0' }));
      assert(!util.isFirefox({ userAgent: 'Mozilla/5.0 (Windows NT 6.3; Win64, x64; Touch) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36 Edge/12.0 (Touch; Trident/7.0; .NET4.0E; .NET4.0C; .NET CLR 3.5.30729; .NET CLR 2.0.50727; .NET CLR 3.0.30729; HPNTDFJS; H9P; InfoPath' }));
      assert(!util.isFirefox({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/538.36 (KHTML, like Gecko) Edge/12.10240' }));
      assert(!util.isFirefox({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.9600' }));
    });

    it('correctly parses firefox user agent strings', () => {
      assert(util.isFirefox({ userAgent: 'Mozilla/5.0 (Android 4.4; Mobile; rv:41.0) Gecko/41.0 Firefox/41.0' }));
      assert(util.isFirefox({ userAgent: 'Mozilla/5.0 (Windows NT x.y; rv:10.0) Gecko/20100101 Firefox/10.0' }));
      assert(util.isFirefox({ userAgent: 'Mozilla/5.0 (Windows NT x.y; Win64; x64; rv:10.0) Gecko/20100101 Firefox/10.0' }));
      assert(util.isFirefox({ userAgent: 'Mozilla/5.0 (Windows NT x.y; WOW64; rv:10.0) Gecko/20100101 Firefox/10.0' }));
      assert(util.isFirefox({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X x.y; rv:10.0) Gecko/20100101 Firefox/10.0' }));
      assert(util.isFirefox({ userAgent: 'Mozilla/5.0 (Macintosh; PPC Mac OS X x.y; rv:10.0) Gecko/20100101 Firefox/10.0' }));
      assert(util.isFirefox({ userAgent: 'Mozilla/5.0 (X11; Linux i686; rv:10.0) Gecko/20100101 Firefox/10.0' }));
      assert(util.isFirefox({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:10.0) Gecko/20100101 Firefox/10.0' }));
      assert(util.isFirefox({ userAgent: 'Mozilla/5.0 (X11; Linux i686 on x86_64; rv:10.0) Gecko/20100101 Firefox/10.0' }));
      assert(util.isFirefox({ userAgent: 'Mozilla/5.0 (Maemo; Linux armv7l; rv:10.0) Gecko/20100101 Firefox/10.0 Fennec/10.0' }));
      assert(util.isFirefox({ userAgent: 'Mozilla/5.0 (Android; Mobile; rv:40.0) Gecko/40.0 Firefox/40.0' }));
      assert(util.isFirefox({ userAgent: 'Mozilla/5.0 (Android 4.4; Mobile; rv:41.0) Gecko/41.0 Firefox/41.0' }));
      assert(util.isFirefox({ userAgent: 'Mozilla/5.0 (Tablet; rv:26.0) Gecko/26.0 Firefox/26.0' }));
      assert(util.isFirefox({ userAgent: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 8_3 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) FxiOS/1.0 Mobile/12F69 Safari/600.1.4' }));
      assert(util.isFirefox({ userAgent: 'Mozilla/5.0 (iPad; CPU iPhone OS 8_3 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) FxiOS/1.0 Mobile/12F69 Safari/600.1.4' }));
      assert(util.isFirefox({ userAgent: 'Mozilla/5.0 (Maemo; Linux armv7l; rv:10.0.1) Gecko/20100101 Firefox/10.0.1 Fennec/10.0.1' }));
      assert(util.isFirefox({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.5; rv:10.0.1) Gecko/20100101 Firefox/10.0.1 SeaMonkey/2.7.1' }));
    });
  });

  describe('isLegacyEdge', () => {
    it('correctly parses non edge user agent strings', () => {
      assert(!util.isLegacyEdge({ userAgent: 'Mozilla/5.0 (Android 4.4; Mobile; rv:41.0) Gecko/41.0 Firefox/41.0' }));
      assert(!util.isLegacyEdge({ userAgent: 'Mozilla/5.0 (Windows NT x.y; rv:10.0) Gecko/20100101 Firefox/10.0' }));
      assert(!util.isLegacyEdge({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:10.0) Gecko/20100101 Firefox/10.0' }));
      assert(!util.isLegacyEdge({ userAgent: 'Mozilla/5.0 (X11; Linux i686 on x86_64; rv:10.0) Gecko/20100101 Firefox/10.0' }));
      assert(!util.isLegacyEdge({ userAgent: 'Mozilla/5.0 (Tablet; rv:26.0) Gecko/26.0 Firefox/26.0' }));
      assert(!util.isLegacyEdge({ userAgent: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 8_3 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) FxiOS/1.0 Mobile/12F69 Safari/600.1.4' }));
      assert(!util.isLegacyEdge({ userAgent: 'Mozilla/5.0 (iPad; CPU iPhone OS 8_3 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) FxiOS/1.0 Mobile/12F69 Safari/600.1.4' }));
      assert(!util.isLegacyEdge({ userAgent: 'Mozilla/5.0 (Maemo; Linux armv7l; rv:10.0.1) Gecko/20100101 Firefox/10.0.1 Fennec/10.0.1' }));
      assert(!util.isLegacyEdge({ userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.5; rv:10.0.1) Gecko/20100101 Firefox/10.0.1 SeaMonkey/2.7.1' }));
    });

    it('correctly parses edge user agent strings', () => {
      assert(util.isLegacyEdge({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.246' }));
      assert(util.isLegacyEdge({ userAgent: 'Mozilla/5.0 (X11; CrOS x86_64 6783.1.0) AppleWebKit/537.36 (KHTML, like Gecko) Edge/12.0' }));
      assert(util.isLegacyEdge({ userAgent: 'Mozilla/5.0 (Windows NT 6.3; Win64, x64; Touch) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/39.0.2171.71 Safari/537.36 Edge/12.0 (Touch; Trident/7.0; .NET4.0E; .NET4.0C; .NET CLR 3.5.30729; .NET CLR 2.0.50727; .NET CLR 3.0.30729; HPNTDFJS; H9P; InfoPath' }));
      assert(util.isLegacyEdge({ userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/538.36 (KHTML, like Gecko) Edge/12.10240' }));
      assert(util.isLegacyEdge({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/42.0.2311.135 Safari/537.36 Edge/12.9600' }));
    });

    it('correctly parses chromium edge user agent strings', () => {
      assert(!util.isLegacyEdge({ userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/79.0.3945.74 Safari/537.36 Edg/79.0.309.43' }));
      assert(!util.isLegacyEdge({ userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 10_3_2 like Mac OS X) AppleWebKit/603.2.4 (KHTML, like Gecko) Mobile/14F89 Safari/603.2.4 EdgiOS/41.1.35.1' }));
      assert(!util.isLegacyEdge({ userAgent: 'Mozilla/5.0 (Linux; Android 8.0; Pixel XL Build/OPP3.170518.006) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.0 Mobile Safari/537.36 EdgA/41.1.35.1' }));
    });
  });

  describe('isChrome', () => {
    it('correctly parses non chrome user agent strings', () => {
      assert(!util.isChrome({}, { userAgent: 'Mozilla/5.0 (Android 4.4; Mobile; rv:41.0) Gecko/41.0 Firefox/41.0' }));
      assert(!util.isChrome({}, { userAgent: 'Mozilla/5.0 (Windows NT x.y; rv:10.0) Gecko/20100101 Firefox/10.0' }));
      assert(!util.isChrome({}, { userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:10.0) Gecko/20100101 Firefox/10.0' }));
      assert(!util.isChrome({}, { userAgent: 'Mozilla/5.0 (X11; Linux i686 on x86_64; rv:10.0) Gecko/20100101 Firefox/10.0' }));
      assert(!util.isChrome({}, { userAgent: 'Mozilla/5.0 (Tablet; rv:26.0) Gecko/26.0 Firefox/26.0' }));
      assert(!util.isChrome({}, { userAgent: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 8_3 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) FxiOS/1.0 Mobile/12F69 Safari/600.1.4' }));
      assert(!util.isChrome({}, { userAgent: 'Mozilla/5.0 (iPad; CPU iPhone OS 8_3 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) FxiOS/1.0 Mobile/12F69 Safari/600.1.4' }));
      assert(!util.isChrome({}, { userAgent: 'Mozilla/5.0 (Maemo; Linux armv7l; rv:10.0.1) Gecko/20100101 Firefox/10.0.1 Fennec/10.0.1' }));
      assert(!util.isChrome({}, { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.5; rv:10.0.1) Gecko/20100101 Firefox/10.0.1 SeaMonkey/2.7.1' }));
    });

    it('correctly parses chrome user agent strings', () => {
      assert(util.isChrome({ chrome: true }, { vendor: 'Google Inc.', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.113 Safari/537.36' }));
      assert(util.isChrome({ chrome: true }, { vendor: 'Google Inc.', userAgent: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/60.0.3112.90 Safari/537.36' }));
      assert(util.isChrome({ chrome: true }, { vendor: 'Google Inc.', userAgent: 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/44.0.2403.157 Safari/537.36' }));
      assert(util.isChrome({ chrome: true }, { vendor: 'Google Inc.', userAgent: 'Mozilla/5.0 (Windows NT 5.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/46.0.2490.71 Safari/537.36' }));
      assert(util.isChrome({ chrome: true }, { vendor: 'Google Inc.', userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36' }));
      assert(util.isChrome({ chrome: true }, { vendor: 'Google Inc.', userAgent: 'Mozilla/5.0 (Windows NT 6.1; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.77 Safari/537.36' }));
      assert(util.isChrome({ chrome: true }, { vendor: 'Google Inc.', userAgent: 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/63.0.3239.132 Safari/537.36' }));
      assert(util.isChrome({ chrome: true }, { vendor: 'Google Inc.', userAgent: 'Mozilla/5.0 (Windows NT 6.1) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/69.0.3497.100 Safari/537.36' }));
      assert(util.isChrome({ chrome: false }, { vendor: 'Google Inc.', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_14_6) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/78.0.3904.108 Safari/537.36' }));
    });
  });

  describe('isSafari', () => {
    it('correctly parses non chrome user agent strings', () => {
      assert(!util.isSafari({}, { userAgent: 'Mozilla/5.0 (Android 4.4; Mobile; rv:41.0) Gecko/41.0 Firefox/41.0' }));
      assert(!util.isSafari({}, { userAgent: 'Mozilla/5.0 (Windows NT x.y; rv:10.0) Gecko/20100101 Firefox/10.0' }));
      assert(!util.isSafari({}, { userAgent: 'Mozilla/5.0 (X11; Linux x86_64; rv:10.0) Gecko/20100101 Firefox/10.0' }));
      assert(!util.isSafari({}, { userAgent: 'Mozilla/5.0 (X11; Linux i686 on x86_64; rv:10.0) Gecko/20100101 Firefox/10.0' }));
      assert(!util.isSafari({}, { userAgent: 'Mozilla/5.0 (Tablet; rv:26.0) Gecko/26.0 Firefox/26.0' }));
      assert(!util.isSafari({}, { userAgent: 'Mozilla/5.0 (iPod touch; CPU iPhone OS 8_3 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) FxiOS/1.0 Mobile/12F69 Safari/600.1.4' }));
      assert(!util.isSafari({}, { userAgent: 'Mozilla/5.0 (iPad; CPU iPhone OS 8_3 like Mac OS X) AppleWebKit/600.1.4 (KHTML, like Gecko) FxiOS/1.0 Mobile/12F69 Safari/600.1.4' }));
      assert(!util.isSafari({}, { userAgent: 'Mozilla/5.0 (Maemo; Linux armv7l; rv:10.0.1) Gecko/20100101 Firefox/10.0.1 Fennec/10.0.1' }));
      assert(!util.isSafari({}, { userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.5; rv:10.0.1) Gecko/20100101 Firefox/10.0.1 SeaMonkey/2.7.1' }));
    });

    it('correctly parses chrome user agent strings', () => {
      assert(util.isSafari({ vendor: 'Apple Computer, Inc.', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 11_4_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/11.0 Mobile/15E148 Safari/604.1' }));
      assert(util.isSafari({ vendor: 'Apple Computer, Inc.', userAgent: 'Mozilla/5.0 (Macintosh; U; Intel Mac OS X 10_6_6; en-en) AppleWebKit/533.19.4 (KHTML, like Gecko) Version/5.0.3 Safari/533.19.4' }));
      assert(util.isSafari({ vendor: 'Apple Computer, Inc.', userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 12_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0 Mobile/15E148 Safari/604.1' }));
      assert(util.isSafari({ vendor: 'Apple Computer, Inc.', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_13_6) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/12.0.1 Safari/605.1.15' }));
      assert(util.isSafari({ vendor: 'Apple Computer, Inc.', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_6_8) AppleWebKit/534.59.10 (KHTML, like Gecko) Version/5.1.9 Safari/534.59.10' }));
      assert(util.isSafari({ vendor: 'Apple Computer, Inc.', userAgent: 'Mozilla/5.0 (iPad; CPU OS 6_0 like Mac OS X) AppleWebKit/536.26 (KHTML, like Gecko) Version/6.0 Mobile/10A5355d Safari/8536.25' }));
      assert(util.isSafari({ vendor: 'Apple Computer, Inc.', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_10_5) AppleWebKit/603.3.8 (KHTML, like Gecko) Version/10.1.2 Safari/603.3.8' }));
      assert(util.isSafari({ vendor: 'Apple Computer, Inc.', userAgent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_7_5) AppleWebKit/537.78.2 (KHTML, like Gecko) Version/6.1.6 Safari/537.78.2' }));
    });
  });

  describe('queryToJson', () => {
    it('returns an empty string if null is passed', () => {
      assert.equal(util.queryToJson(null), '');
    });

    it('returns an empty string if undefined is passed', () => {
      assert.equal(util.queryToJson(), '');
    });

    it('returns an empty string if empty string is passed', () => {
      assert.equal(util.queryToJson(''), '');
    });

    it('correctly parses query strings', () => {
      assert.deepEqual(util.queryToJson('foo=bar'), { foo: 'bar' });
      assert.deepEqual(util.queryToJson('123=123'), { 123: '123' });
      assert.deepEqual(util.queryToJson('f+oo=ba+r&b+ar=fo+o'), { 'f+oo': 'ba r', 'b+ar': 'fo o' });
      assert.deepEqual(util.queryToJson('f%2Boo=ba%2Br'), { 'f%2Boo': 'ba+r' });
      assert.deepEqual(util.queryToJson('f%2boo=ba%2br'), { 'f%2boo': 'ba+r' });
      assert.deepEqual(util.queryToJson('foo=&bar='), { foo: '', bar: '' });
      assert.deepEqual(util.queryToJson('foo=bar&foo=baz&bar=%E6%88%91%E4%B8%8D%E5%90%83%E8%9B%8B'), { foo: 'baz' , bar: '我不吃蛋' });
    });
  });

  describe('promisifyEvents', () => {
    const resolveEventName = 'foo';
    const rejectEventName = 'bar';
    const { promisifyEvents } = util;
    let emitter;

    beforeEach(() => {
      emitter = new EventEmitter();
    });

    it('should resolve', async () => {
      setTimeout(() => emitter.emit(resolveEventName));
      await promisifyEvents(emitter, resolveEventName, rejectEventName);
    });

    it('should reject', async () => {
      setTimeout(() => emitter.emit(rejectEventName));
      await assert.rejects(() => promisifyEvents(emitter, resolveEventName, rejectEventName));
    });

    it('should clear reject handler', async () => {
      setTimeout(() => emitter.emit(resolveEventName));
      await promisifyEvents(emitter, resolveEventName, rejectEventName);
      assert.strictEqual(emitter.eventNames().length, 0);
    });

    it('should clear resolve handler', async () => {
      setTimeout(() => emitter.emit(rejectEventName));
      await promisifyEvents(emitter, resolveEventName, rejectEventName).catch(() => {});
      assert.strictEqual(emitter.eventNames().length, 0);
    });
  });

  describe('sortByMimeTypes', () => {
    const { sortByMimeTypes } = util;
    const codecs = [
            { mimeType : 'audio/opus' },
            { mimeType : 'audio/red' },
            { mimeType : 'audio/G722' },
            { mimeType : 'audio/PCMU' },
            { mimeType : 'audio/PCMA' },
          ];

    it('should be case-insensitive', () => {
      const codecPreferences = ['pCmU', 'OpUs'];
      const sortedCodecs = [
        { mimeType: 'audio/PCMU' },
        { mimeType: 'audio/opus' },
        { mimeType: 'audio/red' },
        { mimeType: 'audio/G722' },
        { mimeType: 'audio/PCMA' },
      ];
      assert.deepEqual(sortByMimeTypes(codecs, codecPreferences), sortedCodecs);
    });

    it('should handle a single preference', () => {
      const sortedCodecs = [
        { mimeType: 'audio/PCMU' },
        { mimeType: 'audio/opus' },
        { mimeType: 'audio/red' },
        { mimeType: 'audio/G722' },
        { mimeType: 'audio/PCMA' },
      ];
      const singlePreference = ['pcmu'];
      assert.deepEqual(sortByMimeTypes(codecs, singlePreference), sortedCodecs);
    });

    it('should NOT sort if invalid codecs provided', () => {
      const codecPreferences = ['foo', 'bar'];
      assert.deepEqual(sortByMimeTypes(codecs, codecPreferences), codecs);
    });
  });
});
