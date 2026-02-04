#!/bin/bash

# When running in stage environment, remap STAGE_ prefixed env vars to their standard names
if [ "$ENV" = "stage" ]; then
  echo "Running in stage environment, remapping STAGE_ prefixed env vars..."
  export STAGE=true
  echo "  Set STAGE=true for Cypress"
  for var in $(env | grep '^STAGE_' | cut -d= -f1); do
    new_var=${var#STAGE_}
    export "$new_var=${!var}"
    echo "  Remapped $var -> $new_var"
  done
fi

if [ "$CIRCLECI" = "true" ]; then
  echo "Asking circleci to pick tests based on timings..."
  TESTFILES=$(circleci tests glob "cypress/e2e/**/*.cy.ts" | circleci tests split --split-by=timings)
  TEST_LIST=$(echo $TESTFILES | tr ' ' ',')
  echo $TEST_LIST

  if [[ "$1" == "chrome" && -n "$2" ]]; then
    npm run test:integration:chrome -- --spec "$2" && echo "$2 tests passed" || bash scripts/report-failure.sh "$2 tests"
  elif [[ "$1" == "chrome" ]]; then
    npm run test:integration:chrome -- --spec "$TEST_LIST" && echo "Integration tests passed" || bash scripts/report-failure.sh "Integration tests"
  elif [[ "$1" == "firefox" ]]; then
    npm run test:integration -- --spec "$TEST_LIST" --browser /usr/local/bin/firefox && echo "Integration tests passed" || bash scripts/report-failure.sh "Integration tests"
  else
    echo "$1 browser not supported"
    exit 1
  fi
fi
