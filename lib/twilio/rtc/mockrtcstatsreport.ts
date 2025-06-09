// @ts-nocheck

/**
 * This file was imported from another project. If making changes to this file, please don't
 * make them here. Make them on the linked repo below, then copy back:
 * https://code.hq.twilio.com/client/MockRTCStatsReport
 */

// The legacy max volume, which is the positive half of a signed short integer.
const OLD_MAX_VOLUME = 32767;

const NativeRTCStatsReport = typeof window !== 'undefined'
  ? window.RTCStatsReport : undefined;

/**
 * Create a MockRTCStatsReport wrapper around a Map of RTCStats objects. If RTCStatsReport is available
 *   natively, it will be inherited so that instanceof checks pass.
 * @constructor
 * @extends RTCStatsReport
 * @param {Map<string, RTCStats>} statsMap - A Map of RTCStats objects to wrap
 *   with a MockRTCStatsReport object.
 */
function MockRTCStatsReport(statsMap) {
  if (!(this instanceof MockRTCStatsReport)) {
    return new MockRTCStatsReport(statsMap);
  }

  const self = this;
  Object.defineProperties(this, {
    _map: { value: statsMap },
    size: {
      enumerable: true,
      get() {
        return self._map.size;
      },
    },
  });

  this[Symbol.iterator] = statsMap[Symbol.iterator];
}

// If RTCStatsReport is available natively, inherit it. Keep our constructor.
if (NativeRTCStatsReport) {
  MockRTCStatsReport.prototype = Object.create(NativeRTCStatsReport.prototype);
  MockRTCStatsReport.prototype.constructor = MockRTCStatsReport;
}

// Map the Map-like read methods to the underlying Map
['entries', 'forEach', 'get', 'has', 'keys', 'values'].forEach(key => {
  MockRTCStatsReport.prototype[key] = function(...args) {
    return this._map[key](...args);
  };
});

/**
 * Convert an array of RTCStats objects into a mock RTCStatsReport object.
 * @param {Array<RTCStats>}
 * @return {MockRTCStatsReport}
 */
MockRTCStatsReport.fromArray = function fromArray(array) {
  return new MockRTCStatsReport(array.reduce((map, rtcStats) => {
    map.set(rtcStats.id, rtcStats);
    return map;
  }, new Map()));
};

/**
 * Convert a legacy RTCStatsResponse object into a mock RTCStatsReport object.
 * @param {RTCStatsResponse} statsResponse - An RTCStatsResponse object returned by the
 *   legacy getStats(callback) method in Chrome.
 * @return {MockRTCStatsReport} A mock RTCStatsReport object.
 */
MockRTCStatsReport.fromRTCStatsResponse = function fromRTCStatsResponse(statsResponse) {
  let activeCandidatePairId;
  const transportIds = new Map();

  const statsMap = statsResponse.result().reduce((map, report) => {
    const id = report.id;
    switch (report.type) {
      case 'googCertificate':
        map.set(id, createRTCCertificateStats(report));
        break;
      case 'datachannel':
        map.set(id, createRTCDataChannelStats(report));
        break;
      case 'googCandidatePair':
        if (getBoolean(report, 'googActiveConnection')) {
          activeCandidatePairId = id;
        }

        map.set(id, createRTCIceCandidatePairStats(report));
        break;
      case 'localcandidate':
        map.set(id, createRTCIceCandidateStats(report, false));
        break;
      case 'remotecandidate':
        map.set(id, createRTCIceCandidateStats(report, true));
        break;
      case 'ssrc':
        if (isPresent(report, 'packetsReceived')) {
          map.set(`rtp-${id}`, createRTCInboundRTPStreamStats(report));
        } else {
          map.set(`rtp-${id}`, createRTCOutboundRTPStreamStats(report));
        }

        map.set(`track-${id}`, createRTCMediaStreamTrackStats(report));
        map.set(`codec-${id}`, createRTCCodecStats(report));
        break;
      case 'googComponent':
        const transportReport = createRTCTransportStats(report);
        transportIds.set(transportReport.selectedCandidatePairId, id);
        map.set(id, createRTCTransportStats(report));
        break;
    }

    return map;
  }, new Map());

  if (activeCandidatePairId) {
    const activeTransportId = transportIds.get(activeCandidatePairId);
    if (activeTransportId) {
      statsMap.get(activeTransportId).dtlsState = 'connected';
    }
  }

  return new MockRTCStatsReport(statsMap);
};

/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCTransportStats}
 */
