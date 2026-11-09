#!/usr/bin/env bash
#
# Prepares a fresh Amazon Linux 2023 (arm64) server once: Docker with the Compose and Buildx plugins,
# 2 GB of swap for the cloud's build, and a clone of the repository. deploy.sh --setup runs it as
# root over SSH, with AISUS_REPO naming the public repository to clone.
set -euo pipefail
: "${AISUS_REPO:?set AISUS_REPO, such as https://github.com/aisusdev/aisus.git}"

COMPOSE_VERSION=v5.6.1
BUILDX_VERSION=v0.38.1
plugins=/usr/local/lib/docker/cli-plugins

dnf install -y docker git
systemctl enable --now docker
usermod -aG docker ec2-user

# Each plugin is checked against the checksum its release publishes. Each download is tried up to
# six times, because GitHub's release downloads sometimes answer 504 to clients that are not signed in.
mkdir -p "$plugins"
download() { curl -fsSL --retry 5 --retry-delay 10 --retry-all-errors "$@"; }
# A file already copied into /tmp/aisus-plugins/ is used instead of a download, and is checked the same way.
fetch() {
  local url=$1 sums=$2 name=$3 target=$4 dir=/tmp/aisus-plugins/${1##*/download/}
  mkdir -p "$dir"
  [[ -s $dir/$name ]] || download -o "$dir/$name" "$url/$name"
  [[ -s $dir/$sums ]] || download -o "$dir/$sums" "$url/$sums"
  grep " \*\?$name\$" "$dir/$sums" | sed "s| \*\?$name\$|  $dir/$name|" | sha256sum -c -
  install -m 0755 "$dir/$name" "$target"
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
# The clone is tried up to five times too, for the same reason.
for attempt in 1 2 3 4 5; do
  [[ -d $home/aisus/.git ]] && break
  sudo -u ec2-user git clone --quiet "$AISUS_REPO" "$home/aisus" || { rm -rf "$home/aisus"; sleep 10; }
done
[[ -d $home/aisus/.git ]]
docker compose version
docker buildx version
