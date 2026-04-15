import * as loglevel from 'loglevel';
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
declare class Log {
    /**
     * Log levels
     */
    static levels: loglevel.LogLevel;
    /**
     * Return the `loglevel` instance maintained internally.
     * @param [options] - Optional settings
     * @returns The `loglevel` instance.
     */
    static getLogLevelInstance(options?: LogOptions): loglevel.Logger;
    /**
     * The loglevel singleton instance
     */
    private static loglevelInstance;
    /**
     * The loglevel logger instance that will be used in this {@link Log}
     */
    private _log;
    /**
     * Prefix to use for this log instance
     */
    private _prefix;
    /**
     * @constructor
     * @param [tag] - tag name for the logs
     * @param [options] - Optional settings
     */
    constructor(tag: string, options?: LogOptions);
    /**
     * Log a debug message
     * @param args - Any number of arguments to be passed to loglevel.debug
     */
    debug(...args: any[]): void;
    /**
     * Log an error message
     * @param args - Any number of arguments to be passed to loglevel.error
     */
    error(...args: any[]): void;
    /**
     * Log an info message
     * @param args - Any number of arguments to be passed to loglevel.info
     */
    info(...args: any[]): void;
    /**
     * Set a default log level to disable all logging below the given level
     */
    setDefaultLevel(level: loglevel.LogLevelDesc): void;
    /**
     * Log a warning message
     * @param args - Any number of arguments to be passed to loglevel.warn
     */
    warn(...args: any[]): void;
}
export declare const Logger: loglevel.Logger;
export default Log;
