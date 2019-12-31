#!/usr/bin/python3
"""
Merge together DVRPC sidewalk and crosswalk OSM files.
"""

import xml.etree.ElementTree as eTree

OUTPUT_FILE = 'crosswalks_sidewalks_merged.osm'

sidewalks = eTree.parse('sidewalks.osm')
crosswalks = eTree.parse('crosswalks.osm')


def round_coord(coord):
    """Round to five decimal places, or ~1.1 meters"""
    return str(round(float(coord), 5))


side_root = sidewalks.getroot()
cross_root = crosswalks.getroot()

side_nodes = side_root.findall('node')
cross_nodes = cross_root.findall('node')

side_coords = []
cross_coords = []

for n in side_nodes:
    side_coords.append(round_coord(n.get('lat')) + ',' +
                       round_coord(n.get('lon')))

for n in cross_nodes:
    cross_coords.append(round_coord(n.get('lat')) + ',' +
                        round_coord(n.get('lon')))

matched = set(side_coords).intersection(set(cross_coords))

print('found ' + str(len(matched)) +
      ' matched nodes, updating crosswalk node IDs...')

changed_ids = {}
for match in matched:
    sn_id = None
    for sc_idx, sc in enumerate(side_coords):
        if sc == match:
            sn_id = side_nodes[sc_idx].get('id')
            break
    if not sn_id:
        print('no match found for ' + match + ', skipping')
        continue
    for cc_idx, cc in enumerate(cross_coords):
        if cc == match:
            cn = cross_nodes[cc_idx]
            cn_id = cn.get('id')
            # map old ID to new ID to update references in ways later
            changed_ids[cn_id] = sn_id
            # update crosswalk ID to match sidewalk node
            cn.set('id', sn_id)

print('nodes updated, now updating refereces in ways...')

cross_ways = cross_root.findall('way')
for way in cross_ways:
    for c in way.getchildren():
        if c.tag == 'nd':
            ref = c.get('ref')
            if ref in changed_ids:
                c.set('ref', changed_ids[ref])

crosswalks.write(OUTPUT_FILE)
print('all done!')
