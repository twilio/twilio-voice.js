/**
 * Create a MockRTCStatsReport wrapper around a Map of RTCStats objects. If RTCStatsReport is available
 *   natively, it will be inherited so that instanceof checks pass.
 * @constructor
 * @extends RTCStatsReport
 * @param {Map<string, RTCStats>} statsMap - A Map of RTCStats objects to wrap
 *   with a MockRTCStatsReport object.
 */
declare function MockRTCStatsReport(statsMap: any): any;
declare namespace MockRTCStatsReport {
    var prototype: any;
    var fromArray: (array: any) => any;
    var fromRTCStatsResponse: (statsResponse: any) => any;
}
export default MockRTCStatsReport;
