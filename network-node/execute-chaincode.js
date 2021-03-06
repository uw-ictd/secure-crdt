'use strict';
/*
 * A module to execute chaincode actions.
 */

const Fabric_Client = require('fabric-client');
const util = require('util');

exports.setupCrypto = (fabric_client, store_path) => {
    // Create the key value store as defined in the fabric-client/config/default.json 'key-value-store' setting.
    Fabric_Client.newDefaultKeyValueStore({ path: store_path
    }).then((state_store) => {
        // Assign the store to the fabric client.
        fabric_client.setStateStore(state_store);
        let crypto_suite = Fabric_Client.newCryptoSuite();
        // Use the same location for the state store (where the users' certificate are kept)
        // and the crypto store (where the users' keys are kept).
        let crypto_store = Fabric_Client.newCryptoKeyStore({path: store_path});
        crypto_suite.setCryptoKeyStore(crypto_store);
        fabric_client.setCryptoSuite(crypto_suite);

        // Get the enrolled user from persistence, this user will sign all requests.
        return fabric_client.getUserContext('user1', true);
    }).then((user_from_store) => {
        if (user_from_store && user_from_store.isEnrolled()) {
            console.log('Successfully loaded user1 from persistence');
        } else {
            throw new Error('Failed to get user1.... run registerUser.js');
        }
    }).catch((err) => {
        console.error('Failed to setup the store and user successfully :: ' + err);
    });
};

exports.queryChaincode = (fabric_client, channel, cc_name, cc_function, cc_args_list) => {
    const request = {
        // targets : Defaults to all peers assigned to channel
        chaincodeId: cc_name,
        fcn: cc_function,
        args: cc_args_list
    };

    return new Promise((resolve, reject) => {
        // Send query proposal to the peer.
        channel.queryByChaincode(request).then((query_responses) => {
            console.log("Query has completed, checking results");
            // TODO(matt9j) query_responses can have multiple results if multiple peers were targeted
            if (query_responses && query_responses.length === 1) {
                if (query_responses[0] instanceof Error) {
                    console.error("error from query = ", query_responses[0]);
                    reject(query_responses[0]);
                } else {
                    console.log("Response is ", query_responses[0].toString());
                    resolve(query_responses[0]);
                }
            } else {
                console.log("No payloads were returned from query");
                reject();
            }
        }).catch((err) => {
            console.error('Failed to query successfully :: ' + err);
            reject(err);
        });
    });
};

exports.invokeChaincode = (fabric_client, channel, cc_name, cc_function, cc_args_list) => {
    let transaction_id = fabric_client.newTransactionID();
    console.log("Assigning transaction_id: ", transaction_id._transaction_id);

    const request = {
        // targets : Defaults to all peers assigned to channel
        chaincodeId: cc_name,
        fcn: cc_function,
        args: cc_args_list,
        chainId: 'mychannel', // TODO(matt9j) Make this parameterized.
		txId: transaction_id
    };

    return new Promise((resolve, reject) => {
        channel.sendTransactionProposal(request).then((results) => {
            let proposal_responses = results[0];
            let proposal = results[1];
            let proposal_is_good = false;
            if (proposal_responses && proposal_responses[0].response &&
                proposal_responses[0].response.status === 200) {
                proposal_is_good = true;
                console.log('Transaction proposal was good');
            } else {
                console.error('Transaction proposal was bad');
            }

            if (proposal_is_good) {
                console.log(util.format(
                    'Successfully sent Proposal and received ProposalResponse: Status - %s, message - "%s"',
                    proposal_responses[0].response.status, proposal_responses[0].response.message));

                // build up the request for the orderer to have the transaction committed
                let orderer_request = {
                    proposalResponses: proposal_responses,
                    proposal: proposal
                };

                // set the transaction listener and set a timeout of 30 sec
                // if the transaction did not get committed within the timeout period,
                // report a TIMEOUT status
                let transaction_id_string = transaction_id.getTransactionID(); //Get the transaction ID string to be used by the event processing
                let promises = [];

                let sendPromise = channel.sendTransaction(orderer_request);
                promises.push(sendPromise); //we want the send transaction first, so that we know where to check status

                // using resolve the promise so that result status may be processed
                // under the then clause rather than having the catch clause process
                // the status
                let txPromise = new Promise((resolve, reject) => {
                    // Setup an event hub for blockchain notifications.
                    const event_hub = fabric_client.newEventHub();
                    event_hub.setPeerAddr('grpc://localhost:7053');
                    let handle = setTimeout(() => {
                        event_hub.disconnect();
                        resolve({event_status: 'TIMEOUT'}); //we could use reject(new Error('Trnasaction did not complete within 30 seconds'));
                    }, 3000);
                    event_hub.connect();
                    event_hub.registerTxEvent(transaction_id_string, (tx, code) => {
                        // this is the callback for transaction event status
                        // first some clean up of event listener
                        clearTimeout(handle);
                        event_hub.unregisterTxEvent(transaction_id_string);
                        event_hub.disconnect();

                        // now let the application know what happened
                        let return_status = {event_status: code, tx_id: transaction_id_string};
                        if (code !== 'VALID') {
                            console.error('The transaction was invalid, code = ' + code);
                            resolve(return_status); // we could use reject(new Error('Problem with the transaction, event status ::'+code));
                        } else {
                            console.log('The transaction has been committed on peer ' + event_hub._ep._endpoint.addr);
                            resolve(return_status);
                        }
                    }, (err) => {
                        //this is the callback if something goes wrong with the event registration or processing
                        reject(new Error('There was a problem with the eventhub ::' + err));
                    });
                });
                promises.push(txPromise);

                return Promise.all(promises);
            } else {
                console.error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
                throw new Error('Failed to send Proposal or receive valid response. Response null or status is not 200. exiting...');
            }
        }).then((results) => {
            // TODO(matt9j) Clean up this if statement logic... it's nasty.
            console.log('Send transaction promise and event listener promise have completed');
            // check the results in the order the promises were added to the promise all list
            if (results && results[0] && results[0].status === 'SUCCESS') {
                console.log('Successfully sent transaction to the orderer.');
                if(results && results[1] && results[1].event_status === 'VALID') {
                    resolve('SUCCESS');
                }
            } else {
                console.error('Failed to order the transaction. Error code: ' + results[0].status);
                reject(results[0].status);
            }

            if(results && results[1] && results[1].event_status === 'VALID') {
                console.log('Successfully committed the change to the ledger by the peer');
            } else {
                console.log('Transaction failed to be committed to the ledger due to ::'+results[1].event_status);
                reject(results[1].event_status);
            }
            reject('Unknown invoke failure, possibly ordered but rejected by peer.');
        }).catch((err) => {
            console.error('Failed to invoke successfully :: ' + err);
            reject(err);
        });
    });
};