"use strict";
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
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
        this._prefix = "[TwilioVoice][" + tag + "]";
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
        (_a = this._log).debug.apply(_a, __spreadArrays([this._prefix], args));
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
        (_a = this._log).error.apply(_a, __spreadArrays([this._prefix], args));
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
        (_a = this._log).info.apply(_a, __spreadArrays([this._prefix], args));
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
        (_a = this._log).warn.apply(_a, __spreadArrays([this._prefix], args));
    };
    /**
     * Log levels
     */
    Log.levels = LogLevelModule.levels;
    return Log;
}());
exports.Logger = Log.getLogLevelInstance();
exports.default = Log;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9sb2cudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6IjtBQUFBOzs7O0dBSUc7Ozs7Ozs7Ozs7QUFFSCx5Q0FBMkM7QUFDM0MseUNBQTJDO0FBYTNDOzs7O0dBSUc7QUFDSDtJQXVDRTs7OztPQUlHO0lBQ0gsYUFBWSxHQUFXLEVBQUUsT0FBb0I7UUFDM0MsSUFBSSxDQUFDLElBQUksR0FBRyxHQUFHLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDLENBQUM7UUFDN0MsSUFBSSxDQUFDLE9BQU8sR0FBRyxtQkFBaUIsR0FBRyxNQUFHLENBQUM7SUFDekMsQ0FBQztJQXpDRDs7OztPQUlHO0lBQ0ksdUJBQW1CLEdBQTFCLFVBQTJCLE9BQW9CO1FBQzdDLElBQUksQ0FBQyxHQUFHLENBQUMsZ0JBQWdCLEVBQUU7WUFDekIsSUFBSTtnQkFDRixHQUFHLENBQUMsZ0JBQWdCLEdBQUcsQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsT0FBTyxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsY0FBYyxDQUFDLENBQUMsU0FBUyxDQUFDLHdCQUFZLENBQUMsQ0FBQzthQUM5SDtZQUFDLFdBQU07Z0JBQ04sMkJBQTJCO2dCQUMzQixPQUFPLENBQUMsSUFBSSxDQUFDLDZCQUE2QixDQUFDLENBQUM7Z0JBQzVDLEdBQUcsQ0FBQyxnQkFBZ0IsR0FBRyxPQUFjLENBQUM7YUFDdkM7U0FDRjtRQUNELE9BQU8sR0FBRyxDQUFDLGdCQUFnQixDQUFDO0lBQzlCLENBQUM7SUEyQkQ7OztPQUdHO0lBQ0gsbUJBQUssR0FBTDs7UUFBTSxjQUFjO2FBQWQsVUFBYyxFQUFkLHFCQUFjLEVBQWQsSUFBYztZQUFkLHlCQUFjOztRQUNsQixDQUFBLEtBQUEsSUFBSSxDQUFDLElBQUksQ0FBQSxDQUFDLEtBQUssMkJBQUMsSUFBSSxDQUFDLE9BQU8sR0FBSyxJQUFJLEdBQUU7SUFDekMsQ0FBQztJQUVEOzs7T0FHRztJQUNILG1CQUFLLEdBQUw7O1FBQU0sY0FBYzthQUFkLFVBQWMsRUFBZCxxQkFBYyxFQUFkLElBQWM7WUFBZCx5QkFBYzs7UUFDbEIsQ0FBQSxLQUFBLElBQUksQ0FBQyxJQUFJLENBQUEsQ0FBQyxLQUFLLDJCQUFDLElBQUksQ0FBQyxPQUFPLEdBQUssSUFBSSxHQUFFO0lBQ3pDLENBQUM7SUFFRDs7O09BR0c7SUFDSCxrQkFBSSxHQUFKOztRQUFLLGNBQWM7YUFBZCxVQUFjLEVBQWQscUJBQWMsRUFBZCxJQUFjO1lBQWQseUJBQWM7O1FBQ2pCLENBQUEsS0FBQSxJQUFJLENBQUMsSUFBSSxDQUFBLENBQUMsSUFBSSwyQkFBQyxJQUFJLENBQUMsT0FBTyxHQUFLLElBQUksR0FBRTtJQUN4QyxDQUFDO0lBRUQ7O09BRUc7SUFDSCw2QkFBZSxHQUFmLFVBQWdCLEtBQWtDO1FBQ2hELElBQUksSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLEVBQUU7WUFDN0IsSUFBSSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7U0FDbEM7YUFBTTtZQUNMLDJCQUEyQjtZQUMzQixPQUFPLENBQUMsSUFBSSxDQUFDLCtCQUErQixDQUFDLENBQUM7U0FDL0M7SUFDSCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsa0JBQUksR0FBSjs7UUFBSyxjQUFjO2FBQWQsVUFBYyxFQUFkLHFCQUFjLEVBQWQsSUFBYztZQUFkLHlCQUFjOztRQUNqQixDQUFBLEtBQUEsSUFBSSxDQUFDLElBQUksQ0FBQSxDQUFDLElBQUksMkJBQUMsSUFBSSxDQUFDLE9BQU8sR0FBSyxJQUFJLEdBQUU7SUFDeEMsQ0FBQztJQTFGRDs7T0FFRztJQUNJLFVBQU0sR0FBNEIsY0FBYyxDQUFDLE1BQU0sQ0FBQztJQXdGakUsVUFBQztDQUFBLEFBNUZELElBNEZDO0FBRVksUUFBQSxNQUFNLEdBQUcsR0FBRyxDQUFDLG1CQUFtQixFQUFFLENBQUM7QUFFaEQsa0JBQWUsR0FBRyxDQUFDIn0=