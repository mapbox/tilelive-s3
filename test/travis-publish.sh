#!/bin/bash

set -e

# Inspect binary.
if [ $platform == "linux" ]; then
    ldd ./lib/binding/tilelive_s3.node
else
    otool -L ./lib/binding/tilelive_s3.node
fi

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
