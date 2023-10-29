const xrpl = require("xrpl");
const crypto = require('crypto');
const cc = require('five-bells-condition')
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
dotenv.config();
const bcrypt = require('bcrypt');
const salt = bcrypt.genSaltSync(10);
const express = require('express');
const app = express();
const cookieParser = require('cookie-parser');

const User = require('./models/user');
const Job = require('./models/jobpostings');

app.use(express.json());
app.use(cors({origin: true, credentials: true}));
app.use(cookieParser());


app.get('/api', (req, res) => {
    res.status(200).json({"msg":"hello from api"});
    console.log('Hello World from shane api')
})
app.get('/api/getinfo', (req, res) => {
    const { user } = req.cookies;
    console.log(user);
    const myArray = user.split('%20');
    res.json({"username":myArray[0], "seed":myArray[1], "applicant":myArray[2]});
})

app.post('/api/getuser', async (req, res) => {
    const { id } = req.body;
    const userDoc = await User.findById(id);
    if(userDoc === null){res.status(400).json({});}
    res.json(userDoc);
})

app.post('/api/login', async (req,res) => {
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
    const {username, password} = req.body;
    try {
        // const userDoc = await User.findOne({username: username});
        const userDoc = await User.findOne({username: username});
        if(userDoc === null){
            res.status(400).json('User Does not Exist')
            return;
        }
        const pwcompare = bcrypt.compareSync(password, userDoc.password);
        if(pwcompare){
            /* jwt.sign({ username:username, id:userDoc._id }, process.env.JWT_PRIVATE_KEY, {}, function(err, token) {
                if(err){
                    res.status(500).json({error_message: err});
                }
                let expirationDate = new Date();
                expirationDate.setTime(expirationDate.getTime() + (15 * 60 * 1000));
                // res.cookie('token', token, { expires: expirationDate }).json(userDoc);
                res.cookie('token', token, { httpOnly: true, expires: expirationDate, sameSite: 'none', secure: true}).json(userDoc);
            }); */
            res.cookie('user', `${username} ${userDoc.seed} ${userDoc.applicant}`, {
                httpOnly: true, 
                maxAge: 3600000 // 1 hour in milliseconds
              });
            res.status(200).json({"username":username, "seed":userDoc.seed, "applicant":userDoc.applicant});
        } else {
            res.status(400).json('Wrong Credentials');
        }
    } catch (error) {
        res.status(500).send(error);
    }
})  

app.post('/api/signup', async (req,res) => {
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
    const {username, password, displayname, applicant} = req.body;
    try {
        const hashedpw = bcrypt.hashSync(password, salt);
        const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
        await client.connect()
        const fund_result = await client.fundWallet()
        const client_wallet = fund_result.wallet
        console.log(client_wallet)
        const newUser = await User.create({
            username: username,
            password: hashedpw,
            displayname: displayname,
            seed: client_wallet.seed,
            applicant: applicant,
        });
        res.status(200).json({"s_key": client_wallet.seed});
        // res.json(newUser);
    } catch (error) {
        res.status(400).json({error_message: error});
    }
})

app.post('/api/postjob', async (req,res) => {
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
    const {company,role,description,location,salary,skills, seed} = req.body;  
    
    try {
        const newJob = await Job.create({
            company: company,
            role: role,
            description: description,
            location: location,
            salary: salary,
            skills: skills,
            creater_s_key: seed
        });
        res.status(200).json({"msg": "job posting completed"});
    } catch (error) {
        res.status(400).json({error_message: error});
    }
})

app.get('/api/getlisting', async (req, res) => {
    mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
    try {
        const jobDocs = await Job.find().sort({ createdAt: -1 }).limit(10);
        res.status(200).json(jobDocs);
    } catch (error) {
        res.status(400).json({ error_message: error });
    }
})

app.post('/api/getallapp', async (req, res) => {
    await mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
    const { objectId } = req.body;
  
    try {
      const jobDocs = await Job.findById( objectId );
        if (!jobDocs) {
            return res.status(404).json({ message: 'Job not found' });
        }
        console.log(jobDocs);
      res.status(200).json(jobDocs.applicants); 
    } catch (error) {
      res.status(400).json({ errorMessage: error.message });
    }
  })

app.post('/api/getmypost', async (req, res) => {

    mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
  
    const {privatekey} = req.body;
    console.log(privatekey)
    try {
      const job = await Job.find({
        creater_s_key: privatekey 
      });
  
      if (!job) {
        return res.status(404).json({message: 'Job not found'});
      }
      res.json(job);
  
    } catch (error) {
      console.error(error);
      res.status(500).json({message: 'Server error'});
    }
  
  });
