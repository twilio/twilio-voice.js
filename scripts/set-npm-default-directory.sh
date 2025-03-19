#!/bin/bash

mkdir -p ~/.npm-global/lib
npm config set prefix '~/.npm-global'
touch ~/.profile
echo "export PATH=~/.npm-global/bin:$PATH"
source ~/.profile
