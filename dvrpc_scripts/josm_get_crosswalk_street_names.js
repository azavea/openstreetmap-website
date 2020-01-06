// Rhino script file for JOSM
// Runs inbuilt JOSM validator test to find crossing highways.
// Finds those that are DVRPC crosswalks crossing named streets.
// Writes pipe-delimited results to file in home directory:
// street OSM ID, street name, crosswalk DVRPC object ID, crosswalk OSM ID

var RESULTS_FILENAME = 'josm_dvrpc_crosswalks_street_names.txt';

var util = require("josm/util");
var console = require("josm/scriptingconsole");
var layers = require("josm/layers");

console.clear();
console.println("starting...");
util.println('starting...');

var crossingWays = new org.openstreetmap.josm.data.validation.tests.CrossingWays.Ways();

var ds = layers.activeLayer.data;
var ways = ds.query("highway=*");
util.println('got ways');

crossingWays.initialize();
crossingWays.startTest(null);
crossingWays.visit(ways);
crossingWays.endTest();
util.println('finished test');

var errors = crossingWays.getErrors();
console.println("found " + errors.size() + " instances of crossing higways");
var streetCrossings = 0;
// will write to home directory
var outFile = new java.io.PrintWriter(new java.io.FileWriter(RESULTS_FILENAME));

for (var i = 0; i < errors.size(); i++) {
    var error = errors.get(i);
    // Code is 620 and message "Crossing highways" for all results
    var primitives = error.getPrimitives();
    if (primitives.size() != 2) {
        console.println("Found " + primitives.size() + " highways crossing together");
    }
    var primitiveIterator = primitives.iterator();
    var dvrpcWay = null;
    var otherWay = null;
    while (primitiveIterator.hasNext()) {
        var p = primitiveIterator.next();
        if (!p.has("dvrpc:objectid")) {
            otherWay = p;
        } else {
            dvrpcWay = p;
        }
    }
    if (!dvrpcWay || !otherWay || !otherWay.has("name") || dvrpcWay.get("footway") != "crossing") {
        continue;
    }
    util.println(otherWay.get("highway") + ' ' + otherWay.get("name") +
                 " intersects crosswalk " + dvrpcWay.get("dvrpc:objectid"));
    outFile.println(otherWay.getId() + "|" +
                  otherWay.get("name") + "|" +
                  dvrpcWay.get("dvrpc:objectid") + "|" + dvrpcWay.getId());
    streetCrossings += 1;
}

outFile.close();
console.println("\nFound " + streetCrossings + " DVRPC crosswalks crossing named streets\n");
util.println("all done!");
console.println("\nall done");
