import * as assert from 'assert';
import * as sinon from 'sinon';
import { NotSupportedError } from '../../lib/twilio/errors';
import { generateVoiceEventSid } from '../../lib/twilio/sid';

const root = global as any;

describe('sid util', () => {
  let originalWindow: any;
  let getRandomValues: sinon.SinonSpy<[Uint8Array], Uint8Array>;
  let Uint8ArrayMock: sinon.SinonSpy<[number], Uint8Array>;

  function injectWindow(injections: Record<string, any>) {
    root.window = {
      ...root.window,
      ...injections,
    };
  }

  beforeEach(() => {
    originalWindow = root.window;

    getRandomValues = sinon
      .spy((arr: Uint8Array) => {
        return arr.fill(42);
      });

    Uint8ArrayMock = sinon.spy((n: number) => new Uint8Array(n));
  });

  afterEach(() => {
    root.window = originalWindow;
  });

  describe('generateVoiceEventSid', () => {
    it('should throw if window is not available', () => {
      root.window = undefined;
      assert.throws(
        () => generateVoiceEventSid(),
        new NotSupportedError('This platform is not supported.'),
      );
    });

    it('should throw if crypto is not available', () => {
      injectWindow({ Uint8Array: Uint8ArrayMock });
      assert.throws(
        () => generateVoiceEventSid(),
        new NotSupportedError('The `crypto` module is not available on this platform.'),
      );
    });

    it('should throw if getRandomValues is not available', () => {
      injectWindow({ crypto: {}, Uint8Array: Uint8ArrayMock });
      assert.throws(
        () => generateVoiceEventSid(),
        new NotSupportedError('The function `crypto.getRandomValues` is not available on this platform.'),
      );
    });

    it('should throw if Uint32Array is not available', () => {
      injectWindow({ crypto: { getRandomValues } });
      assert.throws(
        () => generateVoiceEventSid(),
        new NotSupportedError('The `Uint8Array` module is not available on this platform.'),
      );
    });

    it('should generate a sid using getRandomValues', () => {
      injectWindow({ crypto: { getRandomValues }, Uint8Array: Uint8ArrayMock });
      assert(typeof generateVoiceEventSid() === 'string');
      sinon.assert.calledOnce(getRandomValues);
    });

    it('should be prefixed with `KX`', () => {
      injectWindow({ crypto: { getRandomValues }, Uint8Array: Uint8ArrayMock });
      const sid = generateVoiceEventSid();
      const matches = /^KX(.+)$/.exec(sid);
      assert(matches);
    });

    it('should consist of 34 characters', () => {
      injectWindow({ crypto: { getRandomValues }, Uint8Array: Uint8ArrayMock });
      const completeSid = generateVoiceEventSid();
      assert(completeSid.length === 34);

      const matches = /^(\w\w)([\d\w]+)$/.exec(completeSid);
      assert(matches);

      const [_, prefix, prefixlessSid] = matches!;
      assert(prefix === 'KX');
      assert(prefixlessSid.length === 32);
    });
  });
});
