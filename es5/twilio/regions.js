"use strict";
var _a;
Object.defineProperty(exports, "__esModule", { value: true });
exports.defaultEdge = exports.regionToEdge = exports.regionShortcodes = exports.Region = exports.Edge = void 0;
exports.createEventGatewayURI = createEventGatewayURI;
exports.createSignalingEndpointURL = createSignalingEndpointURL;
exports.getChunderURIs = getChunderURIs;
exports.getRegionShortcode = getRegionShortcode;
var errors_1 = require("./errors");
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
})(Edge || (exports.Edge = Edge = {}));
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
})(Region || (exports.Region = Region = {}));
/**
 * Region shortcodes. Maps the full region name from AWS to the Twilio shortcode.
 * @private
 */
exports.regionShortcodes = {
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
exports.regionToEdge = (_a = {},
    _a[Region.Au1] = Edge.Sydney,
    _a[Region.Br1] = Edge.SaoPaulo,
    _a[Region.Ie1] = Edge.Dublin,
    _a[Region.De1] = Edge.Frankfurt,
    _a[Region.Jp1] = Edge.Tokyo,
    _a[Region.Sg1] = Edge.Singapore,
    _a[Region.Us1] = Edge.Ashburn,
    _a[Region.Us2] = Edge.Umatilla,
    _a[Region.Gll] = Edge.Roaming,
    /**
     * Interconnect edges
     */
    _a[Region.Us1Ix] = Edge.AshburnIx,
    _a[Region.Us2Ix] = Edge.SanJoseIx,
    _a[Region.Ie1Ix] = Edge.LondonIx,
    _a[Region.De1Ix] = Edge.FrankfurtIx,
    _a[Region.Sg1Ix] = Edge.SingaporeIx,
    _a[Region.Au1Ix] = Edge.SydneyIx,
    _a[Region.Jp1Ix] = Edge.TokyoIx,
    /**
     * Tnx regions
     */
    _a[Region.Us1Tnx] = Edge.AshburnIx,
    _a[Region.Us2Tnx] = Edge.AshburnIx,
    _a[Region.Ie1Tnx] = Edge.LondonIx,
    _a[Region.Sg1Tnx] = Edge.SingaporeIx,
    _a);
/**
 * The default edge to connect to and create a chunder uri from, if the edge
 * parameter is not specified during setup in `Device`.
 * @constant
 */
exports.defaultEdge = Edge.Roaming;
/**
 * The default event gateway URI to publish to.
 * @constant
 * @private
 */
var defaultEventGatewayURI = 'eventgw.twilio.com';
/**
 * String template for an edge chunder URI
 * @param edge - The edge.
 */
function createChunderEdgeURI(edge) {
    return "voice-js.".concat(edge, ".twilio.com");
}
/**
 * String template for a region insights URI
 * @param region - The region.
 */
function createEventGatewayURI(region) {
    return region
        ? "eventgw.".concat(region, ".twilio.com")
        : defaultEventGatewayURI;
}
/**
 * Create a signaling endpoint URL to connect a websocket to from a chunder URI.
 * @param uri the chunder URI to create a signaling endpoint URL for
 */
function createSignalingEndpointURL(uri) {
    return "wss://".concat(uri, "/signal");
}
/**
 * Get the URI associated with the passed edge.
 * @private
 * @param edge - A string or an array of edge values
 * @returns An array of chunder URIs
 */
function getChunderURIs(edge) {
    if (!!edge && typeof edge !== 'string' && !Array.isArray(edge)) {
        throw new errors_1.InvalidArgumentError('If `edge` is provided, it must be of type `string` or an array of strings.');
    }
    var uris;
    if (edge) {
        var edgeParams = Array.isArray(edge) ? edge : [edge];
        uris = edgeParams.map(function (param) { return createChunderEdgeURI(param); });
    }
    else {
        uris = [createChunderEdgeURI(exports.defaultEdge)];
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
    return exports.regionShortcodes[region] || null;
}
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaW9ucy5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIi4uLy4uL2xpYi90d2lsaW8vcmVnaW9ucy50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOzs7O0FBZ0pBLHNEQUlDO0FBTUQsZ0VBRUM7QUFRRCx3Q0FpQkM7QUFRRCxnREFFQztBQS9MRCxtQ0FBZ0Q7QUFFaEQ7O0dBRUc7QUFDSCxJQUFZLElBdUJYO0FBdkJELFdBQVksSUFBSTtJQUNkOztPQUVHO0lBQ0gseUJBQWlCLENBQUE7SUFDakIsOEJBQXNCLENBQUE7SUFDdEIseUJBQWlCLENBQUE7SUFDakIsK0JBQXVCLENBQUE7SUFDdkIsdUJBQWUsQ0FBQTtJQUNmLCtCQUF1QixDQUFBO0lBQ3ZCLDJCQUFtQixDQUFBO0lBQ25CLDZCQUFxQixDQUFBO0lBQ3JCLDJCQUFtQixDQUFBO0lBQ25COztPQUVHO0lBQ0gsZ0NBQXdCLENBQUE7SUFDeEIsaUNBQXlCLENBQUE7SUFDekIsOEJBQXNCLENBQUE7SUFDdEIsb0NBQTRCLENBQUE7SUFDNUIsb0NBQTRCLENBQUE7SUFDNUIsOEJBQXNCLENBQUE7SUFDdEIsNEJBQW9CLENBQUE7QUFDdEIsQ0FBQyxFQXZCVyxJQUFJLG9CQUFKLElBQUksUUF1QmY7QUFFRDs7Ozs7Ozs7Ozs7Ozs7O0dBZUc7QUFDSCxJQUFZLE1BcUJYO0FBckJELFdBQVksTUFBTTtJQUNoQixxQkFBVyxDQUFBO0lBQ1gsMEJBQWdCLENBQUE7SUFDaEIscUJBQVcsQ0FBQTtJQUNYLHFCQUFXLENBQUE7SUFDWCwwQkFBZ0IsQ0FBQTtJQUNoQixxQkFBVyxDQUFBO0lBQ1gscUJBQVcsQ0FBQTtJQUNYLDBCQUFnQixDQUFBO0lBQ2hCLDRCQUFrQixDQUFBO0lBQ2xCLHFCQUFXLENBQUE7SUFDWCwwQkFBZ0IsQ0FBQTtJQUNoQixxQkFBVyxDQUFBO0lBQ1gsMEJBQWdCLENBQUE7SUFDaEIsNEJBQWtCLENBQUE7SUFDbEIscUJBQVcsQ0FBQTtJQUNYLDBCQUFnQixDQUFBO0lBQ2hC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