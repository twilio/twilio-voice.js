/**
 * @packageDocumentation
 * @module Tools
 * @internalapi
 */
import { InvalidArgumentError } from './errors';
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
export default class DialtonePlayer {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZGlhbHRvbmVQbGF5ZXIuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi9saWIvdHdpbGlvL2RpYWx0b25lUGxheWVyLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7O0dBSUc7QUFFSCxPQUFPLEVBQUUsb0JBQW9CLEVBQUUsTUFBTSxVQUFVLENBQUM7QUFFaEQ7O0dBRUc7QUFDSCxNQUFNLGVBQWUsR0FBc0M7SUFDekQsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztJQUNsQixLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO0lBQ2xCLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7SUFDbEIsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztJQUNsQixLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO0lBQ2xCLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7SUFDbEIsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztJQUNsQixLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO0lBQ2xCLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7SUFDbEIsS0FBSyxFQUFFLENBQUMsSUFBSSxFQUFFLEdBQUcsQ0FBQztJQUNsQixLQUFLLEVBQUUsQ0FBQyxJQUFJLEVBQUUsR0FBRyxDQUFDO0lBQ2xCLEtBQUssRUFBRSxDQUFDLElBQUksRUFBRSxHQUFHLENBQUM7Q0FDbkIsQ0FBQztBQUVGLE1BQU0sQ0FBQyxPQUFPLE9BQU8sY0FBYztJQU1qQyxZQUFvQixRQUFzQjtRQUF0QixhQUFRLEdBQVIsUUFBUSxDQUFjO1FBTDFDOztXQUVHO1FBQ0gsZUFBVSxHQUFlLEVBQUUsQ0FBQztRQUcxQixJQUFJLENBQUMsVUFBVSxHQUFHO1lBQ2hCLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFO1lBQzFCLElBQUksQ0FBQyxRQUFRLENBQUMsVUFBVSxFQUFFO1NBQzNCLENBQUM7UUFFRixJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQWtCLEVBQUUsRUFBRTtZQUM3QyxRQUFRLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxDQUFDLENBQUM7WUFDNUMsUUFBUSxDQUFDLElBQUksQ0FBQyxLQUFLLEdBQUcsR0FBRyxDQUFDO1lBQzFCLElBQUksQ0FBQyxVQUFVLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxDQUFDO1FBQ2pDLENBQUMsQ0FBQyxDQUFDO0lBQ0wsQ0FBQztJQUVELE9BQU87UUFDTCxJQUFJLENBQUMsVUFBVSxDQUFDLE9BQU8sQ0FBQyxDQUFDLFFBQWtCLEVBQUUsRUFBRTtZQUM3QyxRQUFRLENBQUMsVUFBVSxFQUFFLENBQUM7UUFDeEIsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0lBRUQ7OztPQUdHO0lBQ0gsSUFBSSxDQUFDLEtBQWE7UUFDaEIsTUFBTSxXQUFXLEdBQUcsZUFBZSxDQUFDLEtBQUssQ0FBQyxDQUFDO1FBRTNDLElBQUksQ0FBQyxXQUFXLEVBQUU7WUFDaEIsTUFBTSxJQUFJLG9CQUFvQixDQUFDLHlCQUF5QixDQUFDLENBQUM7U0FDM0Q7UUFFRCxNQUFNLFdBQVcsR0FBcUI7WUFDcEMsSUFBSSxDQUFDLFFBQVEsQ0FBQyxnQkFBZ0IsRUFBRTtZQUNoQyxJQUFJLENBQUMsUUFBUSxDQUFDLGdCQUFnQixFQUFFO1NBQ2pDLENBQUM7UUFFRixXQUFXLENBQUMsT0FBTyxDQUFDLENBQUMsVUFBMEIsRUFBRSxDQUFTLEVBQUUsRUFBRTtZQUM1RCxVQUFVLENBQUMsSUFBSSxHQUFHLE1BQXdCLENBQUM7WUFDM0MsVUFBVSxDQUFDLFNBQVMsQ0FBQyxLQUFLLEdBQUcsV0FBVyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQzVDLFVBQVUsQ0FBQyxPQUFPLENBQUMsSUFBSSxDQUFDLFVBQVUsQ0FBQyxDQUFDLENBQUMsQ0FBQyxDQUFDO1lBQ3ZDLFVBQVUsQ0FBQyxLQUFLLEVBQUUsQ0FBQztZQUNuQixVQUFVLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsV0FBVyxHQUFHLEdBQUcsQ0FBQyxDQUFDO1lBQ2pELFVBQVUsQ0FBQyxnQkFBZ0IsQ0FBQyxPQUFPLEVBQUUsR0FBRyxFQUFFLENBQUMsVUFBVSxDQUFDLFVBQVUsRUFBRSxDQUFDLENBQUM7UUFDdEUsQ0FBQyxDQUFDLENBQUM7SUFDTCxDQUFDO0NBQ0YifQ==