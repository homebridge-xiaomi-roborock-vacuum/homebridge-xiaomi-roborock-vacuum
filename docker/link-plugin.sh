#!/bin/sh
# Links the plugin built by docker/Dockerfile into Homebridge's plugins (replacing any copy installed from npm).
# It runs after the container installs the plugins in /homebridge/package.json, which would remove it otherwise.
set -e

PLUGIN=/homebridge/node_modules/homebridge-xiaomi-roborock-vacuum

if [ -e "$PLUGIN" ] && [ ! -L "$PLUGIN" ]; then
  echo "Replacing the installed homebridge-xiaomi-roborock-vacuum with this working copy"
  rm -rf "$PLUGIN"
fi
mkdir -p /homebridge/node_modules
ln -sfn /opt/homebridge-xiaomi-roborock-vacuum "$PLUGIN"
echo "Linked homebridge-xiaomi-roborock-vacuum $(jq -r .version /opt/homebridge-xiaomi-roborock-vacuum/package.json) (this working copy)"
