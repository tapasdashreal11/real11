#! /bin/bash

cd /home/ubuntu/node 

sudo apt-get update -y

sudo apt install default-jre

curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash -

sudo apt-get install -y nodejs

sudo npm install -g pm2

sudo npm install

