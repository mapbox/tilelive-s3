#!/bin/bash

set -e

# Inspect binary.
if [[ $(uname -s) == "Linux" ]]; then
    ldd ./lib/binding/tilelive_s3.node
else
    otool -L ./lib/binding/tilelive_s3.node
fi

COMMIT_MESSAGE=$(git show -s --format=%B $TRAVIS_COMMIT | tr -d '\n')

if [ "${COMMIT_MESSAGE#*'[publish binary]'}" != "$COMMIT_MESSAGE" ]; then
    npm install aws-sdk
    ./node_modules/.bin/node-pre-gyp package testpackage
    ./node_modules/.bin/node-pre-gyp publish info

    rm -rf build
    rm -rf lib/binding
    npm install --fallback-to-build=false
    npm test

    ./node_modules/.bin/node-pre-gyp info
fi
