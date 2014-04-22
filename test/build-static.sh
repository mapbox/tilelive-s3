#!/bin/bash

set -e
export LIBPNG_PREFIX="/tmp/libpng"
export CFLAGS="-I${LIBPNG_PREFIX}/include -fPIC"
export LDFLAGS="-L${LIBPNG_PREFIX}/lib"
if [[ `uname -s` == 'Darwin' ]]; then
    export LDFLAGS="${LDFLAGS} -Wl,-search_paths_first"
fi
export PKG_CONFIG_PATH="${LIBPNG_PREFIX}/lib/pkgconfig"

build_dir=$(pwd)

mkdir ./tmp && cd ./tmp
mkdir -p ${LIBPNG_PREFIX}/lib
mkdir -p ${LIBPNG_PREFIX}/include
wget https://mapnik.s3.amazonaws.com/deps/libpng-1.6.10.tar.gz -O ./libpng-1.6.10.tar.gz
tar xzf libpng-1.6.10.tar.gz
cd ./libpng-1.6.10
./configure --prefix=${LIBPNG_PREFIX} --enable-static --disable-shared --disable-dependency-tracking
make
make install

cd $build_dir
