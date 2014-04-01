#!/bin/bash

set -e
export CFLAGS="$CFLAGS -fPIC"

build_dir=$(pwd)

mkdir ./tmp && cd ./tmp
wget https://mapnik.s3.amazonaws.com/deps/libpng-1.6.9.tar.gz -O ./libpng-1.6.9.tar.gz
tar xzf libpng-1.6.9.tar.gz
cd ./libpng-1.6.9
./configure --enable-shared --disable-shared --disable-dependency-tracking
make
sudo make install

cd $build_dir
