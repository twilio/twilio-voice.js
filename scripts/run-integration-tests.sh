#!/bin/bash

if [[ "$1" == "chrome" ]]; then
  npm run test:cypress -- browser /usr/bin/google-chrome
elif [[ "$1" === "firefox" ]]; then
  npm run test:cypress -- browser /usr/local/bin/firefox
else
  echo "$1 browser not supported"
  exit 1
fi
