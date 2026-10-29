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
        ? line.replace(/(\r?)$/, `;maxaveragebitrate=${maxAverageBitrate}$1`)
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