function createRTCTransportStats(report) {
  return {
    bytesReceived: undefined,
    bytesSent: undefined,
    dtlsState: undefined,
    id: report.id,
    localCertificateId: report.stat('localCertificateId'),
    remoteCertificateId: report.stat('remoteCertificateId'),
    rtcpTransportStatsId: undefined,
    selectedCandidatePairId: report.stat('selectedCandidatePairId'),
    timestamp: Date.parse(report.timestamp),
    type: 'transport',
  };
}

/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCCodecStats}
 */
function createRTCCodecStats(report) {
  return {
    channels: undefined,
    clockRate: undefined,
    id: report.id,
    implementation: undefined,
    mimeType: `${report.stat('mediaType')}/${report.stat('googCodecName')}`,
    payloadType: undefined,
    sdpFmtpLine: undefined,
    timestamp: Date.parse(report.timestamp),
    type: 'codec',
  };
}

/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCMediaStreamTrackStats}
 */
function createRTCMediaStreamTrackStats(report) {
  return {
    audioLevel: isPresent(report, 'audioOutputLevel')
      ? getInt(report, 'audioOutputLevel') / OLD_MAX_VOLUME
      : (getInt(report, 'audioInputLevel') || 0) / OLD_MAX_VOLUME,
    detached: undefined,
    echoReturnLoss: getFloat(report, 'googEchoCancellationReturnLoss'),
    echoReturnLossEnhancement: getFloat(report, 'googEchoCancellationReturnLossEnhancement'),
    ended: undefined,
    frameHeight: isPresent(report, 'googFrameHeightReceived')
      ? getInt(report, 'googFrameHeightReceived')
      : getInt(report, 'googFrameHeightSent'),
    frameWidth: isPresent(report, 'googFrameWidthReceived')
      ? getInt(report, 'googFrameWidthReceived')
      : getInt(report, 'googFrameWidthSent'),
    framesCorrupted: undefined,
    framesDecoded: getInt(report, 'framesDecoded'),
    framesDropped: undefined,
    framesPerSecond: undefined,
    framesReceived: undefined,
    framesSent: getInt(report, 'framesEncoded'),
    fullFramesLost: undefined,
    id: report.id,
    kind: report.stat('mediaType'),
    partialFramesLost: undefined,
    remoteSource: undefined,
    ssrcIds: undefined,
    timestamp: Date.parse(report.timestamp),
    trackIdentifier: report.stat('googTrackId'),
    type: 'track',
  };
}

/**
 * @param {RTCLegacyStatsReport} report
 * @param {boolean} isInbound - Whether to create an inbound stats object, or outbound.
 * @returns {RTCRTPStreamStats}
 */
function createRTCRTPStreamStats(report, isInbound) {
  return {
    associateStatsId: undefined,
    codecId: `codec-${report.id}`,
    firCount: isInbound
      ? getInt(report, 'googFirsSent')
      : undefined,
    id: report.id,
    isRemote: undefined,
    mediaType: report.stat('mediaType'),
    nackCount: isInbound
      ? getInt(report, 'googNacksSent')
      : getInt(report, 'googNacksReceived'),
    pliCount: isInbound
      ? getInt(report, 'googPlisSent')
      : getInt(report, 'googPlisReceived'),
    qpSum: getInt(report, 'qpSum'),
    sliCount: undefined,
    ssrc: report.stat('ssrc'),
    timestamp: Date.parse(report.timestamp),
    trackId: `track-${report.id}`,
    transportId: report.stat('transportId'),
  };
}

/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCInboundRTPStreamStats}
 */
function createRTCInboundRTPStreamStats(report) {
  const rtp = createRTCRTPStreamStats(report, true);

  Object.assign(rtp, {
    burstDiscardCount: undefined,
    burstDiscardRate: undefined,
    burstLossCount: undefined,
    burstLossRate: undefined,
    burstPacketsDiscarded: undefined,
    burstPacketsLost: undefined,
    bytesReceived: getInt(report, 'bytesReceived'),
    fractionLost: undefined,
    framesDecoded: getInt(report, 'framesDecoded'),
    gapDiscardRate: undefined,
    gapLossRate: undefined,
    jitter: convertMsToSeconds(report.stat('googJitterReceived')),
    packetsDiscarded: undefined,
    packetsLost: getInt(report, 'packetsLost'),
    packetsReceived: getInt(report, 'packetsReceived'),
    packetsRepaired: undefined,
    roundTripTime: convertMsToSeconds(report.stat('googRtt')),
    type: 'inbound-rtp',
  });

  return rtp;
}

/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCOutboundRTPStreamStats}
 */
