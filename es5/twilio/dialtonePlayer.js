'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var index = require('./errors/index.js');

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
            throw new index.InvalidArgumentError('Invalid DTMF sound name');
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlhbHRvbmVQbGF5ZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vZGlhbHRvbmVQbGF5ZXIudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOlsiSW52YWxpZEFyZ3VtZW50RXJyb3IiXSwibWFwcGluZ3MiOiI7Ozs7OztBQUVBOztBQUVHO0FBQ0gsSUFBTSxlQUFlLEdBQXNDO0FBQ3pELElBQUEsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztBQUNsQixJQUFBLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7QUFDbEIsSUFBQSxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO0FBQ2xCLElBQUEsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztBQUNsQixJQUFBLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7QUFDbEIsSUFBQSxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO0FBQ2xCLElBQUEsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztBQUNsQixJQUFBLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7QUFDbEIsSUFBQSxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO0FBQ2xCLElBQUEsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztBQUNsQixJQUFBLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7QUFDbEIsSUFBQSxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO0NBQ25CO0FBRUQsSUFBQSxjQUFBLGtCQUFBLFlBQUE7QUFNRSxJQUFBLFNBQUEsY0FBQSxDQUFvQixRQUFzQixFQUFBO1FBQTFDLElBQUEsS0FBQSxHQUFBLElBQUE7UUFBb0IsSUFBQSxDQUFBLFFBQVEsR0FBUixRQUFRO0FBTDVCOztBQUVHO1FBQ0gsSUFBQSxDQUFBLFVBQVUsR0FBZSxFQUFFO1FBR3pCLElBQUksQ0FBQyxVQUFVLEdBQUc7QUFDaEIsWUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRTtBQUMxQixZQUFBLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFO1NBQzNCO0FBRUQsUUFBQSxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxVQUFDLFFBQWtCLEVBQUE7WUFDekMsUUFBUSxDQUFDLE9BQU8sQ0FBQyxLQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsQ0FBQztBQUMzQyxZQUFBLFFBQVEsQ0FBQyxJQUFJLENBQUMsS0FBSyxHQUFHLEdBQUc7QUFDekIsWUFBQSxLQUFJLENBQUMsVUFBVSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUM7QUFDaEMsUUFBQSxDQUFDLENBQUM7SUFDSjtBQUVBLElBQUEsY0FBQSxDQUFBLFNBQUEsQ0FBQSxPQUFPLEdBQVAsWUFBQTtBQUNFLFFBQUEsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsVUFBQyxRQUFrQixFQUFBO1lBQ3pDLFFBQVEsQ0FBQyxVQUFVLEVBQUU7QUFDdkIsUUFBQSxDQUFDLENBQUM7SUFDSixDQUFDO0FBRUQ7OztBQUdHO0lBQ0gsY0FBQSxDQUFBLFNBQUEsQ0FBQSxJQUFJLEdBQUosVUFBSyxLQUFhLEVBQUE7UUFBbEIsSUFBQSxLQUFBLEdBQUEsSUFBQTtBQUNFLFFBQUEsSUFBTSxXQUFXLEdBQUcsZUFBZSxDQUFDLEtBQUssQ0FBQztRQUUxQyxJQUFJLENBQUMsV0FBVyxFQUFFO0FBQ2hCLFlBQUEsTUFBTSxJQUFJQSwwQkFBb0IsQ0FBQyx5QkFBeUIsQ0FBQztRQUMzRDtBQUVBLFFBQUEsSUFBTSxXQUFXLEdBQXFCO0FBQ3BDLFlBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRTtBQUNoQyxZQUFBLElBQUksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLEVBQUU7U0FDakM7QUFFRCxRQUFBLFdBQVcsQ0FBQyxPQUFPLENBQUMsVUFBQyxVQUEwQixFQUFFLENBQVMsRUFBQTtBQUN4RCxZQUFBLFVBQVUsQ0FBQyxJQUFJLEdBQUcsTUFBd0I7WUFDMUMsVUFBVSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQztZQUMzQyxVQUFVLENBQUMsT0FBTyxDQUFDLEtBQUksQ0FBQyxVQUFVLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdEMsVUFBVSxDQUFDLEtBQUssRUFBRTtZQUNsQixVQUFVLENBQUMsSUFBSSxDQUFDLEtBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxHQUFHLEdBQUcsQ0FBQztBQUNoRCxZQUFBLFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsWUFBQSxFQUFNLE9BQUEsVUFBVSxDQUFDLFVBQVUsRUFBRSxDQUFBLENBQXZCLENBQXVCLENBQUM7QUFDckUsUUFBQSxDQUFDLENBQUM7SUFDSixDQUFDO0lBQ0gsT0FBQSxjQUFDO0FBQUQsQ0FBQyxFQWxERDs7OzsifQ==
