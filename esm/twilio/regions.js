import { InvalidArgumentError } from './errors/index.js';

/**
 * Valid edges.
 */
var Edge;
(function (Edge) {
    /**
     * Public edges
     */
    Edge["Sydney"] = "sydney";
    Edge["SaoPaulo"] = "sao-paulo";
    Edge["Dublin"] = "dublin";
    Edge["Frankfurt"] = "frankfurt";
    Edge["Tokyo"] = "tokyo";
    Edge["Singapore"] = "singapore";
    Edge["Ashburn"] = "ashburn";
    Edge["Umatilla"] = "umatilla";
    Edge["Roaming"] = "roaming";
    /**
     * Interconnect edges
     */
    Edge["AshburnIx"] = "ashburn-ix";
    Edge["SanJoseIx"] = "san-jose-ix";
    Edge["LondonIx"] = "london-ix";
    Edge["FrankfurtIx"] = "frankfurt-ix";
    Edge["SingaporeIx"] = "singapore-ix";
    Edge["SydneyIx"] = "sydney-ix";
    Edge["TokyoIx"] = "tokyo-ix";
})(Edge || (Edge = {}));
/**
 * Valid current regions.
 *
 * @deprecated
 *
 * CLIENT-6831
 * This is no longer used or updated for checking validity of regions in the
 * SDK. We now allow any string to be passed for region. Invalid regions won't
 * be able to connect, and won't throw an exception.
 *
 * CLIENT-7519
 * This is used again to temporarily convert edge values to regions as part of
 * Phase 1 Regional. This is still considered deprecated.
 *
 * @private
 */
var Region;
(function (Region) {
    Region["Au1"] = "au1";
    Region["Au1Ix"] = "au1-ix";
    Region["Br1"] = "br1";
    Region["De1"] = "de1";
    Region["De1Ix"] = "de1-ix";
    Region["Gll"] = "gll";
    Region["Ie1"] = "ie1";
    Region["Ie1Ix"] = "ie1-ix";
    Region["Ie1Tnx"] = "ie1-tnx";
    Region["Jp1"] = "jp1";
    Region["Jp1Ix"] = "jp1-ix";
    Region["Sg1"] = "sg1";
    Region["Sg1Ix"] = "sg1-ix";
    Region["Sg1Tnx"] = "sg1-tnx";
    Region["Us1"] = "us1";
    Region["Us1Ix"] = "us1-ix";
    Region["Us1Tnx"] = "us1-tnx";
    Region["Us2"] = "us2";
    Region["Us2Ix"] = "us2-ix";
    Region["Us2Tnx"] = "us2-tnx";
})(Region || (Region = {}));
/**
 * Region shortcodes. Maps the full region name from AWS to the Twilio shortcode.
 * @private
 */
const regionShortcodes = {
    ASIAPAC_SINGAPORE: Region.Sg1,
    ASIAPAC_SYDNEY: Region.Au1,
    ASIAPAC_TOKYO: Region.Jp1,
    EU_FRANKFURT: Region.De1,
    EU_IRELAND: Region.Ie1,
    SOUTH_AMERICA_SAO_PAULO: Region.Br1,
    US_EAST_VIRGINIA: Region.Us1,
    US_WEST_OREGON: Region.Us2,
};
/**
 * Region to edge mapping, as part of Phase 1 Regional (CLIENT-7519).
 * Temporary.
 * @private
 */
const regionToEdge = {
    [Region.Au1]: Edge.Sydney,
    [Region.Br1]: Edge.SaoPaulo,
    [Region.Ie1]: Edge.Dublin,
    [Region.De1]: Edge.Frankfurt,
    [Region.Jp1]: Edge.Tokyo,
    [Region.Sg1]: Edge.Singapore,
    [Region.Us1]: Edge.Ashburn,
    [Region.Us2]: Edge.Umatilla,
    [Region.Gll]: Edge.Roaming,
    /**
     * Interconnect edges
     */
    [Region.Us1Ix]: Edge.AshburnIx,
    [Region.Us2Ix]: Edge.SanJoseIx,
    [Region.Ie1Ix]: Edge.LondonIx,
    [Region.De1Ix]: Edge.FrankfurtIx,
    [Region.Sg1Ix]: Edge.SingaporeIx,
    [Region.Au1Ix]: Edge.SydneyIx,
    [Region.Jp1Ix]: Edge.TokyoIx,
    /**
     * Tnx regions
     */
    [Region.Us1Tnx]: Edge.AshburnIx,
    [Region.Us2Tnx]: Edge.AshburnIx,
    [Region.Ie1Tnx]: Edge.LondonIx,
    [Region.Sg1Tnx]: Edge.SingaporeIx,
};
/**
 * The default edge to connect to and create a chunder uri from, if the edge
 * parameter is not specified during setup in `Device`.
 * @constant
 */
