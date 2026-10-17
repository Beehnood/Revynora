#!/bin/sh
set -eu
curl --fail --silent --show-error --max-time 10 https://api.revynora.watercode.dev/api/v1/health/ready > /dev/null
