/**
 * This file was imported from another project. If making changes to this file, please don't
 * make them here. Make them on the linked repo below, then copy back:
 * https://code.hq.twilio.com/client/MockRTCStatsReport
 */
/* eslint-disable no-undefined */
// The legacy max volume, which is the positive half of a signed short integer.
var OLD_MAX_VOLUME = 32767;
var NativeRTCStatsReport = typeof window !== 'undefined'
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
    var self = this;
    Object.defineProperties(this, {
        size: {
            enumerable: true,
            get: function () {
                return self._map.size;
            }
        },
        _map: { value: statsMap }
    });
    this[Symbol.iterator] = statsMap[Symbol.iterator];
}
// If RTCStatsReport is available natively, inherit it. Keep our constructor.
if (NativeRTCStatsReport) {
    MockRTCStatsReport.prototype = Object.create(NativeRTCStatsReport.prototype);
    MockRTCStatsReport.prototype.constructor = MockRTCStatsReport;
}
// Map the Map-like read methods to the underlying Map
['entries', 'forEach', 'get', 'has', 'keys', 'values'].forEach(function (key) {
    MockRTCStatsReport.prototype[key] = function () {
        var _a;
        var args = [];
        for (var _i = 0; _i < arguments.length; _i++) {
            args[_i] = arguments[_i];
        }
        return (_a = this._map)[key].apply(_a, args);
    };
});
/**
 * Convert an array of RTCStats objects into a mock RTCStatsReport object.
 * @param {Array<RTCStats>}
 * @return {MockRTCStatsReport}
 */
