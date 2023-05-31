"use strict";
var __spreadArrays = (this && this.__spreadArrays) || function () {
    for (var s = 0, i = 0, il = arguments.length; i < il; i++) s += arguments[i].length;
    for (var r = Array(s), k = 0, i = 0; i < il; i++)
        for (var a = arguments[i], j = 0, jl = a.length; j < jl; j++, k++)
            r[k] = a[j];
    return r;
};
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
// @ts-nocheck
// tslint:disable no-empty
var errors_1 = require("../errors");
var mockrtcstatsreport_1 = require("./mockrtcstatsreport");
var ERROR_PEER_CONNECTION_NULL = 'PeerConnection is null';
var ERROR_WEB_RTC_UNSUPPORTED = 'WebRTC statistics are unsupported';
/**
 * Helper function to find a specific stat from a report.
 * Some environment provide the stats report as a map (regular browsers)
 * but some provide stats report as an array (citrix vdi)
 * @private
 */
function findStatById(report, id) {
    if (typeof report.get === 'function') {
        return report.get(id);
    }
    return report.find(function (s) { return s.id === id; });
}
/**
 * Generate WebRTC statistics report for the given {@link PeerConnection}
 * @param {PeerConnection} peerConnection - Target connection.
 * @return {Promise<RTCStatsReport>} WebRTC RTCStatsReport object
 */
function getRTCStatsReport(peerConnection) {
    if (!peerConnection) {
        return Promise.reject(new errors_1.InvalidArgumentError(ERROR_PEER_CONNECTION_NULL));
    }
    if (typeof peerConnection.getStats !== 'function') {
        return Promise.reject(new errors_1.NotSupportedError(ERROR_WEB_RTC_UNSUPPORTED));
    }
    var promise;
    try {
        promise = peerConnection.getStats();
    }
    catch (e) {
        promise = new Promise(function (resolve) { return peerConnection.getStats(resolve); }).then(mockrtcstatsreport_1.default.fromRTCStatsResponse);
    }
    return promise;
}
/**
 * @typedef {Object} StatsOptions
 * Used for testing to inject and extract methods.
 * @property {function} [createRTCSample] - Method for parsing an RTCStatsReport
 */
/**
 * Collects any WebRTC statistics for the given {@link PeerConnection}
 * @param {PeerConnection} peerConnection - Target connection.
 * @param {StatsOptions} options - List of custom options.
 * @return {Promise<RTCSample>} Universally-formatted version of RTC stats.
 */
function getRTCStats(peerConnection, options) {
    options = Object.assign({ createRTCSample: createRTCSample }, options);
    return getRTCStatsReport(peerConnection).then(options.createRTCSample);
}
exports.getRTCStats = getRTCStats;
/**
 * Generate WebRTC stats report containing relevant information about ICE candidates for the given {@link PeerConnection}
 * @param {PeerConnection} peerConnection - Target connection.
 * @return {Promise<RTCIceCandidateStatsReport>} RTCIceCandidateStatsReport object
 */
function getRTCIceCandidateStatsReport(peerConnection) {
    return getRTCStatsReport(peerConnection).then(function (report) {
        // Find the relevant information needed to determine selected candidates later
        var _a = Array.from(report.values()).reduce(function (rval, stat) {
            ['candidatePairs', 'localCandidates', 'remoteCandidates'].forEach(function (prop) {
                if (!rval[prop]) {
                    rval[prop] = [];
                }
            });
            switch (stat.type) {
                case 'candidate-pair':
                    rval.candidatePairs.push(stat);
                    break;
                case 'local-candidate':
                    rval.localCandidates.push(stat);
                    break;
                case 'remote-candidate':
                    rval.remoteCandidates.push(stat);
                    break;
                case 'transport':
                    // This transport is the one being used if selectedCandidatePairId is populated
                    if (stat.selectedCandidatePairId) {
                        rval.transport = stat;
                    }
                    break;
            }
            return rval;
        }, {}), candidatePairs = _a.candidatePairs, localCandidates = _a.localCandidates, remoteCandidates = _a.remoteCandidates, transport = _a.transport;
        // This is a report containing information about the selected candidates, such as IDs
        // This is coming from WebRTC stats directly and doesn't contain the actual ICE Candidates info
        var selectedCandidatePairReport = candidatePairs.find(function (pair) {
            // Firefox
            return pair.selected ||
                // Spec-compliant way
                (transport && pair.id === transport.selectedCandidatePairId);
        });
        var selectedIceCandidatePairStats;
        if (selectedCandidatePairReport) {
            selectedIceCandidatePairStats = {
                localCandidate: localCandidates.find(function (candidate) { return candidate.id === selectedCandidatePairReport.localCandidateId; }),
                remoteCandidate: remoteCandidates.find(function (candidate) { return candidate.id === selectedCandidatePairReport.remoteCandidateId; }),
            };
        }
        // Build the return object
        return {
            iceCandidateStats: __spreadArrays(localCandidates, remoteCandidates),
            selectedIceCandidatePairStats: selectedIceCandidatePairStats,
        };
    });
}
exports.getRTCIceCandidateStatsReport = getRTCIceCandidateStatsReport;
/**
 * @typedef {Object} RTCSample - A sample containing relevant WebRTC stats information.
 * @property {Number} [timestamp]
 * @property {String} [codecName] - MimeType name of the codec being used by the outbound audio stream
 * @property {Number} [rtt] - Round trip time
 * @property {Number} [jitter]
 * @property {Number} [packetsSent]
 * @property {Number} [packetsLost]
 * @property {Number} [packetsReceived]
 * @property {Number} [bytesReceived]
 * @property {Number} [bytesSent]
 * @property {Number} [localAddress]
 * @property {Number} [remoteAddress]
 */
