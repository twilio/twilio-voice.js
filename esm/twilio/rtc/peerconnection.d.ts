/**
 * @typedef {Object} PeerConnection
 * @param audioHelper
 * @param pstream
 * @param options
 * @return {PeerConnection}
 * @constructor
 */
declare function PeerConnection(audioHelper: any, pstream: any, options: any): any;
declare namespace PeerConnection {
    var protocol: any;
    var enabled: boolean;
}
export default PeerConnection;
