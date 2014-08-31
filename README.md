CAAC
====

CIP-Assisted-Asset-Cropper

# Installing dependencies (on a Ubuntu server)
## Getting node.js compiled and installed - find the newest link on http://nodejs.org/http://nodejs.org/

### First install build dependencies

	sudo apt-get install gcc make g++

### Get the source code for node onto the machine

	wget http://nodejs.org/dist/v0.10.31/node-v0.10.31.tar.gz

### Untar the archive

	tar -xvf node-*.tar.gz node

### Change directory into the node folder

	cd node

### Configure, build and install

	./configure
	make
	sudo make install

### Verify the installation

	node --version
	npm --version

### Optionally remove the archive and directory.

	rm -rf node*

## Deploy using forever and nginx as a forward proxy.

### Install the dependencies

	sudo npm install -g forever
	sudo apt-get install nginx

### Install git and install OpenCV using a repo cloned from GitHub.

	sudo apt-get install git
	git clone https://github.com/jayrambhia/Install-OpenCV.git

	cd Install-OpenCV/Ubuntu/
	./opencv_latest.sh 

### Create a site for the Cropper on the nginx installation

	cd /etc/nginx/sites-available/
	sudo nano caac

### Paste in the following or similar configuration

	server {
		listen 80 default_server;
		listen [::]:80 default_server ipv6only=on;

		# root /usr/share/nginx/html;
		# index index.html index.htm;

		# Make site accessible from http://localhost/
		server_name localhost;

		location / {
		    proxy_pass       http://localhost:3000;
		    proxy_set_header Host      $host;
		    proxy_set_header X-Real-IP $remote_addr;
		}
	}

### Disable any default site and enable this

	cd /etc/nginx/sites-available/sites-enabled/
	unlink default 
	sudo ln -s /etc/nginx/sites-available/caac caac

### Restart nginx

	sudo service nginx restart

## Clone this repository onto the server

	git clone https://github.com/NationalMuseumofDenmark/CAAC.git

### Create a script (such as start.sh) to start the CAAC using forever

	nano start.sh

### Paste in the following or similar script (changing the value of app to the location of the app)

	#!/bin/bash -e
	app=/home/$USER/CAAC
	cd $app && forever start bin/www
