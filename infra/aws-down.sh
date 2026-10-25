#!/usr/bin/env bash
#
# Removes everything aws-up.sh created: the server and its disk, the Elastic IP, the security group
# and the key pair. The data on the server goes with it.
#
#   infra/aws-down.sh --yes
set -euo pipefail
[[ ${1:-} == --yes ]] || { echo "This deletes the server and all its data. Run it with --yes." >&2; exit 1; }

PROFILE=${AISUS_AWS_PROFILE:-aisus}
REGION=${AISUS_AWS_REGION:-ap-southeast-1}
NAME=aisus
state=$HOME/.config/aisus
aws() { command aws --profile "$PROFILE" --region "$REGION" --output text "$@"; }

alloc=$(aws ec2 describe-addresses --filters "Name=tag:Name,Values=$NAME" --query 'Addresses[0].AllocationId')
if [[ $alloc != None ]]; then
  association=$(aws ec2 describe-addresses --allocation-ids "$alloc" --query 'Addresses[0].AssociationId')
  [[ $association == None ]] || aws ec2 disassociate-address --association-id "$association"
  aws ec2 release-address --allocation-id "$alloc"
fi
ids=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$NAME" Name=instance-state-name,Values=pending,running,stopping,stopped --query 'Reservations[].Instances[].InstanceId')
if [[ -n $ids && $ids != None ]]; then
  aws ec2 terminate-instances --instance-ids $ids >/dev/null
  aws ec2 wait instance-terminated --instance-ids $ids
fi
sg=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$NAME" --query 'SecurityGroups[0].GroupId')
[[ $sg == None ]] || aws ec2 delete-security-group --group-id "$sg"
aws ec2 delete-key-pair --key-name "$NAME" >/dev/null 2>&1 || true
rm -f "$state/aisus.pem" "$state/server.env"
echo "Removed the server, its address, its security group and its key pair."
