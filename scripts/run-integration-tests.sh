#!/bin/bash
function reportFailure() {
  if [ -n "${SLACK_WEBHOOK}" ] && [ -n "${BUILD_LABEL}" ] && [ -n "${CIRCLE_BUILD_URL}" ]
  then
    BRANCH_NAME=$(git branch 2> /dev/null | sed -e '/^[^*]/d' -e 's/* \(.*\)/\1/')
    SLACK_MESSAGE=":failed_build: <${CIRCLE_BUILD_URL}|${BUILD_LABEL}> ${BROWSER} ${BVER} on branch ${BRANCH_NAME}"
    echo "Reporting to slack: ${SLACK_MESSAGE}"
    curl -X POST -H 'Content-type: application/json' --data '{"text": '\""$SLACK_MESSAGE"\"'}' $SLACK_WEBHOOK
  fi

  echo "Integration tests failed"
  exit 1
}

./node_modules/.bin/karma start $PWD/karma.conf.ts --log-level debug && echo "Integration tests passed" || reportFailure
