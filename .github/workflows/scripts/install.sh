#!/bin/sh
sudo apt-get update
sudo apt -y install build-essential curl cmake pkg-config libboost-all-dev libssl-dev libzmq3-dev libunbound-dev libsodium-dev libunwind8-dev liblzma-dev libreadline6-dev libldns-dev libexpat1-dev doxygen graphviz libpgm-dev libudev-dev libusb-1.0-0-dev libhidapi-dev protobuf-compiler libprotobuf-dev xsltproc gperf autoconf automake libtool-bin libprotobuf-c-dev

# json files
js-beautify $(find . -type f -name '*.json') -t -n --space-after-named-function --space-after-anon-function -B --good-stuff

# javascript, html and css files
js-beautify $(find . -type f -name '*.js') $(find . -type f -name '*.html') $(find . -type f -name '*.css') -t -n --space-after-named-function --space-after-anon-function -B --good-stuff
