import * as loglevel from 'loglevel';
import { PACKAGE_NAME } from './constants.js';

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
                Log.loglevelInstance = (options && options.LogLevelModule ? options.LogLevelModule : loglevel).getLogger(PACKAGE_NAME);
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
Log.levels = loglevel.levels;
const Logger = Log.getLogLevelInstance();

export { Logger, Log as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2xvZy50cyJdLCJzb3VyY2VzQ29udGVudCI6W251bGxdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFjQTs7OztBQUlHO0FBQ0gsTUFBTSxHQUFHLENBQUE7QUFNUDs7OztBQUlHO0lBQ0gsT0FBTyxtQkFBbUIsQ0FBQyxPQUFvQixFQUFBO0FBQzdDLFFBQUEsSUFBSSxDQUFDLEdBQUcsQ0FBQyxnQkFBZ0IsRUFBRTtBQUN6QixZQUFBLElBQUk7Z0JBQ0YsR0FBRyxDQUFDLGdCQUFnQixHQUFHLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxjQUFjLEdBQUcsT0FBTyxDQUFDLGNBQWMsR0FBRyxRQUFRLEVBQUUsU0FBUyxDQUFDLFlBQVksQ0FBQztZQUN4SDtBQUFFLFlBQUEsT0FBQSxFQUFBLEVBQU07O0FBRU4sZ0JBQUEsT0FBTyxDQUFDLElBQUksQ0FBQyw2QkFBNkIsQ0FBQztBQUMzQyxnQkFBQSxHQUFHLENBQUMsZ0JBQWdCLEdBQUcsT0FBYztZQUN2QztRQUNGO1FBQ0EsT0FBTyxHQUFHLENBQUMsZ0JBQWdCO0lBQzdCO0FBaUJBOzs7O0FBSUc7SUFDSCxXQUFBLENBQVksR0FBVyxFQUFFLE9BQW9CLEVBQUE7UUFDM0MsSUFBSSxDQUFDLElBQUksR0FBRyxHQUFHLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDO0FBQzVDLFFBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxDQUFBLGNBQUEsRUFBaUIsR0FBRyxHQUFHO0lBQ3hDO0FBRUE7OztBQUdHO0lBQ0gsS0FBSyxDQUFDLEdBQUcsSUFBVyxFQUFBO0FBQ2xCLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQztJQUN4QztBQUVBOzs7QUFHRztJQUNILEtBQUssQ0FBQyxHQUFHLElBQVcsRUFBQTtBQUNsQixRQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsS0FBSyxDQUFDLElBQUksQ0FBQyxPQUFPLEVBQUUsR0FBRyxJQUFJLENBQUM7SUFDeEM7QUFFQTs7O0FBR0c7SUFDSCxJQUFJLENBQUMsR0FBRyxJQUFXLEVBQUE7QUFDakIsUUFBQSxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsT0FBTyxFQUFFLEdBQUcsSUFBSSxDQUFDO0lBQ3ZDO0FBRUE7O0FBRUc7QUFDSCxJQUFBLGVBQWUsQ0FBQyxLQUE0QixFQUFBO0FBQzFDLFFBQUEsSUFBSSxJQUFJLENBQUMsSUFBSSxDQUFDLGVBQWUsRUFBRTtBQUM3QixZQUFBLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQztRQUNsQzthQUFPOztBQUVMLFlBQUEsT0FBTyxDQUFDLElBQUksQ0FBQywrQkFBK0IsQ0FBQztRQUMvQztJQUNGO0FBRUE7OztBQUdHO0lBQ0gsSUFBSSxDQUFDLEdBQUcsSUFBVyxFQUFBO0FBQ2pCLFFBQUEsSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLE9BQU8sRUFBRSxHQUFHLElBQUksQ0FBQztJQUN2Qzs7QUExRkE7O0FBRUc7QUFDSSxHQUFBLENBQUEsTUFBTSxHQUFzQixRQUFRLENBQUMsTUFBTTtNQTBGdkMsTUFBTSxHQUFHLEdBQUcsQ0FBQyxtQkFBbUI7Ozs7In0=
