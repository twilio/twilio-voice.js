/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
import * as LogLevelModule from 'loglevel';
import { PACKAGE_NAME } from './constants';
/**
 * {@link Log} provides logging features throughout the sdk using loglevel module
 * See https://github.com/pimterry/loglevel for documentation
 * @private
 */
class Log {
    /**
     * @constructor
     * @param [tag] - tag name for the logs
     * @param [options] - Optional settings
     */
    constructor(tag, options) {
        this._log = Log.getLogLevelInstance(options);
        this._prefix = `[TwilioVoice][${tag}]`;
    }
    /**
     * Return the `loglevel` instance maintained internally.
     * @param [options] - Optional settings
     * @returns The `loglevel` instance.
     */
    static getLogLevelInstance(options) {
        if (!Log.loglevelInstance) {
            try {
                Log.loglevelInstance = (options && options.LogLevelModule ? options.LogLevelModule : LogLevelModule).getLogger(PACKAGE_NAME);
            }
            catch (_a) {
                // tslint:disable-next-line
                console.warn('Cannot create custom logger');
                Log.loglevelInstance = console;
            }
        }
        return Log.loglevelInstance;
    }
    /**
     * Log a debug message
     * @param args - Any number of arguments to be passed to loglevel.debug
     */
    debug(...args) {
        this._log.debug(this._prefix, ...args);
    }
    /**
     * Log an error message
     * @param args - Any number of arguments to be passed to loglevel.error
     */
    error(...args) {
        this._log.error(this._prefix, ...args);
    }
    /**
     * Log an info message
     * @param args - Any number of arguments to be passed to loglevel.info
     */
    info(...args) {
        this._log.info(this._prefix, ...args);
    }
    /**
     * Set a default log level to disable all logging below the given level
     */
    setDefaultLevel(level) {
        if (this._log.setDefaultLevel) {
            this._log.setDefaultLevel(level);
        }
        else {
            // tslint:disable-next-line
            console.warn('Logger cannot setDefaultLevel');
        }
    }
    /**
     * Log a warning message
     * @param args - Any number of arguments to be passed to loglevel.warn
     */
    warn(...args) {
        this._log.warn(this._prefix, ...args);
    }
}
/**
 * Log levels
 */
Log.levels = LogLevelModule.levels;
export const Logger = Log.getLogLevelInstance();
export default Log;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9sb2cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7R0FJRztBQUVILE9BQU8sS0FBSyxjQUFjLE1BQU0sVUFBVSxDQUFDO0FBQzNDLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFhM0M7Ozs7R0FJRztBQUNILE1BQU0sR0FBRztJQXVDUDs7OztPQUlHO0lBQ0gsWUFBWSxHQUFXLEVBQUUsT0FBb0I7UUFDM0MsSUFBSSxDQUFDLElBQUksR0FBRyxHQUFHLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDN0MsSUFBSSxDQUFDLE9BQU8sR0FBRyxpQkFBaUIsR0FBRyxHQUFHLENBQUM7SUFDekMsQ0FBQztJQXpDRDs7OztPQUlHO0lBQ0gsTUFBTSxDQUFDLG1CQUFtQixDQUFDLE9BQW9CO1FBQzdDLElBQUksQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUU7WUFDekIsSUFBSTtnQkFDRixHQUFHLENBQUMsZ0JBQWdCLEdBQUcsQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxDQUFDO2FBQzlIO1lBQUMsV0FBTTtnQkFDTiwyQkFBMkI7Z0JBQzNCLE9BQU8sQ0FBQyxJQUFJLENBQUMsNkJBQTZCLENBQUMsQ0FBQztnQkFDNUMsR0FBRyxDQUFDLGdCQUFnQixHQUFHLE9BQWMsQ0FBQzthQUN2QztTQUNGO1FBQ0QsT0FBTyxHQUFHLENBQUMsZ0JBQWdCLENBQUM7SUFDOUIsQ0FBQztJQTJCRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsR0FBRyxJQUFXO1FBQ2xCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztJQUN6QyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsS0FBSyxDQUFDLEdBQUcsSUFBVztRQUNsQixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7SUFDekMsQ0FBQztJQUVEOzs7T0FHRztJQUNILElBQUksQ0FBQyxHQUFHLElBQVc7UUFDakIsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFFRDs7T0FFRztJQUNILGVBQWUsQ0FBQyxLQUFrQztRQUNoRCxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFO1lBQzdCLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQ2xDO2FBQU07WUFDTCwyQkFBMkI7WUFDM0IsT0FBTyxDQUFDLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO1NBQy9DO0lBQ0gsQ0FBQztJQUVEOzs7T0FHRztJQUNILElBQUksQ0FBQyxHQUFHLElBQVc7UUFDakIsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0lBQ3hDLENBQUM7O0FBMUZEOztHQUVHO0FBQ0ksVUFBTSxHQUE0QixjQUFjLENBQUMsTUFBTSxDQUFDO0FBMEZqRSxNQUFNLENBQUMsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLG1CQUFtQixFQUFFLENBQUM7QUFFaEQsZUFBZSxHQUFHLENBQUMifQ==