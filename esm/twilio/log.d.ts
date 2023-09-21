/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
import * as LogLevelModule from 'loglevel';
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
declare class Log {
    /**
     * Log levels
     */
    static levels: LogLevelModule.LogLevel;
    /**
     * Create the logger singleton instance if it doesn't exists
     * @returns The singleton {@link Log} instance
     */
    static getInstance(): Log;
    /**
     * The logger singleton instance
     */
    private static instance;
    /**
     * The loglevel logger instance that will be used in this {@link Log}
     */
    private _log;
    /**
     * @constructor
     * @param [options] - Optional settings
     */
    constructor(options?: LogOptions);
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
     * Return the `loglevel` instance maintained internally.
     * @returns The `loglevel` instance.
     */
    getLogLevelInstance(): LogLevelModule.Logger;
    /**
     * Log an info message
     * @param args - Any number of arguments to be passed to loglevel.info
     */
    info(...args: any[]): void;
    /**
     * Set a default log level to disable all logging below the given level
     */
    setDefaultLevel(level: LogLevelModule.LogLevelDesc): void;
    /**
     * Log a warning message
     * @param args - Any number of arguments to be passed to loglevel.warn
     */
    warn(...args: any[]): void;
}
export declare const Logger: LogLevelModule.Logger;
export default Log;
