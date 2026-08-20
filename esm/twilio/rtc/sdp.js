import { flatMap, difference, isChrome } from '../util.js';

// @ts-nocheck
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
    if (!isChrome(window, window.navigator)) {
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
        const kindPattern = new RegExp(`m=${'.*'}`, 'gm');
        const directionPattern = new RegExp(`a=${'.*'}`, 'gm');
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
    const preferredPayloadTypes = flatMap(preferredCodecs, codecName => codecMap.get(codecName) || []);
    const remainingCodecs = difference(Array.from(codecMap.keys()), preferredCodecs);
    const remainingPayloadTypes = flatMap(remainingCodecs, codecName => codecMap.get(codecName));
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

export { getPreferredCodecInfo, setCodecPreferences, setIceAggressiveNomination, setMaxAverageBitrate };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2RwLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9zZHAudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOlsidXRpbC5pc0Nocm9tZSIsInV0aWwuZmxhdE1hcCIsInV0aWwuZGlmZmVyZW5jZSJdLCJtYXBwaW5ncyI6Ijs7QUFBQTtBQUdBLE1BQU0sOEJBQThCLEdBQUc7QUFDckMsSUFBQSxDQUFDLEVBQUUsTUFBTTtBQUNULElBQUEsQ0FBQyxFQUFFLE1BQU07Q0FDVjtBQUVELE1BQU0sYUFBYSxHQUFHLEdBQUc7QUFDekIsTUFBTSxXQUFXLEdBQUcsTUFBTTtBQUMxQixNQUFNLFdBQVcsR0FBRyxJQUFJO0FBRXhCLFNBQVMscUJBQXFCLENBQUMsR0FBRyxFQUFBO0lBQ2hDLE1BQU0sR0FBRyxPQUFPLEVBQUUsU0FBUyxDQUFDLEdBQUcsdUJBQXVCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUM7SUFDbEYsTUFBTSxLQUFLLEdBQUcsSUFBSSxNQUFNLENBQUMsQ0FBQSxPQUFBLEVBQVUsT0FBTyxDQUFBLE9BQUEsQ0FBUyxFQUFFLEdBQUcsQ0FBQztBQUN6RCxJQUFBLE1BQU0sR0FBRyxXQUFXLENBQUMsR0FBRyxLQUFLLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsQ0FBQztBQUNyRCxJQUFBLE9BQU8sRUFBRSxTQUFTLEVBQUUsV0FBVyxFQUFFO0FBQ25DO0FBRUEsU0FBUywwQkFBMEIsQ0FBQyxHQUFHLEVBQUE7Ozs7QUFJckMsSUFBQSxJQUFJLENBQUNBLFFBQWEsQ0FBQyxNQUFNLEVBQUUsTUFBTSxDQUFDLFNBQVMsQ0FBQyxFQUFFO0FBQzVDLFFBQUEsT0FBTyxHQUFHO0lBQ1o7QUFFQSxJQUFBLE9BQU8sR0FBRyxDQUFDLEtBQUssQ0FBQyxJQUFJO0FBQ2xCLFNBQUEsTUFBTSxDQUFDLElBQUks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
