"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TwilioError = exports.Logger = exports.PreflightTest = exports.Device = exports.Call = void 0;
var call_1 = require("./twilio/call");
exports.Call = call_1.default;
var device_1 = require("./twilio/device");
exports.Device = device_1.default;
var log_1 = require("./twilio/log");
Object.defineProperty(exports, "Logger", { enumerable: true, get: function () { return log_1.Logger; } });
var preflight_1 = require("./twilio/preflight/preflight");
Object.defineProperty(exports, "PreflightTest", { enumerable: true, get: function () { return preflight_1.PreflightTest; } });
// TODO: Consider refactoring this export (VBLOCKS-4589)
var TwilioError = require("./twilio/errors");
exports.TwilioError = TwilioError;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoidHdpbGlvLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vbGliL3R3aWxpby50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7QUFDQSxzQ0FBaUM7QUFzQlIsZUF0QmxCLGNBQUksQ0FzQmtCO0FBckI3QiwwQ0FBcUM7QUFxQk4saUJBckJ4QixnQkFBTSxDQXFCd0I7QUFwQnJDLG9DQUFzQztBQW9CZ0IsdUZBcEI3QyxZQUFNLE9Bb0I2QztBQWxCNUQsMERBQTZEO0FBa0J0Qiw4RkFsQjlCLHlCQUFhLE9Ba0I4QjtBQWZwRCx3REFBd0Q7QUFDeEQsNkNBQStDO0FBY2Usa0NBQVcifQ==