#!/bin/bash

set -e

COMMIT_MESSAGE=$(git show -s --format=%B $TRAVIS_COMMIT | tr -d '\n')

if test "${COMMIT_MESSAGE#*'[publish binary]'}" != "$COMMIT_MESSAGE"
    then
    PUBLISH_BINARY=true
    FALLBACK_TO_BUILD=false
    npm install aws-sdk
    node-pre-gyp package testpackage
    node-pre-gyp publish info

    rm -rf build
    rm -rf lib/binding
    npm install --fallback-to-build=false
    npm test

    node-pre-gyp info
fi
