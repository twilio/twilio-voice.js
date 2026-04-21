'use strict';

var util = require('../util.js');

// @ts-nocheck
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
        var kindPattern = new RegExp("m=".concat('.*'), 'gm');
        var directionPattern = new RegExp("a=".concat('.*'), 'gm');
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

exports.getPreferredCodecInfo = getPreferredCodecInfo;
exports.setCodecPreferences = setCodecPreferences;
exports.setIceAggressiveNomination = setIceAggressiveNomination;
exports.setMaxAverageBitrate = setMaxAverageBitrate;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic2RwLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9zZHAudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOlsidXRpbC5pc0Nocm9tZSIsInV0aWwuZmxhdE1hcCIsInV0aWwuZGlmZmVyZW5jZSJdLCJtYXBwaW5ncyI6Ijs7OztBQUFBO0FBR0EsSUFBTSw4QkFBOEIsR0FBRztBQUNyQyxJQUFBLENBQUMsRUFBRSxNQUFNO0FBQ1QsSUFBQSxDQUFDLEVBQUUsTUFBTTtDQUNWO0FBRUQsSUFBTSxhQUFhLEdBQUcsR0FBRztBQUN6QixJQUFNLFdBQVcsR0FBRyxNQUFNO0FBQzFCLElBQU0sV0FBVyxHQUFHLElBQUk7QUFFeEIsU0FBUyxxQkFBcUIsQ0FBQyxHQUFHLEVBQUE7SUFDMUIsSUFBQSxFQUFBLEdBQXlCLHVCQUF1QixDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFLEVBQUUsRUFBRSxDQUFDLEVBQXpFLE9BQU8sR0FBQSxFQUFBLENBQUEsQ0FBQSxDQUFBLEVBQUUsU0FBUyxHQUFBLEVBQUEsQ0FBQSxDQUFBLENBQXVEO0lBQ2xGLElBQU0sS0FBSyxHQUFHLElBQUksTUFBTSxDQUFDLFNBQUEsQ0FBQSxNQUFBLENBQVUsT0FBTyxFQUFBLFNBQUEsQ0FBUyxFQUFFLEdBQUcsQ0FBQztBQUNuRCxJQUFBLElBQUEsS0FBa0IsS0FBSyxDQUFDLElBQUksQ0FBQyxHQUFHLENBQUMsSUFBSSxDQUFDLElBQUksRUFBRSxFQUFFLENBQUMsRUFBNUMsV0FBVyxRQUFpQztBQUNyRCxJQUFBLE9BQU8sRUFBRSxTQUFTLEVBQUEsU0FBQSxFQUFFLFdBQVcsRUFBQSxXQUFBLEVBQUU7QUFDbkM7QUFFQSxTQUFTLDBCQUEwQixDQUFDLEdBQUcsRUFBQTs7OztBQUlyQyxJQUFBLElBQUksQ0FBQ0EsYUFBYSxDQUFDLE1BQU0sRUFBRSxNQUFNLENBQUMsU0FBUyxDQUFDLEVBQUU7QUFDNUMsUUFB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
