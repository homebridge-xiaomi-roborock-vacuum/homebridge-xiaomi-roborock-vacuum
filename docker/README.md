# Homebridge in Docker, with this working copy

A real Homebridge, with its UI, running the plugin built from your working copy. Use it to try a change with your robot,
or the plugin's settings page, before it's released.

```sh
npm run docker
```

Then open <http://localhost:8581>. On the first run, create the UI's admin user and add your robot from the plugin's
settings (Plugins → Xiaomi Roborock Vacuum → Settings).

- **After a change:** stop it (Ctrl+C) and run `npm run docker` again. It rebuilds the plugin as npm would publish it,
  with its production dependencies.
- **The data** (config, accessories, logs, the Xiaomi Cloud session) is kept in `docker/homebridge/`, which is
  git-ignored. Delete that folder to start from scratch.
- **The robot** is reached from the container, so it must be reachable from your machine.
- **The Home app:** HomeKit finds Homebridge with mDNS, which doesn't cross Docker's network. To pair it, on Linux,
  replace `ports` with `network_mode: host` in `docker-compose.yml`. On macOS, testing with the UI and the logs is
  easier.
- **Another Homebridge version:** set `HOMEBRIDGE_IMAGE` in the Dockerfile to one of the image's dated tags.

It needs Docker with [Compose](https://docs.docker.com/compose/install/) (`docker compose`). With Compose installed
from Homebrew, add `"cliPluginsExtraDirs": ["/opt/homebrew/lib/docker/cli-plugins"]` to `~/.docker/config.json`, or
run `docker-compose -f docker/docker-compose.yml up --build` instead.
