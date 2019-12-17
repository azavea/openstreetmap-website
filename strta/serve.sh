#!/bin/bash

echo 'starting rails server'
vagrant ssh -c "cd /srv/openstreetmap-website && rails server --binding=0.0.0.0"
