# A real Homebridge (with its UI) running the plugin built from this working copy: see docker/README.md.

ARG HOMEBRIDGE_IMAGE=homebridge/homebridge:latest

# Build the plugin, and package it the way npm would publish it
FROM node:26-slim AS build
WORKDIR /src
COPY package.json package-lock.json ./
RUN npm ci --ignore-scripts --no-audit --no-fund
COPY . .
RUN npm run build \
  && npm pack --pack-destination /tmp \
  && mkdir /plugin \
  && tar -xzf /tmp/homebridge-xiaomi-roborock-vacuum-*.tgz -C /plugin --strip-components=1 \
  && cp package-lock.json /plugin/ \
  && cd /plugin \
  && npm ci --omit=dev --ignore-scripts --no-audit --no-fund \
  && rm package-lock.json

FROM ${HOMEBRIDGE_IMAGE}
COPY --from=build /plugin /opt/homebridge-xiaomi-roborock-vacuum
COPY docker/link-plugin.sh /usr/local/bin/link-plugin
# Copied to /homebridge/startup.sh on the first start, run on every start
COPY docker/startup.sh /defaults/startup.sh
