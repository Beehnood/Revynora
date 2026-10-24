#!/bin/sh
# Read-only audit; no sudo prompt, no env/config dump, no docker inspect (may reveal secrets).
set -u
uname -srmo
getconf _NPROCESSORS_ONLN
free -h
df -h / /var/lib/docker 2>/dev/null
uptime
ss -lnt 2>/dev/null
systemctl is-active nginx docker postgresql 2>/dev/null
if command -v docker >/dev/null; then
  docker version --format '{{.Server.Version}}' 2>/dev/null
  docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Ports}}\t{{.Status}}' 2>/dev/null
  docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' 2>/dev/null
  docker system df 2>/dev/null
fi
if command -v nginx >/dev/null; then nginx -v 2>&1; fi
if command -v psql >/dev/null; then psql --version; fi
# Report filenames only, never content of existing sites or secrets.
find /etc/nginx/sites-enabled -maxdepth 1 -type l -printf '%f\n' 2>/dev/null
exit 0
