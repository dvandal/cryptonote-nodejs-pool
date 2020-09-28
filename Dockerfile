# Why node:8 and not node:10? Because (a) v8 is LTS, so more likely to be stable, and (b) "npm update" on node:10 breaks on Docker on Linux (but not on OSX, oddly)
FROM node:8-slim

RUN apt-get update \
  && DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs git libboost-all-dev libssl-dev make gcc g++ libsodium-dev\
  && rm -rf /var/lib/apt/lists/*

ADD . /pool/
WORKDIR /pool/

RUN npm update

RUN mkdir -p /config

EXPOSE 8117
EXPOSE 3333
EXPOSE 5555
EXPOSE 7777

VOLUME ["/config"]

CMD node init.js -config=/config/config.json
