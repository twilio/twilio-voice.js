#!/bin/bash

BROWSER_ARG="$1"
TEST_FILES_ARG="$2"

if [ -n "${TEST_FILES_ARG}" ]; then
  STEP_NAME="${TEST_FILES_ARG} tests"
elif [ -n "${BROWSER_ARG}" ]; then
  STEP_NAME="Integration tests (${BROWSER_ARG})"
else
  STEP_NAME="Integration tests"
fi

if [ -n "${SLACK_WEBHOOK}" ] && [ -n "${BUILD_LABEL}" ] && [ -n "${CIRCLE_BUILD_URL}" ] && [ "${IS_PR_WORKFLOW}" != "true" ]
then
  BRANCH_NAME=$(git branch 2> /dev/null | sed -e '/^[^*]/d' -e 's/* \(.*\)/\1/')
  SLACK_MESSAGE=":failed_build: <${CIRCLE_BUILD_URL}|${BUILD_LABEL}> ${BROWSER} ${BVER} on branch ${BRANCH_NAME} on step ${STEP_NAME}"

  # Parse merged JUnit XML report for failed test details
  FAILURE_DETAILS=""
  if [ -f reports/junit-report.xml ]; then
    FAILURE_DETAILS=$(grep -B1 '<failure' reports/junit-report.xml | grep '<testcase' | sed 's/.*[[:space:]]name="\([^"]*\)".*/- \1/' || true)
  fi

  if [ -n "${FAILURE_DETAILS}" ]; then
    FAILURE_DETAILS=$(echo "${FAILURE_DETAILS}" | tr '\n' '\\' | sed 's/\\/\\n/g')
    SLACK_MESSAGE="${SLACK_MESSAGE}\nFailed tests:\n${FAILURE_DETAILS}"
  fi

  echo "Reporting to slack: ${SLACK_MESSAGE}"
  curl -X POST -H 'Content-type: application/json' --data '{"text": '\""$SLACK_MESSAGE"\"'}' $SLACK_WEBHOOK
fi

echo "Step failed: ${STEP_NAME}"

exit 1
