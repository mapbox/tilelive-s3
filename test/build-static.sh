#!/bin/bash

set -e
export CC=gcc-4.8
export CXX=g++-4.8
export CXXFLAGS="$CXXFLAGS -fPIC"
export CFLAGS="$CFLAGS -fPIC"

build_dir=$(pwd)

wget http://prdownloads.sourceforge.net/libpng/libpng-1.2.51.tar.gz?download /tmp/libpng-1.2.51.tar.gz
wget http://prdownloads.sourceforge.net/libpng/libpng-1.2.51.tar.gz.asc?download /tmp/libpng-1.2.51.tar.gz.asc
gpg --keyserver pgp.mit.edu --recv-keys A16C640F
gpg --verify /tmp/libpng-1.2.51.tar.gz.asc

tar xzv libpng-1.2.51.tar.gz -C /tmp
cd /tmp/libpng-1.2.51
./configure --enable-shared --disable-shared --disable-dependency-tracking
make && make install

cd $build_dir
