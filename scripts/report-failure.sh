#!/bin/bash

if [ -n "${SLACK_WEBHOOK}" ] && [ -n "${BUILD_LABEL}" ] && [ -n "${CIRCLE_BUILD_URL}" ] && [ -n "$1" ]
then
  BRANCH_NAME=$(git branch 2> /dev/null | sed -e '/^[^*]/d' -e 's/* \(.*\)/\1/')
  SLACK_MESSAGE=":failed_build: <${CIRCLE_BUILD_URL}|${BUILD_LABEL}> ${BROWSER} ${BVER} on branch ${BRANCH_NAME} on step $1"
  echo "Reporting to slack: ${SLACK_MESSAGE}"
  curl -X POST -H 'Content-type: application/json' --data '{"text": '\""$SLACK_MESSAGE"\"'}' $SLACK_WEBHOOK
fi

echo "Step failed: $1"

exit 1
