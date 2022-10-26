"use strict";
var _a, _b, _c, _d;
Object.defineProperty(exports, "__esModule", { value: true });
/**
 * @packageDocumentation
 * @module Voice
 * This module describes valid and deprecated regions.
 */
var errors_1 = require("./errors");
/**
 * Valid deprecated regions.
 * @private
 */
var DeprecatedRegion;
(function (DeprecatedRegion) {
    DeprecatedRegion["Au"] = "au";
    DeprecatedRegion["Br"] = "br";
    DeprecatedRegion["Ie"] = "ie";
    DeprecatedRegion["Jp"] = "jp";
    DeprecatedRegion["Sg"] = "sg";
    DeprecatedRegion["UsOr"] = "us-or";
    DeprecatedRegion["UsVa"] = "us-va";
})(DeprecatedRegion = exports.DeprecatedRegion || (exports.DeprecatedRegion = {}));
/**
 * Valid edges.
 * @private
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
})(Edge = exports.Edge || (exports.Edge = {}));
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
})(Region = exports.Region || (exports.Region = {}));
/**
 * Deprecated regions. Maps the deprecated region to its equivalent up-to-date region.
 * @private
 */
exports.deprecatedRegions = (_a = {},
    _a[DeprecatedRegion.Au] = Region.Au1,
    _a[DeprecatedRegion.Br] = Region.Br1,
    _a[DeprecatedRegion.Ie] = Region.Ie1,
    _a[DeprecatedRegion.Jp] = Region.Jp1,
    _a[DeprecatedRegion.Sg] = Region.Sg1,
    _a[DeprecatedRegion.UsOr] = Region.Us1,
    _a[DeprecatedRegion.UsVa] = Region.Us1,
    _a);
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
 * Region URIs. Maps the Twilio shortcode to its Twilio endpoint URI.
 * @private
 */
var regionURIs = (_b = {},
    _b[Region.Au1] = 'chunderw-vpc-gll-au1.twilio.com',
    _b[Region.Au1Ix] = 'chunderw-vpc-gll-au1-ix.twilio.com',
    _b[Region.Br1] = 'chunderw-vpc-gll-br1.twilio.com',
    _b[Region.De1] = 'chunderw-vpc-gll-de1.twilio.com',
    _b[Region.De1Ix] = 'chunderw-vpc-gll-de1-ix.twilio.com',
    _b[Region.Gll] = 'chunderw-vpc-gll.twilio.com',
    _b[Region.Ie1] = 'chunderw-vpc-gll-ie1.twilio.com',
    _b[Region.Ie1Ix] = 'chunderw-vpc-gll-ie1-ix.twilio.com',
    _b[Region.Ie1Tnx] = 'chunderw-vpc-gll-ie1-tnx.twilio.com',
    _b[Region.Jp1] = 'chunderw-vpc-gll-jp1.twilio.com',
    _b[Region.Jp1Ix] = 'chunderw-vpc-gll-jp1-ix.twilio.com',
    _b[Region.Sg1] = 'chunderw-vpc-gll-sg1.twilio.com',
    _b[Region.Sg1Ix] = 'chunderw-vpc-gll-sg1-ix.twilio.com',
    _b[Region.Sg1Tnx] = 'chunderw-vpc-gll-sg1-tnx.twilio.com',
    _b[Region.Us1] = 'chunderw-vpc-gll-us1.twilio.com',
    _b[Region.Us1Ix] = 'chunderw-vpc-gll-us1-ix.twilio.com',
    _b[Region.Us1Tnx] = 'chunderw-vpc-gll-us1-tnx.twilio.com',
    _b[Region.Us2] = 'chunderw-vpc-gll-us2.twilio.com',
    _b[Region.Us2Ix] = 'chunderw-vpc-gll-us2-ix.twilio.com',
    _b[Region.Us2Tnx] = 'chunderw-vpc-gll-us2-tnx.twilio.com',
    _b);
/**
 * Edge to region mapping, as part of Phase 1 Regional (CLIENT-7519).
 * Temporary.
 * @private
 */
exports.edgeToRegion = (_c = {},
    _c[Edge.Sydney] = Region.Au1,
    _c[Edge.SaoPaulo] = Region.Br1,
    _c[Edge.Dublin] = Region.Ie1,
    _c[Edge.Frankfurt] = Region.De1,
    _c[Edge.Tokyo] = Region.Jp1,
    _c[Edge.Singapore] = Region.Sg1,
    _c[Edge.Ashburn] = Region.Us1,
    _c[Edge.Umatilla] = Region.Us2,
    _c[Edge.Roaming] = Region.Gll,
    /**
     * Interconnect edges
     */
    _c[Edge.AshburnIx] = Region.Us1Ix,
    _c[Edge.SanJoseIx] = Region.Us2Ix,
    _c[Edge.LondonIx] = Region.Ie1Ix,
    _c[Edge.FrankfurtIx] = Region.De1Ix,
    _c[Edge.SingaporeIx] = Region.Sg1Ix,
    _c[Edge.SydneyIx] = Region.Au1Ix,
    _c[Edge.TokyoIx] = Region.Jp1Ix,
    _c);
/**
 * Region to edge mapping, as part of Phase 1 Regional (CLIENT-7519).
 * Temporary.
 * @private
 */
