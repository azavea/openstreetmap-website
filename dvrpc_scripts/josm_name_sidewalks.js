// Rhino script file for JOSM
// Assigns street names to adjoining DVRPC sidewalks.

// Expects results file from `josm_get_crosswalk_street_names.js` to exist in home directory.

var util = require("josm/util");
var console = require("josm/scriptingconsole");
var layers = require("josm/layers");

var INPUT_FILENAME = 'josm_dvrpc_crosswalks_street_names.txt';

var MAX_CONNECTOR_LENGTH = 3.0;
var MAX_ANGLE_DIFF = 30.0;

/*
 * @param {Collection} ways java Collection of OSM Ways
 * @param {Number} thisId OSM Id of the way to ignore
 * @returns JavaScript array of the ways which are DVRPC sidewalks
 */
function getSidewalks(ways, thisId) {
    var iterator = ways.iterator();
    var sidewalkConnections = [];
    while (iterator.hasNext()) {
        var w = iterator.next();
        if (w.getId() != thisId) {
            if (w.has("highway") && w.get("highway") == "footway") {
                if (w.has("dvrpc:objectid")) {
                    var footway = w.get("footway");
                    if (footway == "sidewalk") {
                        sidewalkConnections.push(w);
                    }
                }
            }
        } // else connected to self
    }
    return sidewalkConnections;
}

var setNames = {};

// Set the name property on the given way (w) to sideWalkName
function setSidewalkName(w, sidewalkName) {
    var objectId = w.get("dvrpc:objectid");
    var existingName = w.get("name");
    if (existingName && existingName.length && existingName != sidewalkName) {
        console.println("sidewalk " + objectId + " already named " +
            existingName + " not setting it to " + sidewalkName);
        // unset the name, since there is a conflict
        w.remove("name");
        delete setNames[objectId];
    } else {
        w.set("name", sidewalkName);
        setNames[objectId] = sidewalkName;
    }
}

