'use strict';

var tslib = require('tslib');
var index = require('../errors/index.js');
var mockrtcstatsreport = require('./mockrtcstatsreport.js');

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
        return Promise.reject(new index.InvalidArgumentError(ERROR_PEER_CONNECTION_NULL));
    }
    if (typeof peerConnection.getStats !== 'function') {
        return Promise.reject(new index.NotSupportedError(ERROR_WEB_RTC_UNSUPPORTED));
    }
    var promise;
    try {
        promise = peerConnection.getStats();
    }
    catch (e) {
        promise = new Promise(function (resolve) { return peerConnection.getStats(resolve); }).then(mockrtcstatsreport.default.fromRTCStatsResponse);
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
            iceCandidateStats: tslib.__spreadArray(tslib.__spreadArray([], localCandidates, true), remoteCandidates, true),
            selectedIceCandidatePairStats: selectedIceCandidatePairStats,
        };
    });
}
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

exports.getRTCIceCandidateStatsReport = getRTCIceCandidateStatsReport;
exports.getRTCStats = getRTCStats;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoic3RhdHMuanMiLCJzb3VyY2VzIjpbIi4uLy4uLy4uL2xpYi90d2lsaW8vcnRjL3N0YXRzLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIkludmFsaWRBcmd1bWVudEVycm9yIiwiTm90U3VwcG9ydGVkRXJyb3IiLCJNb2NrUlRDU3RhdHNSZXBvcnQiLCJfX3NwcmVhZEFycmF5Il0sIm1hcHBpbmdzIjoiOzs7Ozs7QUFLQSxJQUFNLDBCQUEwQixHQUFHLHdCQUF3QjtBQUMzRCxJQUFNLHlCQUF5QixHQUFHLG1DQUFtQztBQUVyRTs7Ozs7QUFLRztBQUNILFNBQVMsWUFBWSxDQUFDLE1BQU0sRUFBRSxFQUFFLEVBQUE7QUFDOUIsSUFBQSxJQUFJLE9BQU8sTUFBTSxDQUFDLEdBQUcsS0FBSyxVQUFVLEVBQUU7QUFDcEMsUUFBQSxPQUFPLE1BQU0sQ0FBQyxHQUFHLENBQUMsRUFBRSxDQUFDO0lBQ3ZCO0FBQ0EsSUFBQSxPQUFPLE1BQU0sQ0FBQyxJQUFJLENBQUMsVUFBQSxDQUFDLEVBQUEsRUFBSSxPQUFBLENBQUMsQ0FBQyxFQUFFLEtBQUssRUFBRSxDQUFBLENBQVgsQ0FBVyxDQUFDO0FBQ3RDO0FBRUE7Ozs7QUFJRztBQUNILFNBQVMsaUJBQWlCLENBQUMsY0FBYyxFQUFBO0lBQ3ZDLElBQUksQ0FBQyxjQUFjLEVBQUU7UUFDbkIsT0FBTyxPQUFPLENBQUMsTUFBTSxDQUFDLElBQUlBLDBCQUFvQixDQUFDLDBCQUEwQixDQUFDLENBQUM7SUFDN0U7QUFFQSxJQUFBLElBQUksT0FBTyxjQUFjLENBQUMsUUFBUSxLQUFLLFVBQVUsRUFBRTtRQUNqRCxPQUFPLE9BQU8sQ0FBQyxNQUFNLENBQUMsSUFBSUMsdUJBQWlCLENBQUMseUJBQXlCLENBQUMsQ0FBQztJQUN6RTtBQUVBLElBQUEsSUFBSSxPQUFPO0FBQ1gsSUFBQSxJQUFJO0FBQ0YsUUFBQSxPQUFPLEdBQUcsY0FBYyxDQUFDLFFBQVEsRUFBRTtJQUNyQztJQUFFLE9BQU8sQ0FBQyxF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
