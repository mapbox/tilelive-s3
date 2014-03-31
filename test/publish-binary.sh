#!/bin/bash

set -e

COMMIT_MESSAGE=$(git show -s --format=%B $TRAVIS_COMMIT | tr -d '\n')

if [ "${COMMIT_MESSAGE#*'[publish binary]'}" != "$COMMIT_MESSAGE" ]; then
    npm install aws-sdk
    node-pre-gyp package testpackage
    node-pre-gyp publish info

    rm -rf build
    rm -rf lib/binding
    npm install --fallback-to-build=false
    npm test

    node-pre-gyp info
fi
