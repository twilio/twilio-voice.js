"use strict";
// @ts-nocheck
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * This file was imported from another project. If making changes to this file, please don't
 * make them here. Make them on the linked repo below, then copy back:
 * https://code.hq.twilio.com/client/MockRTCStatsReport
 */
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
        _map: { value: statsMap },
        size: {
            enumerable: true,
            get: function () {
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
                    map.set("rtp-".concat(id), createRTCInboundRTPStreamStats(report));
                }
                else {
                    map.set("rtp-".concat(id), createRTCOutboundRTPStreamStats(report));
                }
                map.set("track-".concat(id), createRTCMediaStreamTrackStats(report));
                map.set("codec-".concat(id), createRTCCodecStats(report));
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
        mimeType: "".concat(report.stat('mediaType'), "/").concat(report.stat('googCodecName')),
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
        codecId: "codec-".concat(report.id),
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
        trackId: "track-".concat(report.id),
        transportId: report.stat('transportId'),
    };
}
/**
 * @param {RTCLegacyStatsReport} report
 * @returns {RTCInboundRTPStreamStats}
 */
function createRTCInboundRTPStreamStats(report) {
    var rtp = createRTCRTPStreamStats(report, true);
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
    var rtp = createRTCRTPStreamStats(report, false);
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
        isRemote: isRemote,
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
exports.default = MockRTCStatsReport;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja3J0Y3N0YXRzcmVwb3J0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9ydGMvbW9ja3J0Y3N0YXRzcmVwb3J0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQSxjQUFjOztBQUVkOzs7O0dBSUc7QUFFSCwrRUFBK0U7QUFDL0UsSUFBTSxjQUFjLEdBQUcsS0FBSyxDQUFDO0FBRTdCLElBQU0sb0JBQW9CLEdBQUcsT0FBTyxNQUFNLEtBQUssV0FBVztJQUN4RCxDQUFDLENBQUMsTUFBTSxDQUFDLGNBQWMsQ0FBQyxDQUFDLENBQUMsU0FBUyxDQUFDO0FBRXRDOzs7Ozs7O0dBT0c7QUFDSCxTQUFTLGtCQUFrQixDQUFDLFFBQVE7SUFDbEMsSUFBSSxDQUFDLENBQUMsSUFBSSxZQUFZLGtCQUFrQixDQUFDLEVBQUUsQ0FBQztRQUMxQyxPQUFPLElBQUksa0JBQWtCLENBQUMsUUFBUSxDQUFDLENBQUM7SUFDMUMsQ0FBQztJQUVELElBQU0sSUFBSSxHQUFHLElBQUksQ0FBQztJQUNsQixNQUFNLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFO1FBQzVCLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUU7UUFDekIsSUFBSSxFQUFFO1lBQ0osVUFBVSxFQUFFLElBQUk7WUFDaEIsR0FBRztnQkFDRCxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQ3hCLENBQUM7U0FDRjtLQUNGLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNwRCxDQUFDO0FBRUQsNkVBQTZFO0FBQzdFLElBQUksb0JBQW9CLEVBQUUsQ0FBQztJQUN6QixrQkFBa0IsQ0FBQyxTQUFTLEdBQUcsTUFBTSxDQUFDLE1BQU0sQ0FBQyxvQkFBb0IsQ0FBQyxTQUFTLENBQUMsQ0FBQztJQUM3RSxrQkFB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