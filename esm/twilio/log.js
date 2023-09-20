/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
import * as LogLevelModule from 'loglevel';
import { PACKAGE_NAME } from './constants';
/**
 * {@link Log} provides logging features throught the sdk using loglevel module
 * See https://github.com/pimterry/loglevel for documentation
 */
class Log {
    /**
     * @constructor
     * @param [options] - Optional settings
     */
    constructor(options) {
        try {
            this._log = (options && options.LogLevelModule ? options.LogLevelModule : LogLevelModule).getLogger(PACKAGE_NAME);
        }
        catch (_a) {
            // tslint:disable-next-line
            console.warn('Cannot create custom logger');
            this._log = console;
        }
    }
    /**
     * Create the logger singleton instance if it doesn't exists
     * @returns The singleton {@link Log} instance
     */
    static getInstance() {
        if (!Log.instance) {
            Log.instance = new Log();
        }
        return Log.instance;
    }
    /**
     * Log a debug message
     * @param args - Any number of arguments to be passed to loglevel.debug
     */
    debug(...args) {
        this._log.debug(...args);
    }
    /**
     * Log an error message
     * @param args - Any number of arguments to be passed to loglevel.error
     */
    error(...args) {
        this._log.error(...args);
    }
    /**
     * Return the `loglevel` instance maintained internally.
     * @returns The `loglevel` instance.
     */
    getLogLevelInstance() {
        return this._log;
    }
    /**
     * Log an info message
     * @param args - Any number of arguments to be passed to loglevel.info
     */
    info(...args) {
        this._log.info(...args);
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
        this._log.warn(...args);
    }
}
/**
 * Log levels
 */
Log.levels = LogLevelModule.levels;
export const Logger = Log.getInstance().getLogLevelInstance();
export default Log;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9sb2cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IkFBQUE7Ozs7R0FJRztBQUVILE9BQU8sS0FBSyxjQUFjLE1BQU0sVUFBVSxDQUFDO0FBQzNDLE9BQU8sRUFBRSxZQUFZLEVBQUUsTUFBTSxhQUFhLENBQUM7QUFhM0M7OztHQUdHO0FBQ0gsTUFBTSxHQUFHO0lBMkJQOzs7T0FHRztJQUNILFlBQVksT0FBb0I7UUFDOUIsSUFBSTtZQUNGLElBQUksQ0FBQyxJQUFJLEdBQUcsQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsU0FBUyxDQUFDLFlBQVksQ0FBQyxDQUFDO1NBQ25IO1FBQUMsV0FBTTtZQUNOLDJCQUEyQjtZQUMzQixPQUFPLENBQUMsSUFBSSxDQUFDLDZCQUE2QixDQUFDLENBQUM7WUFDNUMsSUFBSSxDQUFDLElBQUksR0FBRyxPQUFjLENBQUM7U0FDNUI7SUFDSCxDQUFDO0lBakNEOzs7T0FHRztJQUNILE1BQU0sQ0FBQyxXQUFXO1FBQ2hCLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFO1lBQ2pCLEdBQUcsQ0FBQyxRQUFRLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztTQUMxQjtRQUNELE9BQU8sR0FBRyxDQUFDLFFBQVEsQ0FBQztJQUN0QixDQUFDO0lBMEJEOzs7T0FHRztJQUNILEtBQUssQ0FBQyxHQUFHLElBQVc7UUFDbEIsSUFBSSxDQUFDLElBQUksQ0FBQyxLQUFLLENBQUMsR0FBRyxJQUFJLENBQUMsQ0FBQztJQUMzQixDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsS0FBSyxDQUFDLEdBQUcsSUFBVztRQUNsQixJQUFJLENBQUMsSUFBSSxDQUFDLEtBQUssQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO0lBQzNCLENBQUM7SUFFRDs7O09BR0c7SUFDSCxtQkFBbUI7UUFDakIsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ25CLENBQUM7SUFFRDs7O09BR0c7SUFDSCxJQUFJLENBQUMsR0FBRyxJQUFXO1FBQ2pCLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDLEdBQUcsSUFBSSxDQUFDLENBQUM7SUFDMUIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsZUFBZSxDQUFDLEtBQWtDO1FBQ2hELElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUU7WUFDN0IsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDbEM7YUFBTTtZQUNMLDJCQUEyQjtZQUMzQixPQUFPLENBQUMsSUFBSSxDQUFDLCtCQUErQixDQUFDLENBQUM7U0FDL0M7SUFDSCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsSUFBSSxDQUFDLEdBQUcsSUFBVztRQUNqQixJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksQ0FBQyxDQUFDO0lBQzFCLENBQUM7O0FBMUZEOztHQUVHO0FBQ0ksVUFBTSxHQUE0QixjQUFjLENBQUMsTUFBTSxDQUFDO0FBMEZqRSxNQUFNLENBQUMsTUFBTSxNQUFNLEdBQUcsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLG1CQUFtQixFQUFFLENBQUM7QUFFOUQsZUFBZSxHQUFHLENBQUMifQ==