// used when making acccount. It will provide you a blockchain wallet unique to you
app.get('/api/makeaccount', async(req, res) => {
    const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
    await client.connect()
    const fund_result = await client.fundWallet()
    const client_wallet = fund_result.wallet
    console.log(client_wallet)
    res.status(200).json({"s_key": client_wallet.seed});
})

app.post('/api/getapplicationhistory', async (req, res)  => {
    await mongoose.connect(process.env.MONGODB_CONNECTION_STRING);
    const { privatekey } = req.body;

    const userDoc = await User.findOne({seed : privatekey});
    if(userDoc === null){return;}
    const jobDocs = await Job.find({applicants: userDoc._id});
    res.status(200).json(jobDocs);
})

// used when the job item is swiped left(showing interest)
// it will return escrow sequence number for escrow cancel operation
app.post('/api/jobinterest', async(req, res) => {
    console.log(req.body)
    const {s_key_user, s_key_comp} = req.body
    console.log(s_key_user, s_key_comp);
    
    
    
    const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
    await client.connect()
    const client_wallet = xrpl.Wallet.fromSeed(s_key_user)
    const company_wallet = xrpl.Wallet.fromSeed(s_key_comp)
    
    // Construct condition and fulfillment ---------------------------------------
    const preimageData = crypto.randomBytes(32);
    const myFulfillment = new cc.PreimageSha256();
    myFulfillment.setPreimage(preimageData);
    const conditionHex = myFulfillment.getConditionBinary().toString('hex').toUpperCase();
    
    // Set the escrow finish time --------------------------------------------------
    let finishAfter = new Date((new Date().getTime() / 1000)); // 0 day from now
    finishAfter = new Date(finishAfter * 1000);
    console.log("This escrow will finish after: ", finishAfter);
    
    
    console.log('Condition:', conditionHex);
    console.log('Fulfillment:', myFulfillment.serializeBinary().toString('hex').toUpperCase());
    
    // Prepare transaction -------------------------------------------------------
    const prepared = await client.autofill({
        "TransactionType": "EscrowCreate",
        "Account": /* "rwUovZSYAD6DtgAmMR3VxC8TtZAcHrJPLm", */  client_wallet.address,
        "Amount": xrpl.xrpToDrops("5"),
        "Destination": /* "rQDQytvKuTQ4MrvCBmo5f1WnZkV1dQuwox",  */ company_wallet.address,
        // "DestinationTag": 2023,
        "Condition": conditionHex,
        // "Fee": "12",
        "CancelAfter": xrpl.isoTimeToRippleTime(finishAfter.toISOString()), 
    })
    
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
        const escrowSeq = submit_result.result.Sequence
        // submitAndWait() doesn't return until the transaction has a final result.
        // Raises XrplError if the transaction doesn't get confirmed by the network.
        // Does not handle disaster recovery.
        console.log("Transaction result:", submit_result)
        res.status(200).json({"msg":"transaction done", "escrowSeq": escrowSeq});
    } catch(err) {
        console.log("Error submitting transaction:", err)
        res.status(400).json({"msg":"transaction faiiled"});
    }
    
    const userDoc = await User.findOne({seed : s_key_user});
    if(userDoc === null){return;}
    // const jobDoc = await Job.findOne({creater_s_key: s_key_comp});
    Job.updateOne({creater_s_key: s_key_comp}, {$push: {applicants: userDoc._id}});
    console.log("updated")

    // errorneous
    // const user = await User.findOne({seed : s_key_user});

    // // Get job document
    // const job = await Job.findById({creater_s_key: s_key_comp});

    // // Push user into applicants array 
    // job.updateOne({
    //     $push: {
    //         applicants: user._id 
    //     }
    // });
    // job.save();
    // Disconnect when done (If you omit this, Node.js won't end the process)
    client.disconnect()
})

// used when recruiter check job applicant's profile and decide to hire/not hire
app.post('/api/jobdecisionchecked', async(req, res) => {
    const {s_key_user, sequence_num} = req.body

    const client = new xrpl.Client("wss://s.altnet.rippletest.net:51233")
    await client.connect()
    const client_wallet = xrpl.Wallet.fromSeed(s_key_user)

    const prepared = await client.autofill({
        "Account": client_wallet.address,
        "TransactionType": "EscrowCancel",
        "Owner": client_wallet.address,
        "OfferSequence": sequence_num,
    })

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
        res.status(200).json({"msg":"transaction calcelation done"});
    } catch(err) {
        console.log("Error submitting transaction:", err)
        res.status(400).json({"msg":"transaction calcelation failed"});
    }

    // Disconnect when done (If you omit this, Node.js won't end the process)
    client.disconnect()
})

app.listen(4000, () => {
    console.log('Server listening on port 4000');  
});