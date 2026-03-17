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

  # Parse JUnit XML reports for failed test details
  FAILURE_DETAILS=""
  if ls reports/junit-report-*.xml 1>/dev/null 2>&1; then
    FAILURE_DETAILS=$(awk '
      /<testsuite / && /file="/ {
        s = $0
        sub(/.*file="/, "", s)
        sub(/".*/, "", s)
        if (s != "") current_file = s
      }
      /<testcase / && /name="/ {
        s = $0
        sub(/.*name="/, "", s)
        sub(/".*/, "", s)
        gsub(/&quot;/, "\"", s)
        gsub(/&amp;/, "\\&", s)
        gsub(/&lt;/, "<", s)
        gsub(/&gt;/, ">", s)
        if (s != "") current_test = s
      }
      /<failure/ {
        if (current_file != "" && current_test != "") {
          if (files[current_file] != "")
            files[current_file] = files[current_file] ", \"" current_test "\""
          else
            files[current_file] = "\"" current_test "\""
        }
      }
      END {
        for (f in files) {
          print "- " f ": " files[f]
        }
      }
    ' reports/junit-report-*.xml)
  fi

  if [ -n "${FAILURE_DETAILS}" ]; then
    SLACK_MESSAGE="${SLACK_MESSAGE}\nFailed tests:\n${FAILURE_DETAILS}"
  fi

  echo "Reporting to slack: ${SLACK_MESSAGE}"
  curl -X POST -H 'Content-type: application/json' --data '{"text": '\""$SLACK_MESSAGE"\"'}' $SLACK_WEBHOOK
fi

echo "Step failed: ${STEP_NAME}"

exit 1