const defaultEdge = Edge.Roaming;
/**
 * The default event gateway URI to publish to.
 * @constant
 * @private
 */
const defaultEventGatewayURI = 'eventgw.twilio.com';
/**
 * String template for an edge chunder URI
 * @param edge - The edge.
 */
function createChunderEdgeURI(edge) {
    return `voice-js.${edge}.twilio.com`;
}
/**
 * String template for a region insights URI
 * @param region - The region.
 */
function createEventGatewayURI(region) {
    return region
        ? `eventgw.${region}.twilio.com`
        : defaultEventGatewayURI;
}
/**
 * Create a signaling endpoint URL to connect a websocket to from a chunder URI.
 * @param uri the chunder URI to create a signaling endpoint URL for
 */
function createSignalingEndpointURL(uri) {
    return `wss://${uri}/signal`;
}
/**
 * Get the URI associated with the passed edge.
 * @private
 * @param edge - A string or an array of edge values
 * @returns An array of chunder URIs
 */
function getChunderURIs(edge) {
    if (!!edge && typeof edge !== 'string' && !Array.isArray(edge)) {
        throw new InvalidArgumentError('If `edge` is provided, it must be of type `string` or an array of strings.');
    }
    let uris;
    if (edge) {
        const edgeParams = Array.isArray(edge) ? edge : [edge];
        uris = edgeParams.map((param) => createChunderEdgeURI(param));
    }
    else {
        uris = [createChunderEdgeURI(defaultEdge)];
    }
    return uris;
}
/**
 * Get the region shortcode by its full AWS region string.
 *
 * @private
 * @param region - The region's full AWS string.
 */
function getRegionShortcode(region) {
    return regionShortcodes[region] || null;
}

