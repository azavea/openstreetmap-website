#!/usr/bin/env bash

# abort on error
set -e

# set locale to UTF-8 compatible
sudo locale-gen en_US.utf8
sudo update-locale LANG=en_US.utf8 LC_ALL=en_US.utf8
export LANG=en_US.utf8
export LC_ALL=en_US.utf8
export DEBIAN_FRONTEND=noninteractive

# check if yarn is installed
if ! dpkg -s yarn; then
    echo 'install packages'
    # add repository for yarn
    # https://yarnpkg.com/lang/en/docs/install/#debian-stable
    curl -sS https://dl.yarnpkg.com/debian/pubkey.gpg | sudo apt-key add -
    echo "deb https://dl.yarnpkg.com/debian/ stable main" | sudo tee /etc/apt/sources.list.d/yarn.list
    
    # make sure we have up-to-date packages
    sudo apt-get -y -o Dpkg::Options::="--force-confdef" \
        -o Dpkg::Options::="--force-confold" update

    # upgrade all packages
    # noninteractively, to work around grub-pc prompt issue
    # https://github.com/chef/bento/issues/661#issuecomment-248136601
    sudo apt-get -y -o Dpkg::Options::="--force-confdef" \
        -o Dpkg::Options::="--force-confold" upgrade

    # install packages as explained in INSTALL.md
    sudo apt-get -y -o Dpkg::Options::="--force-confdef" -o Dpkg::Options::="--force-confold" \
        install ruby2.5 libruby2.5 ruby2.5-dev \
        libmagickwand-dev libxml2-dev libxslt1-dev fontconfig nodejs \
        apache2 apache2-dev build-essential git-core \
        postgresql-11 postgresql-contrib-11 libpq-dev \
        libsasl2-dev imagemagick libffi-dev libgd-dev libarchive-dev libbz2-dev \
        openjdk-11-jdk openjdk-11-doc osmosis postgresql-11-postgis-2.5 yarn \

    # install a phantomjs version that will work headlessly
    wget https://bitbucket.org/ariya/phantomjs/downloads/phantomjs-2.1.1-linux-x86_64.tar.bz2
    tar jxvf phantomjs-2.1.1-linux-x86_64.tar.bz2
    sudo cp phantomjs-2.1.1-linux-x86_64/bin/phantomjs /usr/bin/
    rm -r phantomjs-2.1.1-linux-x86_64*
fi

# set up sample configs
if [ ! -f config/database.yml ]; then
    cp config/example.database.yml config/database.yml
fi
if [ ! -f config/storage.yml ]; then
    cp config/example.storage.yml config/storage.yml
fi
if [ ! -f config/settings.local.yml ]; then
    touch config/settings.local.yml
fi

# Run SQL
echo 'drop and recreate databases and users'

PSQLCMD="psql -U postgres"
if [ "$USER" = "root" ]; then
    echo 'use postgres user in vagrant environment'
    PSQLCMD="sudo -u postgres psql"
fi
$PSQLCMD -f "script/setup/recreate_databases.sql"

echo 'add database extensions'
$PSQLCMD -f "script/setup/add_extensions.sql" openstreetmap
$PSQLCMD -f "script/setup/add_extensions.sql" osm_test

# install PostgreSQL functions
echo 'install functions'
$PSQLCMD -d openstreetmap -f db/functions/functions.sql
$PSQLCMD -d osm_test -f db/functions/functions.sql

## install the bundle necessary for openstreetmap-website
gem2.5 install rake
gem2.5 install --version "~> 1.16.2" bundler
# do bundle install as a convenience
bundle install --retry=10 --jobs=2

# Create the database tables for OSM an migrate to the specific APIDB schema version
# that is the last APIDB version used by osmosis:
# https://github.com/openstreetmap/osmosis/blob/2219470cef1f73f5d1319c57149c84b398e767ce/osmosis-apidb/src/main/java/org/openstreetmap/osmosis/apidb/v0_6/ApidbVersionConstants.java
echo 'apply migrations to osmosis version'
bundle exec rake db:migrate VERSION=20130328184137

# Workaround for attempted user imports failing with:
# ERROR: duplicate key value violates unique constraint "users_display_name_idx"
echo 'drop user display name index as a workaround'
$PSQLCMD -c "DROP INDEX IF EXISTS users_display_name_idx" openstreetmap

# Run osmosis import for whatever OSM files are in the `data` directory
IMPORTED_DATA=false
if [ -f data/*.osm ]; then
    IMPORTED_DATA=true
    echo 'import data directory OSM contents with osmosis'
    osmosis --read-xml data/*.osm --write-apidb \
        database="openstreetmap" user="openstreetmap" password="openstreetmap"
fi
if [ -f data/*.pbf ]; then
    IMPORTED_DATA=true
    echo 'import data directory PBF contents with osmosis'
    osmosis --read-pbf data/*.pbf --write-apidb \
        database="openstreetmap" user="openstreetmap" password="openstreetmap"
fi

# Update the sequence for the given table (table name expected as first parameter)
# to the last value currently in the table.
function update_sequence {
    echo "update sequence for ${1}"
    local last_seq_val=$($PSQLCMD -Atq -d openstreetmap -c "SELECT MAX(id) FROM ${1}")
    if [ ! -z "$last_seq_val" ]; then
        $PSQLCMD -d openstreetmap -c "SELECT setval('$1_id_seq', $last_seq_val)"
    fi
}

# Tables in the database that use sequenced IDs and may need updating after import.
# Note that some tables that use sequenced IDs that exist in the final database
# were added by migrations run below, and do not exist yet in the database after import,
# and so are not included here.
declare -a SEQUENCE_TABLES=(
    "acls"
    "changesets"
    "current_nodes"
    "current_relations"
    "current_ways"
    "diary_comments"
    "diary_entries"
    "friends"
    "gpx_file_tags"
    "gpx_files"
    "messages"
    "note_comments"
    "notes"
    "redactions"
    "user_blocks"
    "user_roles"
    "user_tokens"
    "users"
)

if $IMPORTED_DATA; then
    echo 'add back display name index'
    # Add back index removed for import.
    # Should be safe, if uniqueness violations were from users changing their display name,
    # then changing it back.
    $PSQLCMD -c "CREATE UNIQUE INDEX users_display_name_idx ON users (display_name)" openstreetmap
    # Set the changeset sequence ID to start incrementing after the last used ID in the import.
    # See: https://github.com/openstreetmap/openstreetmap-website/issues/1542
    # Also update the sequences in the database.
    echo 'update sequences'
    for i in "${SEQUENCE_TABLES[@]}"
    do
       echo "$i"
       update_sequence "$i"
    done
fi

# migrate the database from the osmosis version to the latest version
echo 'apply remaining migrations'
bundle exec rake db:migrate

echo 'export i8ln'
bundle exec rake i18n:js:export
echo 'install npm packages'
bundle exec rake yarn:install

echo 'all done'
