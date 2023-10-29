const xrpl = require("xrpl");
const crypto = require('crypto');
const cc = require('five-bells-condition')

// Example credentials
const client_wallet = xrpl.Wallet.fromSeed("sEdSc1BqrUfa4F2wRnkGDiWCZjVYSPH")
console.log(client_wallet.address) // this is the derived public key 

// Create a wallet and fund it with the Testnet faucet:

const company_wallet = xrpl.Wallet.fromSeed("sEdTNUAND72uAdbw181KSeoi2ovPJkF")
console.log(company_wallet.address) // this is the derived public key 


// Wrap code in an async function so we can use await
async function main() {
    
    // Define the network client
    const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
    await client.connect()
  
    // Construct condition and fulfillment ---------------------------------------
    const preimageData = crypto.randomBytes(32);
    const myFulfillment = new cc.PreimageSha256();
    myFulfillment.setPreimage(preimageData);
    const conditionHex = myFulfillment.getConditionBinary().toString('hex').toUpperCase();

    // Set the escrow finish time --------------------------------------------------
    let finishAfter = new Date((new Date().getTime() / 1000) + 604800); // 7 day from now
    finishAfter = new Date(finishAfter * 1000);
    console.log("This escrow will finish after: ", finishAfter);


    console.log('Condition:', conditionHex);
    console.log('Fulfillment:', myFulfillment.serializeBinary().toString('hex').toUpperCase());

    // Prepare transaction -------------------------------------------------------
    const prepared = await client.autofill({
        "Account": client_wallet.address,
        "TransactionType": "EscrowCancel",
        "Owner": client_wallet.address,
        "OfferSequence": 42433017,
    })

    // {
    //     "TransactionType": "EscrowCreate",
    //     "Account": /* "rwUovZSYAD6DtgAmMR3VxC8TtZAcHrJPLm", */  client_wallet.address,
    //     "Amount": xrpl.xrpToDrops("5"),
    //     "Destination": /* "rQDQytvKuTQ4MrvCBmo5f1WnZkV1dQuwox",  */ company_wallet.address,
    //     // "DestinationTag": 2023,
    //     "Condition": conditionHex,
    //     // "Fee": "12",
    //     "FinishAfter": xrpl.isoTimeToRippleTime(finishAfter.toISOString()), 
    // }

    const max_ledger = prepared.LastLedgerSequence
    console.log("Prepared transaction instructions:", prepared)
    console.log("Transaction cost:", xrpl.dropsToXrp(prepared.Fee), "XRP")
    console.log("Transaction expires after ledger:", max_ledger)

    
    // Sign prepared instructions ------------------------------------------------
    const signed = client_wallet.sign(prepared)
    console.log("Identifying hash:", signed.hash)
    console.log("Signed blob:", signed.tx_blob)
    
    // Submit signed blob --------------------------------------------------------
    try {
        const submit_result = await client.submitAndWait(signed.tx_blob)
        // submitAndWait() doesn't return until the transaction has a final result.
        // Raises XrplError if the transaction doesn't get confirmed by the network.
        // Does not handle disaster recovery.
        console.log("Transaction result:", submit_result)
    } catch(err) {
        console.log("Error submitting transaction:", err)
    }

    // Disconnect when done (If you omit this, Node.js won't end the process)
    client.disconnect()
}
  
  

main()