#!/bin/bash

echo 'running linters'
vagrant ssh -c "cd /srv/openstreetmap-website && bundle exec rubocop -f fuubar && bundle exec rake eslint && bundle exec erblint ."
