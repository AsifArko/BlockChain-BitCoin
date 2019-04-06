const express = require('express');
const bodyParser = require('body-parser');
const Blockchain = require('./blockchain');
const uuid = require('uuid/v1');
const port = process.argv[2];
const rp = require('request-promise');

const nodeAddress = uuid().split('-').join("");

const bitcoin = new Blockchain();

// Creating node app
var app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({
    extended: true
}));

// Routes 
// Get the BlockChain
app.get('/blockchain', function (req, res) {
    res.send(bitcoin);
});

// Create a Transaction
app.post('/transaction', function (req, res) {
    // First create new transaction 
    const blockIndex = bitcoin.createNewTransaction(req.body.amount, req.body.sender, req.body.recipient);
    res.json({
        note: `Transaction will be added in block ${blockIndex} .`
    });
});

// Mine block . Create block with proof of work
app.get('/mine', function (req, res) {
    // Get the last block in the blockchain and extract the hash of this block
    const lastBlock = bitcoin.getLastBlock();
    const previousBlockHash = lastBlock['hash'];

    // Generate current block data object
    const currentBlockData = {
        transaction: bitcoin.pendingTransactions,
        index: lastBlock['index'] + 1,
    };

    // Get the appropiate nonce by doing a proof of work
    const nonce = bitcoin.proofOfWork(previousBlockHash, currentBlockData);

    // Generate the current block hash
    const hash = bitcoin.hashBlock(previousBlockHash,currentBlockData,nonce);

    // Create new transaction as a reward for the miner
    bitcoin.createNewTransaction(12.5,"00",nodeAddress);

    // Finally creates the new block
    const newBlock = bitcoin.createNewBlock(nonce,previousBlockHash,hash);

    res.json({
        note:"New block mined successfully",
        block:newBlock,
    })
});

// Register a node and broadcast that node to the entire network
app.post('/register-and-broadcast-node',function(req,res){
    const newNodeUrl = req.body.newNodeUrl;

    // adding the new node url to the Blockchain's NetworkNodes list
    if (bitcoin.networkNodes.indexOf(newNodeUrl) == -1) bitcoin.networkNodes.push(newNodeUrl);

    // Broadcast new node
    const registerNodesPromises = []
    bitcoin.networkNodes.forEach(networkNodeUrl => {
        // Register Node Endpoint '/register-node'
        const requestOptions = {
            uri: networkNodeUrl + '/register-node',
            method:'POST',
            body:{ newNodeUrl:newNodeUrl },
            json:true,
        };

        // Create requests of request.Promise type and push it to an array .
        // Then all the requests will be sent asynchronously and handle further
        registerNodesPromises.push(rp(requestOptions));
    });
    
    Promise.all(registerNodesPromises)
    .then(data =>{
         const bulkRegisterOptions ={
             uri:newNodeUrl + '/register-nodes-bulk',
             method:'POST',
             body:{allNetworkNodes:[ ...bitcoin.networkNodes , bitcoin.currentNodeUrl ]},
             json:true
         };
         return rp(bulkRegisterOptions)
    })
    .then(data => {
        res.json({note:"New node registered with network successfully"})
    })

});

// Register a node in the network
app.post('/register-node',function(req,res){

});

// Register multiple nodes at once
app.post('/register-nodes-bulk',function(){

});

app.listen(port, function () {
    console.log(`Listenning on port  ${port}`);
});