'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var tslib = require('tslib');
var loglevel = require('loglevel');
var constants = require('./constants.js');

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
                Log.loglevelInstance = (options && options.LogLevelModule ? options.LogLevelModule : loglevel).getLogger(constants.PACKAGE_NAME);
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
        (_a = this._log).debug.apply(_a, tslib.__spreadArray([this._prefix], args, false));
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
        (_a = this._log).error.apply(_a, tslib.__spreadArray([this._prefix], args, false));
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
        (_a = this._log).info.apply(_a, tslib.__spreadArray([this._prefix], args, false));
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
        (_a = this._log).warn.apply(_a, tslib.__spreadArray([this._prefix], args, false));
    };
    /**
     * Log levels
     */
    Log.levels = loglevel.levels;
    return Log;
}());
var Logger = Log.getLogLevelInstance();

exports.Logger = Logger;
exports.default = Log;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibG9nLmpzIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2xvZy50cyJdLCJzb3VyY2VzQ29udGVudCI6W251bGxdLCJuYW1lcyI6WyJQQUNLQUdFX05BTUUiLCJfX3NwcmVhZEFycmF5Il0sIm1hcHBpbmdzIjoiOzs7Ozs7OztBQWNBOzs7O0FBSUc7QUFDSCxJQUFBLEdBQUEsa0JBQUEsWUFBQTtBQXVDRTs7OztBQUlHO0lBQ0gsU0FBQSxHQUFBLENBQVksR0FBVyxFQUFFLE9BQW9CLEVBQUE7UUFDM0MsSUFBSSxDQUFDLElBQUksR0FBRyxHQUFHLENBQUMsbUJBQW1CLENBQUMsT0FBTyxDQUFDO0FBQzVDLFFBQUEsSUFBSSxDQUFDLE9BQU8sR0FBRyxnQkFBQSxDQUFBLE1BQUEsQ0FBaUIsR0FBRyxNQUFHO0lBQ3hDO0FBekNBOzs7O0FBSUc7SUFDSSxHQUFBLENBQUEsbUJBQW1CLEdBQTFCLFVBQTJCLE9BQW9CLEVBQUE7QUFDN0MsUUFBQSxJQUFJLENBQUMsR0FBRyxDQUFDLGdCQUFnQixFQUFFO0FBQ3pCLFlBQUEsSUFBSTtnQkFDRixHQUFHLENBQUMsZ0JBQWdCLEdBQUcsQ0FBQyxPQUFPLElBQUksT0FBTyxDQUFDLGNBQWMsR0FBRyxPQUFPLENBQUMsY0FBYyxHQUFHLFFBQVEsRUFBRSxTQUFTLENBQUNBLHNCQUFZLENBQUM7WUFDeEg7QUFBRSxZQUFBLE9BQUEsRUFBQSxFQUFNOztBQUVOLGdCQUFBLE9BQU8sQ0FBQyxJQUFJLENBQUMsNkJBQTZCLENBQUM7QUFDM0MsZ0JBQUEsR0FBRyxDQUFDLGdCQUFnQixHQUFHLE9BQWM7WUFDdkM7UUFDRjtRQUNBLE9BQU8sR0FBRyxDQUFDLGdCQUFnQjtJQUM3QixDQUFDO0FBMkJEOzs7QUFHRztBQUNILElBQUEsR0FBQSxDQUFBLFNBQUEsQ0FBQSxLQUFLLEdBQUwsWUFBQTs7UUFBTSxJQUFBLElBQUEsR0FBQSxFQUFBO2FBQUEsSUFBQSxFQUFBLEdBQUEsQ0FBYyxFQUFkLEVBQUEsR0FBQSxTQUFBLENB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
