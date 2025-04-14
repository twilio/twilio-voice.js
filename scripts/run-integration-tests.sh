#!/bin/bash

if [[ "$1" == "chrome" ]]; then
  npm run test:cypress:chrome
elif [[ "$1" == "firefox" ]]; then
  npm run test:cypress:firefox
else
  echo "$1 browser not supported"
  exit 1
fi
