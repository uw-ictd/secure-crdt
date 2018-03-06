curl localhost:8080/steve -d '{"pubKey":"stevekey"}' -H "Content-Type: application/json"

curl localhost:8080/steve/pubkey

curl localhost:8080/steve/entry -d '{"userKey":"stevekey","uniqueId":"0","change":"10"}' -H "Content-Type: application/json"

curl localhost:8080/steve/balance
