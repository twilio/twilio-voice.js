"use strict";
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
Object.defineProperty(exports, "__esModule", { value: true });
var LogLevelModule = require("loglevel");
var constants_1 = require("./constants");
/**
 * {@link Log} provides logging features throught the sdk using loglevel module
 * See https://github.com/pimterry/loglevel for documentation
 */
var Log = /** @class */ (function () {
    /**
     * @constructor
     * @param [options] - Optional settings
     */
    function Log(options) {
        try {
            this._log = (options && options.LogLevelModule ? options.LogLevelModule : LogLevelModule).getLogger(constants_1.PACKAGE_NAME);
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
    Log.getInstance = function () {
        if (!Log.instance) {
            Log.instance = new Log();
        }
        return Log.instance;
    };
    /**
     * Log a debug message
     * @param args - Any number of arguments to be passed to loglevel.debug
     */
    Log.prototype.debug = function () {
        var _a;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        (_a = this._log).debug.apply(_a, args);
    };
    /**
     * Log an error message
     * @param args - Any number of arguments to be passed to loglevel.error
     */
    Log.prototype.error = function () {
        var _a;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        (_a = this._log).error.apply(_a, args);
    };
    /**
     * Return the `loglevel` instance maintained internally.
     * @returns The `loglevel` instance.
     */
    Log.prototype.getLogLevelInstance = function () {
        return this._log;
    };
    /**
     * Log an info message
     * @param args - Any number of arguments to be passed to loglevel.info
     */
    Log.prototype.info = function () {
        var _a;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        (_a = this._log).info.apply(_a, args);
    };
    /**
     * Set a default log level to disable all logging below the given level
     */
    Log.prototype.setDefaultLevel = function (level) {
        if (this._log.setDefaultLevel) {
            this._log.setDefaultLevel(level);
        }
        else {
            // tslint:disable-next-line
            console.warn('Logger cannot setDefaultLevel');
        }
    };
    /**
     * Log a warning message
     * @param args - Any number of arguments to be passed to loglevel.warn
     */
    Log.prototype.warn = function () {
        var _a;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        (_a = this._log).warn.apply(_a, args);
    };
    /**
     * Log levels
     */
    Log.levels = LogLevelModule.levels;
    return Log;
}());
exports.Logger = Log.getInstance().getLogLevelInstance();
exports.default = Log;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9sb2cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7O0FBRUgseUNBQTJDO0FBQzNDLHlDQUEyQztBQWEzQzs7O0dBR0c7QUFDSDtJQTJCRTs7O09BR0c7SUFDSCxhQUFZLE9BQW9CO1FBQzlCLElBQUk7WUFDRixJQUFJLENBQUMsSUFBSSxHQUFHLENBQUMsT0FBTyxJQUFJLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLE9BQU8sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLGNBQWMsQ0FBQyxDQUFDLFNBQVMsQ0FBQyx3QkFBWSxDQUFDLENBQUM7U0FDbkg7UUFBQyxXQUFNO1lBQ04sMkJBQTJCO1lBQzNCLE9BQU8sQ0FBQyxJQUFJLENBQUMsNkJBQTZCLENBQUMsQ0FBQztZQUM1QyxJQUFJLENBQUMsSUFBSSxHQUFHLE9BQWMsQ0FBQztTQUM1QjtJQUNILENBQUM7SUFqQ0Q7OztPQUdHO0lBQ0ksZUFBVyxHQUFsQjtRQUNFLElBQUksQ0FBQyxHQUFHLENBQUMsUUFBUSxFQUFFO1lBQ2pCLEdBQUcsQ0FBQyxRQUFRLEdBQUcsSUFBSSxHQUFHLEVBQUUsQ0FBQztTQUMxQjtRQUNELE9BQU8sR0FBRyxDQUFDLFFBQVEsQ0FBQztJQUN0QixDQUFDO0lBMEJEOzs7T0FHRztJQUNILG1CQUFLLEdBQUw7O1FBQU0sY0FBYzthQUFkLFVBQWMsRUFBZCxxQkFBYyxFQUFkLElBQWM7WUFBZCx5QkFBYzs7UUFDbEIsQ0FBQSxLQUFBLElBQUksQ0FBQyxJQUFJLENBQUEsQ0FBQyxLQUFLLFdBQUksSUFBSSxFQUFFO0lBQzNCLENBQUM7SUFFRDs7O09BR0c7SUFDSCxtQkFBSyxHQUFMOztRQUFNLGNBQWM7YUFBZCxVQUFjLEVBQWQscUJBQWMsRUFBZCxJQUFjO1lBQWQseUJBQWM7O1FBQ2xCLENBQUEsS0FBQSxJQUFJLENBQUMsSUFBSSxDQUFBLENBQUMsS0FBSyxXQUFJLElBQUksRUFBRTtJQUMzQixDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsaUNBQW1CLEdBQW5CO1FBQ0UsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDO0lBQ25CLENBQUM7SUFFRDs7O09BR0c7SUFDSCxrQkFBSSxHQUFKOztRQUFLLGNBQWM7YUFBZCxVQUFjLEVBQWQscUJBQWMsRUFBZCxJQUFjO1lBQWQseUJBQWM7O1FBQ2pCLENBQUEsS0FBQSxJQUFJLENBQUMsSUFBSSxDQUFBLENBQUMsSUFBSSxXQUFJLElBQUksRUFBRTtJQUMxQixDQUFDO0lBRUQ7O09BRUc7SUFDSCw2QkFBZSxHQUFmLFVBQWdCLEtBQWtDO1FBQ2hELElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUU7WUFDN0IsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDbEM7YUFBTTtZQUNMLDJCQUEyQjtZQUMzQixPQUFPLENBQUMsSUFBSSxDQUFDLCtCQUErQixDQUFDLENBQUM7U0FDL0M7SUFDSCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsa0JBQUksR0FBSjs7UUFBSyxjQUFjO2FBQWQsVUFBYyxFQUFkLHFCQUFjLEVBQWQsSUFBYztZQUFkLHlCQUFjOztRQUNqQixDQUFBLEtBQUEsSUFBSSxDQUFDLElBQUksQ0FBQSxDQUFDLElBQUksV0FBSSxJQUFJLEVBQUU7SUFDMUIsQ0FBQztJQTFGRDs7T0FFRztJQUNJLFVBQU0sR0FBNEIsY0FBYyxDQUFDLE1BQU0sQ0FBQztJQXdGakUsVUFBQztDQUFBLEFBNUZELElBNEZDO0FBRVksUUFBQSxNQUFNLEdBQUcsR0FBRyxDQUFDLFdBQVcsRUFBRSxDQUFDLG1CQUFtQixFQUFFLENBQUM7QUFFOUQsa0JBQWUsR0FBRyxDQUFDIn0=