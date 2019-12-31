#!/bin/bash

# Expects OSM server to be running.
# Writes export file to data/export.osm.

echo 'exporting OSM database contents'
vagrant ssh -c 'cd /srv/openstreetmap-website && osmosis --read-apidb database="openstreetmap" user="openstreetmap" password="openstreetmap" validateSchemaVersion=no --write-xml file="data/export.osm"'
