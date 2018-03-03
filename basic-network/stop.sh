#!/usr/bin/env bash
set -e

# Stop containers that might be running.
docker-compose -f docker-compose.yml stop
