// all necessary imports
const express = require('express');
const app = express();
const xrpl = require('xrpl');
const crypto = require('crypto');

// middleware declaration
// app.use(cors({origin: true, credentials: true}));
app.use(express.json());


async function main() {
    const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
    await client.connect()
    const fund_result = await client.fundWallet()
    const client_wallet = fund_result.wallet
    // const client_wallet = xrpl.Wallet.generate()
    // console.log(fund_result)
    console.log(client_wallet)

    // company wallet
    const company = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
    await company.connect()
    const company_fund_result = await company.fundWallet()
    const company_wallet = company_fund_result.wallet
    // const company_wallet = xrpl.Wallet.generate()
    console.log(company_wallet)

    const release_date_unix = Math.floor( new Date("2017-11-13T00:00:00Z") / 1000 );
    const release_date_ripple = release_date_unix - 946684800;
    const finish_time = release_date_ripple + 604800 // current time + 7 days

    // call Yash's api to get company code
    // for now, it is a constant
    const code = "testingcode"
    const hash = crypto.createHash('sha256').update(code).digest('hex'); 
    // Set condition as the raw hash 
    const condition = hash;

    console.log("prepared getting ready")
    const prepared = await client.autofill(
    {
        "Account": client_wallet.address,
        "TransactionType": "EscrowCreate",
        "Amount": "10000",
        "Destination": company_wallet.address,
        // "CancelAfter": 533257958,
        "FinishAfter": finish_time,
        "Condition": condition,
    })
    console.log( "Prepared transaction done")
    // swipeLeft(client_wallet, company_wallet)
    const signed = client_wallet.sign(prepared)
    try {
        const submit_result = await client.submitAndWait(signed.tx_blob)
        // submitAndWait() doesn't return until the transaction has a final result.
        // Raises XrplError if the transaction doesn't get confirmed by the network.
        // Does not handle disaster recovery.
        console.log("Transaction result:", submit_result)
    } catch(err) {
    console.log("Error submitting transaction:", err)
    }

    await client.disconnect()
    await company.disconnect()
}
main()



async function swipeLeft(user_wallet, company_wallet) {
    // const client; // will be user
    // const user_wallet // another input
    // const company_wallet

    const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
    await client.connect()

    const ledger = await client.request({
        command: 'ledger',
        ledger_index: 'validated'
    })
    console.log(ledger)
    const latest_ledger = ledger.result.ledger.ledger_index
    console.log("Latest validated ledger index:", latest_ledger)
    
    // prepared transaction
    const prepared = await client.autofill({
        "TransactionType": "Payment",
        "Account": user_wallet.address,
        "Amount": "0",
        "Destination": company_wallet.address,
    })
    const max_ledger = prepared.LastLedgerSequence
    console.log("Prepared transaction instructions:", prepared)
    console.log("Transaction cost:", xrpl.dropsToXrp(prepared.Fee), "XRP")
    console.log("Transaction expires after ledger:", max_ledger)

    // signing transaction
    const signed = user_wallet.sign(prepared)
    console.log("Identifying hash:", signed.hash)
    console.log("Signed blob:", signed.tx_blob)

    // submitting transaction(submit only)
    const tx = await client.request({
        "command": "submit",
        "tx_blob": signed.tx_blob
    })
    console.log("Transaction result:", tx)

    return;
}

// function recruiterAccept(user, company) {
//     // Generate a transaction object indicating company's decision to move forward with the user
//     const transaction = {
//         TransactionType: 'RecruiterAcceptance', // Custom transaction type (define your own)
//         Account: company.walletAddress, // Company's wallet address
//         UserID: user.id, // Unique identifier for the user
//         // Add other necessary transaction details
//     };

//     // Sign the transaction with the server wallet's private key
//     const signedTransaction = client.sign(transaction, serverPrivateKey);

//     // Submit the signed transaction to the XRP Ledger
//     client.submit(signedTransaction).then(result => {
//         console.log('Transaction submitted:', result);
//     }).catch(error => {
//         console.error('Error submitting transaction:', error);
//     });
// }

// function userRegistration(user) {
//     const transaction = {
//         TransactionType: 'UserRegistration',
//         Account: user.walletAddress,
//         // Add other necessary transaction details
//     };

//     const signedTransaction = client.sign(transaction, serverPrivateKey);

//     client.submit(signedTransaction).then(result => {
//         console.log('Transaction submitted:', result);
//     }).catch(error => {
//         console.error('Error submitting transaction:', error);
//     });
// }

// // Example usage
// const user = {
//     walletAddress: 'YOUR_USER_WALLET_ADDRESS',
//     // Add other user information
// };

// const job = {
//     id: 'JOB_ID',
//     // Add other job details
// };

// const company = {
//     walletAddress: 'YOUR_COMPANY_WALLET_ADDRESS',
//     // Add other company information
// };

// Use the functions as needed
// swipeLeft(user, job);
// recruiterAccept(user, company);
// userRegistration(user);
