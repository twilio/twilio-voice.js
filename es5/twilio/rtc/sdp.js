"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setMaxAverageBitrate = exports.setIceAggressiveNomination = exports.setCodecPreferences = exports.getPreferredCodecInfo = void 0;
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
var util = require("../util");
var ptToFixedBitrateAudioCodecName = {
    0: 'PCMU',
    8: 'PCMA',
};
var defaultOpusId = 111;
var BITRATE_MAX = 510000;
var BITRATE_MIN = 6000;
function getPreferredCodecInfo(sdp) {
    var _a = /a=rtpmap:(\d+) (\S+)/m.exec(sdp) || [null, '', ''], codecId = _a[1], codecName = _a[2];
    var regex = new RegExp("a=fmtp:" + codecId + " (\\S+)", 'm');
    var _b = regex.exec(sdp) || [null, ''], codecParams = _b[1];
    return { codecName: codecName, codecParams: codecParams };
}
exports.getPreferredCodecInfo = getPreferredCodecInfo;
function setIceAggressiveNomination(sdp) {
    // This only works on Chrome. We don't want any side effects on other browsers
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1024096
    // https://issues.corp.twilio.com/browse/CLIENT-6911
    if (!util.isChrome(window, window.navigator)) {
        return sdp;
    }
    return sdp.split('\n')
        .filter(function (line) { return line.indexOf('a=ice-lite') === -1; })
        .join('\n');
}
exports.setIceAggressiveNomination = setIceAggressiveNomination;
function setMaxAverageBitrate(sdp, maxAverageBitrate) {
    if (typeof maxAverageBitrate !== 'number'
        || maxAverageBitrate < BITRATE_MIN
        || maxAverageBitrate > BITRATE_MAX) {
        return sdp;
    }
    var matches = /a=rtpmap:(\d+) opus/m.exec(sdp);
    var opusId = matches && matches.length ? matches[1] : defaultOpusId;
    var regex = new RegExp("a=fmtp:" + opusId);
    var lines = sdp.split('\n').map(function (line) { return regex.test(line)
        ? line + (";maxaveragebitrate=" + maxAverageBitrate)
        : line; });
    return lines.join('\n');
}
exports.setMaxAverageBitrate = setMaxAverageBitrate;
/**
 * Return a new SDP string with the re-ordered codec preferences.
 * @param {string} sdp
 * @param {Array<AudioCodec>} preferredCodecs - If empty, the existing order
 *   of audio codecs is preserved
 * @returns {string} Updated SDP string
 */
function setCodecPreferences(sdp, preferredCodecs) {
    var mediaSections = getMediaSections(sdp);
    var session = sdp.split('\r\nm=')[0];
    return [session].concat(mediaSections.map(function (section) {
        // Codec preferences should not be applied to m=application sections.
        if (!/^m=(audio|video)/.test(section)) {
            return section;
        }
        var kind = section.match(/^m=(audio|video)/)[1];
        var codecMap = createCodecMapForMediaSection(section);
        var payloadTypes = getReorderedPayloadTypes(codecMap, preferredCodecs);
        var newSection = setPayloadTypesInMediaSection(payloadTypes, section);
        var pcmaPayloadTypes = codecMap.get('pcma') || [];
        var pcmuPayloadTypes = codecMap.get('pcmu') || [];
        var fixedBitratePayloadTypes = kind === 'audio'
            ? new Set(pcmaPayloadTypes.concat(pcmuPayloadTypes))
            : new Set();
        return fixedBitratePayloadTypes.has(payloadTypes[0])
            ? newSection.replace(/\r\nb=(AS|TIAS):([0-9]+)/g, '')
            : newSection;
    })).join('\r\n');
}
exports.setCodecPreferences = setCodecPreferences;
/**
 * Get the m= sections of a particular kind and direction from an sdp.
 * @param {string} sdp - SDP string
 * @param {string} [kind] - Pattern for matching kind
 * @param {string} [direction] - Pattern for matching direction
 * @returns {Array<string>} mediaSections
 */
function getMediaSections(sdp, kind, direction) {
    return sdp.replace(/\r\n\r\n$/, '\r\n').split('\r\nm=').slice(1).map(function (mediaSection) { return "m=" + mediaSection; }).filter(function (mediaSection) {
        var kindPattern = new RegExp("m=" + (kind || '.*'), 'gm');
        var directionPattern = new RegExp("a=" + (direction || '.*'), 'gm');
        return kindPattern.test(mediaSection) && directionPattern.test(mediaSection);
    });
}
/**
 * Create a Codec Map for the given m= section.
 * @param {string} section - The given m= section
 * @returns {Map<Codec, Array<PT>>}
 */
