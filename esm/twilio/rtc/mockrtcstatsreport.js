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
    MockRTCStatsReport.prototype[key] = function (...args) {
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
                }
                else {
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibW9ja3J0Y3N0YXRzcmVwb3J0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9ydGMvbW9ja3J0Y3N0YXRzcmVwb3J0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiJBQUFBLGNBQWM7QUFFZDs7OztHQUlHO0FBRUgsK0VBQStFO0FBQy9FLE1BQU0sY0FBYyxHQUFHLEtBQUssQ0FBQztBQUU3QixNQUFNLG9CQUFvQixHQUFHLE9BQU8sTUFBTSxLQUFLLFdBQVc7SUFDeEQsQ0FBQyxDQUFDLE1BQU0sQ0FBQyxjQUFjLENBQUMsQ0FBQyxDQUFDLFNBQVMsQ0FBQztBQUV0Qzs7Ozs7OztHQU9HO0FBQ0gsU0FBUyxrQkFBa0IsQ0FBQyxRQUFRO0lBQ2xDLElBQUksQ0FBQyxDQUFDLElBQUksWUFBWSxrQkFBa0IsQ0FBQyxFQUFFLENBQUM7UUFDMUMsT0FBTyxJQUFJLGtCQUFrQixDQUFDLFFBQVEsQ0FBQyxDQUFDO0lBQzFDLENBQUM7SUFFRCxNQUFNLElBQUksR0FBRyxJQUFJLENBQUM7SUFDbEIsTUFBTSxDQUFDLGdCQUFnQixDQUFDLElBQUksRUFBRTtRQUM1QixJQUFJLEVBQUUsRUFBRSxLQUFLLEVBQUUsUUFBUSxFQUFFO1FBQ3pCLElBQUksRUFBRTtZQUNKLFVBQVUsRUFBRSxJQUFJO1lBQ2hCLEdBQUc7Z0JBQ0QsT0FBTyxJQUFJLENBQUMsSUFBSSxDQUFDLElBQUksQ0FBQztZQUN4QixDQUFDO1NBQ0Y7S0FDRixDQUFDLENBQUM7SUFFSCxJQUFJLENBQUMsTUFBTSxDQUFDLFFBQVEsQ0FBQyxHQUFHLFFBQVEsQ0FBQyxNQUFNLENBQUMsUUFBUSxDQUFDLENBQUM7QUFDcEQsQ0FBQztBQUVELDZFQUE2RTtBQUM3RSxJQUFJLG9CQUFvQixFQUFFLENBQUM7SUFDekIsa0JBQWtCLENBQUMsU0FBUyxHQUFHLE1BQU0sQ0FBQyxNQUFNLENBQUMsb0JBQW9CLENBQUMsU0FBUyxDQUFDLENBQUM7SUFDN0Usa0JBQWtC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