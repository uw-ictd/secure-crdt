// account implements chaincode to manage user key registration
package main

import (
	"encoding/json"
	"fmt"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	"github.com/hyperledger/fabric/protos/peer"
)

// UserAccountChaincode tracks a user account registrations
type UserAccountChaincode struct {
}

// UserAccountData organizes all data associated with a single user.
type UserAccountData struct {
	PublicKey string `json:"PublicKey"`
}

// Init is called during chaincode instantiation to initialize any
// data. Note that chaincode upgrade also calls this function to reset
// or to migrate data, so be careful to avoid a scenario where you
// inadvertently clobber your ledger's data!
func (t *UserAccountChaincode) Init(stub shim.ChaincodeStubInterface) peer.Response {
	// No chaincode level state currently required.
	return shim.Success(nil)
}

// Invoke "register" and "getKey" operations on the chaincode.
func (t *UserAccountChaincode) Invoke(stub shim.ChaincodeStubInterface) peer.Response {
	// Extract the function and args from the transaction proposal
	fn, args := stub.GetFunctionAndParameters()

	var result string
	var err error
	switch fn {
	case "register":
		result, err = register(stub, args)
	case "getPublicKey":
		result, err = getPublicKey(stub, args)
	default:
		return shim.Error(fmt.Sprintf("The provided function \"%s\" is not supported.", fn))
	}

	if err != nil {
		return shim.Error(err.Error())
	}

	// Return the result as success payload
	return shim.Success([]byte(result))
}

// register stores the user (both id and public key) on the ledger. If the key exists,
// it will override the value with the new one.
func register(stub shim.ChaincodeStubInterface, args []string) (string, error) {
	if len(args) != 2 {
		return "", fmt.Errorf("incorrect arguments. Expecting a unique userId and a public key")
	}

	// Test if the user has already been registered.
	probeUser, probeErr := stub.GetState(args[0])
	if probeErr != nil {
		return "", fmt.Errorf("error probing userId [%s] existence", args[0])
	}
	if probeUser != nil {
		return "", fmt.Errorf("the userId [%s] already exists", args[0])
	}

	// Format the new user data
	newUser, jsonErr := json.Marshal(UserAccountData{PublicKey: args[1]})
	if jsonErr != nil {
		return "", fmt.Errorf("failed to marshall user structure")
	}

	err := stub.PutState(args[0], newUser)
	if err != nil {
		return "", fmt.Errorf("failed to set asset: %s", args[0])
	}
	return args[1], nil
}

// getPublicKey returns the publicKey of the specified user.
func getPublicKey(stub shim.ChaincodeStubInterface, args []string) (string, error) {
	if len(args) != 1 {
		return "", fmt.Errorf("incorrect arguments. Expecting a userId")
	}

	value, err := stub.GetState(args[0])
	if err != nil {
		return "", fmt.Errorf("failed to get userId [%s] with error [%s]", args[0], err)
	}
	if value == nil {
		return "", fmt.Errorf("userId not found: [%s]", args[0])
	}

	userData := UserAccountData{}
	json.Unmarshal(value, &userData)

	return string(userData.PublicKey), nil
}

// main function starts up the chaincode in the container during instantiate
func main() {
	if err := shim.Start(new(UserAccountChaincode)); err != nil {
		fmt.Printf("Error starting UserAccountChaincode chaincode: %s", err)
	}
}
