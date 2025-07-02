"use strict";
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
var LogLevelModule = require("loglevel");
var constants_1 = require("./constants");
/**
 * {@link Log} provides logging features throughout the sdk using loglevel module
 * See https://github.com/pimterry/loglevel for documentation
 * @private
 */
var Log = /** @class */ (function () {
    /**
     * @constructor
     * @param [tag] - tag name for the logs
     * @param [options] - Optional settings
     */
    function Log(tag, options) {
        this._log = Log.getLogLevelInstance(options);
        this._prefix = "[TwilioVoice][".concat(tag, "]");
    }
    /**
     * Return the `loglevel` instance maintained internally.
     * @param [options] - Optional settings
     * @returns The `loglevel` instance.
     */
    Log.getLogLevelInstance = function (options) {
        if (!Log.loglevelInstance) {
            try {
                Log.loglevelInstance = (options && options.LogLevelModule ? options.LogLevelModule : LogLevelModule).getLogger(constants_1.PACKAGE_NAME);
            }
            catch (_a) {
                // tslint:disable-next-line
                console.warn('Cannot create custom logger');
                Log.loglevelInstance = console;
            }
        }
        return Log.loglevelInstance;
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
        (_a = this._log).debug.apply(_a, __spreadArray([this._prefix], args, false));
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
        (_a = this._log).error.apply(_a, __spreadArray([this._prefix], args, false));
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
        (_a = this._log).info.apply(_a, __spreadArray([this._prefix], args, false));
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
        (_a = this._log).warn.apply(_a, __spreadArray([this._prefix], args, false));
    };
    /**
     * Log levels
     */
    Log.levels = LogLevelModule.levels;
    return Log;
}());
exports.Logger = Log.getLogLevelInstance();
exports.default = Log;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9sb2cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7Ozs7Ozs7Ozs7O0FBQUEseUNBQTJDO0FBQzNDLHlDQUEyQztBQWEzQzs7OztHQUlHO0FBQ0g7SUF1Q0U7Ozs7T0FJRztJQUNILGFBQVksR0FBVyxFQUFFLE9BQW9CO1FBQzNDLElBQUksQ0FBQyxJQUFJLEdBQUcsR0FBRyxDQUFDLG1CQUFtQixDQUFDLE9BQU8sQ0FBQyxDQUFDO1FBQzdDLElBQUksQ0FBQyxPQUFPLEdBQUcsd0JBQWlCLEdBQUcsTUFBRyxDQUFDO0lBQ3pDLENBQUM7SUF6Q0Q7Ozs7T0FJRztJQUNJLHVCQUFtQixHQUExQixVQUEyQixPQUFvQjtRQUM3QyxJQUFJLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDMUIsSUFBSSxDQUFDO2dCQUNILEdBQUcsQ0FBQyxnQkFBZ0IsR0FBRyxDQUFDLE9BQU8sSUFBSSxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxPQUFPLENBQUMsY0FBYyxDQUFDLENBQUMsQ0FBQyxjQUFjLENBQUMsQ0FBQyxTQUFTLENBQUMsd0JBQVksQ0FBQyxDQUFDO1lBQy9ILENBQUM7WUFBQyxXQUFNLENBQUM7Z0JBQ1AsMkJBQTJCO2dCQUMzQixPQUFPLENBQUMsSUFBSSxDQUFDLDZCQUE2QixDQUFDLENBQUM7Z0JBQzVDLEdBQUcsQ0FBQyxnQkFBZ0IsR0FBRyxPQUFjLENBQUM7WUFDeEMsQ0FBQztRQUNILENBQUM7UUFDRCxPQUFPLEdBQUcsQ0FBQyxnQkFBZ0IsQ0FBQztJQUM5QixDQUFDO0lBMkJEOzs7T0FHRztJQUNILG1CQUFLLEdBQUw7O1FBQU0sY0FBYzthQUFkLFVBQWMsRUFBZCxxQkFBYyxFQUFkLElBQWM7WUFBZCx5QkFBYzs7UUFDbEIsQ0FBQSxLQUFBLElBQUksQ0FBQyxJQUFJLENBQUEsQ0FBQyxLQUFLLDBCQUFDLElBQUksQ0FBQyxPQUFPLEdBQUssSUFBSSxVQUFFO0lBQ3pDLENBQUM7SUFFRDs7O09BR0c7SUFDSCxtQkFBSyxHQUFMOztRQUFNLGNBQWM7YUFBZCxVQUFjLEVBQWQscUJBQWMsRUFBZCxJQUFjO1lBQWQseUJBQWM7O1FBQ2xCLENBQUEsS0FBQSxJQUFJLENBQUMsSUFBSSxDQUFBLENBQUMsS0FBSywwQkFBQyxJQUFJLENBQUMsT0FBTyxHQUFLLElBQUksVUFBRTtJQUN6QyxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsa0JBQUksR0FBSjs7UUFBSyxjQUFjO2FBQWQsVUFBYyxFQUFkLHFCQUFjLEVBQWQsSUFBYztZQUFkLHlCQUFjOztRQUNqQixDQUFBLEtBQUEsSUFBSSxDQUFDLElBQUksQ0FBQSxDQUFDLElBQUksMEJBQUMsSUFBSSxDQUFDLE9BQU8sR0FBSyxJQUFJLFVBQUU7SUFDeEMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsNkJBQWUsR0FBZixVQUFnQixLQUFrQztRQUNoRCxJQUFJLElBQUksQ0FBQyxJQUFJLENBQUMsZUFBZSxFQUFFLENBQUM7WUFDOUIsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7UUFDbkMsQ0FBQzthQUFNLENBQUM7WUFDTiwyQkFBMkI7WUFDM0IsT0FBTyxDQUFDLElBQUksQ0FBQywrQkFBK0IsQ0FBQyxDQUFDO1FBQ2hELENBQUM7SUFDSCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsa0JBQUksR0FBSjs7UUFBSyxjQUFjO2FBQWQsVUFBYyxFQUFkLHFCQUFjLEVBQWQsSUFBYztZQUFkLHlCQUFjOztRQUNqQixDQUFBLEtBQUEsSUFBSSxDQUFDLElBQUksQ0FBQSxDQUFDLElBQUksMEJBQUMsSUFBSSxDQUFDLE9BQU8sR0FBSyxJQUFJLFVBQUU7SUFDeEMsQ0FBQztJQTFGRDs7T0FFRztJQUNJLFVBQU0sR0FBNEIsY0FBYyxDQUFDLE1BQU0sQ0FBQztJQXdGakUsVUFBQztDQUFBLEFBNUZELElBNEZDO0FBRVksUUFBQSxNQUFNLEdBQUcsR0FBRyxDQUFDLG1CQUFtQixFQUFFLENBQUM7QUFFaEQsa0JBQWUsR0FBRyxDQUFDIn0=