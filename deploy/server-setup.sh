#!/usr/bin/env bash
#
# Prepares a fresh Amazon Linux 2023 (arm64) server once: Docker with the Compose and Buildx plugins,
# 2 GB of swap for the cloud's build, and a clone of the repository. deploy.sh --setup runs it as
# root over SSH, with AISUS_REPO naming the public repository to clone.
set -euo pipefail
: "${AISUS_REPO:?set AISUS_REPO, such as https://github.com/kerktaiheng/aisus.git}"

COMPOSE_VERSION=v5.6.1
BUILDX_VERSION=v0.38.1
plugins=/usr/local/lib/docker/cli-plugins

dnf install -y docker git
systemctl enable --now docker
usermod -aG docker ec2-user

# Each plugin is checked against the checksum its release publishes.
mkdir -p "$plugins"
fetch() {
  local url=$1 sums=$2 name=$3 target=$4
  curl -fsSL -o "/tmp/$name" "$url/$name"
  curl -fsSL "$url/$sums" | grep " \*\?$name\$" | sed "s| \*\?$name\$|  /tmp/$name|" | sha256sum -c -
  install -m 0755 "/tmp/$name" "$target"
}
fetch "https://github.com/docker/compose/releases/download/$COMPOSE_VERSION" checksums.txt docker-compose-linux-aarch64 "$plugins/docker-compose"
fetch "https://github.com/docker/buildx/releases/download/$BUILDX_VERSION" checksums.txt "buildx-$BUILDX_VERSION.linux-arm64" "$plugins/docker-buildx"

if [[ ! -f /swapfile ]]; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo "/swapfile none swap sw 0 0" >> /etc/fstab
fi

home=/home/ec2-user
[[ -d $home/aisus/.git ]] || sudo -u ec2-user git clone --quiet "$AISUS_REPO" "$home/aisus"
docker compose version
docker buildx version
