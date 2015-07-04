#!/usr/bin/env bash

export PATH=./node_modules/.bin/:$PATH

if [[ ! -d ./.mason ]]; then
    git clone --depth 1 https://github.com/mapbox/mason.git ./.mason
fi

export MASON_DIR=$(pwd)/.mason
export PATH=$(pwd)/.mason:$(pwd)/mason_packages/.link/bin:$PATH
./.mason/mason install libpng 1.6.17
./.mason/mason link libpng 1.6.17
export PKG_CONFIG_PATH=$(pwd)/mason_packages/.link/lib/pkgconfig/
export CXXFLAGS="-I$(pwd)/mason_packages/.link/include"
export LDFLAGS="-L$(pwd)/mason_packages/.link/lib"
if [[ $(uname -s) == 'Darwin' ]]; then
    export LDFLAGS="${LDFLAGS} -Wl,-search_paths_first";
fi;
