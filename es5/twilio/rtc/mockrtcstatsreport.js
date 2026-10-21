'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

// @ts-nocheck
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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja3J0Y3N0YXRzcmVwb3J0LmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9tb2NrcnRjc3RhdHNyZXBvcnQudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7OztBQUFBO0FBRUE7Ozs7QUFJRztBQUVIO0FBQ0EsSUFBTSxjQUFjLEdBQUcsS0FBSztBQUU1QixJQUFNLG9CQUFvQixHQUFHLE9BQU8sTUFBTSxLQUFLO01BQzNDLE1BQU0sQ0FBQyxjQUFjLEdBQUcsU0FBUztBQUVyQzs7Ozs7OztBQU9HO0FBQ0gsU0FBUyxrQkFBa0IsQ0FBQyxRQUFRLEVBQUE7QUFDbEMsSUFBQSxJQUFJLEVBQUUsSUFBSSxZQUFZLGtCQUFrQixDQUFDLEVBQUU7QUFDekMsUUFBQSxPQUFPLElBQUksa0JBQWtCLENBQUMsUUFBUSxDQUFDO0lBQ3pDO0lBRUEsSUFBTSxJQUFJLEdBQUcsSUFBSTtBQUNqQixJQUFBLE1BQU0sQ0FBQyxnQkFBZ0IsQ0FBQyxJQUFJLEVBQUU7QUFDNUIsUUFBQSxJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFO0FBQ3pCLFFBQUEsSUFBSSxFQUFFO0FBQ0osWUFBQSxVQUFVLEVBQUUsSUFBSTtZQUNoQixHQUFHLEVBQUEsWUFBQTtBQUNELGdCQUFBLE9BQU8sSUFBSSxDQUFDLElBQUksQ0FBQyxJQUFJO1lBQ3ZCLENBQUM7QUFDRixTQUFBO0FBQ0YsS0FBQSxDQUFDO0FBRUYsSUFBQSxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDO0FBQ25EO0FBRUE7QUFDQSxJQUFJLG9CQUFvQixFQUFFO0lBQ3hCLGtCQUFrQixDQUFDLFNBQVMsR0FBRyxNQUFNLENBQUMsTUFBTSxDQUFDLG9CQUFvQixDQUFDLFNBQVMsQ0FBQztBQUM1RSxJQUFBLGtCQUFrQixDQUFDLFNBQVMsQ0FBQyxXQUFXLEdBQUcsa0JBQWtCO0FBQy9EO0FBRUE7QUFDQSxDQUFDLFNBQVMsRUFBRSxTQUFTLEVBQUUsS0FBSyxFQUFFLEtBQUssRUFBRSxNQUFNLEVBQUUsUUFBUSxDQUFDLENBQUMsT0FBTyxDQUFDLFVBQUEsR0FBRyxFQUFBO0FBQ2hFLElBQUEsa0JBQWtCLENBQUMsU0FBUyxDQUFDLEdBQUcsQ0FBQyxHQUFHLFlBQUE7O1FBQVMsSUFBQSxJQUFBLEdBQUEsRUFBQTthQUFBLElBQUEsRUFBQSxHQUFBLENBQU8sRUFBUCxFQUFBLEdBQUEsU0FBQSxDQUFBLE1BQU8sRUFBUCxFQUFBLEVBQU8sRUFBQTtZQUFQLElBQUEsQ0FBQSxFQUFBLENBQUEsR0FBQSxTQUFBLENBQUEsRUFBQSxDQUFBOztRQUMzQyxPQUFPLENBQUEsRUFBQSxHQUFBLElBQUksQ0FBQyxJQUFJLEVBQUMsR0FBRyxDQUFDLENBQUEsS0FBQSxDQUFBLEVBQUEsRUFBSSxJQUFJLENBQUE7QUFDL0IsSUFBQSxDQUFDO0FBQ0gsQ0FBQyxDQUFDO0FBRUY7Ozs7QUFJRztBQUNILGtCQUFrQixDQUFDLFNBQVMsR0FBRyxTQUFTLFNBQVMsQ0FBQyxLQUFLLEVBQUE7SUFDckQsT0FBTyxJQUFJLGtCQUFrQixDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsVUFBQyxHQUFHLEVBQUUsUUFBUSxFQUFBO1FBQ3ZELEdBQUcsQ0FBQyxHQUFHLENBQUMsUUFBUSxDQUFDLEVBQUUsRUFBRSxRQUFRLENBQUM7QUFDOUIsUUFBQSxPQUFPLEdBQUc7QUFDWixJQUFBLENBQUMsRUFBRSxJQUFJLEdBQUcsRUFBRSxDQUFDLENBQUM7QUFDaEIsQ0FBQztBQUVEOzs7OztBQUtHO0FBQ0gsa0JBQWtCLENBQUMsb0JBQW9CLEdBQUcsU0FBUyxvQkFBb0IsQ0FBQyxhQUFhLEVBQUE7QUFDbkYsSUFBQSxJQUFJLHFCQUFxQjtBQUN6QixJQUFBLElBQU0sWUFBWSxHQUFHLElBQUksR0FBRyxFQUFFO0FBRTlCLElBQUEsSUFBTSxRQUFRLEdBQUcsYUFBYSxDQUFDLE1BQU0sRUFBRSxDQUFDLE1BQU0sQ0FBQyxVQUFDLEdBQUcsRUFBRSxNQUFNLEVBQUE7QUFDekQsUUFBQSxJQUFNLEVBQUUsR0FBRyxNQUFNLENBQUMsRUFBRTtBQUNwQixRQUFBLFFBQVEsTUFBTSxDQUFDLElBQUk7QUFDakIsWUFBQSxLQUFLLGlCQUFpQjtnQkFDcEIsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUseUJBQXlCLENBQUMsTUFBTSxDQUFDLENBQUM7Z0JBQzlDO0FBQ0YsWUFBQSxLQUFLLGFBQWE7Z0JBQ2hCLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLHlCQUF5QixDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUM5QztBQUNGLFlBQUEsS0FBSyxtQkFBbUI7QUFDdEIsZ0JBQUEsSUFBSSxVQUFVLENBQUMsTUFBTSxFQUFFLHNCQUFzQixDQUFDLEVBQUU7b0JBQzlDLHFCQUFxQixHQUFHLEVBQUU7Z0JBQzVCO2dCQUVBLEdBQUcsQ0FBQyxHQUFHLENBQUMsRUFBRSxFQUFFLDhCQUE4QixDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNuRDtBQUNGLFlBQUEsS0FBSyxnQkFBZ0I7QUFDbkIsZ0JBQUEsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsMEJBQTBCLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQyxDQUFDO2dCQUN0RDtBQUNGLFlBQUEsS0FBSyxpQkFBaUI7QUFDcEIsZ0JBQUEsR0FBRyxDQUFDLEdBQUcsQ0FBQyxFQUFFLEVBQUUsMEJBQTBCLENBQUMsTUFBTSxFQUFFLElBQUksQ0FBQyxDQUFDO2dCQUNyRDtBQUNGLFlBQUEsS0FBSyxNQUFNO0FBQ1QsZ0JBQUEsSUFBSSxTQUFTLENBQUMsTUFBTSxFQUFFLGlCQUFpQixDQUFDLEVBQUU7QUFDeEMsb0JBQUEsR0FBRyxDQUFDLEdBQUcsQ0FBQyxNQUFBLENBQUEsTUFBQSxDQUFPLEVBQUUsQ0FBRSxFQUFFLDhCQUE4QixDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUM5RDtxQkFBTztBQUNMLG9CQUFBLEdBQUcsQ0FBQyxHQUFHLENBQUMsTUFBQSxDQUFBLE1BQUEsQ0FBTyxFQUFFLENBQUUsRUFBRSwrQkFBK0IsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDL0Q7QUFFQSxnQkFBQSxHQUFHLENBQUMsR0FBRyxDQUFDLFFBQUEsQ0FBQSxNQUFBLENBQVMsRUFBRSxDQUFFLEVBQUUsOEJBQThCLENBQUMsTUFBTSxDQUFDLENBQUM7QUFDOUQsZ0JBQUEsR0FBRyxDQUFDLEdBQUcsQ0FBQyxRQUFBLENBQUEsTUFBQSxDQUFTLEVBQUUsQ0FBRSxFQUFFLG1CQUFtQixDQUFDLE1BQU0sQ0FBQyxDQUFDO2dCQUNuRDtBQUNGLFlBQUEsS0FBSyxlQUFlO0FBQ2xCLGdCQUFBLElBQU0sZUFBZSxHQUFHLHVCQUF1QixDQUFDLE1BQU0sQ0FBQztnQkFDdkQsWUFBWSxDQUFDLEdBQUcsQ0FBQyxlQUFlLENBQUMsdUJBQXVCLEVBQUUsRUFBRSxDQUFDO2dCQUM3RCxHQUFHLENBQUMsR0FBRyxDQUFDLEVBQUUsRUFBRSx1QkFBdUIsQ0FBQyxNQUFNLENBQUMsQ0FBQztnQkFDNUM7O0FBR0osUUFBQSxPQUFPLEdBQUc7QUFDWixJQUFBLENBQUMsRUFBRSxJQUFJLEdBQUcsRUFBRSxDQUFDO0lBRWIsSUFBSSxxQkFBcUIsRUFBRTtRQUN6QixJQUFNLGlCQUFpQixHQUFHLFlBQVksQ0FBQyxHQUFHLENBQUMscUJBQXFCLENBQUM7UUFDakUsSUFBSSxpQkFBaUIsRUFBRTtZQUNyQixRQUFRLENBQUMsR0FBRyxDQUFDLGlCQUFpQixDQUFDLENBQUMsU0FBUyxHQUFHLFdBQVc7UUFDekQ7SUFDRjtBQUVBLElBQUEsT0FBTyxJQUFJLGtCQUFrQixDQUFDLFFBQVEsQ0FBQztBQUN6QyxDQUFDO0FBRUQ7OztBQUdHO0FBQ0gsU0FBUyx1QkFBdUIsQ0FBQyxNQUFNLEVBQUE7SUFDckMsT0FBTztBQUNMLFFBQUEsYUFBYSxFQUFFLFNBQVM7QUFDeEIsUUFBQSxTQUFTLEVBQUUsU0FBUztBQUNwQixRQUFBLFNBQVMsRUFBRSxTQUFTO1FBQ3BCLEVBQUUsRUFBRSxNQUFNLENBQUMsRUFBRTtBQUNiLFFBQUEsa0JBQWtCLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQztBQUNyRCxRQUFBLG1CQUFtQixFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMscUJBQXFCLENBQUM7QUFDdkQsUUFBQSxvQkFBb0IsRUFBRSxTQUFTO0FBQy9CLFFBQUEsdUJBQXVCLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyx5QkFBeUIsQ0FBQztRQUMvRCxTQUFTLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDO0FBQ3ZDLFFBQUEsSUFBSSxFQUFFLFdBQVc7S0FDbEI7QUFDSDtBQUVBOzs7QUFHRztBQUNILFNBQVMsbUJBQW1CLENBQUMsTUFBTSxFQUFBO0lBQ2pDLE9BQU87QUFDTCxRQUFBLFFBQVEsRUFBRSxTQUFTO0FBQ25CLFFBQUEsU0FBUyxFQUFFLFNBQVM7UUFDcEIsRUFBRSxFQUFFLE1BQU0sQ0FBQyxFQUFFO0FBQ2IsUUFBQSxjQUFjLEVBQUUsU0FBUztBQUN6QixRQUFBLFFBQVEsRUFBRSxFQUFBLENBQUEsTUFBQSxDQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDLEVBQUEsR0FBQSxDQUFBLENBQUEsTUFBQSxDQUFJLE1BQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDLENBQUU7QUFDdkUsUUFBQSxXQUFXLEVBQUUsU0FBUztBQUN0QixRQUFBLFdBQVcsRUFBRSxTQUFTO1FBQ3RCLFNBQVMsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7QUFDdkMsUUFBQSxJQUFJLEVBQUUsT0FBTztLQUNkO0FBQ0g7QUFFQTs7O0FBR0c7QUFDSCxTQUFTLDhCQUE4QixDQUFDLE1BQU0sRUFBQTtJQUM1QyxPQUFPO0FBQ0wsUUFBQSxVQUFVLEVBQUUsU0FBUyxDQUFDLE1BQU0sRUFBRSxrQkFBa0I7Y0FDNUMsTUFBTSxDQUFDLE1BQU0sRUFBRSxrQkFBa0IsQ0FBQyxHQUFHO0FBQ3ZDLGNBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxFQUFFLGlCQUFpQixDQUFDLElBQUksQ0FBQyxJQUFJLGNBQWM7QUFDN0QsUUFBQSxRQUFRLEVBQUUsU0FBUztBQUNuQixRQUFBLGNBQWMsRUFBRSxRQUFRLENBQUMsTUFBTSxFQUFFLGdDQUFnQyxDQUFDO0FBQ2xFLFFBQUEseUJBQXlCLEVBQUUsUUFBUSxDQUFDLE1BQU0sRUFBRSwyQ0FBMkMsQ0FBQztBQUN4RixRQUFBLEtBQUssRUFBRSxTQUFTO0FBQ2hCLFFBQUEsV0FBVyxFQUFFLFNBQVMsQ0FBQyxNQUFNLEVBQUUseUJBQXlCO0FBQ3RELGNBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSx5QkFBeUI7QUFDMUMsY0FBRSxNQUFNLENBQUMsTUFBTSxFQUFFLHFCQUFxQixDQUFDO0FBQ3pDLFFBQUEsVUFBVSxFQUFFLFNBQVMsQ0FBQyxNQUFNLEVBQUUsd0JBQXdCO0FBQ3BELGNBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSx3QkFBd0I7QUFDekMsY0FBRSxNQUFNLENBQUMsTUFBTSxFQUFFLG9CQUFvQixDQUFDO0FBQ3hDLFFBQUEsZUFBZSxFQUFFLFNBQVM7QUFDMUIsUUFBQSxhQUFhLEVBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxlQUFlLENBQUM7QUFDOUMsUUFBQSxhQUFhLEVBQUUsU0FBUztBQUN4QixRQUFBLGVBQWUsRUFBRSxTQUFTO0FBQzFCLFFBQUEsY0FBYyxFQUFFLFNBQVM7QUFDekIsUUFBQSxVQUFVLEVBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxlQUFlLENBQUM7QUFDM0MsUUFBQSxjQUFjLEVBQUUsU0FBUztRQUN6QixFQUFFLEVBQUUsTUFBTSxDQUFDLEVBQUU7QUFDYixRQUFBLElBQUksRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztBQUM5QixRQUFBLGlCQUFpQixFQUFFLFNBQVM7QUFDNUIsUUFBQSxZQUFZLEVBQUUsU0FBUztBQUN2QixRQUFBLE9BQU8sRUFBRSxTQUFTO1FBQ2xCLFNBQVMsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7QUFDdkMsUUFBQSxlQUFlLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUM7QUFDM0MsUUFBQSxJQUFJLEVBQUUsT0FBTztLQUNkO0FBQ0g7QUFFQTs7OztBQUlHO0FBQ0gsU0FBUyx1QkFBdUIsQ0FBQyxNQUFNLEVBQUUsU0FBUyxFQUFBO0lBQ2hELE9BQU87QUFDTCxRQUFBLGdCQUFnQixFQUFFLFNBQVM7QUFDM0IsUUFBQSxPQUFPLEVBQUUsUUFBQSxDQUFBLE1BQUEsQ0FBUyxNQUFNLENBQUMsRUFBRSxDQUFFO0FBQzdCLFFBQUEsUUFBUSxFQUFFO0FBQ1IsY0FBRSxNQUFNLENBQUMsTUFBTSxFQUFFLGNBQWM7QUFDL0IsY0FBRSxTQUFTO1FBQ2IsRUFBRSxFQUFFLE1BQU0sQ0FBQyxFQUFFO0FBQ2IsUUFBQSxRQUFRLEVBQUUsU0FBUztBQUNuQixRQUFBLFNBQVMsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztBQUNuQyxRQUFBLFNBQVMsRUFBRTtBQUNULGNBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxlQUFlO0FBQ2hDLGNBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxtQkFBbUIsQ0FBQztBQUN2QyxRQUFBLFFBQVEsRUFBRTtBQUNSLGNBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxjQUFjO0FBQy9CLGNBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxrQkFBa0IsQ0FBQztBQUN0QyxRQUFBLEtBQUssRUFBRSxNQUFNLENBQUMsTUFBTSxFQUFFLE9BQU8sQ0FBQztBQUM5QixRQUFBLFFBQVEsRUFBRSxTQUFTO0FBQ25CLFFBQUEsSUFBSSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsTUFBTSxDQUFDO1FBQ3pCLFNBQVMsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7QUFDdkMsUUFBQSxPQUFPLEVBQUUsUUFBQSxDQUFBLE1BQUEsQ0FBUyxNQUFNLENBQUMsRUFBRSxDQUFFO0FBQzdCLFFBQUEsV0FBVyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDO0tBQ3hDO0FBQ0g7QUFFQTs7O0FBR0c7QUFDSCxTQUFTLDhCQUE4QixDQUFDLE1BQU0sRUFBQTtJQUM1QyxJQUFNLEdBQUcsR0FBRyx1QkFBdUIsQ0FBQyxNQUFNLEVBQUUsSUFBSSxDQUFDO0FBRWpELElBQUEsTUFBTSxDQUFDLE1BQU0sQ0FBQyxHQUFHLEVBQUU7QUFDakIsUUFBQSxpQkFBaUIsRUFBRSxTQUFTO0FBQzVCLFFBQUEsZ0JBQWdCLEVBQUUsU0FBUztBQUMzQixRQUFBLGNBQWMsRUFBRSxTQUFTO0FBQ3pCLFFBQUEsYUFBYSxFQUFFLFNBQVM7QUFDeEIsUUFBQSxxQkFBcUIsRUFBRSxTQUFTO0FBQ2hDLFFBQUEsZ0JBQWdCLEVBQUUsU0FBUztBQUMzQixRQUFBLGFBQWEsRUFBRSxNQUFNLENBQUMsTUFBTSxFQUFFLGVBQWUsQ0FBQztBQUM5QyxRQUFBLFlBQVksRUFBRSxTQUFTO0FBQ3ZCLFFBQUEsYUFBYSxFQUFFLE1BQU0sQ0FBQyxNQUFNLEVBQUUsZUFBZSxDQUFDO0FBQzlDLFFBQUEsY0FBYyxFQUFFLFNBQVM7QUFDekIsUUFBQSxXQUFXLEVBQUUsU0FBUztRQUN0QixNQUFNLEVBQUUsa0JBQWtCLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxvQkFBb0IsQ0FBQyxDQUFDO0FBQzdELFFBQUEsZ0JBQWdCLEVBQUUsU0FBUztBQUMzQixRQUFBLFdBQVcsRUFBRSxNQUFNLENBQUMsTUFBTSxFQUFFLGFBQWEsQ0FBQztBQUMxQyxRQUFBLGVBQWUsRUFBRSxNQUFNLENBQUMsTUFBTSxFQUFFLGlCQUFpQixDQUFDO0FBQ2xELFFBQUEsZUFBZSxFQUFFLFNBQVM7UUFDMUIsYUFBYSxFQUFFLGtCQUFrQixDQUFDLE1BQU0sQ0FBQyxJQUFJLENBQUMsU0FBUyxDQUFDLENBQUM7QUFDekQsUUFBQSxJQUFJLEVBQUUsYUFBYTtBQUNwQixLQUFBLENBQUM7QUFFRixJQUFBLE9BQU8sR0FBRztBQUNaO0FBRUE7OztBQUdHO0FBQ0gsU0FBUywrQkFBK0IsQ0FBQyxNQUFNLEVBQUE7SUFDN0MsSUFBTSxHQUFHLEdBQUcsdUJBQXVCLENBQUMsTUFBTSxFQUFFLEtBQUssQ0FBQztBQUVsRCxJQUFBLE1BQU0sQ0FBQyxNQUFNLENBQUMsR0FBRyxFQUFFO0FBQ2pCLFFBQUEsU0FBUyxFQUFFLE1BQU0sQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDO0FBQ3RDLFFBQUEsYUFBYSxFQUFFLE1BQU0sQ0FBQyxNQUFNLEVBQUUsZUFBZSxDQUFDO0FBQzlDLFFBQUEsV0FBVyxFQUFFLE1BQU0sQ0FBQyxNQUFNLEVBQUUsYUFBYSxDQUFDO0FBQzFDLFFBQUEsZUFBZSxFQUFFLFNBQVM7QUFDMUIsUUFBQSxhQUFhLEVBQUUsU0FBUztBQUN4QixRQUFBLElBQUksRUFBRSxjQUFjO0FBQ3JCLEtBQUEsQ0FBQztBQUVGLElBQUEsT0FBTyxHQUFHO0FBQ1o7QUFFQTs7OztBQUlHO0FBQ0gsU0FBUywwQkFBMEIsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFBO0lBQ2xELE9BQU87UUFDTCxhQUFhLEVBQUUsc0JBQXNCLENBQUMsTUFBTSxDQUFDLElBQUksQ0FBQyxlQUFlLENBQUMsQ0FBQztBQUNuRSxRQUFBLE9BQU8sRUFBRSxTQUFTO1FBQ2xCLEVBQUUsRUFBRSxNQUFNLENBQUMsRUFBRTtBQUNiLFFBQUEsRUFBRSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsV0FBVyxDQUFDO0FBQzVCLFFBQUEsUUFBUSxFQUFBLFFBQUE7QUFDUixRQUFBLElBQUksRUFBRSxNQUFNLENBQUMsTUFBTSxFQUFFLFlBQVksQ0FBQztBQUNsQyxRQUFBLFFBQVEsRUFBRSxRQUFRLENBQUMsTUFBTSxFQUFFLFVBQVUsQ0FBQztBQUN0QyxRQUFBLFFBQVEsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLFdBQVcsQ0FBQztBQUNsQyxRQUFBLGFBQWEsRUFBRSxTQUFTO1FBQ3hCLFNBQVMsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7QUFDdkMsUUFBQSxXQUFXLEVBQUUsU0FBUztBQUN0QixRQUFBLElBQUksRUFBRTtBQUNKLGNBQUU7QUFDRixjQUFFLGlCQUFpQjtBQUNyQixRQUFBLEdBQUcsRUFBRSxTQUFTO0tBQ2Y7QUFDSDtBQUVBOzs7QUFHRztBQUNILFNBQVMsOEJBQThCLENBQUMsTUFBTSxFQUFBO0lBQzVDLE9BQU87QUFDTCxRQUFBLHdCQUF3QixFQUFFLFNBQVM7QUFDbkMsUUFBQSx3QkFBd0IsRUFBRSxTQUFTO0FBQ25DLFFBQUEsYUFBYSxFQUFFLE1BQU0sQ0FBQyxNQUFNLEVBQUUsZUFBZSxDQUFDO0FBQzlDLFFBQUEsU0FBUyxFQUFFLE1BQU0sQ0FBQyxNQUFNLEVBQUUsV0FBVyxDQUFDO0FBQ3RDLFFBQUEsbUJBQW1CLEVBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxxQkFBcUIsQ0FBQztRQUMxRCxvQkFBb0IsRUFBRSxrQkFBa0IsQ0FBQyxNQUFNLENBQUMsSUFBSSxDQUFDLFNBQVMsQ0FBQyxDQUFDO1FBQ2hFLEVBQUUsRUFBRSxNQUFNLENBQUMsRUFBRTtBQUNiLFFBQUEsMkJBQTJCLEVBQUUsU0FBUztBQUN0QyxRQUFBLHVCQUF1QixFQUFFLFNBQVM7QUFDbEMsUUFBQSxnQkFBZ0IsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLGtCQUFrQixDQUFDO0FBQ2pELFFBQUEsU0FBUyxFQUFFLFNBQVM7QUFDcEIsUUFBQSxRQUFRLEVBQUUsU0FBUztBQUNuQixRQUFBLFFBQVEsRUFBRSxTQUFTO0FBQ25CLFFBQUEsaUJBQWlCLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxtQkFBbUIsQ0FBQztBQUNuRCxRQUFBLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxNQUFNLEVBQUUsa0JBQWtCLENBQUM7QUFDcEQsUUFBQSxZQUFZLEVBQUUsTUFBTSxDQUFDLE1BQU0sRUFBRSxjQUFjLENBQUM7QUFDNUMsUUFBQSxpQkFBaUIsRUFBRSxNQUFNLENBQUMsTUFBTSxFQUFFLG1CQUFtQixDQUFDO0FBQ3RELFFBQUEsYUFBYSxFQUFFLE1BQU0sQ0FBQyxNQUFNLEVBQUUsZUFBZSxDQUFDO0FBQzlDLFFBQUEsdUJBQXVCLEVBQUUsU0FBUztBQUNsQyxRQUFBLG1CQUFtQixFQUFFLFNBQVM7QUFDOUIsUUFBQSxLQUFLLEVBQUUsU0FBUztRQUNoQixTQUFTLEVBQUUsSUFBSSxDQUFDLEtBQUssQ0FBQyxNQUFNLENBQUMsU0FBUyxDQUFDO0FBQ3ZDLFFBQUEsa0JBQWtCLEVBQUUsU0FBUztBQUM3QixRQUFBLFdBQVcsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLGVBQWUsQ0FBQztBQUN6QyxRQUFBLElBQUksRUFBRSxnQkFBZ0I7QUFDdEIsUUFBQSxRQUFRLEVBQUUsVUFBVSxDQUFDLE1BQU0sRUFBRSxjQUFjLENBQUM7S0FDN0M7QUFDSDtBQUVBOzs7QUFHRztBQUNILFNBQVMseUJBQXlCLENBQUMsTUFBTSxFQUFBO0lBQ3ZDLE9BQU87QUFDTCxRQUFBLGlCQUFpQixFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDO0FBQy9DLFFBQUEsV0FBVyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsaUJBQWlCLENBQUM7QUFDM0MsUUFBQSxvQkFBb0IsRUFBRSxNQUFNLENBQUMsSUFBSSxDQUFDLDBCQUEwQixDQUFDO1FBQzdELEVBQUUsRUFBRSxNQUFNLENBQUMsRUFBRTtBQUNiLFFBQUEsbUJBQW1CLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxjQUFjLENBQUM7UUFDaEQsU0FBUyxFQUFFLElBQUksQ0FBQyxLQUFLLENBQUMsTUFBTSxDQUFDLFNBQVMsQ0FBQztBQUN2QyxRQUFBLElBQUksRUFBRSxhQUFhO0tBQ3BCO0FBQ0g7QUFFQTs7O0FBR0c7QUFDSCxTQUFTLHlCQUF5QixDQUFDLE1BQU0sRUFBQTtJQUN2QyxPQUFPO0FBQ0wsUUFBQSxhQUFhLEVBQUUsU0FBUztBQUN4QixRQUFBLFNBQVMsRUFBRSxTQUFTO0FBQ3BCLFFBQUEsYUFBYSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsZUFBZSxDQUFDO1FBQzNDLEVBQUUsRUFBRSxNQUFNLENBQUMsRUFBRTtBQUNiLFFBQUEsS0FBSyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO0FBQzNCLFFBQUEsZ0JBQWdCLEVBQUUsU0FBUztBQUMzQixRQUFBLFlBQVksRUFBRSxTQUFTO0FBQ3ZCLFFBQUEsUUFBUSxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBVSxDQUFDO0FBQ2pDLFFBQUEsS0FBSyxFQUFFLE1BQU0sQ0FBQyxJQUFJLENBQUMsT0FBTyxDQUFDO1FBQzNCLFNBQVMsRUFBRSxJQUFJLENBQUMsS0FBSyxDQUFDLE1BQU0sQ0FBQyxTQUFTLENBQUM7QUFDdkMsUUFBQSxXQUFXLEVBQUUsTUFBTSxDQUFDLElBQUksQ0FBQyxhQUFhLENBQUM7QUFDdkMsUUFBQSxJQUFJLEVBQUUsY0FBYztLQUNyQjtBQUNIO0FBRUE7OztBQUdHO0FBQ0gsU0FBUyxrQkFBa0IsQ0FBQyxJQUFJLEVBQUE7QUFDOUIsSUFBQSxPQUFPLEtBQUssQ0FBQyxJQUFJLENBQUMsSUFBSSxJQUFJLEtBQUs7QUFDN0IsVUFBRTtVQUNBLFFBQVEsQ0FBQyxJQUFJLEVBQUUsRUFBRSxDQUFDLEdBQUcsSUFBSTtBQUMvQjtBQUVBOzs7QUFHRztBQUNILFNBQVMsc0JBQXNCLENBQUMsSUFBSSxFQUFBO0lBQ2xDLFFBQVEsSUFBSTtBQUNWLFFBQUEsS0FBSyxlQUFlO0FBQ2xCLFlBQUEsT0FBTyxPQUFPO0FBQ2hCLFFBQUEsS0FBSyxpQkFBaUI7QUFDcEIsWUFBQSxPQUFPLE9BQU87QUFDaEIsUUFBQSxLQUFLLE1BQU07QUFDWCxRQUFBLEtBQUssT0FBTztBQUNaLFFBQUE7QUFDRSxZQUFBLE9BQU8sSUFBSTs7QUFFakI7QUFFQSxTQUFTLE1BQU0sQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFBO0lBQzlCLElBQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO0FBQ2xDLElBQUEsT0FBTyxTQUFTLENBQUMsTUFBTSxFQUFFLFFBQVE7QUFDL0IsVUFBRSxRQUFRLENBQUMsSUFBSSxFQUFFLEVBQUU7VUFDakIsU0FBUztBQUNmO0FBRUEsU0FBUyxRQUFRLENBQUMsTUFBTSxFQUFFLFFBQVEsRUFBQTtJQUNoQyxJQUFNLElBQUksR0FBRyxNQUFNLENBQUMsSUFBSSxDQUFDLFFBQVEsQ0FBQztBQUNsQyxJQUFBLE9BQU8sU0FBUyxDQUFDLE1BQU0sRUFBRSxRQUFRO0FBQy9CLFVBQUUsVUFBVSxDQUFDLElBQUk7VUFDZixTQUFTO0FBQ2Y7QUFFQSxTQUFTLFVBQVUsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFBO0lBQ2xDLElBQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO0FBQ2xDLElBQUEsT0FBTyxTQUFTLENBQUMsTUFBTSxFQUFFLFFBQVE7V0FDNUIsSUFBSSxLQUFLLE1BQU0sSUFBSSxJQUFJLEtBQUssSUFBSTtVQUNqQyxTQUFTO0FBQ2Y7QUFFQSxTQUFTLFNBQVMsQ0FBQyxNQUFNLEVBQUUsUUFBUSxFQUFBO0lBQ2pDLElBQU0sSUFBSSxHQUFHLE1BQU0sQ0FBQyxJQUFJLENBQUMsUUFBUSxDQUFDO0lBQ2xDLE9BQU8sT0FBTyxJQUFJLEtBQUssV0FBVyxJQUFJLElBQUksS0FBSyxFQUFFO0FBQ25EOzs7OyJ9
