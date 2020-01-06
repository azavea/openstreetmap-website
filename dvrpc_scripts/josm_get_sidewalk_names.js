// Rhino script file for JOSM
// Writes pipe-delimited file of the names assigned to DVRPC sidewalks.
// Expects `josm_name_sidewalks.js` to have been run first.

var RESULTS_FILENAME = 'josm_dvrpc_sidewalk_names.txt';

var util = require("josm/util");
var console = require("josm/scriptingconsole");
var layers = require("josm/layers");

console.clear();
console.println("starting...");
util.println('starting...');


var ds = layers.activeLayer.data;
var ways = ds.query("footway=sidewalk");
util.println('got ways');

// will write to home directory
var outFile = new java.io.PrintWriter(new java.io.FileWriter(RESULTS_FILENAME));

var names = 0;
for (var i=0; i < ways.length; i++) {
    var way = ways[i];
    if (way.has("dvrpc:objectid") && way.has("name")) {
        var wayName = way.get("name");
        if (wayName && wayName.length) {
            outFile.println(way.getId() + "|" +
                        way.get("dvrpc:objectid") + "|" +
                        wayName);
            names += 1;
        }
    }
}

outFile.close();
console.println("\nFound " + names + " named DVRPC sidewalks\n");
util.println("all done!");
console.println("\nall done");
