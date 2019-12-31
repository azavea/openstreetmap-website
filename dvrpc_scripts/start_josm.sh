#!/bin/bash

# Script to help with starting downloaded JOSM on Ubuntu (not the system package).
# `josm_tested.jar` downloaded from https://josm.openstreetmap.de/

# start JOSM
java -Xmx12G -jar /opt/josm/josm-tested.jar

# Start JOSM with Jython support. Note standalone Jython is required.
# java -Xmx12G -cp "/opt/josm/josm-tested.jar:/opt/jython/jython-standalone-2.7.1.jar" org.openstreetmap.josm.gui.MainApplication
