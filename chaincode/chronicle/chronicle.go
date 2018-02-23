// chronicle logs a set of crdt updates for a particular user
package main

import (
	"encoding/json"
	"fmt"
	"strconv"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	"github.com/hyperledger/fabric/protos/peer"
)

// Chronicle tracks the history of a particular crdt
type ChronicleChaincode struct {
}

// SpecificChronicle organizes all data associated with a single user.
type SpecificChronicle struct {
	Entries []ChronicleEntry `json:"Entries"`
}

// ChronicleEntry represents a single CRDT update.
type ChronicleEntry struct {
	Change int `json:"Change"`
	UniqueId string `json:"UniqueId"`
}

// Init is called during chaincode instantiation to initialize any
// data. Note that chaincode upgrade also calls this function to reset
// or to migrate data, so be careful to avoid a scenario where you
// inadvertently clobber your ledger's data!
func (t *ChronicleChaincode) Init(stub shim.ChaincodeStubInterface) peer.Response {
	// No chaincode level state currently required.
	return shim.Success(nil)
}

// Invoke "record" and "computeResult" operations on the chaincode.
func (t *ChronicleChaincode) Invoke(stub shim.ChaincodeStubInterface) peer.Response {
	// Extract the function and args from the transaction proposal
	fn, args := stub.GetFunctionAndParameters()

	var result string
	var err error
	switch fn {
	case "record":
		result, err = record(stub, args)
	case "computeResult":
		result, err = computeResult(stub, args)
	default:
		return shim.Error(fmt.Sprintf("The provided function \"%s\" is not supported.", fn))
	}

	if err != nil {
		return shim.Error(err.Error())
	}

	// Return the result as success payload
	return shim.Success([]byte(result))
}

// record adds a new element to the ledger for the given key
func record(stub shim.ChaincodeStubInterface, args []string) (string, error) {
	// Parse arguments
	if len(args) != 4 {
		return "", fmt.Errorf("incorrect arguments. Expecting a unique userId, a change, a UID, and the user key")
	}

	userId := args[0]
	uniqueId := args[2]
	change, err := strconv.Atoi(args[1])
	if err != nil {
		return "", fmt.Errorf("error converting argument [%s] to an integer", args[1])
	}

	// TODO(matt9j) Validate the signatures on the update.

	var userChronicle = SpecificChronicle{}
	rawUserChronicle, err := stub.GetState(userId)
	if err != nil {
		return "", fmt.Errorf("error looking up userId [%s]", args[0])
	}
	if rawUserChronicle != nil {
		json.Unmarshal(rawUserChronicle, &userChronicle)
	}

	// Ensure the update is unique.
	// TODO(matt9j) Provide sorting or indexing so this isn't a linear scan.
	for i := 0; i < len(userChronicle.Entries); i++ {
		if userChronicle.Entries[i].UniqueId == uniqueId {
			return "", fmt.Errorf("the crdt entry [%s] has already been committed", uniqueId)
		}
	}

	userChronicle.Entries = append(userChronicle.Entries, ChronicleEntry{Change: change, UniqueId: uniqueId})
	outputBytes, err := json.Marshal(userChronicle)
	if err != nil {
		return "", fmt.Errorf("error serializing new entry")
	}

	stub.PutState(userId, outputBytes)
	return fmt.Sprintf("%s:%d", userId, change), nil
}

// computeResult returns the final result of the specified crdt.
func computeResult(stub shim.ChaincodeStubInterface, args []string) (string, error) {
	rawUserChronicle, err := stub.GetState(args[0])
	if err != nil {
		return "", fmt.Errorf("error looking up userId [%s]", args[0])
	}
	if rawUserChronicle == nil {
		return "", fmt.Errorf("no entry for userId [%s]", args[0])
	}

	userChronicle := SpecificChronicle{}
	json.Unmarshal(rawUserChronicle, &userChronicle)

	// Collapse the CRDT summation
	result := 0
	// TODO(matt9j) Provide sorting or indexing so this isn't a linear scan.
	for i := 0; i < len(userChronicle.Entries); i++ {
		result += userChronicle.Entries[i].Change
	}

	return fmt.Sprintf("%d", result), nil
}

// main function starts up the chaincode in the container during instantiate
func main() {
	if err := shim.Start(new(ChronicleChaincode)); err != nil {
		fmt.Printf("Error starting ChronicleChaincode: %s", err)
	}
}
