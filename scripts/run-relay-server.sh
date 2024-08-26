#!/bin/bash

npm run test:relay-server && echo "Relay server shut down gracefully" || bash scripts/report-failure.sh "Relay server"