export { Edge, Region, createEventGatewayURI, createSignalingEndpointURL, defaultEdge, getChunderURIs, getRegionShortcode, regionShortcodes, regionToEdge };
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaW9ucy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9yZWdpb25zLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBRUE7O0FBRUc7SUFDUztBQUFaLENBQUEsVUFBWSxJQUFJLEVBQUE7QUFDZDs7QUFFRztBQUNILElBQUEsSUFBQSxDQUFBLFFBQUEsQ0FBQSxHQUFBLFFBQWlCO0FBQ2pCLElBQUEsSUFBQSxDQUFBLFVBQUEsQ0FBQSxHQUFBLFdBQXNCO0FBQ3RCLElBQUEsSUFBQSxDQUFBLFFBQUEsQ0FBQSxHQUFBLFFBQWlCO0FBQ2pCLElBQUEsSUFBQSxDQUFBLFdBQUEsQ0FBQSxHQUFBLFdBQXVCO0FBQ3ZCLElBQUEsSUFBQSxDQUFBLE9BQUEsQ0FBQSxHQUFBLE9BQWU7QUFDZixJQUFBLElBQUEsQ0FBQSxXQUFBLENBQUEsR0FBQSxXQUF1QjtBQUN2QixJQUFBLElBQUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxTQUFtQjtBQUNuQixJQUFBLElBQUEsQ0FBQSxVQUFBLENBQUEsR0FBQSxVQUFxQjtBQUNyQixJQUFBLElBQUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxTQUFtQjtBQUNuQjs7QUFFRztBQUNILElBQUEsSUFBQSxDQUFBLFdBQUEsQ0FBQSxHQUFBLFlBQXdCO0FBQ3hCLElBQUEsSUFBQSxDQUFBLFdBQUEsQ0FBQSxHQUFBLGFBQXlCO0FBQ3pCLElBQUEsSUFBQSxDQUFBLFVBQUEsQ0FBQSxHQUFBLFdBQXNCO0FBQ3RCLElBQUEsSUFBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLGNBQTRCO0FBQzVCLElBQUEsSUFBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLGNBQTRCO0FBQzVCLElBQUEsSUFBQSxDQUFBLFVBQUEsQ0FBQSxHQUFBLFdBQXNCO0FBQ3RCLElBQUEsSUFBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLFVBQW9CO0FBQ3RCLENBQUMsRUF2QlcsSUFBSSxLQUFKLElBQUksR0FBQSxFQUFBLENBQUEsQ0FBQTtBQXlCaEI7Ozs7Ozs7Ozs7Ozs7OztBQWVHO0lBQ1M7QUFBWixDQUFBLFVBQVksTUFBTSxFQUFBO0FBQ2hCLElBQUEsTUFBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQVc7QUFDWCxJQUFBLE1BQUEsQ0FBQSxPQUFBLENBQUEsR0FBQSxRQUFnQjtBQUNoQixJQUFBLE1BQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxLQUFXO0FBQ1gsSUFBQSxNQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsS0FBVztBQUNYLElBQUEsTUFBQSxDQUFBLE9BQUEsQ0FBQSxHQUFBLFFBQWdCO0FBQ2hCLElBQUEsTUFBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQVc7QUFDWCxJQUFBLE1BQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxLQUFXO0FBQ1gsSUFBQSxNQUFBLENBQUEsT0FBQSxDQUFBLEdBQUEsUUFBZ0I7QUFDaEIsSUFBQSxNQUFBLENBQUEsUUFBQSxDQUFBLEdBQUEsU0FBa0I7QUFDbEIsSUFBQSxNQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsS0FBVztBQUNYLElBQUEsTUFBQSxDQUFBLE9BQUEsQ0FBQSxHQUFBLFFBQWdCO0FBQ2hCLElBQUEsTUFBQSxDQUFBLEtBQUEsQ0FBQSxHQUFBLEtBQVc7QUFDWCxJQUFBLE1BQUEsQ0FBQSxPQUFBLENBQUEsR0FBQSxRQUFnQjtBQUNoQixJQUFBLE1BQUEsQ0FBQSxRQUFBLENBQUEsR0FBQSxTQUFrQjtBQUNsQixJQUFBLE1BQUEsQ0FBQSxLQUFBLENBQUEsR0FBQSxLQUFXO0FBQ1gsSUFBQSxNQUFBLENBQUEsT0FBQSxDQUFBLEdBQUEsUUFBZ0I7QUFDaEIsSUFBQSxNQUFBLENBQUEsUUFBQSxDQUFBLEdBQUEsU0FBa0I7QUFDbEIsSUFBQSxNQUFBLENBQUEsS0FBQSxDQUFBLEdBQUEsS0FBVztBQUNYLElBQUEsTUFBQSxDQUFBLE9BQUEsQ0FBQSxHQUFBLFFBQWdCO0FBQ2hCLElBQUEsTUFBQSxDQUFBLFFBQUEsQ0FBQSxHQUFBLFNBQWtCO0FBQ3BCLENBQUMsRUFyQlcsTUFBTSxLQUFOLE1BQU0sR0FBQSxFQUFBLENBQUEsQ0FBQTtBQXVCbEI7OztBQUdHO0FBQ0ksTUFBTSxnQkFBZ0IsR0FBZ0M7SUFDM0QsaUJBQWlCLEVBQUUsTUFBTSxDQUFDLEdBQUc7SUFDN0IsY0FBYyxFQUFFLE1BQU0sQ0FBQyxHQUFHO0lBQzFCLGFBQWEsRUFBRSxNQUFNLENBQUMsR0FBRztJQUN6QixZQUFZLEVBQUUsTUFBTSxDQUFDLEdBQUc7SUFDeEIsVUFBVSxFQUFFLE1BQU0sQ0FBQyxHQUFHO0lBQ3RCLHVCQUF1QixFQUFFLE1BQU0sQ0FBQyxHQUFHO0lBQ25DLGdCQUFnQixFQUFFLE1BQU0sQ0FBQyxHQUFHO0lBQzVCLGNBQWMsRUFBRSxNQUFNLENBQUMsR0FBRzs7QUFHNUI7Ozs7QUFJRztBQUNJLE1BQU0sWUFBWSxHQUF5QjtBQUNoRCxJQUFBLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTTtBQUN6QixJQUFBLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsUUFBUTtBQUMzQixJQUFBLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsTUFBTTtBQUN6QixJQUFBLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUztBQUM1QixJQUFBLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsS0FBSztBQUN4QixJQUFBLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsU0FBUztBQUM1QixJQUFBLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTztBQUMxQixJQUFBLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsUUFBUTtBQUMzQixJQUFBLENBQUMsTUFBTSxDQUFDLEdBQUcsR0FBRyxJQUFJLENBQUMsT0FBTztBQUMxQjs7QUFFRztBQUNILElBQUEsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTO0FBQzlCLElBQUEsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxTQUFTO0FBQzlCLElBQUEsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRO0FBQzdCLElBQUEsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxXQUFXO0FBQ2hDLElBQUEsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxXQUFXO0FBQ2hDLElBQUEsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxRQUFRO0FBQzdCLElBQUEsQ0FBQyxNQUFNLENBQUMsS0FBSyxHQUFHLElBQUksQ0FBQyxPQUFPO0FBQzVCOztBQUVHO0FBQ0gsSUFBQSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVM7QUFDL0IsSUFBQSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFNBQVM7QUFDL0IsSUFBQSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFFBQVE7QUFDOUIsSUFBQSxDQUFDLE1BQU0sQ0FBQyxNQUFNLEdBQUcsSUFBSSxDQUFDLFdBQVc7O0FBR25DOzs7O0FBSUc7QUFDSSxNQUFNLFdBQVcsR0FBUyxJQUFJLENBQUM7QUFFdEM7Ozs7QUFJRztBQUNILE1BQU0sc0JBQXNCLEdBQVcsb0JBQW9CO0FBRTNEOzs7QUFHRztBQUNILFNBQVMsb0JBQW9CLENBQUMsSUFBWSxFQUFBO0lBQ3hDLE9BQU8sQ0FBQSxTQUFBLEVBQVksSUFBSSxDQUFBLFdBQUEsQ0FBYTtBQUN0QztBQUVBOzs7QUFHRztBQUNHLFNBQVUscUJBQXFCLENBQUMsTUFBYyxFQUFBO0FBQ2xELElBQUEsT0FBTztVQUNILENBQUEsUUFBQSxFQUFXLE1BQU0sQ0FBQSxXQUFBO1VBQ2pCLHNCQUFzQjtBQUM1QjtBQUVBOzs7QUFHRztBQUNHLFNBQVUsMEJBQTBCLENBQUMsR0FBVyxFQUFBO0lBQ3BELE9BQU8sQ0FBQSxNQUFBLEVBQVMsR0FBRyxDQUFBLE9BQUEsQ0FBUztBQUM5QjtBQUVBOzs7OztBQUtHO0FBQ0csU0FBVSxjQUFjLENBQUMsSUFBd0IsRUFBQTtBQUNyRCxJQUFBLElBQUksQ0FBQyxDQUFDLElBQUksSUFBSSxPQUFPLElBQUksS0FBSyxRQUFRLElBQUksQ0FBQyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxFQUFFO0FBQzlELFFBQUEsTUFBTSxJQUFJLG9CQUFvQixDQUM1Qiw0RUFBNEUsQ0FDN0U7SUFDSDtBQUVBLElBQUEsSUFBSSxJQUFjO0lBRWxCLElBQUksSUFBSSxFQUFFO0FBQ1IsUUFBQSxNQUFNLFVBQVUsR0FBRyxLQUFLLENBQUMsT0FBTyxDQUFDLElBQUksQ0FBQyxHQUFHLElBQUksR0FBRyxDQUFDLElBQUksQ0FBQztBQUN0RCxRQUFBLElBQUksR0FBRyxVQUFVLENBQUMsR0FBRyxDQUFDLENBQUMsS0FBVyxLQUFLLG9CQUFvQixDQUFDLEtBQUssQ0FBQyxDQUFDO0lBQ3JFO1NBQU87QUFDTCxRQUFBLElBQUksR0FBRyxDQUFDLG9CQUFvQixDQUFDLFdBQVcsQ0FBQyxDQUFDO0lBQzVDO0FBRUEsSUFBQSxPQUFPLElBQUk7QUFDYjtBQUVBOzs7OztBQUtHO0FBQ0csU0FBVSxrQkFBa0IsQ0FBQyxNQUFjLEVBQUE7QUFDL0MsSUFBQSxPQUFPLGdCQUFnQixDQUFDLE1BQU0sQ0FBQyxJQUFJLElBQUk7QUFDekM7Ozs7In0=
