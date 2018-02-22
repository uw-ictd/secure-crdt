package main

import (
	"fmt"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	"github.com/hyperledger/fabric/protos/peer"
)

// Account manages a user account registration
type UserAccount struct {
}

// Init is called during chaincode instantiation to initialize any
// data. Note that chaincode upgrade also calls this function to reset
// or to migrate data, so be careful to avoid a scenario where you
// inadvertently clobber your ledger's data!
func (t *UserAccount) Init(stub shim.ChaincodeStubInterface) peer.Response {
	// Get the args from the transaction proposal
	args := stub.GetStringArgs()
	if len(args) != 2 {
		return shim.Error("Incorrect arguments! Expecting a unique userId and a public key")
	}

	// Set up any variables or assets here by calling stub.PutState()

	// We store the key and the value on the ledger.
	err := stub.PutState(args[0], []byte(args[1]))
	if err != nil {
		return shim.Error(fmt.Sprintf("Failed to create asset: %s", args[0]))
	}
	return shim.Success(nil)
}


// main function starts up the chaincode in the container during instantiate
func main() {
    if err := shim.Start(new(UserAccount)); err != nil {
            fmt.Printf("Error starting UserAccount chaincode: %s", err)
    }
}
