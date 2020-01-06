#!/usr/bin/env python3
# encoding=utf8
"""
Write modified DVRPC sidewalk shapefile with fields added for the assigned street name and OSM ID.

Expects `dvrpc_sidewalk_names.txt`, the output of the `josm_get_sidewalk_names.js` JOSM script,
to exist in the local directory.

Will download the DVRPC sidewalk shapefile if it doesn't exist already in the current directory.
"""

import csv
import os
import zipfile

import fiona
from fiona.crs import from_epsg
import requests


INPUT_NAMES_FILE = 'dvrpc_sidewalk_names.txt'
SHP_DIRECTORY = 'sidewalks'
ZIPFILE = 'DVRPC_Pedestrian_Network__Sidewalks.zip'
SHP_URL = 'https://opendata.arcgis.com/datasets/6e8aef56bea14bc5973c6d865315e562_5.zip'
SHP_FILE = 'sidewalks/DVRPC_Pedestrian_Network__Sidewalks.shp'
OUT_SHP = 'sidewalks/DVRPC_named_sidewalks.shp'

# to use clipped source instead
# SHP_FILE = 'sidewalks/sidewalks_clipped.shp'
# OUT_SHP = 'sidewalks/sidewalks_clipped_named.shp'

if not os.path.isfile(SHP_FILE):
    print('DVRPC sidewalks Shapefile not found. Downloading...')
    req = requests.get(SHP_URL, stream=True)
    with open(ZIPFILE, 'wb') as zf:
        for chunk in req.iter_content(chunk_size=128):
            zf.write(chunk)
        print('Done downloading sidewalks Shapefile. Extracting...')
    with zipfile.ZipFile(ZIPFILE, 'r') as zipref:
        zipref.extractall(SHP_DIRECTORY)
        print('Zipped Shapefile extracted.')
else:
    print('DVRPC sidewalks Shapefile found locally; not downloading.')

# map DRPC ID to two-element array with OSM ID and street name
sidewalks = {}
with open(INPUT_NAMES_FILE) as inf:
    rdr = csv.reader(inf, delimiter='|')
    print('\n\n')
    longest_len = 0
    for r in rdr:
        osm_id = r[0]
        dvrpc_object_id = r[1]
        street_name = r[2]
        sidewalks[dvrpc_object_id] = [osm_id, street_name]
        name_len = len(street_name)
        if (name_len > longest_len):
            longest_len = name_len


named_features = 0
total_features = 0
with fiona.open(SHP_FILE) as shp:
    schema = shp.schema.copy()
    """
    schema:
    {'properties': OrderedDict([('objectid', 'int:10'), ('line_type', 'int:10'),
    ('status', 'str:80'), ('material', 'str:80'), ('material_o', 'str:80'), ('feat_type', 'str:80'),
    ('raised', 'str:80'), ('width', 'str:80'), ('captured', 'str:80'), ('state', 'str:80'),
    ('county', 'str:80'), ('muni', 'str:80'), ('community', 'str:80'), ('ped_sig', 'str:80'),
    ('globalid', 'str:80'), ('Shape__Len', 'float:24.15')]), 'geometry': 'LineString'}
    """

    crs = from_epsg(4326)
    # 254 is the maximum width allowed dBase/Shapefile
    # maximum street name length found is 25 characters
    schema['properties']['streetname'] = 'str:80'
    # maximum is 20 for dBase
    schema['properties']['osm_id'] = 'int:20'
    with fiona.open(OUT_SHP, 'w', driver='ESRI Shapefile', schema=schema,
                    crs=crs) as outjson:
        for feature in shp:
            object_id = str(feature['properties']['objectid'])
            total_features += 1
            if object_id in sidewalks:
                feature['properties']['osm_id'] = sidewalks[object_id][0]
                feature['properties']['streetname'] = sidewalks[object_id][1]
                outjson.write(feature)
                named_features += 1

print('\n')
print('Assigned street names to ' + str(named_features) + ' of ' +
      str(total_features) + ' total sidewalk features.')
print('Longest street name is ' + str(longest_len) + ' characters.')

print('\n')
print('All done writing sidewalk names to {outfile}'.format(outfile=OUT_SHP))
