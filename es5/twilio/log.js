"use strict";
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9sb2cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7OztBQUVILHlDQUEyQztBQUMzQyx5Q0FBMkM7QUFhM0M7OztHQUdHO0FBQ0g7SUEyQkU7OztPQUdHO0lBQ0gsYUFBWSxPQUFvQjtRQUM5QixJQUFJO1lBQ0YsSUFBSSxDQUFDLElBQUksR0FBRyxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxTQUFTLENBQUMsd0JBQVksQ0FBQyxDQUFDO1NBQ25IO1FBQUMsV0FBTTtZQUNOLDJCQUEyQjtZQUMzQixPQUFPLENBQUMsSUFBSSxDQUFDLDZCQUE2QixDQUFDLENBQUM7WUFDNUMsSUFBSSxDQUFDLElBQUksR0FBRyxPQUFjLENBQUM7U0FDNUI7SUFDSCxDQUFDO0lBakNEOzs7T0FHRztJQUNJLGVBQVcsR0FBbEI7UUFDRSxJQUFJLENBQUMsR0FBRyxDQUFDLFFBQVEsRUFBRTtZQUNqQixHQUFHLENBQUMsUUFBUSxHQUFHLElBQUksR0FBRyxFQUFFLENBQUM7U0FDMUI7UUFDRCxPQUFPLEdBQUcsQ0FBQyxRQUFRLENBQUM7SUFDdEIsQ0FBQztJQTBCRDs7O09BR0c7SUFDSCxtQkFBSyxHQUFMOztRQUFNLGNBQWM7YUFBZCxVQUFjLEVBQWQscUJBQWMsRUFBZCxJQUFjO1lBQWQseUJBQWM7O1FBQ2xCLENBQUEsS0FBQSxJQUFJLENBQUMsSUFBSSxDQUFBLENBQUMsS0FBSyxXQUFJLElBQUksRUFBRTtJQUMzQixDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsbUJBQUssR0FBTDs7UUFBTSxjQUFjO2FBQWQsVUFBYyxFQUFkLHFCQUFjLEVBQWQsSUFBYztZQUFkLHlCQUFjOztRQUNsQixDQUFBLEtBQUEsSUFBSSxDQUFDLElBQUksQ0FBQSxDQUFDLEtBQUssV0FBSSxJQUFJLEVBQUU7SUFDM0IsQ0FBQztJQUVEOzs7T0FHRztJQUNILGlDQUFtQixHQUFuQjtRQUNFLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQztJQUNuQixDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsa0JBQUksR0FBSjs7UUFBSyxjQUFjO2FBQWQsVUFBYyxFQUFkLHFCQUFjLEVBQWQsSUFBYztZQUFkLHlCQUFjOztRQUNqQixDQUFBLEtBQUEsSUFBSSxDQUFDLElBQUksQ0FBQSxDQUFDLElBQUksV0FBSSxJQUFJLEVBQUU7SUFDMUIsQ0FBQztJQUVEOztPQUVHO0lBQ0gsNkJBQWUsR0FBZixVQUFnQixLQUFrQztRQUNoRCxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFO1lBQzdCLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO1NBQ2xDO2FBQU07WUFDTCwyQkFBMkI7WUFDM0IsT0FBTyxDQUFDLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO1NBQy9DO0lBQ0gsQ0FBQztJQUVEOzs7T0FHRztJQUNILGtCQUFJLEdBQUo7O1FBQUssY0FBYzthQUFkLFVBQWMsRUFBZCxxQkFBYyxFQUFkLElBQWM7WUFBZCx5QkFBYzs7UUFDakIsQ0FBQSxLQUFBLElBQUksQ0FBQyxJQUFJLENBQUEsQ0FBQyxJQUFJLFdBQUksSUFBSSxFQUFFO0lBQzFCLENBQUM7SUExRkQ7O09BRUc7SUFDSSxVQUFNLEdBQTRCLGNBQWMsQ0FBQyxNQUFNLENBQUM7SUF3RmpFLFVBQUM7Q0FBQSxBQTVGRCxJQTRGQztBQUVZLFFBQUEsTUFBTSxHQUFHLEdBQUcsQ0FBQyxXQUFXLEVBQUUsQ0FBQyxtQkFBbUIsRUFBRSxDQUFDO0FBRTlELGtCQUFlLEdBQUcsQ0FBQyJ9