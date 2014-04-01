#!/bin/bash

set -e
export CFLAGS="$CFLAGS -fPIC"

build_dir=$(pwd)

mkdir ./tmp && cd ./tmp
wget 'http://prdownloads.sourceforge.net/libpng/libpng-1.6.10.tar.gz?download' -O ./libpng-1.6.10.tar.gz
wget 'http://prdownloads.sourceforge.net/libpng/libpng-1.6.10.tar.gz.asc?download' -O ./libpng-1.6.10.tar.gz.asc
gpg --keyserver pgp.mit.edu --recv-keys A16C640F
gpg --verify ./libpng-1.6.10.tar.gz.asc

tar xzf libpng-1.2.51.tar.gz
cd ./libpng-1.2.51
./configure --enable-shared --disable-shared --disable-dependency-tracking
make
sudo make install

cd $build_dir
