import { InvalidArgumentError } from './errors';

/**
 * A Map of DTMF Sound Names to their mock frequency pairs.
 */
const bandFrequencies: Partial<Record<string, number[]>> = {
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
  /**
   * Gain nodes, reducing the frequency.
   */
  _gainNodes: GainNode[] = [];

  constructor(private _context: AudioContext) {
    this._gainNodes = [
      this._context.createGain(),
      this._context.createGain(),
    ];

    this._gainNodes.forEach((gainNode: GainNode) => {
      gainNode.connect(this._context.destination);
      gainNode.gain.value = 0.1;
      this._gainNodes.push(gainNode);
    });
  }

  cleanup(): void {
    this._gainNodes.forEach((gainNode: GainNode) => {
      gainNode.disconnect();
    });
  }

  /**
   * Play the dual frequency tone for the passed DTMF name.
   * @param sound
   */
  play(sound: string): void {
    const frequencies = bandFrequencies[sound];

    if (!frequencies) {
      throw new InvalidArgumentError('Invalid DTMF sound name');
    }

    const oscillators: OscillatorNode[] = [
      this._context.createOscillator(),
      this._context.createOscillator(),
    ];

    oscillators.forEach((oscillator: OscillatorNode, i: number) => {
      oscillator.type = 'sine' as OscillatorType;
      oscillator.frequency.value = frequencies[i];
      oscillator.connect(this._gainNodes[i]);
      oscillator.start();
      oscillator.stop(this._context.currentTime + 0.1);
      oscillator.addEventListener('ended', () => oscillator.disconnect());
    });
  }
}
