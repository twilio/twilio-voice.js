"use strict";
/**
 * @packageDocumentation
 * @module Voice
 * @internalapi
 */
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * {@link RTCIceCandidate} parses an ICE candidate gathered by the browser
 * and returns a IceCandidate object
 */
var IceCandidate = /** @class */ (function () {
    /**
     * @constructor
     * @param iceCandidate RTCIceCandidate coming from the browser
     */
    function IceCandidate(iceCandidate, isRemote) {
        if (isRemote === void 0) { isRemote = false; }
        /**
         * Whether this is deleted from the list of candidate gathered
         */
        this.deleted = false;
        var cost;
        var parts = iceCandidate.candidate.split('network-cost ');
        if (parts[1]) {
            cost = parseInt(parts[1], 10);
        }
        this.candidateType = iceCandidate.type;
        this.ip = iceCandidate.ip || iceCandidate.address;
        this.isRemote = isRemote;
        this.networkCost = cost;
        this.port = iceCandidate.port;
        this.priority = iceCandidate.priority;
        this.protocol = iceCandidate.protocol;
        this.relatedAddress = iceCandidate.relatedAddress;
        this.relatedPort = iceCandidate.relatedPort;
        this.tcpType = iceCandidate.tcpType;
        this.transportId = iceCandidate.sdpMid;
    }
    /**
     * Get the payload object for insights
     */
    IceCandidate.prototype.toPayload = function () {
        return {
            'candidate_type': this.candidateType,
            'deleted': this.deleted,
            'ip': this.ip,
            'is_remote': this.isRemote,
            'network-cost': this.networkCost,
            'port': this.port,
            'priority': this.priority,
            'protocol': this.protocol,
            'related_address': this.relatedAddress,
            'related_port': this.relatedPort,
            'tcp_type': this.tcpType,
            'transport_id': this.transportId,
        };
    };
    return IceCandidate;
}());
exports.IceCandidate = IceCandidate;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWNlY2FuZGlkYXRlLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiLi4vLi4vLi4vbGliL3R3aWxpby9ydGMvaWNlY2FuZGlkYXRlLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7QUFBQTs7OztHQUlHOztBQTZCSDs7O0dBR0c7QUFDSDtJQWlFRTs7O09BR0c7SUFDSCxzQkFBWSxZQUE2QixFQUFFLFFBQXlCO1FBQXpCLHlCQUFBLEVBQUEsZ0JBQXlCO1FBOURwRTs7V0FFRztRQUNLLFlBQU8sR0FBWSxLQUFLLENBQUM7UUE0RC9CLElBQUksSUFBSSxDQUFDO1FBQ1QsSUFBTSxLQUFLLEdBQUcsWUFBWSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDLENBQUM7UUFFNUQsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDWixJQUFJLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUMsQ0FBQztTQUMvQjtRQUVELElBQUksQ0FBQyxhQUFhLEdBQUcsWUFBWSxDQUFDLElBQUksQ0FBQztRQUN2QyxJQUFJLENBQUMsRUFBRSxHQUFHLFlBQVksQ0FBQyxFQUFFLElBQUksWUFBWSxDQUFDLE9BQU8sQ0FBQztRQUNsRCxJQUFJLENBQUMsUUFBUSxHQUFHLFFBQVEsQ0FBQztRQUN6QixJQUFJLENBQUMsV0FBVyxHQUFHLElBQUksQ0FBQztRQUN4QixJQUFJLENBQUMsSUFBSSxHQUFHLFlBQVksQ0FBQyxJQUFJLENBQUM7UUFDOUIsSUFBSSxDQUFDLFFBQVEsR0FBRyxZQUFZLENBQUMsUUFBUSxDQUFDO1FBQ3RDLElBQUksQ0FBQyxRQUFRLEdBQUcsWUFBWSxDQUFDLFFBQVEsQ0FBQztRQUN0QyxJQUFJLENBQUMsY0FBYyxHQUFHLFlBQVksQ0FBQyxjQUFjLENBQUM7UUFDbEQsSUFBSSxDQUFDLFdBQVcsR0FBRyxZQUFZLENBQUMsV0FBVyxDQUFDO1FBQzVDLElBQUksQ0FBQyxPQUFPLEdBQUcsWUFBWSxDQUFDLE9BQU8sQ0FBQztRQUNwQyxJQUFJLENBQUMsV0FBVyxHQUFHLFlBQVksQ0FBQyxNQUFNLENBQUM7SUFDekMsQ0FBQztJQUVEOztPQUVHO0lBQ0gsZ0NBQVMsR0FBVDtRQUNFLE9BQU87WUFDTCxnQkFBZ0IsRUFBRSxJQUFJLENBQUMsYUFBYTtZQUNwQyxTQUFTLEVBQUUsSUFBSSxDQUFDLE9BQU87WUFDdkIsSUFBSSxFQUFFLElBQUksQ0FBQyxFQUFFO1lBQ2IsV0FBVyxFQUFFLElBQUksQ0FBQyxRQUFRO1lBQzFCLGNBQWMsRUFBRSxJQUFJLENBQUMsV0FBVztZQUNoQyxNQUFNLEVBQUUsSUFBSSxDQUFDLElBQUk7WUFDakIsVUFBVSxFQUFFLElBQUksQ0FBQyxRQUFRO1lBQ3pCLFVBQVUsRUFBRSxJQUFJLENBQUMsUUFBUTtZQUN6QixpQkFBaUIsRUFBRSxJQUFJLENBQUMsY0FBYztZQUN0QyxjQUFjLEVBQUUsSUFBSSxDQUFDLFdBQVc7WUFDaEMsVUFBVSxFQUFFLElBQUksQ0FBQyxPQUFPO1lBQ3hCLGNBQWMsRUFBRSxJQUFJLENBQUMsV0FBVztTQUNqQyxDQUFDO0lBQ0osQ0FBQztJQUNILG1CQUFDO0FBQUQsQ0FBQyxBQTdHRCxJQTZHQztBQTdHWSxvQ0FBWSJ9