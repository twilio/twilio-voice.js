/**
 * @packageDocumentation
 * @module Tools
 * @internalapi
 */
export default class DialtonePlayer {
    private _context;
    /**
     * Gain nodes, reducing the frequency.
     */
    _gainNodes: GainNode[];
    constructor(_context: AudioContext);
    cleanup(): void;
    /**
     * Play the dual frequency tone for the passed DTMF name.
     * @param sound
     */
    play(sound: string): void;
}
