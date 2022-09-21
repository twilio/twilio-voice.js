import * as assert from 'assert';
import * as sinon from 'sinon';
import { NotSupportedError } from '../../lib/twilio/errors';
import { generateUuid, generateVoiceEventSid } from '../../lib/twilio/uuid';

const root = global as any;

describe('uuid util', () => {
  let originalWindow: any;
  let randomUUID: sinon.SinonStub;
  let getRandomValues: sinon.SinonSpy<[Uint32Array], Uint32Array>;
  let Uint32ArrMock: sinon.SinonSpy<[number], Uint32Array>;

  function injectWindow(injections: Record<string, any>) {
    root.window = {
      ...root.window,
      ...injections,
    };
  }

  beforeEach(() => {
    originalWindow = root.window;

    randomUUID = sinon
      .stub()
      .returns('here\'s a random uuid for you to use');

    getRandomValues = sinon
      .spy((arr: Uint32Array) => {
        return arr.fill(42);
      });

    Uint32ArrMock = sinon.spy((n: number) => new Uint32Array(n));
  });

  afterEach(() => {
    root.window = originalWindow;
  });

  describe('generateUuid', () => {
    it('should throw if window is not available', () => {
      root.window = undefined;
      assert.throws(
        () => generateUuid(),
        new NotSupportedError('This platform is not supported.'),
      );
    });

    it('should throw if crypto is not available', () => {
      injectWindow({ Uint32Array: Uint32ArrMock });
      assert.throws(
        () => generateUuid(),
        new NotSupportedError('The `crypto` module is not available on this platform.'),
      );
    });

    it('should throw if neither randomUUID or getRandomValues are available', () => {
      injectWindow({ crypto: {}, Uint32Array: Uint32ArrMock });
      assert.throws(
        () => generateUuid(),
        new NotSupportedError(
          'Neither `crypto.randomUUID` or `crypto.getRandomValues` are ' +
          'available on this platform.',
        ),
      );
    });

    it('should throw if Uint32Array is not available', () => {
      injectWindow({ crypto: { randomUUID, getRandomValues } });
      assert.throws(
        () => generateUuid(),
        new NotSupportedError('The `Uint32Array` module is not available on this platform.'),
      );
    });

    it('should generate a uuid using randomUUID', () => {
      injectWindow({ crypto: { randomUUID }, Uint32Array: Uint32ArrMock });
      assert(typeof generateUuid() === 'string');
      sinon.assert.calledOnce(randomUUID);
    });

    it('should generate a uuid using getRandomValues', () => {
      injectWindow({ crypto: { getRandomValues }, Uint32Array: Uint32ArrMock });
      assert(typeof generateUuid() === 'string');
      sinon.assert.calledOnce(getRandomValues);
    });

    it('should prefer randomUUID if both randomUUID and getRandomValues are available', () => {
      injectWindow({ crypto: { randomUUID, getRandomValues }, Uint32Array: Uint32ArrMock });
      assert(typeof generateUuid() === 'string');
      sinon.assert.calledOnce(randomUUID);
      sinon.assert.notCalled(getRandomValues);
    });
  });

  describe('generateVoiceEventSid', () => {
    it('should be prefixed with `KX`', () => {
      injectWindow({ crypto: { randomUUID }, Uint32Array: Uint32ArrMock });
      const sid = generateVoiceEventSid();
      const matches = /^KX(.+)$/.exec(sid);
      assert(matches);
    });
  });
});
