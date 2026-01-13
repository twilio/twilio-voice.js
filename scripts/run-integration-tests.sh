#!/bin/bash

if [ "$CIRCLECI" = "true" ]; then
  echo "Asking circleci to pick tests based on timings..."
  TESTFILES=$(circleci tests glob "cypress/e2e/**/*.cy.js" | circleci tests split --split-by=timings)
  echo $TESTFILES
fi

if [[ "$1" == "chrome" && -n "$2" ]]; then
  npm run test:integration:chrome -- --spec "$2" && echo "$2 tests passed" || bash scripts/report-failure.sh "$2 tests"
elif [[ "$1" == "chrome" ]]; then
  npm run test:integration:chrome -- --spec "$TESTFILES" && echo "Integration tests passed" || bash scripts/report-failure.sh "Integration tests"
elif [[ "$1" == "firefox" ]]; then
  npm run test:integration -- --spec "$TESTFILES" --browser /usr/local/bin/firefox && echo "Integration tests passed" || bash scripts/report-failure.sh "Integration tests"
else
  echo "$1 browser not supported"
  exit 1
fi
