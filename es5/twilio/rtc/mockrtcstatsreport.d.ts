export = MockRTCStatsReport;
/**
 * Create a MockRTCStatsReport wrapper around a Map of RTCStats objects. If RTCStatsReport is available
 *   natively, it will be inherited so that instanceof checks pass.
 * @constructor
 * @extends RTCStatsReport
 * @param {Map<string, RTCStats>} statsMap - A Map of RTCStats objects to wrap
 *   with a MockRTCStatsReport object.
 */
declare function MockRTCStatsReport(statsMap: Map<string, RTCStats>): MockRTCStatsReport;
declare class MockRTCStatsReport {
    /**
     * Create a MockRTCStatsReport wrapper around a Map of RTCStats objects. If RTCStatsReport is available
     *   natively, it will be inherited so that instanceof checks pass.
     * @constructor
     * @extends RTCStatsReport
     * @param {Map<string, RTCStats>} statsMap - A Map of RTCStats objects to wrap
     *   with a MockRTCStatsReport object.
     */
    constructor(statsMap: Map<string, RTCStats>);
    constructor: typeof MockRTCStatsReport;
}
declare namespace MockRTCStatsReport { }
