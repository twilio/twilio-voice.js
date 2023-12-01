import Log from '../../lib/twilio/log';
import * as assert from 'assert';
import * as sinon from 'sinon';

const packageName = require('../../package.json').name;

describe('Log', () => {
  let options: any;
  let logA: any;
  let logB: any;
  let _log: any;

  before(() => {
    (Log as any).loglevelInstance = null;
    _log = {};
  });

  beforeEach(() => {
    _log.debug = sinon.stub();
    _log.error = sinon.stub();
    _log.info = sinon.stub();
    _log.setDefaultLevel = sinon.stub();
    _log.warn = sinon.stub();
    options = {LogLevelModule: { getLogger :sinon.stub().returns(_log)}};
    logA = new Log('foo', options);
    logB = new Log('bar', options);
  });

  describe('constructor', () => {
    it('should return the same loglevel instance with correct package name', () => {
      sinon.assert.calledWith(options.LogLevelModule.getLogger, packageName);
      sinon.assert.calledOnce(options.LogLevelModule.getLogger);
    });
  });

  describe('after init', () => {
    let args: any;

    beforeEach(() => {
      args = ['foo', { bar: 'baz' }];
    });

    it('should call loglevel.setDefaultLevel', () => {
      logA.setDefaultLevel(Log.levels.DEBUG);
      logB.setDefaultLevel(Log.levels.INFO);
      sinon.assert.calledTwice(_log.setDefaultLevel);
      assert.deepStrictEqual(_log.setDefaultLevel.args[0], [Log.levels.DEBUG]);
      assert.deepStrictEqual(_log.setDefaultLevel.args[1], [Log.levels.INFO]);
    });

    ['debug', 'error', 'info', 'warn'].forEach(methodName => {
      it(`should call loglevel ${methodName} method`, () => {
        (logA as any)[methodName](...args);
        (logB as any)[methodName](...args);
        sinon.assert.calledTwice(_log[methodName]);
        assert.deepStrictEqual(_log[methodName].args[0], ['[TwilioVoice][foo]', ...args]);
        assert.deepStrictEqual(_log[methodName].args[1], ['[TwilioVoice][bar]', ...args]);
      });
    });
  });
});
