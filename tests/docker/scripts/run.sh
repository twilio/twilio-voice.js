#!/bin/bash
# Start of containerized test, originating from host machine

# Bubble up errors
set -e

# This script can run from anywhere. Let's capture the project directory
DIR=$(cd -P -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)
cd $DIR && cd ../../../

echo "Preparing container"
docker-compose build --build-arg IMAGE=$IMAGE test

echo "Running the image"
docker-compose run -e BROWSER=$BROWSER test ./tests/docker/scripts/entry.sh
