// Rhino script file for JOSM
// Looks for DVRPC pedestrian network sidewalks duplicated in the existing OSM street network.

var util = require("josm/util");
var console = require("josm/scriptingconsole");
var layers = require("josm/layers");

console.clear();
console.println("starting...");
util.println('starting...');


var ds = layers.activeLayer.data;
var dvrpcSidewalks = ds.query("highway=footway footway=sidewalk dvrpc\\:objectid=*");
var osmSidewalks = ds.query("highway=footway footway=sidewalk -dvrpc\\:objectid=*");
util.println('got sidewalks');

console.println("found " + osmSidewalks.length + " OSM sidewalks");
console.println("found " + dvrpcSidewalks.length + " DVRPC sidewalks");

var foundMatches = 0;
var multipleMatches = 0;

osmSidewalks.forEach(function (sd) {
    var sdFirstCoord = sd.firstNode().getCoor();
    var sdLastCoord = sd.lastNode().getCoor();
    console.println('\nsidewalk: ' + sd.id + ' has ' + sd.nodes.length + ' nodes');
    var sdLength = sdFirstCoord.greatCircleDistance(sdLastCoord);
    console.println('sidewalk length: ' + sdLength);

    var foundDvrpcSidewalk = null;
    // skip checking DVRPC sidewalks with an endpoint more than this distance away
    var maxBoundDistance = sdLength + 10;
    var maxEndNodeDistance = 5;
    for (i = 0; i < dvrpcSidewalks.length; i++) {
        var dvrpc = dvrpcSidewalks[i];
        var firstDvrpcCoord = dvrpc.firstNode().getCoor();
        var distanceFirstToFirst = firstDvrpcCoord.greatCircleDistance(sdFirstCoord);
        if (distanceFirstToFirst > maxBoundDistance) {
            continue;
        }
        var distanceFirstToLast = firstDvrpcCoord.greatCircleDistance(sdLastCoord);
        var firstClosest =  distanceFirstToFirst < distanceFirstToLast;
        var shortest = firstClosest ? distanceFirstToFirst : distanceFirstToLast;
        if (shortest > maxEndNodeDistance) {
            continue;
        }
        var lastDvrpcCoord = dvrpc.lastNode().getCoor();
        var otherDistance = firstClosest ? lastDvrpcCoord.greatCircleDistance(sdLastCoord)
            : lastDvrpcCoord.greatCircleDistance(sdFirstCoord);
        if (otherDistance > maxEndNodeDistance) {
            continue;
        }
        if (!foundDvrpcSidewalk) {
            foundDvrpcSidewalk = dvrpc;
        } else {
            console.println('Already have matching DVRPC sidewalk! Not using either.');
            multipleMatches += 1;
            foundDvrpcSidewalk = null;
            break;
        }
    }

    if (foundDvrpcSidewalk) {
        console.println('Found matching sidewalk for OSM sidewalk. Deleting OSM sidewalk.\n');
        sd.setDeleted(true);
        foundMatches += 1;
    }
});

console.println("\n\nFound " + foundMatches + " DVRPC sidewalks for the " +
    osmSidewalks.length + " OSM sidewalks");
console.println("Had " + multipleMatches +
    " OSM sidewalks with more than one seeming DVRPC sidewalk match.");
util.println("all done!");
console.println("\nall done");