exports.regionToEdge = (_d = {},
    _d[Region.Au1] = Edge.Sydney,
    _d[Region.Br1] = Edge.SaoPaulo,
    _d[Region.Ie1] = Edge.Dublin,
    _d[Region.De1] = Edge.Frankfurt,
    _d[Region.Jp1] = Edge.Tokyo,
    _d[Region.Sg1] = Edge.Singapore,
    _d[Region.Us1] = Edge.Ashburn,
    _d[Region.Us2] = Edge.Umatilla,
    _d[Region.Gll] = Edge.Roaming,
    /**
     * Interconnect edges
     */
    _d[Region.Us1Ix] = Edge.AshburnIx,
    _d[Region.Us2Ix] = Edge.SanJoseIx,
    _d[Region.Ie1Ix] = Edge.LondonIx,
    _d[Region.De1Ix] = Edge.FrankfurtIx,
    _d[Region.Sg1Ix] = Edge.SingaporeIx,
    _d[Region.Au1Ix] = Edge.SydneyIx,
    _d[Region.Jp1Ix] = Edge.TokyoIx,
    /**
     * Tnx regions
     */
    _d[Region.Us1Tnx] = Edge.AshburnIx,
    _d[Region.Us2Tnx] = Edge.AshburnIx,
    _d[Region.Ie1Tnx] = Edge.LondonIx,
    _d[Region.Sg1Tnx] = Edge.SingaporeIx,
    _d);
/**
 * The default region to connect to and create a chunder uri from if region is
 * not defined.
 * @constant
 * @private
 */
exports.defaultRegion = 'gll';
/**
 * The default edge to connect to and create a chunder uri from, if the edge
 * parameter is not specified during setup in `Device`.
 * @constant
 */
exports.defaultEdge = Edge.Roaming;
/**
 * The default chunder URI to connect to, should map to region `gll`.
 * @constant
 * @private
 */
exports.defaultChunderRegionURI = 'chunderw-vpc-gll.twilio.com';
/**
 * The default event gateway URI to publish to.
 * @constant
 * @private
 */
var defaultEventGatewayURI = 'eventgw.twilio.com';
/**
 * String template for a region chunder URI
 * @param region - The region.
 */
function createChunderRegionURI(region) {
    return region === exports.defaultRegion
        ? exports.defaultChunderRegionURI
        : "chunderw-vpc-gll-" + region + ".twilio.com";
}
/**
 * String template for an edge chunder URI
 * @param edge - The edge.
 */
function createChunderEdgeURI(edge) {
    return "voice-js." + edge + ".twilio.com";
}
/**
 * String template for a region insights URI
 * @param region - The region.
 */
function createEventGatewayURI(region) {
    return region
        ? "eventgw." + region + ".twilio.com"
        : defaultEventGatewayURI;
}
exports.createEventGatewayURI = createEventGatewayURI;
/**
 * Create a signaling endpoint URL to connect a websocket to from a chunder URI.
 * @param uri the chunder URI to create a signaling endpoint URL for
 */
function createSignalingEndpointURL(uri) {
    return "wss://" + uri + "/signal";
}
exports.createSignalingEndpointURL = createSignalingEndpointURL;
/**
 * Get the URI associated with the passed region or edge. If both are passed,
 * then we want to fail `Device` setup, so we throw an error.
 * As of CLIENT-7519, Regions are deprecated in favor of edges as part of
 * Phase 1 Regional.
 *
 * @private
 * @param edge - A string or an array of edge values
 * @param region - The region shortcode.
 * @param [onDeprecated] - A callback containing the deprecation message to be
 *   warned when the passed parameters are deprecated.
 * @returns An array of chunder URIs
 */
function getChunderURIs(edge, region, onDeprecated) {
    if (!!region && typeof region !== 'string') {
        throw new errors_1.InvalidArgumentError('If `region` is provided, it must be of type `string`.');
    }
    if (!!edge && typeof edge !== 'string' && !Array.isArray(edge)) {
        throw new errors_1.InvalidArgumentError('If `edge` is provided, it must be of type `string` or an array of strings.');
    }
    var deprecatedMessages = [];
    var uris;
    if (region && edge) {
        throw new errors_1.InvalidArgumentError('You cannot specify `region` when `edge` is specified in' +
            '`Twilio.Device.Options`.');
    }
    else if (region) {
        var chunderRegion = region;
        deprecatedMessages.push('Regions are deprecated in favor of edges. Please see this page for ' +
            'documentation: https://www.twilio.com/docs/voice/client/edges.');
        var isDeprecatedRegion = Object.values(DeprecatedRegion).includes(chunderRegion);
        if (isDeprecatedRegion) {
            chunderRegion = exports.deprecatedRegions[chunderRegion];
        }
        var isKnownRegion = Object.values(Region).includes(chunderRegion);
        if (isKnownRegion) {
            var preferredEdge = exports.regionToEdge[chunderRegion];
            deprecatedMessages.push("Region \"" + chunderRegion + "\" is deprecated, please use `edge` " +
                ("\"" + preferredEdge + "\"."));
        }
        uris = [createChunderRegionURI(chunderRegion)];
    }
    else if (edge) {
        var edgeValues_1 = Object.values(Edge);
        var edgeParams = Array.isArray(edge) ? edge : [edge];
        uris = edgeParams.map(function (param) { return edgeValues_1.includes(param)
            ? createChunderRegionURI(exports.edgeToRegion[param])
            : createChunderEdgeURI(param); });
    }
    else {
        uris = [exports.defaultChunderRegionURI];
    }
    if (onDeprecated && deprecatedMessages.length) {
        setTimeout(function () { return onDeprecated(deprecatedMessages.join('\n')); });
    }
    return uris;
}
exports.getChunderURIs = getChunderURIs;
/**
 * Get the region shortcode by its full AWS region string.
 *
 * @private
 * @param region - The region's full AWS string.
 */
function getRegionShortcode(region) {
    return exports.regionShortcodes[region] || null;
}
exports.getRegionShortcode = getRegionShortcode;
//# sourceMappingURL=regions.js.map