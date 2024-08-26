/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
import * as util from '../util';
const ptToFixedBitrateAudioCodecName = {
    0: 'PCMU',
    8: 'PCMA',
};
const defaultOpusId = 111;
const BITRATE_MAX = 510000;
const BITRATE_MIN = 6000;
function getPreferredCodecInfo(sdp) {
    const [, codecId, codecName] = /a=rtpmap:(\d+) (\S+)/m.exec(sdp) || [null, '', ''];
    const regex = new RegExp(`a=fmtp:${codecId} (\\S+)`, 'm');
    const [, codecParams] = regex.exec(sdp) || [null, ''];
    return { codecName, codecParams };
}
function setIceAggressiveNomination(sdp) {
    // This only works on Chrome. We don't want any side effects on other browsers
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1024096
    // https://issues.corp.twilio.com/browse/CLIENT-6911
    if (!util.isChrome(window, window.navigator)) {
        return sdp;
    }
    return sdp.split('\n')
        .filter(line => line.indexOf('a=ice-lite') === -1)
        .join('\n');
}
function setMaxAverageBitrate(sdp, maxAverageBitrate) {
    if (typeof maxAverageBitrate !== 'number'
        || maxAverageBitrate < BITRATE_MIN
        || maxAverageBitrate > BITRATE_MAX) {
        return sdp;
    }
    const matches = /a=rtpmap:(\d+) opus/m.exec(sdp);
    const opusId = matches && matches.length ? matches[1] : defaultOpusId;
    const regex = new RegExp(`a=fmtp:${opusId}`);
    const lines = sdp.split('\n').map(line => regex.test(line)
        ? line + `;maxaveragebitrate=${maxAverageBitrate}`
        : line);
    return lines.join('\n');
}
/**
 * Return a new SDP string with the re-ordered codec preferences.
 * @param {string} sdp
 * @param {Array<AudioCodec>} preferredCodecs - If empty, the existing order
 *   of audio codecs is preserved
 * @returns {string} Updated SDP string
 */
function setCodecPreferences(sdp, preferredCodecs) {
    const mediaSections = getMediaSections(sdp);
    const session = sdp.split('\r\nm=')[0];
    return [session].concat(mediaSections.map(section => {
        // Codec preferences should not be applied to m=application sections.
        if (!/^m=(audio|video)/.test(section)) {
            return section;
        }
        const kind = section.match(/^m=(audio|video)/)[1];
        const codecMap = createCodecMapForMediaSection(section);
        const payloadTypes = getReorderedPayloadTypes(codecMap, preferredCodecs);
        const newSection = setPayloadTypesInMediaSection(payloadTypes, section);
        const pcmaPayloadTypes = codecMap.get('pcma') || [];
        const pcmuPayloadTypes = codecMap.get('pcmu') || [];
        const fixedBitratePayloadTypes = kind === 'audio'
            ? new Set(pcmaPayloadTypes.concat(pcmuPayloadTypes))
            : new Set();
        return fixedBitratePayloadTypes.has(payloadTypes[0])
            ? newSection.replace(/\r\nb=(AS|TIAS):([0-9]+)/g, '')
            : newSection;
    })).join('\r\n');
}
/**
 * Get the m= sections of a particular kind and direction from an sdp.
 * @param {string} sdp - SDP string
 * @param {string} [kind] - Pattern for matching kind
 * @param {string} [direction] - Pattern for matching direction
 * @returns {Array<string>} mediaSections
 */
function getMediaSections(sdp, kind, direction) {
    return sdp.replace(/\r\n\r\n$/, '\r\n').split('\r\nm=').slice(1).map(mediaSection => `m=${mediaSection}`).filter(mediaSection => {
        const kindPattern = new RegExp(`m=${kind || '.*'}`, 'gm');
        const directionPattern = new RegExp(`a=${direction || '.*'}`, 'gm');
        return kindPattern.test(mediaSection) && directionPattern.test(mediaSection);
    });
}
/**
 * Create a Codec Map for the given m= section.
 * @param {string} section - The given m= section
 * @returns {Map<Codec, Array<PT>>}
 */
function createCodecMapForMediaSection(section) {
    return Array.from(createPtToCodecName(section)).reduce((codecMap, pair) => {
        const pt = pair[0];
        const codecName = pair[1];
        const pts = codecMap.get(codecName) || [];
        return codecMap.set(codecName, pts.concat(pt));
    }, new Map());
}
/**
 * Create the reordered Codec Payload Types based on the preferred Codec Names.
 * @param {Map<Codec, Array<PT>>} codecMap - Codec Map
 * @param {Array<Codec>} preferredCodecs - Preferred Codec Names
 * @returns {Array<PT>} Reordered Payload Types
 */
