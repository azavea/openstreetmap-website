# Steps to convert and merge DVRPC sidewalk Shapefile data into OSM data

 - merge three Shapefiles describing the DVRPC pedestrian network with an OSM extract
 - load the OSM file of the pedestrian network into an OSM web server instance using JOSM
 - extract the merged OSM street network and DVRPC pedestrian network from the OSM server
 - assign names to the sidwalks based on their adjoining streets in the OSM street network

Source data from DVRPC:
 - https://dvrpc-dvrpcgis.opendata.arcgis.com/datasets/dvrpc-pedestrian-network-curb-ramps
 - https://dvrpc-dvrpcgis.opendata.arcgis.com/datasets/dvrpc-pedestrian-network-sidewalks
 - https://dvrpc-dvrpcgis.opendata.arcgis.com/datasets/dvrpc-pedestrian-network-crosswalks


## Convert DVRPC sidewalks and crosswalks to OSM format and merge

 - use `ogr2ogr` to clip both shapefiles to bounds:
    - `ogr2ogr -clipsrc -75.3908 39.9537 -75.1624 40.0751 -clipsrclayer DVRPC_Pedestrian_Network__Sidewalks sidewalks_clipped.shp DVRPC_Pedestrian_Network__Sidewalks.shp`
    - `ogr2ogr -clipsrc -75.3908 39.9537 -75.1624 40.0751 -clipsrclayer DVRPC_Pedestrian_Network__Crosswalks crosswalks_clipped.shp DVRPC_Pedestrian_Network__Crosswalks.shp`
 - open sidewalk shapefile in JOSM (reading shapefiles requires the OpenData plugin)
 - select all ways ("select all", then "unselect nodes")
 - remove fields except for objectid, globalid, and material
 - add tags `highway=footway` and `footway=sidewalk`
 - rename objectid and globalid to dvrpc:objectid and dvrpc:globalid, respectively
 - rename material to surface
 - use search to update surface values:
    - remove surface tag where value is N/A
    - update value to lower-case for the other types (concrete, asphalt, and brick)
 - run the JOSM validator and fix errors (delete a one-node way and merge two duplicated nodes)
 - save sidewalk data as an OSM file
 - remove sidewalk layer and open crosswalk shapefile in JOSM
 - select all ways
 - remove all fields except for objectid, globalid, and feat_type
 - rename objectid and globalid to dvrpc:objectid and dvrpc:globalid, respectively
 - rename feat_type to crossing
 - add tags `highway=footway` and `footway=crossing` (note: *not* `highway=crossing`)
    - TODO: should `highway:crossing` be added to the crosswalk nodes? to the curb cut nodes?
 - search for `crossing=UNMARKED` and change value to `unmarked`
 - select all ways, remove from selection `crossing=unmarked`, and set value to `uncontrolled`
    - TODO: should this be `traffic_signals` instead? should this be manually checked later?
    - shapefile has a field for signal, but it is unset for all entries
 - run the JOSM validator (should have no errors; ignore the warnings)
 - save crosswalks as an OSM file
 - open sidewalks OSM as a second layer and re-save both layers as OSM
    - JOSM will regenerate non-conflicting, negative IDs
 - run script `merge_ways.py` to merge the crosswalks and sidewalks to a single OSM file


## Convert curb cuts

 - use `ogr2ogr` to clip to bounds for the curb cuts shapefile, as above
 - open clipped shapefile in JOSM
 - select all features (there are only nodes)
 - remove unused tags, leaving only `objectid`, `globalid`, `position`, and `status`
 - rename the remaining tags to have a `dvrpc:` prefix
 - add the tags `kerb=lowered` and `highway:crossing`
 - run JOSM validator
 - remove one each of the five instances of two nodes at the same position
 - save as OSM file
 - run script `merge_curb_cuts.py` to merge the curb cuts into the sidewalks and crosswalks
 - open merge results in JOSM, validate, and save


## Upload to local OSM website instance

The server will assign positive OSM IDs on upload to the JOSM-produced features.

 - Configure JOSM preferences for OSM host to point to local instance
 - Upload via JOSM the merged OSM to the local OSM instance (already loaded with published data)


## Extract OSM file from local OSM website instance

Use osmosis to extract from the OSM server the combined OSM street network and DVRPC sidewalk data.

 - run `strtra/export_db.sh` while the server is running in the VM
    - output is written to `data/export.osm`


## Name DVRPC sidewalks

 - install the JOSM scripting plugin
 - load into JOSM the exported OSM file produced by `strtra/export_db.sh`
    - this contains both the new DVRPC features, with positive IDs, and the street network
 - open the scripting console and run `josm_get_crosswalk_street_names.js`
    - this produces a text file of results in the JOSM default home directory
 - run `josm_name_sidewalks.js` to assign names to DVRPC sidewalks
 - save JOSM layer to a new file
 - run `josm_get_sidewalk_names.js` to export sidewalk names and IDs
