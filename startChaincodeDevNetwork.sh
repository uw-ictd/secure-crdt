#!/usr/bin/env bash

# Exit on errors.
set -ev

# Start.sh relies on running from within the basic-network directory.
# TODO(matt9j) Figure out why this is the case with docker-compose.
pushd ./basic-network/

docker-compose -f docker-compose-dev.yml -f docker-compose.yml up -d --renew-anon-volumes ca.example.com orderer.example.com peer0.org1.example.com.dev chaincode

# Create the channel
docker exec peer0.org1.example.com peer channel create -o orderer.example.com:7050 -c mychannel -f /etc/hyperledger/configtx/channel.tx
# Join peer0.org1.example.com to the channel.
docker exec peer0.org1.example.com peer channel join -b mychannel.block

# Launch the CLI container to install and instantiate the chaincode on the peer.
docker-compose -f ./docker-compose.yml up -d cli

popd

echo "------Containers up------"
echo "In the dev network, chaincode binaries must be manually run in the chaincode container."