function getReorderedPayloadTypes(codecMap, preferredCodecs) {
    preferredCodecs = preferredCodecs.map(codecName => codecName.toLowerCase());
    const preferredPayloadTypes = util.flatMap(preferredCodecs, codecName => codecMap.get(codecName) || []);
    const remainingCodecs = util.difference(Array.from(codecMap.keys()), preferredCodecs);
    const remainingPayloadTypes = util.flatMap(remainingCodecs, codecName => codecMap.get(codecName));
    return preferredPayloadTypes.concat(remainingPayloadTypes);
}
/**
 * Set the given Codec Payload Types in the first line of the given m= section.
 * @param {Array<PT>} payloadTypes - Payload Types
 * @param {string} section - Given m= section
 * @returns {string} - Updated m= section
 */
function setPayloadTypesInMediaSection(payloadTypes, section) {
    const lines = section.split('\r\n');
    let mLine = lines[0];
    const otherLines = lines.slice(1);
    mLine = mLine.replace(/([0-9]+\s?)+$/, payloadTypes.join(' '));
    return [mLine].concat(otherLines).join('\r\n');
}
/**
 * Create a Map from PTs to codec names for the given m= section.
 * @param {string} mediaSection - The given m= section.
 * @returns {Map<PT, Codec>} ptToCodecName
 */
function createPtToCodecName(mediaSection) {
    return getPayloadTypesInMediaSection(mediaSection).reduce((ptToCodecName, pt) => {
        const rtpmapPattern = new RegExp(`a=rtpmap:${pt} ([^/]+)`);
        const matches = mediaSection.match(rtpmapPattern);
        const codecName = matches
            ? matches[1].toLowerCase()
            : ptToFixedBitrateAudioCodecName[pt]
                ? ptToFixedBitrateAudioCodecName[pt].toLowerCase()
                : '';
        return ptToCodecName.set(pt, codecName);
    }, new Map());
}
/**
 * Get the Codec Payload Types present in the first line of the given m= section
 * @param {string} section - The m= section
 * @returns {Array<PT>} Payload Types
 */
function getPayloadTypesInMediaSection(section) {
    const mLine = section.split('\r\n')[0];
    // In "m=<kind> <port> <proto> <payload_type_1> <payload_type_2> ... <payload_type_n>",
    // the regex matches <port> and the PayloadTypes.
    const matches = mLine.match(/([0-9]+)/g);
    // This should not happen, but in case there are no PayloadTypes in
    // the m= line, return an empty array.
    if (!matches) {
        return [];
    }
    // Since only the PayloadTypes are needed, we discard the <port>.
    return matches.slice(1).map(match => parseInt(match, 10));
}
export { getPreferredCodecInfo, setCodecPreferences, setIceAggressiveNomination, setMaxAverageBitrate, };
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2RwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9ydGMvc2RwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBOzs7O0dBSUc7QUFDSCxjQUFjO0FBQ2QsT0FBTyxLQUFLLElBQUksTUFBTSxTQUFTLENBQUM7QUFFaEMsTUFBTSw4QkFBOEIsR0FBRztJQUNyQyxDQUFDLEVBQUUsTUFBTTtJQUNULENBQUMsRUFBRSxNQUFNO0NBQ1YsQ0FBQztBQUVGLE1BQU0sYUFBYSxHQUFHLEdBQUcsQ0FBQztBQUMxQixNQUFNLFdBQVcsR0FBRyxNQUFNLENBQUM7QUFDM0IsTUFBTSxXQUFXLEdBQUcsSUFBSSxDQUFDO0FBRXpCLFNBQVMscUJBQXFCLENBQUMsR0FBRztJQUNoQyxNQUFNLENBQUMsRUFBRSxPQUFPLEVBQUUsU0FBUyxDQUFDLEdBQUcsdUJBQXVCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsQ0FBQztJQUNuRixNQUFNLEtBQUssR0FBRyxJQUFJLE1BQU0sQ0FBQyxVQUFVLE9BQU8sU0FBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQzFELE1BQU0sQ0FBQyxFQUFFLFdBQVcsQ0FBQyxHQUFHLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLENBQUM7SUFDdEQsT0FBTyxFQUFFLFNBQVMsRUFBRSxXQUFXLEVBQUUsQ0FBQztBQUNwQyxDQUFDO0FBRUQsU0FBUywwQkFBMEIsQ0FBQyxHQUFHO0lBQ3JDLDhFQUE4RTtJQUM5RSxnRUFBZ0U7SUFDaEUsb0RBQW9EO0lBQ3BELElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLEVBQUU7UUFDNUMsT0FBTyxHQUFHLENBQUM7S0FDWjtJQUVELE9BQU8sR0FBRyxDQUFDLEtBQUss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