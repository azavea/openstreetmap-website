// Rhino script file for JOSM
// Looks for DVRPC pedestrian network crosswalks duplicated in the existing OSM street network.
var util = require("josm/util");
var console = require("josm/scriptingconsole");
var layers = require("josm/layers");

console.clear();
console.println("starting...");
util.println('starting...');


var ds = layers.activeLayer.data;
var dvrpcCrosswalks = ds.query("highway=footway footway=crossing dvrpc\\:objectid=*");
var osmCrosswalks = ds.query("highway=footway footway=crossing -dvrpc\\:objectid=*");
util.println('got crosswalks');

console.println("found " + osmCrosswalks.length + " OSM crosswalks");
console.println("found " + dvrpcCrosswalks.length + " DVRPC crosswalks");

var foundMatches = 0;
var multipleMatches = 0;

osmCrosswalks.forEach(function (cw) {
    var cwFirstCoord = cw.firstNode().getCoor();
    var cwLastCoord = cw.lastNode().getCoor();
    console.println('\ncrosswalk: ' + cw.id + ' has ' + cw.nodes.length + ' nodes');
    var cwLength = cwFirstCoord.greatCircleDistance(cwLastCoord);
    console.println('crosswalk length: ' + cwLength);
    cw.nodes.forEach(function(n, idx) {
        var parentWays = n.getParentWays();
        var pwIterator = parentWays.iterator();
        while (pwIterator.hasNext()) {
            var p = pwIterator.next();
            var wayName = p.get('name');
            if (wayName) {
                console.println('\tnode ' + idx + ' has parent way: ' + wayName);
            }
        }
    });

    var foundDvrpcCrosswalk = null;
    // skip checking DVRPC crosswalks with an endpoint more than this distance away
    var maxBoundDistance = cwLength + 10;
    var maxEndNodeDistance = 5;
    for (i = 0; i < dvrpcCrosswalks.length; i++) {
        var dvrpc = dvrpcCrosswalks[i];
        var firstDvrpcCoord = dvrpc.firstNode().getCoor();
        var distanceFirstToFirst = firstDvrpcCoord.greatCircleDistance(cwFirstCoord);
        if (distanceFirstToFirst > maxBoundDistance) {
            continue;
        }
        var distanceFirstToLast = firstDvrpcCoord.greatCircleDistance(cwLastCoord);
        var firstClosest =  distanceFirstToFirst < distanceFirstToLast;
        var shortest = firstClosest ? distanceFirstToFirst : distanceFirstToLast;
        if (shortest > maxEndNodeDistance) {
            continue;
        }
        var lastDvrpcCoord = dvrpc.lastNode().getCoor();
        var otherDistance = firstClosest ? lastDvrpcCoord.greatCircleDistance(cwLastCoord)
            : lastDvrpcCoord.greatCircleDistance(cwFirstCoord);
        if (otherDistance > maxEndNodeDistance) {
            continue;
        }
        if (!foundDvrpcCrosswalk) {
            foundDvrpcCrosswalk = dvrpc;
        } else {
            console.println('Already have matching DVRPC crosswalk! Not using either.');
            multipleMatches += 1;
            foundDvrpcCrosswalk = null;
            break;
        }
    }

    if (foundDvrpcCrosswalk) {
        console.println('Found matching crosswalk for OSM crosswalk. Deleting OSM crosswalk.\n');
        cw.setDeleted(true);
        foundMatches += 1;
    }
});

console.println("\n\nFound " + foundMatches + " DVRPC crosswalks for the " +
    osmCrosswalks.length + " OSM crosswalks");
console.println("Had " + multipleMatches +
    " OSM crosswalks with more than one seeming DVRPC crosswalk match.");
util.println("all done!");
console.println("\nall done");
