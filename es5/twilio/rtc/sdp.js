"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getPreferredCodecInfo = getPreferredCodecInfo;
exports.setCodecPreferences = setCodecPreferences;
exports.setIceAggressiveNomination = setIceAggressiveNomination;
exports.setMaxAverageBitrate = setMaxAverageBitrate;
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
    var regex = new RegExp("a=fmtp:".concat(codecId, " (\\S+)"), 'm');
    var _b = regex.exec(sdp) || [null, ''], codecParams = _b[1];
    return { codecName: codecName, codecParams: codecParams };
}
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
function setMaxAverageBitrate(sdp, maxAverageBitrate) {
    if (typeof maxAverageBitrate !== 'number'
        || maxAverageBitrate < BITRATE_MIN
        || maxAverageBitrate > BITRATE_MAX) {
        return sdp;
    }
    var matches = /a=rtpmap:(\d+) opus/m.exec(sdp);
    var opusId = matches && matches.length ? matches[1] : defaultOpusId;
    var regex = new RegExp("a=fmtp:".concat(opusId));
    var lines = sdp.split('\n').map(function (line) { return regex.test(line)
        ? line + ";maxaveragebitrate=".concat(maxAverageBitrate)
        : line; });
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
/**
 * Get the m= sections of a particular kind and direction from an sdp.
 * @param {string} sdp - SDP string
 * @param {string} [kind] - Pattern for matching kind
 * @param {string} [direction] - Pattern for matching direction
 * @returns {Array<string>} mediaSections
 */
function getMediaSections(sdp, kind, direction) {
    return sdp.replace(/\r\n\r\n$/, '\r\n').split('\r\nm=').slice(1).map(function (mediaSection) { return "m=".concat(mediaSection); }).filter(function (mediaSection) {
        var kindPattern = new RegExp("m=".concat(kind || '.*'), 'gm');
        var directionPattern = new RegExp("a=".concat(direction || '.*'), 'gm');
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
        var rtpmapPattern = new RegExp("a=rtpmap:".concat(pt, " ([^/]+)"));
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2RwLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9ydGMvc2RwLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBc0xFLHNEQUFxQjtBQUNyQixrREFBbUI7QUFDbkIsZ0VBQTBCO0FBQzFCLG9EQUFvQjtBQXpMdEIsY0FBYztBQUNkLDhCQUFnQztBQUVoQyxJQUFNLDhCQUE4QixHQUFHO0lBQ3JDLENBQUMsRUFBRSxNQUFNO0lBQ1QsQ0FBQyxFQUFFLE1BQU07Q0FDVixDQUFDO0FBRUYsSUFBTSxhQUFhLEdBQUcsR0FBRyxDQUFDO0FBQzFCLElBQU0sV0FBVyxHQUFHLE1BQU0sQ0FBQztBQUMzQixJQUFNLFdBQVcsR0FBRyxJQUFJLENBQUM7QUFFekIsU0FBUyxxQkFBcUIsQ0FBQyxHQUFHO0lBQzFCLElBQUEsS0FBeUIsdUJBQXVCLENBQUMsSUFBSSxDQUFDLEdBQUcsQ0FBQyxJQUFJLENBQUMsSUFBSSxFQUFFLEVBQUUsRUFBRSxFQUFFLENBQUMsRUFBekUsT0FBTyxRQUFBLEVBQUUsU0FBUyxRQUF1RCxDQUFDO0lBQ25GLElBQU0sS0FBSyxHQUFHLElBQUksTUFBTSxDQUFDLGlCQUFVLE9BQU8sWUFBUyxFQUFFLEdBQUcsQ0FBQyxDQUFDO0lBQ3BELElBQUEsS0FBa0IsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsRUFBNUMsV0FBVyxRQUFpQyxDQUFDO0lBQ3RELE9BQU8sRUFBRSxTQUFTLFdBQUEsRUFBRSxXQUFXLGFBQUEsRUFBRSxDQUFDO0FBQ3BDLENBQUM7QUFFRCxTQUFTLDBCQUEwQixDQUFDLEdBQUc7SUFDckMsOEVBQThFO0lBQzlFLGdFQUFnRTtJQUNoRSxvREFBb0Q7SUFDcEQsSUFBSSxDQUFDLElBQUksQ0FBQyxRQUFRLENBQUMsTUFBTSxFQUFFLE1BQU0sQ0FBQyxTQUFTLENBQUMsRUFBRSxDQUFDO1FBQzdDLE9BQU8sR0FB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