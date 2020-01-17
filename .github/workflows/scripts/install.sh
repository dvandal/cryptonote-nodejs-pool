#!/bin/sh
#apt-get update
#apt-get install libboost-all-dev

# json files
js-beautify $(find . -type f -name '*.json') -t -n --space-after-named-function --space-after-anon-function -B --good-stuff

# javascript, html and css files
js-beautify $(find . -type f -name '*.js') $(find . -type f -name '*.html') $(find . -type f -name '*.css') -t -n --space-after-named-function --space-after-anon-function -B --good-stuff
