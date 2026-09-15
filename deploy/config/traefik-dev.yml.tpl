# Template of the development Traefik's static configuration.
# ./setup derives deploy/config/traefik-dev.yml from it through envsubst — a
# generated file, and therefore gitignored.
#
# This Traefik is THROWAWAY and local. The production one already exists on
# the VPS: the project plugs into it without ever changing it.

entryPoints:
  web:
    address: ":80"
${REDIRECTION_BLOCK}
  websecure:
    address: ":443"

providers:
  # The development certificates, re-read live. The file only exists over
  # HTTPS; `directory` tolerates its absence, where `filename` would fail
  # the startup.
  file:
    directory: /dynamic
    watch: true

  docker:
    exposedByDefault: false
    # Compose names the network after the project, and Traefik does not
    # apply that prefix by itself.
    network: ${INSTANCE_NAME}_reverse_proxy
    # Discover only THIS instance's containers.
    #
    # Traefik enumerates them through the Docker socket, which lists EVERY
    # container on the machine whatever the networks. Each clone of the
    # repository publishes the same Host(...) rules. Without this
    # constraint, every Traefik registers them all and the request is served
    # by whichever instance won the race. `com.docker.compose.project` is
    # set by Compose: there is no label to keep up to date.
    constraints: "Label(`com.docker.compose.project`, `${INSTANCE_NAME}`)"

api:
  dashboard: true
  # Acceptable only because the port is published on
  # 127.0.0.1:${DASHBOARD_PORT} alone, never on 0.0.0.0.
  insecure: true

log:
  level: "INFO"

# To standard output (docker compose logs rp) rather than to a file: avoids
# a root-owned ./logs directory inside the repository.
accessLog:
  fields:
    names:
      StartUTC: drop
