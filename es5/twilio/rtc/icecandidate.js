'use strict';

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
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiaWNlY2FuZGlkYXRlLmpzIiwic291cmNlcyI6WyIuLi8uLi8uLi9saWIvdHdpbGlvL3J0Yy9pY2VjYW5kaWRhdGUudHMiXSwic291cmNlc0NvbnRlbnQiOltudWxsXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7QUEyQkE7OztBQUdHO0FBQ0gsSUFBQSxZQUFBLGtCQUFBLFlBQUE7QUFpRUU7OztBQUdHO0lBQ0gsU0FBQSxZQUFBLENBQVksWUFBNkIsRUFBRSxRQUF5QixFQUFBO0FBQXpCLFFBQUEsSUFBQSxRQUFBLEtBQUEsTUFBQSxFQUFBLEVBQUEsUUFBQSxHQUFBLEtBQXlCLENBQUEsQ0FBQTtBQTlEcEU7O0FBRUc7UUFDSyxJQUFBLENBQUEsT0FBTyxHQUFZLEtBQUs7QUE0RDlCLFFBQUEsSUFBSSxJQUFJO1FBQ1IsSUFBTSxLQUFLLEdBQUcsWUFBWSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsZUFBZSxDQUFDO0FBRTNELFFBQUEsSUFBSSxLQUFLLENBQUMsQ0FBQyxDQUFDLEVBQUU7WUFDWixJQUFJLEdBQUcsUUFBUSxDQUFDLEtBQUssQ0FBQyxDQUFDLENBQUMsRUFBRSxFQUFFLENBQUM7UUFDL0I7QUFFQSxRQUFBLElBQUksQ0FBQyxhQUFhLEdBQUcsWUFBWSxDQUFDLElBQUk7UUFDdEMsSUFBSSxDQUFDLEVBQUUsR0FBRyxZQUFZLENBQUMsRUFBRSxJQUFJLFlBQVksQ0FBQyxPQUFPO0FBQ2pELFFBQUEsSUFBSSxDQUFDLFFBQVEsR0FBRyxRQUFRO0FBQ3hCLFFBQUEsSUFBSSxDQUFDLFdBQVcsR0FBRyxJQUFJO0FBQ3ZCLFFBQUEsSUFBSSxDQUFDLElBQUksR0FBRyxZQUFZLENBQUMsSUFBSTtBQUM3QixRQUFBLElBQUksQ0FBQyxRQUFRLEdBQUcsWUFBWSxDQUFDLFFBQVE7QUFDckMsUUFBQSxJQUFJLENBQUMsUUFBUSxHQUFHLFlBQVksQ0FBQyxRQUFRO0FBQ3JDLFFBQUEsSUFBSSxDQUFDLGNBQWMsR0FBRyxZQUFZLENBQUMsY0FBYztBQUNqRCxRQUFBLElBQUksQ0FBQyxXQUFXLEdBQUcsWUFBWSxDQUFDLFdBQVc7QUFDM0MsUUFBQSxJQUFJLENBQUMsT0FBTyxHQUFHLFlBQVksQ0FBQyxPQUFPO0FBQ25DLFFBQUEsSUFBSSxDQUFDLFdBQVcsR0FBRyxZQUFZLENBQUMsTUFBTTtJQUN4QztBQUVBOztBQUVHO0FBQ0gsSUFBQSxZQUFBLENBQUEsU0FBQSxDQUFBLFNBQVMsR0FBVCxZQUFBO1FBQ0UsT0FBTztZQUNMLGdCQUFnQixFQUFFLElBQUksQ0FBQyxhQUFhO1lBQ3BDLFNBQVMsRUFBRSxJQUFJLENBQUMsT0FBTztZQUN2QixJQUFJLEVBQUUsSUFBSSxDQUFDLEVBQUU7WUFDYixXQUFXLEVBQUUsSUFBSSxDQUFDLFFBQVE7WUFDMUIsY0FBYyxFQUFFLElBQUksQ0FBQyxXQUFXO1lBQ2hDLE1BQU0sRUFBRSxJQUFJLENBQUMsSUFBSTtZQUNqQixVQUFVLEVBQUUsSUFBSSxDQUFDLFFBQVE7WUFDekIsVUFBVSxFQUFFLElBQUksQ0FBQyxRQUFRO1lBQ3pCLGlCQUFpQixFQUFFLElBQUksQ0FBQyxjQUFjO1lBQ3RDLGNBQWMsRUFBRSxJQUFJLENBQUMsV0FBVztZQUNoQyxVQUFVLEVBQUUsSUFBSSxDQUFDLE9BQU87WUFDeEIsY0FBYyxFQUFFLElBQUksQ0FBQyxXQUFXO1NBQ2pDO0lBQ0gsQ0FBQztJQUNILE9BQUEsWUFBQztBQUFELENBQUMsRUE3R0Q7Ozs7In0=