MockRTCStatsReport.fromArray = function fromArray(array) {
    return new MockRTCStatsReport(array.reduce(function (map, rtcStats) {
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
    var activeCandidatePairId;
    var transportIds = new Map();
    var statsMap = statsResponse.result().reduce(function (map, report) {
        var id = report.id;
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
                    map.set("rtp-" + id, createRTCInboundRTPStreamStats(report));
                }
                else {
                    map.set("rtp-" + id, createRTCOutboundRTPStreamStats(report));
                }
                map.set("track-" + id, createRTCMediaStreamTrackStats(report));
                map.set("codec-" + id, createRTCCodecStats(report));
                break;
            case 'googComponent':
                var transportReport = createRTCTransportStats(report);
                transportIds.set(transportReport.selectedCandidatePairId, id);
                map.set(id, createRTCTransportStats(report));
                break;
        }
        return map;
    }, new Map());
    if (activeCandidatePairId) {
        var activeTransportId = transportIds.get(activeCandidatePairId);
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
        type: 'transport',
        id: report.id,
        timestamp: Date.parse(report.timestamp),
        bytesSent: undefined,
        bytesReceived: undefined,
        rtcpTransportStatsId: undefined,
        dtlsState: undefined,
        selectedCandidatePairId: report.stat('selectedCandidatePairId'),
        localCertificateId: report.stat('localCertificateId'),
        remoteCertificateId: report.stat('remoteCertificateId')
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCCodecStats}
 */
function createRTCCodecStats(report) {
    return {
        type: 'codec',
        id: report.id,
        timestamp: Date.parse(report.timestamp),
        payloadType: undefined,
        mimeType: report.stat('mediaType') + "/" + report.stat('googCodecName'),
        clockRate: undefined,
        channels: undefined,
        sdpFmtpLine: undefined,
        implementation: undefined
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCMediaStreamTrackStats}
 */
function createRTCMediaStreamTrackStats(report) {
    return {
        type: 'track',
        id: report.id,
        timestamp: Date.parse(report.timestamp),
        trackIdentifier: report.stat('googTrackId'),
        remoteSource: undefined,
        ended: undefined,
        kind: report.stat('mediaType'),
        detached: undefined,
        ssrcIds: undefined,
        frameWidth: isPresent(report, 'googFrameWidthReceived')
            ? getInt(report, 'googFrameWidthReceived')
            : getInt(report, 'googFrameWidthSent'),
        frameHeight: isPresent(report, 'googFrameHeightReceived')
            ? getInt(report, 'googFrameHeightReceived')
            : getInt(report, 'googFrameHeightSent'),
        framesPerSecond: undefined,
        framesSent: getInt(report, 'framesEncoded'),
        framesReceived: undefined,
        framesDecoded: getInt(report, 'framesDecoded'),
        framesDropped: undefined,
        framesCorrupted: undefined,
        partialFramesLost: undefined,
        fullFramesLost: undefined,
        audioLevel: isPresent(report, 'audioOutputLevel')
            ? getInt(report, 'audioOutputLevel') / OLD_MAX_VOLUME
            : (getInt(report, 'audioInputLevel') || 0) / OLD_MAX_VOLUME,
        echoReturnLoss: getFloat(report, 'googEchoCancellationReturnLoss'),
        echoReturnLossEnhancement: getFloat(report, 'googEchoCancellationReturnLossEnhancement')
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @param {boolean} isInbound - Whether to create an inbound stats object, or outbound.
 * @returns {RTCRTPStreamStats}
 */
function createRTCRTPStreamStats(report, isInbound) {
    return {
        id: report.id,
        timestamp: Date.parse(report.timestamp),
        ssrc: report.stat('ssrc'),
        associateStatsId: undefined,
        isRemote: undefined,
        mediaType: report.stat('mediaType'),
        trackId: "track-" + report.id,
        transportId: report.stat('transportId'),
        codecId: "codec-" + report.id,
        firCount: isInbound
            ? getInt(report, 'googFirsSent')
            : undefined,
        pliCount: isInbound
            ? getInt(report, 'googPlisSent')
            : getInt(report, 'googPlisReceived'),
        nackCount: isInbound
            ? getInt(report, 'googNacksSent')
            : getInt(report, 'googNacksReceived'),
        sliCount: undefined,
        qpSum: getInt(report, 'qpSum')
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCInboundRTPStreamStats}
 */
function createRTCInboundRTPStreamStats(report) {
    var rtp = createRTCRTPStreamStats(report, true);
    Object.assign(rtp, {
        type: 'inbound-rtp',
        packetsReceived: getInt(report, 'packetsReceived'),
        bytesReceived: getInt(report, 'bytesReceived'),
        packetsLost: getInt(report, 'packetsLost'),
        jitter: convertMsToSeconds(report.stat('googJitterReceived')),
        fractionLost: undefined,
        roundTripTime: convertMsToSeconds(report.stat('googRtt')),
        packetsDiscarded: undefined,
        packetsRepaired: undefined,
        burstPacketsLost: undefined,
        burstPacketsDiscarded: undefined,
        burstLossCount: undefined,
        burstDiscardCount: undefined,
        burstLossRate: undefined,
        burstDiscardRate: undefined,
        gapLossRate: undefined,
        gapDiscardRate: undefined,
        framesDecoded: getInt(report, 'framesDecoded')
    });
    return rtp;
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCOutboundRTPStreamStats}
 */
function createRTCOutboundRTPStreamStats(report) {
    var rtp = createRTCRTPStreamStats(report, false);
    Object.assign(rtp, {
        type: 'outbound-rtp',
        remoteTimestamp: undefined,
        packetsSent: getInt(report, 'packetsSent'),
        bytesSent: getInt(report, 'bytesSent'),
        targetBitrate: undefined,
        framesEncoded: getInt(report, 'framesEncoded')
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
        type: isRemote
            ? 'remote-candidate'
            : 'local-candidate',
        id: report.id,
        timestamp: Date.parse(report.timestamp),
        transportId: undefined,
        isRemote: isRemote,
        ip: report.stat('ipAddress'),
        port: getInt(report, 'portNumber'),
        protocol: report.stat('transport'),
        candidateType: translateCandidateType(report.stat('candidateType')),
        priority: getFloat(report, 'priority'),
        url: undefined,
        relayProtocol: undefined,
        deleted: undefined
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCIceCandidatePairStats}
 */
function createRTCIceCandidatePairStats(report) {
    return {
        type: 'candidate-pair',
        id: report.id,
        timestamp: Date.parse(report.timestamp),
        transportId: report.stat('googChannelId'),
        localCandidateId: report.stat('localCandidateId'),
        remoteCandidateId: report.stat('remoteCandidateId'),
        state: undefined,
        priority: undefined,
        nominated: undefined,
        writable: getBoolean(report, 'googWritable'),
        readable: undefined,
        bytesSent: getInt(report, 'bytesSent'),
        bytesReceived: getInt(report, 'bytesReceived'),
        lastPacketSentTimestamp: undefined,
        lastPacketReceivedTimestamp: undefined,
        totalRoundTripTime: undefined,
        currentRoundTripTime: convertMsToSeconds(report.stat('googRtt')),
        availableOutgoingBitrate: undefined,
        availableIncomingBitrate: undefined,
        requestsReceived: getInt(report, 'requestsReceived'),
        requestsSent: getInt(report, 'requestsSent'),
        responsesReceived: getInt(report, 'responsesReceived'),
        responsesSent: getInt(report, 'responsesSent'),
        retransmissionsReceived: undefined,
        retransmissionsSent: undefined,
        consentRequestsSent: getInt(report, 'consentRequestsSent')
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCIceCertificateStats}
 */
function createRTCCertificateStats(report) {
    return {
        type: 'certificate',
        id: report.id,
        timestamp: Date.parse(report.timestamp),
        fingerprint: report.stat('googFingerprint'),
        fingerprintAlgorithm: report.stat('googFingerprintAlgorithm'),
        base64Certificate: report.stat('googDerBase64'),
        issuerCertificateId: report.stat('googIssuerId')
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCDataChannelStats}
 */
function createRTCDataChannelStats(report) {
    return {
        type: 'data-channel',
        id: report.id,
        timestamp: Date.parse(report.timestamp),
        label: report.stat('label'),
        protocol: report.stat('protocol'),
        datachannelid: report.stat('datachannelid'),
        transportId: report.stat('transportId'),
        state: report.stat('state'),
        messagesSent: undefined,
        bytesSent: undefined,
        messagesReceived: undefined,
        bytesReceived: undefined
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
    var stat = report.stat(statName);
    return isPresent(report, statName)
        ? parseInt(stat, 10)
        : undefined;
}
function getFloat(report, statName) {
    var stat = report.stat(statName);
    return isPresent(report, statName)
        ? parseFloat(stat)
        : undefined;
}
function getBoolean(report, statName) {
    var stat = report.stat(statName);
    return isPresent(report, statName)
        ? (stat === 'true' || stat === true)
        : undefined;
}
function isPresent(report, statName) {
    var stat = report.stat(statName);
    return typeof stat !== 'undefined' && stat !== '';
}
module.exports = MockRTCStatsReport;
//# sourceMappingURL=mockrtcstatsreport.js.map