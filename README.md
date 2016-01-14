# Assisted Asset Cropper

A web-application enabling assisted cropping of assets from a Canto Cumulus CIP asset management system.

The application is written using the Node.js Express framework.

The following is a guide getting you up to speed, which requires some dependencies - please read the "Installing dependencies" section below, if you haven't got the node runtime or want to deploy this on a clean server.

## Easy setup

Clone this repository onto your development machine

    git clone https://github.com/NationalMuseumofDenmark/Assisted-Asset-Cropper.git

Install the node dependencies

    npm install

Run the Grunt tool

    grunt

And use grunt to boot up the app

    grunt start

# Deploying (on a Ubuntu server)

## Install the OpenCV depencency

As a sudoer install git and install OpenCV using a repo cloned from GitHub.
Currently the 3.0.0 version of OpenCV is not supported by the node-opencv package, see https://github.com/peterbraden/node-opencv/issues/273 and https://github.com/peterbraden/node-opencv/pull/259 for updates on this.

    sudo apt-get install git
    git clone https://github.com/jayrambhia/Install-OpenCV.git
    cd Install-OpenCV/Ubuntu/2.4/
    ./opencv2_4_10.sh

## Install nginx and the imagemagick depencency

    sudo apt-get install nginx imagemagick

## Create an application user

Create a seperate 'cropper' user on the server

    sudo adduser --disabled-password cropper

## Install node and npm
As the new cropper user make sure the deployment machine has a version of node and npm installed, I like to use the node version manager tool for this (see https://github.com/creationix/nvm)

    sudo su cropper
    curl -o- https://raw.githubusercontent.com/creationix/nvm/v0.29.0/install.sh | bash

Install the v0.12.8 version of node and npm (latest stable is not compatible with the opencv lib at the moment of writing)

    nvm install v0.12.8

Install the bower, grunt and forever command line tools

    npm install -g bower grunt-cli forever

## Deploy using nginx as a reverse proxy

Create a site for the Cropper on the nginx installation

    cd /etc/nginx/sites-available/
    sudo nano 000-cropper

Paste in the following or similar configuration

    server {
      listen 80 default_server;
      listen [::]:80 default_server ipv6only=on;

      location / {
        proxy_pass       http://localhost:3000;
        proxy_set_header Host      $host;
        proxy_set_header X-Real-IP $remote_addr;
      }
    }

Disable any default site and enable this and restart nginx

    sudo unlink /etc/nginx/sites-enabled/default
    sudo ln -s /etc/nginx/sites-available/000-cropper /etc/nginx/sites-enabled/000-cropper
    sudo service nginx restart

## Clone this repository onto the server

    git clone https://github.com/NationalMuseumofDenmark/Assisted-Asset-Cropper.git

Create a build (such as build.sh) to build the Assisted-Asset-Cropper using npm, bower and grunt

    touch build.sh
    chmod u+x build.sh
    nano build.sh

Paste in the following or similar script

    #!/bin/bash -e
    export NVM_DIR="/home/cropper/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm
    nvm use v0.12.8
    app=/home/$USER/Assisted-Asset-Cropper
    cd $app && npm install && bower install && grunt

For bower to work behind an HTTP proxy, configure git to use https when asked to use the git:// url scheme

    git config --global url.https://github.com/.insteadOf git://github.com/

Create a script (such as start.sh) to start the Assisted-Asset-Cropper using forever

    touch start.sh
    chmod u+x start.sh
    nano start.sh

Paste in the following or similar script (changing the value of app to the location of the app)

    #!/bin/bash -e
    export NVM_DIR="/home/cropper/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"  # This loads nvm
    nvm use v0.12.8
    app=/home/$USER/Assisted-Asset-Cropper
    cd $app && forever start bin/www
