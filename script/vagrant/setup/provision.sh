#!/usr/bin/env bash

# abort on error
set -e

# set locale to UTF-8 compatible. apologies to non-english speakers...
locale-gen en_GB.utf8
update-locale LANG=en_GB.utf8 LC_ALL=en_GB.utf8
export LANG=en_GB.utf8
export LC_ALL=en_GB.utf8

# make sure we have up-to-date packages
apt-get update

# upgrade all packages
apt-get upgrade -y

# install packages as explained in INSTALL.md
apt-get install -y ruby2.5 libruby2.5 ruby2.5-dev \
                     libmagickwand-dev libxml2-dev libxslt1-dev nodejs \
                     apache2 apache2-dev build-essential git-core phantomjs \
                     postgresql postgresql-contrib libpq-dev \
                     libsasl2-dev imagemagick libffi-dev libgd-dev libarchive-dev libbz2-dev \
                     openjdk-11-jdk openjdk-11-doc osmosis postgis
gem2.5 install rake
gem2.5 install --version "~> 1.16.2" bundler

## install the bundle necessary for openstreetmap-website
pushd /srv/openstreetmap-website
# do bundle install as a convenience
bundle install --retry=10 --jobs=2

echo 'drop current databases and users'
sudo -u postgres psql -c "DROP DATABASE IF EXISTS openstreetmap"
sudo -u postgres psql -c "DROP DATABASE IF EXISTS osm_test"
sudo -u postgres psql -c "DROP DATABASE IF EXISTS vagrant"
sudo -u postgres psql -c "DROP ROLE IF EXISTS openstreetmap"
sudo -u postgres psql -c "DROP ROLE IF EXISTS vagrant"

# Create users and databases
echo 'create vagrant user'
sudo -u postgres createuser -s vagrant
echo 'create openstreetmap user'
sudo -u postgres psql -c "CREATE USER openstreetmap WITH PASSWORD 'openstreetmap'"
echo 'create databases'
sudo -u postgres psql -c "CREATE DATABASE vagrant WITH OWNER vagrant"
sudo -u postgres psql -c "CREATE DATABASE openstreetmap WITH OWNER openstreetmap"
sudo -u postgres psql -c "CREATE DATABASE osm_test WITH OWNER openstreetmap"
sudo -u postgres psql -c "GRANT openstreetmap TO vagrant"
sudo -u postgres psql -c "create extension btree_gist" osm_test
sudo -u postgres psql -c "create extension btree_gist" openstreetmap

# Set up the database for osmosis
sudo -u postgres psql -c "create extension postgis" openstreetmap
sudo -u postgres psql -c "create extension hstore" openstreetmap

# Create the database tables for OSM an migrate to the specific APIDB schema version
# that is the last APIDB version used by osmosis:
# https://github.com/openstreetmap/osmosis/blob/2219470cef1f73f5d1319c57149c84b398e767ce/osmosis-apidb/src/main/java/org/openstreetmap/osmosis/apidb/v0_6/ApidbVersionConstants.java
echo 'apply migrations to osmosis version'
bundle exec rake db:migrate VERSION=20130328184137

# Workaround for attempted user imports failing with:
# ERROR: duplicate key value violates unique constraint "users_display_name_idx"
echo 'drop user display name index as a workaround'
sudo -u postgres psql -c "drop index users_display_name_idx" openstreetmap

# Run osmosis import for whatever OSM files are in the `data` directory
if [ -f data/*.osm ]; then
    echo 'import data directory OSM contents with osmosis'
    osmosis --read-xml data/*.osm --write-apidb \
        database="openstreetmap" user="openstreetmap" password="openstreetmap"
fi
if [ -f data/*.pbf ]; then
    echo 'import data directory PBF contents with osmosis'
    osmosis --read-pbf data/*.pbf --write-apidb \
        database="openstreetmap" user="openstreetmap" password="openstreetmap"
fi

# Add back index removed for import.
# Should be safe, if uniqueness violations were from users changing their display name,
# then changing it back.
echo 'add back display name index'
sudo -u postgres psql -c "CREATE UNIQUE INDEX users_display_name_idx ON users (display_name)" openstreetmap


# install PostgreSQL functions
echo 'install functions'
sudo -u postgres psql -d openstreetmap -f db/functions/functions.sql
################################################################################
# *IF* you want a vagrant image which supports replication (or perhaps you're
# using this script to provision some other server and want replication), then
# uncomment the following lines (until popd) and comment out the one above
# (functions.sql).
################################################################################
#pushd db/functions
#make
#psql openstreetmap -c "CREATE OR REPLACE FUNCTION maptile_for_point(int8, int8, int4) RETURNS int4 AS '/srv/openstreetmap-website/db/functions/libpgosm.so', 'maptile_for_point' LANGUAGE C ST#RICT"
#psql openstreetmap -c "CREATE OR REPLACE FUNCTION tile_for_point(int4, int4) RETURNS int8 AS '/srv/openstreetmap-website/db/functions/libpgosm.so', 'tile_for_point' LANGUAGE C STRICT"
#psql openstreetmap -c "CREATE OR REPLACE FUNCTION xid_to_int4(xid) RETURNS int4 AS '/srv/openstreetmap-website/db/functions/libpgosm.so', 'xid_to_int4' LANGUAGE C STRICT"
#popd


# set up sample configs
if [ ! -f config/database.yml ]; then
    cp config/example.database.yml config/database.yml
fi
touch config/settings.local.yml
# migrate the database from the osmosis version to the latest version
echo 'apply remaining migrations'
bundle exec rake db:migrate
popd

echo 'all done'
