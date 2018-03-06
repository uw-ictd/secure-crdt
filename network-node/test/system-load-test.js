'use strict';
/*
 * Generate traffic for a load test on a running system.
 *
 * Requires the network to be started independently.
 */

const loadtest = require('loadtest');
let globalCounter = 0;
// const sessionPrefix = Date.now();
const sessionPrefix = "user";
const uniqueSessionId = Date.now();

const entryRequestGen = function(params, options, client, callback) {
    let message = {userKey: "stevekey", uniqueId: "prefix", change:"10"};
    message.uniqueId = Date.now() + "-" + globalCounter++;
    let message_string = JSON.stringify(message);

    options.headers['Content-Length'] = message_string.length;
    options.headers['Content-Type'] = 'application/json';
    let request = client(options, callback);
    request.write(message_string);
    return request;
};

// Appends one unique entry per user
const parallelEntryRequestGen = function(params, options, client, callback) {
    let userId = sessionPrefix + "-" + globalCounter++;
    let userKey = userId + "key";
    let message = {userKey: userKey, uniqueId: uniqueSessionId.toString(), change:"10"};
    let message_string = JSON.stringify(message);

    options.headers['Content-Length'] = message_string.length;
    options.headers['Content-Type'] = 'application/json';
    options.path = "/" + userId + "/entry";
    let request = client(options, callback);
    request.write(message_string);
    return request;
};

const registrationGen = function(params, options, client, callback) {
    let userId = sessionPrefix + "-" + globalCounter++;
    let message = {pubKey: userId + "key"};
    let message_string = JSON.stringify(message);
    options.headers['Content-Length'] = message_string.length;
    options.headers['Content-Type'] = 'application/json';
    options.path = "/" + userId;
    let request = client(options, callback);
    request.write(message_string);
    return request;
};

let keyOptions = {
    url: 'http://localhost:8080/steve/pubKey',
    maxRequests: 1000,
    concurrency: 10,
    method: 'GET',
    contentType: 'application/JSON',
    requestsPerSecond: 100,
    maxSeconds: 10,
};

let entryOptions = {
    url: 'http://localhost:8080/steve/entry',
    maxRequests: 1000,
    concurrency: 1,
    method: 'POST',
    contentType: 'application/JSON',
    requestsPerSecond: 60,
    maxSeconds: 120,
    requestGenerator: parallelEntryRequestGen,
};

let registrationOptions = {
    url: 'http://localhost:8080/steve',
    maxRequests: 1000,
    concurrency: 1,
    method: 'POST',
    contentType: 'application/JSON',
    requestsPerSecond: 45,
    maxSeconds: 60,
    requestGenerator: registrationGen,
};

let testInstance = loadtest.loadTest(entryOptions, (error, result) => {
    if (error)
    {
        return console.error('Got an error: %s', error);
    }
    console.log('Tests run successfully');
    console.log(result);
    process.exit();
});