#!/usr/bin/env bash
#
# Creates the server on the owner's AWS account, or finds it again: one t4g.small running Amazon
# Linux 2023 (arm64) with a 20 GB gp3 disk, a security group open on 80 and 443 and on 22 from this
# machine's address, a key pair, and an Elastic IP. CPU credits are "standard", so a busy server
# slows down instead of billing for surplus credits. Run it again to re-allow SSH from a new address.
#
#   deploy/aws-up.sh            # profile "aisus", region ap-southeast-1
#
# It writes the server's address to ~/.config/aisus/server.env and the SSH key to
# ~/.config/aisus/aisus.pem. aws-down.sh removes everything it creates.
set -euo pipefail

PROFILE=${AISUS_AWS_PROFILE:-aisus}
REGION=${AISUS_AWS_REGION:-ap-southeast-1}
NAME=aisus
TYPE=${AISUS_INSTANCE_TYPE:-t4g.small}
state=$HOME/.config/aisus
mkdir -p "$state"
chmod 700 "$state"
aws() { command aws --profile "$PROFILE" --region "$REGION" --output text "$@"; }

if ! aws ec2 describe-key-pairs --key-names "$NAME" >/dev/null 2>&1; then
  aws ec2 create-key-pair --key-name "$NAME" --key-type ed25519 --query KeyMaterial > "$state/aisus.pem"
  chmod 600 "$state/aisus.pem"
fi
[[ -s $state/aisus.pem ]] || { echo "The key pair $NAME exists, but $state/aisus.pem is missing. Run aws-down.sh, then this again." >&2; exit 1; }

vpc=$(aws ec2 describe-vpcs --filters Name=is-default,Values=true --query 'Vpcs[0].VpcId')
sg=$(aws ec2 describe-security-groups --filters "Name=group-name,Values=$NAME" "Name=vpc-id,Values=$vpc" --query 'SecurityGroups[0].GroupId')
if [[ $sg == None ]]; then
  sg=$(aws ec2 create-security-group --group-name "$NAME" --description "aisus: the web, and SSH from the deployer" --vpc-id "$vpc" --query GroupId)
  aws ec2 authorize-security-group-ingress --group-id "$sg" --ip-permissions \
    'IpProtocol=tcp,FromPort=80,ToPort=80,IpRanges=[{CidrIp=0.0.0.0/0}]' \
    'IpProtocol=tcp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0}]' \
    'IpProtocol=udp,FromPort=443,ToPort=443,IpRanges=[{CidrIp=0.0.0.0/0}]' >/dev/null
fi
me=$(curl -fsS https://checkip.amazonaws.com)
aws ec2 authorize-security-group-ingress --group-id "$sg" --protocol tcp --port 22 --cidr "$me/32" >/dev/null 2>&1 || true

id=$(aws ec2 describe-instances --filters "Name=tag:Name,Values=$NAME" Name=instance-state-name,Values=pending,running,stopping,stopped --query 'Reservations[0].Instances[0].InstanceId')
if [[ $id == None ]]; then
  ami=$(aws ec2 describe-images --owners amazon --filters "Name=name,Values=al2023-ami-2023*-kernel-*-arm64" Name=state,Values=available --query 'sort_by(Images,&CreationDate)[-1].ImageId')
  id=$(aws ec2 run-instances --image-id "$ami" --instance-type "$TYPE" --key-name "$NAME" --security-group-ids "$sg" \
    --block-device-mappings 'DeviceName=/dev/xvda,Ebs={VolumeSize=20,VolumeType=gp3,DeleteOnTermination=true,Encrypted=true}' \
    --credit-specification CpuCredits=standard --metadata-options HttpTokens=required \
    --tag-specifications "ResourceType=instance,Tags=[{Key=Name,Value=$NAME}]" "ResourceType=volume,Tags=[{Key=Name,Value=$NAME}]" \
    --query 'Instances[0].InstanceId')
fi
aws ec2 start-instances --instance-ids "$id" >/dev/null 2>&1 || true
aws ec2 wait instance-running --instance-ids "$id"

alloc=$(aws ec2 describe-addresses --filters "Name=tag:Name,Values=$NAME" --query 'Addresses[0].AllocationId')
if [[ $alloc == None ]]; then
  alloc=$(aws ec2 allocate-address --domain vpc --tag-specifications "ResourceType=elastic-ip,Tags=[{Key=Name,Value=$NAME}]" --query AllocationId)
fi
aws ec2 associate-address --instance-id "$id" --allocation-id "$alloc" >/dev/null
ip=$(aws ec2 describe-addresses --allocation-ids "$alloc" --query 'Addresses[0].PublicIp')

printf 'AISUS_HOST=%s\nAISUS_INSTANCE=%s\n' "$ip" "$id" > "$state/server.env"
echo "The server $id ($TYPE) answers at $ip. SSH is open to $me."
