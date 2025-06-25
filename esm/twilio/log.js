import * as LogLevelModule from 'loglevel';
import { PACKAGE_NAME } from './constants';
/**
 * {@link Log} provides logging features throughout the sdk using loglevel module
 * See https://github.com/pimterry/loglevel for documentation
 * @private
 */
class Log {
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
     * @constructor
     * @param [tag] - tag name for the logs
     * @param [options] - Optional settings
     */
    constructor(tag, options) {
        this._log = Log.getLogLevelInstance(options);
        this._prefix = `[TwilioVoice][${tag}]`;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9sb2cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUEsT0FBTyxLQUFLLGNBQWMsTUFBTSxVQUFVLENBQUM7QUFDM0MsT0FBTyxFQUFFLFlBQVksRUFBRSxNQUFNLGFBQWEsQ0FBQztBQWEzQzs7OztHQUlHO0FBQ0gsTUFBTSxHQUFHO0lBTVA7Ozs7T0FJRztJQUNILE1BQU0sQ0FBQyxtQkFBbUIsQ0FBQyxPQUFvQjtRQUM3QyxJQUFJLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDMUIsSUFBSSxDQUFDO2dCQUNILEdBQUcsQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxTQUFTLENBQUMsWUFBWSxDQUFDLENBQUM7WUFDL0gsQ0FBQztZQUFDLFdBQU0sQ0FBQztnQkFDUCwyQkFBMkI7Z0JBQzNCLE9BQU8sQ0FBQyxJQUFJLENBQUMsNkJBQTZCLENBQUMsQ0FBQztnQkFDNUMsR0FBRyxDQUFDLGdCQUFnQixHQUFHLE9BQWMsQ0FBQztZQUN4QyxDQUFDO1FBQ0gsQ0FBQztRQUNELE9BQU8sR0FBRyxDQUFDLGdCQUFnQixDQUFDO0lBQzlCLENBQUM7SUFpQkQ7Ozs7T0FJRztJQUNILFlBQVksR0FBVyxFQUFFLE9BQW9CO1FBQzNDLElBQUksQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzdDLElBQUksQ0FBQyxPQUFPLEdBQUcsaUJBQWlCLEdBQUcsR0FBRyxDQUFDO0lBQ3pDLENBQUM7SUFFRDs7O09BR0c7SUFDSCxLQUFLLENBQUMsR0FBRyxJQUFXO1FBQ2xCLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUMsQ0FBQztJQUN6QyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsS0FBSyxDQUFDLEdBQUcsSUFBVztRQUNsQixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7SUFDekMsQ0FBQztJQUVEOzs7T0FHRztJQUNILElBQUksQ0FBQyxHQUFHLElBQVc7UUFDakIsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQyxDQUFDO0lBQ3hDLENBQUM7SUFFRDs7T0FFRztJQUNILGVBQWUsQ0FBQyxLQUFrQztRQUNoRCxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDOUIsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbkMsQ0FBQzthQUFNLENBQUM7WUFDTiwyQkFBMkI7WUFDM0IsT0FBTyxDQUFDLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO1FBQ2hELENBQUM7SUFDSCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsSUFBSSxDQUFDLEdBQUcsSUFBVztRQUNqQixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDLENBQUM7SUFDeEMsQ0FBQzs7QUExRkQ7O0dBRUc7QUFDSSxVQUFNLEdBQTRCLGNBQWMsQ0FBQyxNQUFNLENBQUM7QUEwRmpFLE1BQU0sQ0FBQyxNQUFNLE1BQU0sR0FBRyxHQUFHLENBQUMsbUJBQW1CLEVBQUUsQ0FBQztBQUVoRCxlQUFlLEdBQUcsQ0FBQyJ9