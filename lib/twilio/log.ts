import * as LogLevelModule from 'loglevel';
import { PACKAGE_NAME } from './constants';

/**
 * Options that may be passed to the {@link Log} constructor for internal testing.
 * @private
 */
export interface LogOptions {
  /**
   * Custom loglevel module
   */
  LogLevelModule: any;
}

/**
 * {@link Log} provides logging features throughout the sdk using loglevel module
 * See https://github.com/pimterry/loglevel for documentation
 * @private
 */
class Log {
  /**
   * Log levels
   */
  static levels: LogLevelModule.LogLevel = LogLevelModule.levels;

  /**
   * Return the `loglevel` instance maintained internally.
   * @param [options] - Optional settings
   * @returns The `loglevel` instance.
   */
  static getLogLevelInstance(options?: LogOptions): LogLevelModule.Logger {
    if (!Log.loglevelInstance) {
      try {
        Log.loglevelInstance = (options && options.LogLevelModule ? options.LogLevelModule : LogLevelModule).getLogger(PACKAGE_NAME);
      } catch {
        // tslint:disable-next-line
        console.warn('Cannot create custom logger');
        Log.loglevelInstance = console as any;
      }
    }
    return Log.loglevelInstance;
  }

  /**
   * The loglevel singleton instance
   */
  private static loglevelInstance: LogLevelModule.Logger;

  /**
   * The loglevel logger instance that will be used in this {@link Log}
   */
  private _log: LogLevelModule.Logger;

  /**
   * Prefix to use for this log instance
   */
  private _prefix: string;

  /**
   * @constructor
   * @param [tag] - tag name for the logs
   * @param [options] - Optional settings
   */
  constructor(tag: string, options?: LogOptions) {
    this._log = Log.getLogLevelInstance(options);
    this._prefix = `[TwilioVoice][${tag}]`;
  }

  /**
   * Log a debug message
   * @param args - Any number of arguments to be passed to loglevel.debug
   */
  debug(...args: any[]): void {
    this._log.debug(this._prefix, ...args);
  }

  /**
   * Log an error message
   * @param args - Any number of arguments to be passed to loglevel.error
   */
  error(...args: any[]): void {
    this._log.error(this._prefix, ...args);
  }

  /**
   * Log an info message
   * @param args - Any number of arguments to be passed to loglevel.info
   */
  info(...args: any[]): void {
    this._log.info(this._prefix, ...args);
  }

  /**
   * Set a default log level to disable all logging below the given level
   */
  setDefaultLevel(level: LogLevelModule.LogLevelDesc): void {
    if (this._log.setDefaultLevel) {
      this._log.setDefaultLevel(level);
    } else {
      // tslint:disable-next-line
      console.warn('Logger cannot setDefaultLevel');
    }
  }

  /**
   * Log a warning message
   * @param args - Any number of arguments to be passed to loglevel.warn
   */
  warn(...args: any[]): void {
    this._log.warn(this._prefix, ...args);
  }
}

export const Logger = Log.getLogLevelInstance();

export default Log;
