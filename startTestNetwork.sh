#!/usr/bin/env bash

# Exit on errors.
set -e

# Start.sh relies on running from within the basic-network directory.
# TODO(matt9j) Figure out why this is the case with docker-compose.
pushd ./basic-network/

# Launch a basic network, creating a channel and joining a peer to the channel.
./start.sh
# Launch the CLI container to install and instantiate the chaincode on the peer.
docker-compose -f ./docker-compose.yml up -d cli

popd

echo "------Containers up, start chaincode on the peer------"

./basic-network/setup-chaincode.sh
