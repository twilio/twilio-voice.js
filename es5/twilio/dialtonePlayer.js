"use strict";
/**
 * @packageDocumentation
 * @module Tools
 * @internalapi
 */
Object.defineProperty(exports, "__esModule", { value: true });
var errors_1 = require("./errors");
/**
 * A Map of DTMF Sound Names to their mock frequency pairs.
 */
var bandFrequencies = {
    dtmf0: [1360, 960],
    dtmf1: [1230, 720],
    dtmf2: [1360, 720],
    dtmf3: [1480, 720],
    dtmf4: [1230, 790],
    dtmf5: [1360, 790],
    dtmf6: [1480, 790],
    dtmf7: [1230, 870],
    dtmf8: [1360, 870],
    dtmf9: [1480, 870],
    dtmfh: [1480, 960],
    dtmfs: [1230, 960],
};
var DialtonePlayer = /** @class */ (function () {
    function DialtonePlayer(_context) {
        var _this = this;
        this._context = _context;
        /**
         * Gain nodes, reducing the frequency.
         */
        this._gainNodes = [];
        this._gainNodes = [
            this._context.createGain(),
            this._context.createGain(),
        ];
        this._gainNodes.forEach(function (gainNode) {
            gainNode.connect(_this._context.destination);
            gainNode.gain.value = 0.1;
            _this._gainNodes.push(gainNode);
        });
    }
    DialtonePlayer.prototype.cleanup = function () {
        this._gainNodes.forEach(function (gainNode) {
            gainNode.disconnect();
        });
    };
    /**
     * Play the dual frequency tone for the passed DTMF name.
     * @param sound
     */
    DialtonePlayer.prototype.play = function (sound) {
        var _this = this;
        var frequencies = bandFrequencies[sound];
        if (!frequencies) {
            throw new errors_1.InvalidArgumentError('Invalid DTMF sound name');
        }
        var oscillators = [
            this._context.createOscillator(),
            this._context.createOscillator(),
        ];
        oscillators.forEach(function (oscillator, i) {
            oscillator.type = 'sine';
            oscillator.frequency.value = frequencies[i];
            oscillator.connect(_this._gainNodes[i]);
            oscillator.start();
            oscillator.stop(_this._context.currentTime + 0.1);
            oscillator.addEventListener('ended', function () { return oscillator.disconnect(); });
        });
    };
    return DialtonePlayer;
}());
exports.default = DialtonePlayer;
//# sourceMappingURL=dialtonePlayer.js.map