function RTCSample() { }
/**
 * Create an RTCSample object from an RTCStatsReport
 * @private
 * @param {RTCStatsReport} statsReport
 * @returns {RTCSample}
 */
function createRTCSample(statsReport) {
    var activeTransportId = null;
    var sample = new RTCSample();
    var fallbackTimestamp;
    Array.from(statsReport.values()).forEach(function (stats) {
        // Skip isRemote tracks which will be phased out completely and break in FF66.
        if (stats.isRemote) {
            return;
        }
        // Firefox hack -- Older firefox doesn't have dashes in type names
        var type = stats.type.replace('-', '');
        fallbackTimestamp = fallbackTimestamp || stats.timestamp;
        // (rrowland) As I understand it, this is supposed to come in on remote-inbound-rtp but it's
        // currently coming in on remote-outbound-rtp, so I'm leaving this outside the switch until
        // the appropriate place to look is cleared up.
        if (stats.remoteId) {
            var remote = findStatById(statsReport, stats.remoteId);
            if (remote && remote.roundTripTime) {
                sample.rtt = remote.roundTripTime * 1000;
            }
        }
        switch (type) {
            case 'inboundrtp':
                sample.timestamp = sample.timestamp || stats.timestamp;
                sample.jitter = stats.jitter * 1000;
                sample.packetsLost = stats.packetsLost;
                sample.packetsReceived = stats.packetsReceived;
                sample.bytesReceived = stats.bytesReceived;
                break;
            case 'outboundrtp':
                sample.timestamp = stats.timestamp;
                sample.packetsSent = stats.packetsSent;
                sample.bytesSent = stats.bytesSent;
                if (stats.codecId) {
                    var codec = findStatById(statsReport, stats.codecId);
                    sample.codecName = codec
                        ? codec.mimeType && codec.mimeType.match(/(.*\/)?(.*)/)[2]
                        : stats.codecId;
                }
                break;
            case 'transport':
                activeTransportId = stats.id;
                break;
        }
    });
    if (!sample.timestamp) {
        sample.timestamp = fallbackTimestamp;
    }
    var activeTransport = findStatById(statsReport, activeTransportId);
    if (!activeTransport) {
        return sample;
    }
    var selectedCandidatePair = findStatById(statsReport, activeTransport.selectedCandidatePairId);
    if (!selectedCandidatePair) {
        return sample;
    }
    var localCandidate = findStatById(statsReport, selectedCandidatePair.localCandidateId);
    var remoteCandidate = findStatById(statsReport, selectedCandidatePair.remoteCandidateId);
    if (!sample.rtt) {
        sample.rtt = selectedCandidatePair &&
            (selectedCandidatePair.currentRoundTripTime * 1000);
    }
    Object.assign(sample, {
        // ip is deprecated. use address first then ip if on older versions of browser
        localAddress: localCandidate && (localCandidate.address || localCandidate.ip),
        remoteAddress: remoteCandidate && (remoteCandidate.address || remoteCandidate.ip),
    });
    return sample;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHMuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9zdGF0cy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7Ozs7Ozs7QUFBQTs7OztHQUlHO0FBQ0gsY0FBYztBQUNkLDBCQUEwQjtBQUMxQixvQ0FBb0U7QUFDcEUsMkRBQXNEO0FBRXRELElBQU0sMEJBQTBCLEdBQUcsd0JBQXdCLENBQUM7QUFDNUQsSUFBTSx5QkFBeUIsR0FBRyxtQ0FBbUMsQ0FBQztBQUV0RTs7Ozs7R0FLRztBQUNILFNBQVMsWUFBWSxDQUFDLE1BQU0sRUFBRSxFQUFFO0lBQzlCLElBQUksT0FBTyxNQUFNLENBQUMsR0FBRyxLQUFLLFVBQVUsRUFBRTtRQUNwQyxPQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDLENBQUM7S0FDdkI7SUFDRCxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBQSxDQUFDLElBQUksT0FBQSxDQUFDLENBQUMsRUFBRSxLQUFLLEVBQUUsRUFBWCxDQUFXLENBQUMsQ0FBQztBQUN2QyxDQUFDO0FBRUQ7Ozs7R0FJRztBQUNILFNBQVMsaUJBQWlCLENBQUMsY0FBYztJQUN2QyxJQUFJLENBQUMsY0FBYyxFQUFFO1FBQ25CLE9BQU8sT0FBTyxDQUFDLE1BQU0sQ0FBQyxJQUFJLDZCQUFvQixDQUFDLDBCQUEwQixDQUFDLENBQUMsQ0FBQztLQUM3RTtJQUVELElBQUksT0FBTyxjQUFjLENBQUMsUUFBUSxLQUFLLFVBQVUsRUFBRTtRQUNqRCxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSSwwQkFBaUIsQ0FBQyx5QkFBeUIsQ0FBQyxDQUFDLENBQUM7S0FDekU7SUFFRCxJQUFJLE9BQU8sQ0FBQztJQUNaLElBQUk7UUFDRixPQUFPLEdBQUcsY0FBYyxDQUFDLFFBQVEsRUFBRSxDQUFDO0tBQ3JDO0lBQUMsT0FBTyxDQUFDLEVBQUU7UUFDVixPQUFPLEdBQUcsSUFBSSxPQUFPLENBQUMs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