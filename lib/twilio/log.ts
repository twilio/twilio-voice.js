/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */

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
 * {@link Log} provides logging features throught the sdk using loglevel module
 * See https://github.com/pimterry/loglevel for documentation
 */
class Log {
  /**
   * Log levels
   */
  static levels: LogLevelModule.LogLevel = LogLevelModule.levels;

  /**
   * Create the logger singleton instance if it doesn't exists
   * @returns The singleton {@link Log} instance
   */
  static getInstance(): Log {
    if (!Log.instance) {
      Log.instance = new Log();
    }
    return Log.instance;
  }

  /**
   * The logger singleton instance
   */
  private static instance: Log;

  /**
   * The loglevel logger instance that will be used in this {@link Log}
   */
  private _log: LogLevelModule.Logger;

  /**
   * @constructor
   * @param [options] - Optional settings
   */
  constructor(options?: LogOptions) {
    try {
      this._log = (options && options.LogLevelModule ? options.LogLevelModule : LogLevelModule).getLogger(PACKAGE_NAME);
    } catch {
      // tslint:disable-next-line
      console.warn('Cannot create custom logger');
      this._log = console as any;
    }
  }

  /**
   * Log a debug message
   * @param args - Any number of arguments to be passed to loglevel.debug
   */
  debug(...args: any[]): void {
    this._log.debug(...args);
  }

  /**
   * Log an error message
   * @param args - Any number of arguments to be passed to loglevel.error
   */
  error(...args: any[]): void {
    this._log.error(...args);
  }

  /**
   * Return the `loglevel` instance maintained internally.
   * @returns The `loglevel` instance.
   */
  getLogLevelInstance(): LogLevelModule.Logger {
    return this._log;
  }

  /**
   * Log an info message
   * @param args - Any number of arguments to be passed to loglevel.info
   */
  info(...args: any[]): void {
    this._log.info(...args);
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
    this._log.warn(...args);
  }
}

export const Logger = Log.getInstance().getLogLevelInstance();

export default Log;