function createRTCOutboundRTPStreamStats(report) {
  const rtp = createRTCRTPStreamStats(report, false);

  Object.assign(rtp, {
    bytesSent: getInt(report, 'bytesSent'),
    framesEncoded: getInt(report, 'framesEncoded'),
    packetsSent: getInt(report, 'packetsSent'),
    remoteTimestamp: undefined,
    targetBitrate: undefined,
    type: 'outbound-rtp',
  });

  return rtp;
}

/**
 * @param {RTCLegacyStatsReport} report
 * @param {boolean} isRemote - Whether to create for a remote candidate, or local candidate.
 * @returns {RTCIceCandidateStats}
 */
function createRTCIceCandidateStats(report, isRemote) {
  return {
    candidateType: translateCandidateType(report.stat('candidateType')),
    deleted: undefined,
    id: report.id,
    ip: report.stat('ipAddress'),
    isRemote,
    port: getInt(report, 'portNumber'),
    priority: getFloat(report, 'priority'),
    protocol: report.stat('transport'),
    relayProtocol: undefined,
    timestamp: Date.parse(report.timestamp),
    transportId: undefined,
    type: isRemote
      ? 'remote-candidate'
      : 'local-candidate',
    url: undefined,
  };
}

/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCIceCandidatePairStats}
 */
function createRTCIceCandidatePairStats(report) {
  return {
    availableIncomingBitrate: undefined,
    availableOutgoingBitrate: undefined,
    bytesReceived: getInt(report, 'bytesReceived'),
    bytesSent: getInt(report, 'bytesSent'),
    consentRequestsSent: getInt(report, 'consentRequestsSent'),
    currentRoundTripTime: convertMsToSeconds(report.stat('googRtt')),
    id: report.id,
    lastPacketReceivedTimestamp: undefined,
    lastPacketSentTimestamp: undefined,
    localCandidateId: report.stat('localCandidateId'),
    nominated: undefined,
    priority: undefined,
    readable: undefined,
    remoteCandidateId: report.stat('remoteCandidateId'),
    requestsReceived: getInt(report, 'requestsReceived'),
    requestsSent: getInt(report, 'requestsSent'),
    responsesReceived: getInt(report, 'responsesReceived'),
    responsesSent: getInt(report, 'responsesSent'),
    retransmissionsReceived: undefined,
    retransmissionsSent: undefined,
    state: undefined,
    timestamp: Date.parse(report.timestamp),
    totalRoundTripTime: undefined,
    transportId: report.stat('googChannelId'),
    type: 'candidate-pair',
    writable: getBoolean(report, 'googWritable'),
  };
}

/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCIceCertificateStats}
 */
function createRTCCertificateStats(report) {
  return {
    base64Certificate: report.stat('googDerBase64'),
    fingerprint: report.stat('googFingerprint'),
    fingerprintAlgorithm: report.stat('googFingerprintAlgorithm'),
    id: report.id,
    issuerCertificateId: report.stat('googIssuerId'),
    timestamp: Date.parse(report.timestamp),
    type: 'certificate',
  };
}

/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCDataChannelStats}
 */
function createRTCDataChannelStats(report) {
  return {
    bytesReceived: undefined,
    bytesSent: undefined,
    datachannelid: report.stat('datachannelid'),
    id: report.id,
    label: report.stat('label'),
    messagesReceived: undefined,
    messagesSent: undefined,
    protocol: report.stat('protocol'),
    state: report.stat('state'),
    timestamp: Date.parse(report.timestamp),
    transportId: report.stat('transportId'),
    type: 'data-channel',
  };
}

/**
 * @param {number} inMs - A time in milliseconds
 * @returns {number} The time in seconds
 */
function convertMsToSeconds(inMs) {
  return isNaN(inMs) || inMs === ''
    ? undefined
    : parseInt(inMs, 10) / 1000;
}

/**
 * @param {string} type - A type in the legacy format
 * @returns {string} The type adjusted to new standards for known naming changes
 */
function translateCandidateType(type) {
  switch (type) {
    case 'peerreflexive':
      return 'prflx';
    case 'serverreflexive':
      return 'srflx';
    case 'host':
    case 'relay':
    default:
      return type;
  }
}

function getInt(report, statName) {
  const stat = report.stat(statName);
  return isPresent(report, statName)
    ? parseInt(stat, 10)
    : undefined;
}

function getFloat(report, statName) {
  const stat = report.stat(statName);
  return isPresent(report, statName)
    ? parseFloat(stat)
    : undefined;
}

function getBoolean(report, statName) {
  const stat = report.stat(statName);
  return isPresent(report, statName)
    ? (stat === 'true' || stat === true)
    : undefined;
}

function isPresent(report, statName) {
  const stat = report.stat(statName);
  return typeof stat !== 'undefined' && stat !== '';
}

export default MockRTCStatsReport;
