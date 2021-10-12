'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

var util = require('../util');

var ptToFixedBitrateAudioCodecName = {
  0: 'PCMU',
  8: 'PCMA'
};

var defaultOpusId = 111;
var BITRATE_MAX = 510000;
var BITRATE_MIN = 6000;

function getPreferredCodecInfo(sdp) {
  var _ref = /a=rtpmap:(\d+) (\S+)/m.exec(sdp) || [null, '', ''],
      _ref2 = _slicedToArray(_ref, 3),
      codecId = _ref2[1],
      codecName = _ref2[2];

  var regex = new RegExp('a=fmtp:' + codecId + ' (\\S+)', 'm');

  var _ref3 = regex.exec(sdp) || [null, ''],
      _ref4 = _slicedToArray(_ref3, 2),
      codecParams = _ref4[1];

  return { codecName: codecName, codecParams: codecParams };
}

function setIceAggressiveNomination(sdp) {
  // This only works on Chrome. We don't want any side effects on other browsers
  // https://bugs.chromium.org/p/chromium/issues/detail?id=1024096
  // https://issues.corp.twilio.com/browse/CLIENT-6911
  if (!util.isChrome(window, window.navigator)) {
    return sdp;
  }

  return sdp.split('\n').filter(function (line) {
    return line.indexOf('a=ice-lite') === -1;
  }).join('\n');
}

function setMaxAverageBitrate(sdp, maxAverageBitrate) {
  if (typeof maxAverageBitrate !== 'number' || maxAverageBitrate < BITRATE_MIN || maxAverageBitrate > BITRATE_MAX) {
    return sdp;
  }

  var matches = /a=rtpmap:(\d+) opus/m.exec(sdp);
  var opusId = matches && matches.length ? matches[1] : defaultOpusId;
  var regex = new RegExp('a=fmtp:' + opusId);
  var lines = sdp.split('\n').map(function (line) {
    return regex.test(line) ? line + (';maxaveragebitrate=' + maxAverageBitrate) : line;
  });

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
    var fixedBitratePayloadTypes = kind === 'audio' ? new Set(pcmaPayloadTypes.concat(pcmuPayloadTypes)) : new Set();

    return fixedBitratePayloadTypes.has(payloadTypes[0]) ? newSection.replace(/\r\nb=(AS|TIAS):([0-9]+)/g, '') : newSection;
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
  return sdp.replace(/\r\n\r\n$/, '\r\n').split('\r\nm=').slice(1).map(function (mediaSection) {
    return 'm=' + mediaSection;
  }).filter(function (mediaSection) {
    var kindPattern = new RegExp('m=' + (kind || '.*'), 'gm');
    var directionPattern = new RegExp('a=' + (direction || '.*'), 'gm');
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
  preferredCodecs = preferredCodecs.map(function (codecName) {
    return codecName.toLowerCase();
  });

  var preferredPayloadTypes = util.flatMap(preferredCodecs, function (codecName) {
    return codecMap.get(codecName) || [];
  });

  var remainingCodecs = util.difference(Array.from(codecMap.keys()), preferredCodecs);
  var remainingPayloadTypes = util.flatMap(remainingCodecs, function (codecName) {
    return codecMap.get(codecName);
  });

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
    var rtpmapPattern = new RegExp('a=rtpmap:' + pt + ' ([^/]+)');
    var matches = mediaSection.match(rtpmapPattern);
    var codecName = matches ? matches[1].toLowerCase() : ptToFixedBitrateAudioCodecName[pt] ? ptToFixedBitrateAudioCodecName[pt].toLowerCase() : '';
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
  return matches.slice(1).map(function (match) {
    return parseInt(match, 10);
  });
}

module.exports = {
  getPreferredCodecInfo: getPreferredCodecInfo,
  setCodecPreferences: setCodecPreferences,
  setIceAggressiveNomination: setIceAggressiveNomination,
  setMaxAverageBitrate: setMaxAverageBitrate
};