function createCodecMapForMediaSection(section) {
    return Array.from(createPtToCodecName(section)).reduce(function (codecMap, pair) {
        var pt = pair[0];
        var codecName = pair[1];
        var pts = codecMap.get(codecName) || [];
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
    preferredCodecs = preferredCodecs.map(function (codecName) { return codecName.toLowerCase(); });
    var preferredPayloadTypes = util.flatMap(preferredCodecs, function (codecName) { return codecMap.get(codecName) || []; });
    var remainingCodecs = util.difference(Array.from(codecMap.keys()), preferredCodecs);
    var remainingPayloadTypes = util.flatMap(remainingCodecs, function (codecName) { return codecMap.get(codecName); });
    return preferredPayloadTypes.concat(remainingPayloadTypes);
}
/**
 * Set the given Codec Payload Types in the first line of the given m= section.
 * @param {Array<PT>} payloadTypes - Payload Types
 * @param {string} section - Given m= section
 * @returns {string} - Updated m= section
 */
function setPayloadTypesInMediaSection(payloadTypes, section) {
    var lines = section.split('\r\n');
    var mLine = lines[0];
    var otherLines = lines.slice(1);
    mLine = mLine.replace(/([0-9]+\s?)+$/, payloadTypes.join(' '));
    return [mLine].concat(otherLines).join('\r\n');
}
/**
 * Create a Map from PTs to codec names for the given m= section.
 * @param {string} mediaSection - The given m= section.
 * @returns {Map<PT, Codec>} ptToCodecName
 */
function createPtToCodecName(mediaSection) {
    return getPayloadTypesInMediaSection(mediaSection).reduce(function (ptToCodecName, pt) {
        var rtpmapPattern = new RegExp("a=rtpmap:" + pt + " ([^/]+)");
        var matches = mediaSection.match(rtpmapPattern);
        var codecName = matches
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
    var mLine = section.split('\r\n')[0];
    // In "m=<kind> <port> <proto> <payload_type_1> <payload_type_2> ... <payload_type_n>",
    // the regex matches <port> and the PayloadTypes.
    var matches = mLine.match(/([0-9]+)/g);
    // This should not happen, but in case there are no PayloadTypes in
    // the m= line, return an empty array.
    if (!matches) {
        return [];
    }
    // Since only the PayloadTypes are needed, we discard the <port>.
    return matches.slice(1).map(function (match) { return parseInt(match, 10); });
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2RwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9ydGMvc2RwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBOzs7O0dBSUc7QUFDSCxjQUFjO0FBQ2QsOEJBQWdDO0FBRWhDLElBQU0sOEJBQThCLEdBQUc7SUFDckMsQ0FBQyxFQUFFLE1BQU07SUFDVCxDQUFDLEVBQUUsTUFBTTtDQUNWLENBQUM7QUFFRixJQUFNLGFBQWEsR0FBRyxHQUFHLENBQUM7QUFDMUIsSUFBTSxXQUFXLEdBQUcsTUFBTSxDQUFDO0FBQzNCLElBQU0sV0FBVyxHQUFHLElBQUksQ0FBQztBQUV6QixTQUFTLHFCQUFxQixDQUFDLEdBQUc7SUFDMUIsSUFBQSxLQUF5Qix1QkFBdUIsQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBRSxFQUFFLEVBQUUsQ0FBQyxFQUF6RSxPQUFPLFFBQUEsRUFBRSxTQUFTLFFBQXVELENBQUM7SUFDbkYsSUFBTSxLQUFLLEdBQUcsSUFBSSxNQUFNLENBQUMsWUFBVSxPQUFPLFlBQVMsRUFBRSxHQUFHLENBQUMsQ0FBQztJQUNwRCxJQUFBLEtBQWtCLEtBQUssQ0FBQyxJQUFJLENBQUMsR0FBRyxDQUFDLElBQUksQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLEVBQTVDLFdBQVcsUUFBaUMsQ0FBQztJQUN0RCxPQUFPLEVBQUUsU0FBUyxXQUFBLEVBQUUsV0FBVyxhQUFBLEVBQUUsQ0FBQztBQUNwQyxDQUFDO0FBcUtDLHNEQUFxQjtBQW5LdkIsU0FBUywwQkFBMEIsQ0FBQyxHQUFHO0lBQ3JDLDhFQUE4RTtJQUM5RSxnRUFBZ0U7SUFDaEUsb0RBQW9EO0lBQ3BELElBQUksQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLEVBQUU7UUFDNUMsT0FBTyxHQUFHLENBQUM7S0FDWjtJQUVELE9BQU8sR0FBRyxDQUFD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