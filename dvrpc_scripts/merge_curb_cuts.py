#!/usr/bin/python3
"""
Merge DVRPC curb ramp OSM into the combined crosswalks and sidewalks file.
(Expects `merge_ways.py` to have been run.)
Replaces crosswalk/sidewalk end nodes with curb cut node where present.
"""

import xml.etree.ElementTree as eTree

crosswalks_sidewalks = eTree.parse('crosswalks_sidewalks_merged.osm')
curb_ramps = eTree.parse('curb_ramps.osm')


def round_coord(coord):
    """Round to five decimal places, or ~1.1 meters"""
    return str(round(float(coord), 5))


cs_root = crosswalks_sidewalks.getroot()
curb_ramps_root = curb_ramps.getroot()

cross_side_nodes = cs_root.findall('node')
cuts_nodes = curb_ramps_root.findall('node')

cs_coords = []
cuts_coords = []

for n in cross_side_nodes:
    cs_coords.append(round_coord(n.get('lat')) + ',' +
                     round_coord(n.get('lon')))

for n in cuts_nodes:
    cuts_coords.append(round_coord(n.get('lat')) + ',' +
                       round_coord(n.get('lon')))

matched = set(cs_coords).intersection(set(cuts_coords))

print('found ' + str(len(matched)) +
      ' matched nodes, updating nodes that have curb ramps...')

for match in matched:
    cut_node = None
    have_cut = False  # check for duplicates
    for cut_idx, cc in enumerate(cuts_coords):
        if cc == match:
            cut_node = cuts_nodes[cut_idx]
            break
    if not cut_node:
        print('no match found for ' + match + ', skipping')
        continue
    for cs_idx, cs in enumerate(cs_coords):
        if cs == match:
            cross_side_node = cross_side_nodes[cs_idx]
            old_id = cross_side_node.get('id')
            # replace the old node with the curb cut node
            cs_root.remove(cross_side_node)
            if not have_cut:
                # copy the curb cut node and set its ID to the first found
                # matching existing node
                new_node = eTree.fromstring(eTree.tostring(cut_node))
                new_id = cross_side_node.get('id')
                new_node.set('id', new_id)
                cs_root.append(new_node)
                have_cut = True
            else:
                # go find way reference(s) to duplicate existing nodes
                # and update their IDs to that of the curb cut node
                dupe_refs = cs_root.findall(".//way/nd[@ref='" + old_id + "']")
                for ref in dupe_refs:
                    ref.set('v', new_id)
                    ref.set('ref', new_id)

print('curb ramp nodes set. fixing duplicate nodes...')
duplicate_nodes = 0
single_node_ways = 0
ways = cs_root.findall('.//way')
for way in ways:
    refs = way.findall('nd')
    refset = set()
    for refnode in refs:
        ref = refnode.get('ref')
        if ref in refset:
            duplicate_nodes += 1
            way.remove(refnode)
        else:
            refset.add(ref)
    refs = way.findall('nd')
    if len(refs) == 1:
        single_node_ways += 1
        cs_root.remove(way)

print('deleted ' + str(duplicate_nodes) + ' duplicate way nodes')
print('deleted ' + str(single_node_ways) + ' single-node ways')

crosswalks_sidewalks.write('crosswalks_sidewalks_curb_cuts_merged.osm')

print('all done!')
