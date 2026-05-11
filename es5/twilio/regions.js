'use strict';

var index = require('./errors/index.js');

var _a;
/**
 * Valid edges.
 */
exports.Edge = void 0;
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
})(exports.Edge || (exports.Edge = {}));
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
exports.Region = void 0;
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
})(exports.Region || (exports.Region = {}));
/**
 * Region shortcodes. Maps the full region name from AWS to the Twilio shortcode.
 * @private
 */
var regionShortcodes = {
    ASIAPAC_SINGAPORE: exports.Region.Sg1,
    ASIAPAC_SYDNEY: exports.Region.Au1,
    ASIAPAC_TOKYO: exports.Region.Jp1,
    EU_FRANKFURT: exports.Region.De1,
    EU_IRELAND: exports.Region.Ie1,
    SOUTH_AMERICA_SAO_PAULO: exports.Region.Br1,
    US_EAST_VIRGINIA: exports.Region.Us1,
    US_WEST_OREGON: exports.Region.Us2,
};
/**
 * Region to edge mapping, as part of Phase 1 Regional (CLIENT-7519).
 * Temporary.
 * @private
 */
var regionToEdge = (_a = {},
    _a[exports.Region.Au1] = exports.Edge.Sydney,
    _a[exports.Region.Br1] = exports.Edge.SaoPaulo,
    _a[exports.Region.Ie1] = exports.Edge.Dublin,
    _a[exports.Region.De1] = exports.Edge.Frankfurt,
    _a[exports.Region.Jp1] = exports.Edge.Tokyo,
    _a[exports.Region.Sg1] = exports.Edge.Singapore,
    _a[exports.Region.Us1] = exports.Edge.Ashburn,
    _a[exports.Region.Us2] = exports.Edge.Umatilla,
    _a[exports.Region.Gll] = exports.Edge.Roaming,
    /**
     * Interconnect edges
     */
    _a[exports.Region.Us1Ix] = exports.Edge.AshburnIx,
    _a[exports.Region.Us2Ix] = exports.Edge.SanJoseIx,
    _a[exports.Region.Ie1Ix] = exports.Edge.LondonIx,
    _a[exports.Region.De1Ix] = exports.Edge.FrankfurtIx,
    _a[exports.Region.Sg1Ix] = exports.Edge.SingaporeIx,
    _a[exports.Region.Au1Ix] = exports.Edge.SydneyIx,
    _a[exports.Region.Jp1Ix] = exports.Edge.TokyoIx,
    /**
     * Tnx regions
     */
    _a[exports.Region.Us1Tnx] = exports.Edge.AshburnIx,
    _a[exports.Region.Us2Tnx] = exports.Edge.AshburnIx,
    _a[exports.Region.Ie1Tnx] = exports.Edge.LondonIx,
    _a[exports.Region.Sg1Tnx] = exports.Edge.SingaporeIx,
    _a);
/**
 * The default edge to connect to and create a chunder uri from, if the edge
 * parameter is not specified during setup in `Device`.
 * @constant
 */
var defaultEdge = exports.Edge.Roaming;
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
        throw new index.InvalidArgumentError('If `edge` is provided, it must be of type `string` or an array of strings.');
    }
    var uris;
    if (edge) {
        var edgeParams = Array.isArray(edge) ? edge : [edge];
        uris = edgeParams.map(function (param) { return createChunderEdgeURI(param); });
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

exports.createEventGatewayURI = createEventGatewayURI;
exports.createSignalingEndpointURL = createSignalingEndpointURL;
exports.defaultEdge = defaultEdge;
exports.getChunderURIs = getChunderURIs;
exports.getRegionShortcode = getRegionShortcode;
exports.regionShortcodes = regionShortcodes;
exports.regionToEdge = regionToEdge;
//# sourceMappingURL=data:application/json;charset=utf-8;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoicmVnaW9ucy5qcyIsInNvdXJjZXMiOlsiLi4vLi4vbGliL3R3aWxpby9yZWdpb25zLnRzIl0sInNvdXJjZXNDb250ZW50IjpbbnVsbF0sIm5hbWVzIjpbIkVkZ2UiLCJSZWdpb24iLCJJbnZhbGlkQXJndW1lbnRFcnJvciJdLCJtYXBwaW5ncyI6Ijs7Ozs7QUFFQTs7QUFFRztBQUNTQTtBQUFaLENBQUEsVUFBWSxJQUFJLEVBQUE7QUFDZDs7QUFFRztBQUNILElBQUEsSUFBQSxDQUFBLFFBQUEsQ0FBQSxHQUFBLFFBQWlCO0FBQ2pCLElBQUEsSUFBQSxDQUFBLFVBQUEsQ0FBQSxHQUFBLFdBQXNCO0FBQ3RCLElBQUEsSUFBQSxDQUFBLFFBQUEsQ0FBQSxHQUFBLFFBQWlCO0FBQ2pCLElBQUEsSUFBQSxDQUFBLFdBQUEsQ0FBQSxHQUFBLFdBQXVCO0FBQ3ZCLElBQUEsSUFBQSxDQUFBLE9BQUEsQ0FBQSxHQUFBLE9BQWU7QUFDZixJQUFBLElBQUEsQ0FBQSxXQUFBLENBQUEsR0FBQSxXQUF1QjtBQUN2QixJQUFBLElBQUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxTQUFtQjtBQUNuQixJQUFBLElBQUEsQ0FBQSxVQUFBLENBQUEsR0FBQSxVQUFxQjtBQUNyQixJQUFBLElBQUEsQ0FBQSxTQUFBLENBQUEsR0FBQSxTQUFtQjtBQUNuQjs7QUFFRztBQUNILElBQUEsSUFBQSxDQUFBLFdBQUEsQ0FBQSxHQUFBLFlBQXdCO0FBQ3hCLElBQUEsSUFBQSxDQUFBLFdBQUEsQ0FBQSxHQUFBLGFBQXlCO0FBQ3pCLElBQUEsSUFBQSxDQUFBLFVBQUEsQ0FBQSxHQUFBLFdBQXNCO0FBQ3RCLElBQUEsSUFBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLGNBQTRCO0FBQzVCLElBQUEsSUFBQSxDQUFBLGFBQUEsQ0FBQSxHQUFBLGNBQTRCO0FBQzVCLElBQUEsSUFBQSxDQUFBLFVBQUEsQ0FBQSxHQUFBLFdBQXNCO0FBQ3RCLElBQUEsSUFBQSxDQUFBLFNBQUEsQ0FBQSxHQUFBLFVBQW9CO0FB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
