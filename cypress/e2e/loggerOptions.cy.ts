import * as assert from 'assert';
import { Logger } from '../../lib/twilio';
import Device from '../../lib/twilio/device';
import { generateAccessToken } from '../../tests/lib/token';

describe('Logger', function() {
  this.timeout(10000);

  it('the exposed logger should be defined', () => {
    assert(Logger);
  });

  it('should have standard log level methods', () => {
    assert(typeof Logger.getLevel === 'function', 'getLevel should be a function');
    assert(typeof Logger.setLevel === 'function', 'setLevel should be a function');
  });

  it('should be configurable via Device options logLevel', () => {
    const identity = 'id-' + Date.now();
    const token = generateAccessToken(identity);

    // Should not throw when setting various log levels
    assert.doesNotThrow(() => {
      const device = new Device(token, { logLevel: 'error' as any });
      device.destroy();
    });

    assert.doesNotThrow(() => {
      const device = new Device(token, { logLevel: 'warn' as any });
      device.destroy();
    });

    assert.doesNotThrow(() => {
      const device = new Device(token, { logLevel: 'info' as any });
      device.destroy();
    });

    assert.doesNotThrow(() => {
      const device = new Device(token, { logLevel: 'debug' as any });
      device.destroy();
    });
  });

  it('should accept numeric log levels via Device options', () => {
    const identity = 'id-' + Date.now();
    const token = generateAccessToken(identity);

    // loglevel uses numeric levels: 0=TRACE, 1=DEBUG, 2=INFO, 3=WARN, 4=ERROR, 5=SILENT
    assert.doesNotThrow(() => {
      const device = new Device(token, { logLevel: 0 as any });
      device.destroy();
    });

    assert.doesNotThrow(() => {
      const device = new Device(token, { logLevel: 4 as any });
      device.destroy();
    });
  });
});
