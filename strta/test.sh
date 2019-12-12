#!/bin/bash

echo 'running tests'
vagrant ssh -c "cd /srv/openstreetmap-website && bundle exec rake test:db"
