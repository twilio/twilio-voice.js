"use strict";
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlhbHRvbmVQbGF5ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2RpYWx0b25lUGxheWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsbUNBQWdEO0FBRWhEOztHQUVHO0FBQ0gsSUFBTSxlQUFlLEdBQXNDO0lBQ3pELEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7SUFDbEIsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztJQUNsQixLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO0lBQ2xCLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7SUFDbEIsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztJQUNsQixLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO0lBQ2xCLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7SUFDbEIsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztJQUNsQixLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO0lBQ2xCLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7SUFDbEIsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztJQUNsQixLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO0NBQ25CLENBQUM7QUFFRjtJQU1FLHdCQUFvQixRQUFzQjtRQUExQyxpQkFXQztRQVhtQixhQUFRLEdBQVIsUUFBUSxDQUFjO1FBTDFDOztXQUVHO1FBQ0gsZUFBVSxHQUFlLEVBQUUsQ0FBQztRQUcxQixJQUFJLENBQUMsVUFBVSxHQUFHO1lBQ2hCLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFO1lBQzFCLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFO1NBQzNCLENBQUM7UUFFRixJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxVQUFDLFFBQWtCO1lBQ3pDLFFBQVEsQ0FBQyxPQUFPLENBQUMsS0FBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLENBQUMsQ0FBQztZQUM1QyxRQUFRLENBQUMsSUFBSSxDQUFDLEtBQUssR0FBRyxHQUFHLENBQUM7WUFDMUIsS0FBSSxDQUFDLFVBQVUsQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLENBQUM7UUFDakMsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQsZ0NBQU8sR0FBUDtRQUNFLElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLFVBQUMsUUFBa0I7WUFDekMsUUFBUSxDQUFDLFVBQVUsRUFBRSxDQUFDO1FBQ3hCLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVEOzs7T0FHRztJQUNILDZCQUFJLEdBQUosVUFBSyxLQUFhO1FBQWxCLGlCQW9CQztRQW5CQyxJQUFNLFdBQVcsR0FBRyxlQUFlLENBQUMsS0FBSyxDQUFDLENBQUM7UUFFM0MsSUFBSSxDQUFDLFdBQVcsRUFBRSxDQUFDO1lBQ2pCLE1BQU0sSUFBSSw2QkFBb0IsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDO1FBQzVELENBQUM7UUFFRCxJQUFNLFdBQVcsR0FBcUI7WUFDcEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRTtZQUNoQyxJQUFJLENBQUMsUUFBUSxDQUFDLGdCQUFnQixFQUFFO1NBQ2pDLENBQUM7UUFFRixXQUFXLENBQUMsT0FBTyxDQUFDLFVBQUMsVUFBMEIsRUFBRSxDQUFTO1lBQ3hELFVBQVUsQ0FBQyxJQUFJLEdBQUcsTUFBd0IsQ0FBQztZQUMzQyxVQUFVLENBQUMsU0FBUyxDQUFDLEtBQUssR0FBRyxXQUFXLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDNUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxLQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDLENBQUM7WUFDdkMsVUFBVSxDQUFDLEtBQUssRUFBRSxDQUFDO1lBQ25CLFVBQVUsQ0FBQyxJQUFJLENBQUMsS0FBSSxDQUFDLFFBQVEsQ0FBQyxXQUFXLEdBQUcsR0FBRyxDQUFDLENBQUM7WUFDakQsVUFBVSxDQUFDLGdCQUFnQixDQUFDLE9BQU8sRUFBRSxjQUFNLE9BQUEsVUFBVSxDQUFDLFVBQVUsRUFBRSxFQUF2QixDQUF1QixDQUFDLENBQUM7UUFDdEUsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBQ0gscUJBQUM7QUFBRCxDQUFDLEFBbERELElBa0RDIn0=