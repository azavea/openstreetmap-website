-- Drop and recreate users and databases
DROP DATABASE IF EXISTS openstreetmap;
DROP DATABASE IF EXISTS osm_test;
DROP DATABASE IF EXISTS vagrant;
DROP ROLE IF EXISTS openstreetmap;
DROP ROLE IF EXISTS vagrant;

CREATE ROLE vagrant SUPERUSER CREATEDB CREATEROLE INHERIT LOGIN;
CREATE ROLE osm_test WITH PASSWORD 'osm_test' SUPERUSER CREATEDB INHERIT LOGIN;
CREATE ROLE openstreetmap WITH PASSWORD 'openstreetmap' LOGIN;

CREATE DATABASE vagrant WITH OWNER vagrant;
CREATE DATABASE openstreetmap WITH OWNER openstreetmap;
CREATE DATABASE osm_test WITH OWNER osm_test;

GRANT openstreetmap TO vagrant;
GRANT osm_test TO vagrant;
