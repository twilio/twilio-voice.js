import { InvalidArgumentError } from './errors/index.js';

/**
 * A Map of DTMF Sound Names to their mock frequency pairs.
 */
const bandFrequencies = {
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
class DialtonePlayer {
    constructor(_context) {
        this._context = _context;
        /**
         * Gain nodes, reducing the frequency.
         */
        this._gainNodes = [];
        this._gainNodes = [
            this._context.createGain(),
            this._context.createGain(),
        ];
        this._gainNodes.forEach((gainNode) => {
            gainNode.connect(this._context.destination);
            gainNode.gain.value = 0.1;
            this._gainNodes.push(gainNode);
        });
    }
    cleanup() {
        this._gainNodes.forEach((gainNode) => {
            gainNode.disconnect();
        });
    }
    /**
     * Play the dual frequency tone for the passed DTMF name.
     * @param sound
     */
    play(sound) {
        const frequencies = bandFrequencies[sound];
        if (!frequencies) {
            throw new InvalidArgumentError('Invalid DTMF sound name');
        }
        const oscillators = [
            this._context.createOscillator(),
            this._context.createOscillator(),
        ];
        oscillators.forEach((oscillator, i) => {
            oscillator.type = 'sine';
            oscillator.frequency.value = frequencies[i];
            oscillator.connect(this._gainNodes[i]);
            oscillator.start();
            oscillator.stop(this._context.currentTime + 0.1);
            oscillator.addEventListener('ended', () => oscillator.disconnect());
        });
    }
}

export { DialtonePlayer as default };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlhbHRvbmVQbGF5ZXIuanMiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vZGlhbHRvbmVQbGF5ZXIudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUFFQTs7QUFFRztBQUNILE1BQU0sZUFBZSxHQUFzQztBQUN6RCxJQUFBLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7QUFDbEIsSUFBQSxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO0FBQ2xCLElBQUEsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztBQUNsQixJQUFBLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7QUFDbEIsSUFBQSxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO0FBQ2xCLElBQUEsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztBQUNsQixJQUFBLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7QUFDbEIsSUFBQSxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO0FBQ2xCLElBQUEsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztBQUNsQixJQUFBLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7QUFDbEIsSUFBQSxLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO0FBQ2xCLElBQUEsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztDQUNuQjtBQUVhLE1BQU8sY0FBYyxDQUFBO0FBTWpDLElBQUEsV0FBQSxDQUFvQixRQUFzQixFQUFBO1FBQXRCLElBQUEsQ0FBQSxRQUFRLEdBQVIsUUFBUTtBQUw1Qjs7QUFFRztRQUNILElBQUEsQ0FBQSxVQUFVLEdBQWUsRUFBRTtRQUd6QixJQUFJLENBQUMsVUFBVSxHQUFHO0FBQ2hCLFlBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxVQUFVLEVBQUU7QUFDMUIsWUFBQSxJQUFJLENBQUMsUUFBUSxDQUFDLFVBQVUsRUFBRTtTQUMzQjtRQUVELElBQUksQ0FBQyxVQUFVLENBQUMsT0FBTyxDQUFDLENBQUMsUUFBa0IsS0FBSTtZQUM3QyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDO0FBQzNDLFlBQUEsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsR0FBRztBQUN6QixZQUFBLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztBQUNoQyxRQUFBLENBQUMsQ0FBQztJQUNKO0lBRUEsT0FBTyxHQUFBO1FBQ0wsSUFBSSxDQUFDLFVBQVUsQ0FBQyxPQUFPLENBQUMsQ0FBQyxRQUFrQixLQUFJO1lBQzdDLFFBQVEsQ0FBQyxVQUFVLEVBQUU7QUFDdkIsUUFBQSxDQUFDLENBQUM7SUFDSjtBQUVBOzs7QUFHRztBQUNILElBQUEsSUFBSSxDQUFDLEtBQWEsRUFBQTtBQUNoQixRQUFBLE1BQU0sV0FBVyxHQUFHLGVBQWUsQ0FBQyxLQUFLLENBQUM7UUFFMUMsSUFBSSxDQUFDLFdBQVcsRUFBRTtBQUNoQixZQUFBLE1BQU0sSUFBSSxvQkFBb0IsQ0FBQyx5QkFBeUIsQ0FBQztRQUMzRDtBQUVBLFFBQUEsTUFBTSxXQUFXLEdBQXFCO0FBQ3BDLFlBQUEsSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRTtBQUNoQyxZQUFBLElBQUksQ0FBQyxRQUFRLENBQUMsZ0JBQWdCLEVBQUU7U0FDakM7UUFFRCxXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsVUFBMEIsRUFBRSxDQUFTLEtBQUk7QUFDNUQsWUFBQSxVQUFVLENBQUMsSUFBSSxHQUFHLE1BQXdCO1lBQzFDLFVBQVUsQ0FBQyxTQUFTLENBQUMsS0FBSyxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUM7WUFDM0MsVUFBVSxDQUFDLE9BQU8sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3RDLFVBQVUsQ0FBQyxLQUFLLEVBQUU7WUFDbEIsVUFBVSxDQUFDLElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLFdBQVcsR0FBRyxHQUFHLENBQUM7QUFDaEQsWUFBQSxVQUFVLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxFQUFFLE1BQU0sVUFBVSxDQUFDLFVBQVUsRUFBRSxDQUFDO0FBQ3JFLFFBQUEsQ0FBQyxDQUFDO0lBQ0o7QUFDRDs7OzsifQ==
