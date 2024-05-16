#!/bin/bash

npm run test:integration && echo "Integration tests passed" || bash scripts/report-test-failure.sh
