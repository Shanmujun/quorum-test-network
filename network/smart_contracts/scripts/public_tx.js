const path = require('path');
const fs = require('fs-extra');
const Web3 = require('web3');

// member1 details
const { tessera, quorum } = require("./keys.js");
const host = quorum.member1.url;
const accountAddress = quorum.member1.accountAddress;

// abi and bytecode generated from simplestorage.sol:
// > solcjs --bin --abi simplestorage.sol
const contractJsonPath = path.resolve(__dirname, '../','contracts','SimpleStorage.json');
const contractJson = JSON.parse(fs.readFileSync(contractJsonPath));
const contractAbi = contractJson.abi;
const contractBytecode = contractJson.evm.bytecode.object
// initialize the default constructor with a value `47 = 0x2F`; this value is appended to the bytecode
const contractConstructorInit = "000000000000000000000000000000000000000000000000000000000000002F";

async function getValueAtAddress(host, deployedContractAbi, deployedContractAddress){
  const web3 = new Web3(host);
  const contractInstance = new web3.eth.Contract(deployedContractAbi, deployedContractAddress);
  const res = await contractInstance.methods.get().call();
  console.log("Obtained value at deployed contract is: "+ res);
  return res
}

async function getAllPastEvents(host, deployedContractAbi, deployedContractAddress){
  const web3 = new Web3(host);
  const contractInstance = new web3.eth.Contract(deployedContractAbi, deployedContractAddress);
  const res = await contractInstance.getPastEvents("allEvents", {
    fromBlock: 0,
    toBlock: 'latest'
  })

  const amounts = res.map(x => {
    return x.returnValues._amount
  });

  console.log("Obtained all value events from deployed contract : [" + amounts + "]");
  return res
}

// You need to use the accountAddress details provided to Quorum to send/interact with contracts
async function setValueAtAddress(host, accountAddress, value, deployedContractAbi, deployedContractAddress){
  const web3 = new Web3(host);
  const contractInstance = new web3.eth.Contract(deployedContractAbi, deployedContractAddress);
  const res = await contractInstance.methods.set(value).send({from: accountAddress, gasPrice: "0x0", gasLimit: "0x24A22"});
  console.log("Set value on contract at : " + res.transactionHash);
  // verify the updated value
  // const readRes = await contractInstance.methods.get().call();
  // console.log("Obtained value at deployed contract is: "+ readRes);
  return res
}

async function createContract(host) {
  const web3 = new Web3(host);
  // make an account and sign the transaction with the account's private key; you can alternatively use an exsiting account
  const account = web3.eth.accounts.create();
  console.log(account);

  const txn = {
    chainId: 1337,
    nonce: await web3.eth.getTransactionCount(account.address),       // 0x00 because this is a new account
    from: account.address,
    to: null,            //public tx
    value: "0x00",
    data: '0x'+contractBytecode+contractConstructorInit,
    gasPrice: "0x0",     //ETH per unit of gas
    gas: "0x2CA51"  //max number of gas units the tx is allowed to use
  };

  console.log("create and sign the txn")
  const signedTx = await web3.eth.accounts.signTransaction(txn, account.privateKey);
  console.log("sending the txn")
  const txReceipt = await web3.eth.sendSignedTransaction(signedTx.rawTransaction);
  console.log("tx transactionHash: " + txReceipt.transactionHash);
  console.log("tx contractAddress: " + txReceipt.contractAddress);
  return txReceipt;
};

async function main(){
  createContract(host)
  .then(async function(tx){
    console.log("Contract deployed at address: " + tx.contractAddress);
    console.log("Use the smart contracts 'get' function to read the contract's constructor initialized value .. " )
    await getValueAtAddress(host, contractAbi, tx.contractAddress);
    console.log("Use the smart contracts 'set' function to update that value to 123 .. " );
    await setValueAtAddress(host, accountAddress, 123, contractAbi, tx.contractAddress );
    console.log("Verify the updated value that was set .. " )
    await getValueAtAddress(host, contractAbi, tx.contractAddress);
    await getAllPastEvents(host, contractAbi, tx.contractAddress);
  })
  .catch(console.error);
}

if (require.main === module) {
  main();
}

module.exports = exports = main

