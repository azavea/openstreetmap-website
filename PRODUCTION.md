## Production server setup:

 - clone this repository to `/srv`
 - copy the OSM data file for the clone to start with to the `data` directory
 - go to the top-level repo directory on the server
 - run provisioning script directly, as `sudo`
 - build the production assets: `sudo bundle exec rake assets:precompile db:migrate RAILS_ENV=production`
 - test running production server directly with Rails: `sudo rails server -p 80 -e production --binding=0.0.0.0`
 - install the OSS version of the Passenger Rails server [from their repo](https://www.phusionpassenger.com/docs/advanced_guides/install_and_upgrade/standalone/install/oss/disco.html)
 - test running the Passenger server: `sudo bundle exec passenger start`
 - [run Passenger at startup as a system service](#passenger-system-service-setup)
 - [configure e-mail and modify code to send emails synchronously](#email-configuration)
 - [tune database](#database-tuning)
 - [configure website](#server-configuration)


### Passenger system service setup

Save the text below to `/etc/systemd/service/osm.service`, then set the service to run at startup with `sudo systemctl daemon-reload && sudo systemctl enable osm`.

```
[Unit]
Description=OSM Passenger Rails Server
After=syslog.target network.target

[Service]
Type=simple
User=root
Group=root
WorkingDirectory=/srv/openstreetmap-website
PIDFile=/srv/openstreetmap-website/tmp/pids/passenger.80.pid
ExecStart=/usr/local/bin/bundle exec passenger start
ExecReload=/usr/local/bin/bundle exec passenger stop && /usr/local/bin/bundle exec passenger start
ExecStop=/usr/local/bin/bundle exec passenger stop
TimeoutSec=30
RestartSec=15s
Restart=always

[Install]
WantedBy=multi-user.target
```


### Database tuning

Modify `postgresql.conf` to increase some memory settings and restart PostgreSQL:

```
work_mem = 64MB
maintenance_work_mem = (5% total system memory)
shared_buffers = (25% total system memory)
```


### Email configuration

Set the email configuration in `config/environments/production.rb`:

```
config.action_mailer.smtp_settings = {
    :address              => "smtp.gmail.com",
    :port                 => 587,
    :domain               => "<server domain>",
    :user_name            => "<email account>",
    :password             => "<generated app password>",
    :authentication       => "plain",
    :enable_starttls_auto => true
}
```

Getting email to send with the production server required modifying the app code to change all instances of sending email via `deliver_later` to `deliver`, as the emails would queue but never send. Running the development server with email configured as above, the emails would send, possibly because they would also still log to console, which might have caused the email queue to flush.


### Server configuration

Set the `server_url` to the website domain in `config/settings.yml` and restart the `osm` service.

Go to the website and set up a new user account. Existing public OSM account usernames cannot be re-used on the clone, as the email addresses were anonymized as part of the import. (Alternatively, to re-use an existing account, go to the database, find the user by `display_name`, and reset the email address.) Then register an iD editor application under the user OAuth settings, following the instructions in `AZAVEA_README.md`, and set the editor `id_key` in `config/settings.local.yml`. It should now be possible to edit in the website.