function setSidewalkNames(sidewalkConnections, start, end) {
    if (sidewalkConnections.length != 1) {
        // Connects to parallel and crossing sidewalks directly (no connector node)
        for (var s = 0; s < sidewalkConnections.length; s++) {
            var w = sidewalkConnections[s];
            var neighbors = w.getNeighbours(start);
            // there should be one neighbor; go get it
            var nIt = neighbors.iterator();
            var neighbor = null;
            while (nIt.hasNext()) {
                neighbor = nIt.next();
            }
            if (neighbor == null) {
                console.println("no neighbors found, skipping");
                continue;
            }
            // Find the angle between the crosswalk start and end nodes,
            // and this nearest neighbor node on the adjoining way.
            var angleRadians = org.openstreetmap.josm.tools.Geometry.getCornerAngle(
                end.getEastNorth(),
                start.getEastNorth(),
                neighbor.getEastNorth());
            var angle = org.openstreetmap.josm.tools.Geometry.getNormalizedAngleInDegrees(angleRadians);

            if (Math.abs(angle - 90) < MAX_ANGLE_DIFF) {
                console.println(angle + " right angle from " + streetName +
                                " to sidewalk " + w.getId() +
                                " objectid " + w.get("dvrpc:objectid"));
                setSidewalkName(w, streetName);
            } else {
                console.println(angle + " NOT right angle from " + streetName +
                                " to sidewalk " + w.getId() +
                                " objectid " + w.get("dvrpc:objectid"));
            }
        }
    } else {
        // check if it uses a single connector node to set back curb cuts from street corner
        var w = sidewalkConnections[0];
        var otherEnd = null;
        if (w.firstNode().getId() == start.getId()) {
            otherEnd = w.lastNode();
        } else {
            otherEnd = w.firstNode();
        }
        var otherEndId = otherEnd.getId();
        var nextWays = getSidewalks(otherEnd.getParentWays(), w.getId());

        // ignore any other connectors, if there are multiple curb cuts at a corner
        var removeIdx = -1;
        for (var r = 0; r < nextWays.length; r++) {
            if (Number(nextWays[r].getLength()) < MAX_CONNECTOR_LENGTH) {
                removeIdx = r;
                break;
            }
        }

        if (removeIdx > -1) {
            console.println("ignoring intersecting connector " + nextWays[removeIdx]);
            nextWays.splice(removeIdx, 1);
        }

        // expect the other end of a single connector to branch into two other sidewalks
        // or connect to one sidewalk
        // and be shorter than 4 meters
        if (Number(w.getLength()) > MAX_CONNECTOR_LENGTH) {
            // check if connected directly to single sidewalk
            console.println("\n\nsingle sidewalk " + w.getId() + " objectid " + w.get("dvrpc:objectid") +
                            " is " + w.getLength() + " meters long");
            console.println("it has " + nextWays.length + " connections: " + nextWays);

            var neighbors = w.getNeighbours(start);
            // there should be one neighbor; go get it
            var nIt = neighbors.iterator();
            var neighbor = null;
            while (nIt.hasNext()) {
                neighbor = nIt.next();
            }
            if (neighbor != null) {
                // Find the angle between the crosswalk start and end nodes,
                // and this nearest neighbor node on the adjoining way.
                var angleRadians = org.openstreetmap.josm.tools.Geometry.getCornerAngle(
                    end.getEastNorth(),
                    start.getEastNorth(),
                    neighbor.getEastNorth());
                var angle = org.openstreetmap.josm.tools.Geometry.getNormalizedAngleInDegrees(angleRadians);

                if (Math.abs(angle - 90) < MAX_ANGLE_DIFF) {
                    console.println(angle + " right angle from " + streetName +
                                    " to single connecting sidewalk " + w.getId() +
                                    " objectid " + w.get("dvrpc:objectid"));
                    setSidewalkName(w, streetName);
                }
            }
        } else if (nextWays.length == 2 && Number(w.getLength()) < MAX_CONNECTOR_LENGTH) {
            for (var x = 0; x < nextWays.length; x++) {
                var nWay = nextWays[x];
                if (nWay.getId() == w.getId()) {
                    continue;
                }
                var nbs = nWay.getNeighbours(otherEnd);
                // there should be one neighbor; go get it
                var nbIt = nbs.iterator();
                var nb = null;
                while (nbIt.hasNext()) {
                    nb = nbIt.next();
                }
                if (nb == null) {
                    continue;
                }
                var angleRadians = org.openstreetmap.josm.tools.Geometry.getCornerAngle(
                    end.getEastNorth(),
                    start.getEastNorth(),
                    nb.getEastNorth());

                var angle = org.openstreetmap.josm.tools.Geometry.getNormalizedAngleInDegrees(angleRadians);

                if (Math.abs(angle - 90) < MAX_ANGLE_DIFF) {
                    console.println(angle + " right angle via connector from " + streetName +
                                    " to sidewalk " +
                                    nWay.getId() + " objectid " + nWay.get("dvrpc:objectid"));
                    setSidewalkName(nWay, streetName);
                } else {
                    console.println(angle + " not right angle via connector from " + streetName +
                                    " to sidewalk " +
                                    nWay.getId() + " objectid " + nWay.get("dvrpc:objectid"));
                }
            }
        } else if (nextWays.length == 1 && Number(w.getLength()) < MAX_CONNECTOR_LENGTH) {
            // single connecting sidewalk set back by connector.
            // check if the connector is at a right angle to the sidewalk
            var nWay = nextWays[0];
            var first = null;
            var second = null;
            if (nWay.firstNode().getId() == w.getId()) {
                first = nWay.firstNode();
                second = nWay.lastNode();
            } else {
                first = nWay.lastNode();
                second = nWay.firstNode();
            }
            var neighbors = w.getNeighbours(start);
            // there should be one neighbor; go get it
            var nIt = neighbors.iterator();
            var neighbor = null;
            while (nIt.hasNext()) {
                neighbor = nIt.next();
            }
            if (neighbor != null) {
                var angleRadians = org.openstreetmap.josm.tools.Geometry.getCornerAngle(
                    first.getEastNorth(),
                    second.getEastNorth(),
                    neighbor.getEastNorth());
                var angle = org.openstreetmap.josm.tools.Geometry.getNormalizedAngleInDegrees(angleRadians);
                if (Math.abs(angle - 90) < MAX_ANGLE_DIFF) {
                    console.println(angle + " right angle via connector from " + streetName +
                                    " to only connecting sidewalk " +
                                    nWay.getId() + " objectid " + nWay.get("dvrpc:objectid"));
                    setSidewalkName(nWay, streetName);
                }
            }
        } else {
            console.println("no match for single connecting way " + w.getLength() +
                            " id " + w.getId() + " objectid " + w.get("dvrpc:objectid"));
            console.println("next ways length " + nextWays.length);
        }
    }
}

console.clear();
console.println("starting...");
util.println('starting...');

var inFile = new java.io.File(INPUT_FILENAME);
var fileScanner = new java.util.Scanner(inFile);

var lines = [];
while (fileScanner.hasNextLine()) {
    var line = String(fileScanner.nextLine()).valueOf();
    lines.push(line.split("|"));
}

fileScanner.close();
console.println("read file of intersections");

console.println("find crosswalks");
var ds = layers.activeLayer.data;

for (var j = 0; j < lines.length; j++) {
    var line = lines[j];

    var streetId = line[0];
    var streetName = line[1];
    var crossDvrpcId = line[2];
    var crossOsmId = line[3];

    console.println('\n' + crossOsmId + ': ' + crossDvrpcId + ' crosses street ' + streetName);

    var crosswalk = ds.way(Number(crossOsmId));

    // Check for sidewalks to name from both ends of the crosswalk
    var start = crosswalk.firstNode();
    var end = crosswalk.lastNode();
    console.println("\nstart node: " + start.getId());
    var startConnectingWays = start.getParentWays();
    var startConnections = getSidewalks(startConnectingWays, crosswalk.getId());
    setSidewalkNames(startConnections, start, end);

    console.println("\nend node: " + end.getId());
    var endConnectingWays = end.getParentWays();
    var endConnections = getSidewalks(endConnectingWays, crosswalk.getId());
    setSidewalkNames(endConnections, end, start);
}

console.println("\n\nset names on " + Object.keys(setNames).length + " sidewalks");
console.println("\nlooked at " + lines.length + " crossings of named streets");

util.println("all done!");
console.println("\nall done");
