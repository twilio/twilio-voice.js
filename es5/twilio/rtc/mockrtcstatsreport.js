"use strict";
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
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
        mimeType: report.stat('mediaType') + "/" + report.stat('googCodecName'),
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
        codecId: "codec-" + report.id,
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
        trackId: "track-" + report.id,
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja3J0Y3N0YXRzcmVwb3J0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9ydGMvbW9ja3J0Y3N0YXRzcmVwb3J0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHO0FBQ0gsY0FBYzs7QUFFZDs7OztHQUlHO0FBRUgsK0VBQStFO0FBQy9FLElBQU0sY0FBYyxHQUFHLEtBQUssQ0FBQztBQUU3QixJQUFNLG9CQUFvQixHQUFHLE9BQU8sTUFBTSxLQUFLLFdBQVc7SUFDeEQsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUV0Qzs7Ozs7OztHQU9HO0FBQ0gsU0FBUyxrQkFBa0IsQ0FBQyxRQUFRO0lBQ2xDLElBQUksQ0FBQyxDQUFDLElBQUksWUFBWSxrQkFBa0IsQ0FBQyxFQUFFO1FBQ3pDLE9BQU8sSUFBSSxrQkFBa0IsQ0FBQyxRQUFRLENBQUMsQ0FBQztLQUN6QztJQUVELElBQU0sSUFBSSxHQUFHLElBQUksQ0FBQztJQUNsQixNQUFNLENBQUMsZ0JBQWdCLENBQUMsSUFBSSxFQUFFO1FBQzVCLElBQUksRUFBRSxFQUFFLEtBQUssRUFBRSxRQUFRLEVBQUU7UUFDekIsSUFBSSxFQUFFO1lBQ0osVUFBVSxFQUFFLElBQUk7WUFDaEIsR0FBRztnQkFDRCxPQUFPLElBQUksQ0FBQyxJQUFJLENBQUMsSUFBSSxDQUFDO1lBQ3hCLENBQUM7U0FDRjtLQUNGLENBQUMsQ0FBQztJQUVILElBQUksQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLEdBQUcsUUFBUSxDQUFDLE1BQU0sQ0FBQyxRQUFRLENBQUMsQ0FBQztBQUNwRCxDQUFDO0FBRUQsNkVBQTZFO0FBQzdFLElBQUksb0JBQW9CLEVBQUU7SUFDeEIsa0JBQWtCLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsb0JBQW9CLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDN0Usa0JBQWtC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