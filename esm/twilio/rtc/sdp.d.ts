declare function getPreferredCodecInfo(sdp: any): {
    codecName: string;
    codecParams: string;
};
declare function setIceAggressiveNomination(sdp: any): any;
declare function setMaxAverageBitrate(sdp: any, maxAverageBitrate: any): any;
/**
 * Return a new SDP string with the re-ordered codec preferences.
 * @param {string} sdp
 * @param {Array<AudioCodec>} preferredCodecs - If empty, the existing order
 *   of audio codecs is preserved
 * @returns {string} Updated SDP string
 */
declare function setCodecPreferences(sdp: any, preferredCodecs: any): string;
export { getPreferredCodecInfo, setCodecPreferences, setIceAggressiveNomination, setMaxAverageBitrate, };
