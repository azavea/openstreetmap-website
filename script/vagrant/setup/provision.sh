#!/usr/bin/env bash

# abort on error
set -e

# set locale to UTF-8 compatible. apologies to non-english speakers...
locale-gen en_US.utf8
update-locale LANG=en_US.utf8 LC_ALL=en_US.utf8
export LANG=en_US.utf8
export LC_ALL=en_US.utf8

# add repository for yarn
# https://yarnpkg.com/lang/en/docs/install/#debian-stable
curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list

# make sure we have up-to-date packages
apt-get update

# upgrade all packages
apt-get upgrade -y

# install packages as explained in INSTALL.md
apt-get install -y ruby2.5 libruby2.5 ruby2.5-dev \
                     libmagickwand-dev libxml2-dev libxslt1-dev fontconfig nodejs \
                     apache2 apache2-dev build-essential git-core \
                     postgresql postgresql-contrib libpq-dev \
                     libsasl2-dev imagemagick libffi-dev libgd-dev libarchive-dev libbz2-dev \
                     openjdk-11-jdk openjdk-11-doc osmosis postgis yarn

# install a phantomjs version that will work headlessly
pushd /home/vagrant
wget https://bitbucket.org/ariya/phantomjs/downloads/phantomjs-2.1.1-linux-x86_64.tar.bz2
tar jxvf phantomjs-2.1.1-linux-x86_64.tar.bz2
sudo cp phantomjs-2.1.1-linux-x86_64/bin/phantomjs /usr/bin/
popd

## install the bundle necessary for openstreetmap-website
pushd /srv/openstreetmap-website
gem2.5 install rake
gem2.5 install --version "~> 1.16.2" bundler
# do bundle install as a convenience
bundle install --retry=10 --jobs=2

# Run SQL
pushd /srv/openstreetmap-website/script/vagrant/setup
echo 'drop and recreate databases and users'
sudo -u postgres psql -f recreate_databases.sql

echo 'add database extensions'
sudo -u postgres psql -f add_extensions.sql openstreetmap
sudo -u postgres psql -f add_extensions.sql osm_test
popd # back to /srv/openstreetmap-website

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
if [ ! -f config/storage.yml ]; then
    cp config/example.storage.yml config/storage.yml
fi

touch config/settings.local.yml

# migrate the database from the osmosis version to the latest version
echo 'apply remaining migrations'
bundle exec rake db:migrate

echo 'export i8ln'
bundle exec rake i18n:js:export
echo 'install npm packages'
bundle exec rake yarn:install

popd
echo 'all done'
