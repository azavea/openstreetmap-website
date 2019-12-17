## Setup

Start VM with `vagrant up`. Provisioning the VM will delete and recreate the OSM database and populate it with any `.osm` or `.pbf` OSM data files in the `data` directory. Be sure to also get the user edits with the data download.


## Running the development server

From the host, run `srta/serve.sh` to start the local rails server on port 3003.


## Configuration

Create an account at http://localhost:3003/user/new.

Look in the rails logs for the confirmation email text. Find a link in it that looks like:

`http://localhost:3003/user/USERNAME/confirm?confirm_string=SOME_STRING`

Go to the link to complete registration.

Under the user drop-down in the upper right, go to "My Settings."

Go to 'oauth settings' under the header. Click to register an application for the iD editor. Use `http://localhost:3003` for all of the URLs.

Note the consumer key for the OAuth application once created.

Edit `config/settings.local.yml` (which should exist but be empty after provisining), and add a line for the newly created iD editor OAuth app:

`id_key: OAUTH_KEY`

The map should now be editable for the regions covered by the input OSM data using the local iD editor.
