#! /bin/bash

 apt-get update -y

 apt install default-jre

curl -sL https://deb.nodesource.com/setup_14.x | sudo -E bash -

apt-get install -y nodejs

npm install -g pm2
