#!/bin/bash

# NOTE(mpatwardhan): IMPORTANT - Since CircleCi logs are publicly available,
# DO NOT echo or printenv or in any other way let the sensitive environment variables
# get printed or saved.

set -ev

echo "current directory:"
echo $PWD
echo "node version:"
node --version
echo "npm version:"
npm --version
echo "os info:"
uname -a
echo "directory:"
ls -alt
echo "Package.json version:"
cat package.json | grep version
echo "running tests"


echo "Running network tests"
# network tets run inside a container with docker socket mapped in the container.
echo "${DOCKER_HUB_PASSWORD}" | docker login --username "${DOCKER_HUB_USERNAME}" --password-stdin
docker-compose --file=.circleci/images/docker-compose.yml run integrationTests

echo "Done with Tests!"
