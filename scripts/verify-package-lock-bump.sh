#!/bin/bash

echo "Verifying package-lock.json bump"

if git diff -U0 | grep '^[+]' | grep -Ev '^(\+\+\+ b/)' | grep -v ""\"version\"": "\"${RELEASE_VERSION}\"","
then
  echo "Failure: package-lock.json bump"
  exit 1
fi

echo "Success: package-lock.json bump"
