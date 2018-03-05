'use strict';
/*
 * The main server running on the station.
 *
 * Queues transactions to submit to the ledger when offline.
 */
const app = require('express')();
const bodyParser = require('body-parser');
const upload = require('multer')();
const Fabric_Client = require('fabric-client');
const path = require('path');
const cc_executor = require('./execute-chaincode.js');

// Setup the fabric network.
const fabric_client = new Fabric_Client();
const channel = fabric_client.newChannel('mychannel');
const peer = fabric_client.newPeer('grpc://localhost:7051');
channel.addPeer(peer);
const order_service = fabric_client.newOrderer('grpc://localhost:7050')
channel.addOrderer(order_service);

// Set a location for the fabric key store and ID store.
const store_path = path.join(__dirname, 'hfc-key-store');
console.log('Store path:'+store_path);

// Initialize keys for the cc_executor.
cc_executor.setupCrypto(fabric_client, store_path);

const port = 8080;

app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing xhtml

app.get('/balance/', (request, response) => {
    console.log(request.body);
    cc_executor.invokeChaincode(fabric_client, channel, 'account', 'register', ['allan', 'allankeys']);
    response.send('TODO send the actual response');
});

app.post('/', upload.array(), (request, response, next) => {
   console.log(request.body);
});

app.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err)
    }

    console.log(`server is listening on ${port}`)
});