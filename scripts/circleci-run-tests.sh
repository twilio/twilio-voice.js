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

if [[ -z "${BVER}" ]]; then
  export BVER="stable"
fi

if [[ -z "${BROWSER}" ]]; then
  BROWSER="chrome" docker-compose --file=.circleci/images/docker-compose.yml run integrationTests
  BROWSER="firefox" docker-compose --file=.circleci/images/docker-compose.yml run integrationTests
else
  docker-compose --file=.circleci/images/docker-compose.yml run integrationTests
fi

echo "Done with Tests!"
