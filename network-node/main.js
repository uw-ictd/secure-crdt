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
const HashSet = require('hashset');
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

// Create a store to queue disconnected tuples.
const backlog = new HashSet();
let disconnected = false;

// HTTP Server properties.
const port = 8080;
app.use(bodyParser.json()); // for parsing application/json
app.use(bodyParser.urlencoded({ extended: true })); // for parsing xhtml

app.get('/disconnected', (request, response) => {
    response.send({status: disconnected});
});

app.post('/disconnected', upload.array(), (request, response, next) => {
    console.log(request.body);
    if (request.body.status === 'true') {
       disconnected = true;
       response.status(200).send("Emulating disconnection");
       return;
    }

    if (request.body.status === 'false') {
       disconnected = false;
       response.status(200).send("System now connected");
       return;
    }

    response.status(400).send("Accepts only 'true' or 'false'.")
});

app.get('/:userId/pubkey', (request, response) => {
    let userId = request.params.userId;
    cc_executor.queryChaincode(fabric_client, channel, 'account', 'getPublicKey', [userId]).then((result) => {
        response.status(200).send({userId: userId, pubKey: result.toString()});
    }).catch((err) => {
        response.status(500).send(err.toString());
    });
});

app.post('/:userId', upload.array(), (request, response, next) => {
    if (disconnected === true) {
        response.status(400).send("Cannot register a new user while disconnected");
    }

    cc_executor.invokeChaincode(fabric_client, channel, 'account', 'register',
                                [request.params.userId, request.body.pubKey]).then((result) => {
        response.status(200).send(result);
    }).catch((err) => {
        response.status(500).send(err.toString());
    });
});

app.listen(port, (err) => {
    if (err) {
        return console.log('something bad happened', err)
    }

    console.log(`server is listening on ${port}`)
});