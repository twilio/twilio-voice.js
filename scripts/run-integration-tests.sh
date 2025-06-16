#!/bin/bash

if [[ "$1" == "chrome" ]]; then
  npm run test:integration:chrome && echo "Integration tests passed" || bash scripts/report-failure.sh "Integration tests"
elif [[ "$1" == "firefox" ]]; then
  npm run test:integration -- --browser /usr/local/bin/firefox && echo "Integration tests passed" || bash scripts/report-failure.sh "Integration tests"
else
  echo "$1 browser not supported"
  exit 1
fi
