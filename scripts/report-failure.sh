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

if [ -n "${SLACK_WEBHOOK}" ] && [ -n "${BUILD_LABEL}" ] && [ -n "${CIRCLE_BUILD_URL}" ]
then
  BRANCH_NAME=$(git branch 2> /dev/null | sed -e '/^[^*]/d' -e 's/* \(.*\)/\1/')
  SLACK_MESSAGE=":failed_build: *Build Failed*\n*Build:* <${CIRCLE_BUILD_URL}|${BUILD_LABEL}>\n*Browser:* ${BROWSER} ${BVER}\n*Branch:* \`${BRANCH_NAME}\`\n*Step:* ${STEP_NAME}"

  SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
  PAYLOAD=$(SLACK_MESSAGE="${SLACK_MESSAGE}" node "${SCRIPT_DIR}/build-slack-payload.js" 2>/dev/null || node -e "process.stdout.write(JSON.stringify({text: (process.env.SLACK_MESSAGE || '').replace(/\\\\n/g, '\\n')}))" 2>/dev/null || echo "{\"text\": \"Build failure notification error\"}")

  echo "Reporting to slack: ${SLACK_MESSAGE}"
  curl -X POST -H 'Content-type: application/json' --data "${PAYLOAD}" "${SLACK_WEBHOOK}"
fi

echo "Step failed: ${STEP_NAME}"

exit 1
