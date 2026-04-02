ARG BUILD_FROM=ghcr.io/anweihe/bluesound-web:latest
FROM ${BUILD_FROM}

# HA add-on: data directory mapped to /config
RUN mkdir -p /config/bluesound

ENV DATA_PATH=/config/bluesound
