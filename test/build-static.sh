#!/bin/bash

set -e
export CC=gcc-4.8
export CXX=g++-4.8
export CXXFLAGS="$CXXFLAGS -fPIC"
export CFLAGS="$CFLAGS -fPIC"

build_dir=$(pwd)

mkdir ./tmp
wget 'http://prdownloads.sourceforge.net/libpng/libpng-1.2.51.tar.gz?download' -O ./tmp/libpng-1.2.51.tar.gz
wget 'http://prdownloads.sourceforge.net/libpng/libpng-1.2.51.tar.gz.asc?download' -O ./tmp/libpng-1.2.51.tar.gz.asc
gpg --keyserver pgp.mit.edu --recv-keys A16C640F
gpg --verify ./tmp/libpng-1.2.51.tar.gz.asc

ls -l
pwd
cd ./tmp
tar xzf libpng-1.2.51.tar.gz
cd ./libpng-1.2.51
./configure --enable-shared --disable-shared --disable-dependency-tracking
make
sudo make install

cd $build_dir