import { Logger } from '../../lib/twilio';

const checkLogger = () => {
  const level: string | number = Logger.getLevel();
  Logger.setLevel('error');
  Logger.setLevel('warn');
  Logger.setLevel('info');
  Logger.setLevel('debug');
  Logger.setLevel('trace');
  Logger.setLevel(0);

  Logger.setDefaultLevel('error');
  Logger.enableAll();
  Logger.disableAll();

  Logger.trace('test');
  Logger.debug('test');
  Logger.info('test');
  Logger.warn('test');
  Logger.error('test');
};

export default checkLogger;
