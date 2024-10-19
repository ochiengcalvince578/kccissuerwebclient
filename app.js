const express = require('express')
const bodyParser = require('body-parser');
const axios = require('axios');
const { Web5 } = require('@web5/api');
const { DidDht } = require('@web5/dids');
const { VerifiableCredential } = require ("@web5/credentials");

const app = express();
const port = 3000;

const protocolDefinition = {
  "protocol": "https://vc-to-dwn.tbddev.org/vc-protocol",
  "published": true,
  "types": {
    "credential": {
      "schema": "https://vc-to-dwn.tbddev.org/vc-protocol/schema/credential",
      "dataFormats": [
        "application/vc+jwt"
      ]
    },
    "issuer": {
      "schema": "https://vc-to-dwn.tbddev.org/vc-protocol/schema/issuer",
      "dataFormats": [
        "text/plain"
      ]
    },
    "judge": {
      "schema": "https://vc-to-dwn.tbddev.org/vc-protocol/schema/judge",
      "dataFormats": [
        "text/plain"
      ]
    }
  },
  "structure": {
    "issuer": {
      "$role": true
    },
    "judge": {
      "$role": true
    },
    "credential": {
      "$actions": [
        {
          "role": "issuer",
          "can": [
            "create"
          ]
        },
        {
          "role": "judge",
          "can": [
            "query",
            "read"
          ]
        }
      ]
    }
  }
}

let issuerDidUri = null;


let customerDidUri = "did:dht:rr1w5z9hdjtt76e6zmqmyyxc5cfnwjype6prz45m6z1qsbm8yjao";

let vc = null;

let vcType = null;

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static('public'));

app.get('/', (req, res) => {
    res.render('index');
});

// Create DID Route
app.get('/createDid', (req, res) => {
    res.render('createDid');
});

app.post('/createDid', async (req, res) => {
    // const web5 = new Web5();
    // const { did } = await web5.did.create();
    // const didHt = new DidDht();
    // const did = await didHt.create({ publish: true });
    const didDht = await DidDht.create({ publish: true });
    res.render('createDid', { did : didDht.uri});
});

// Create DWN Route
app.get('/createDwn', (req, res) => {
    

    res.render('createDwn', { did: null, error: null });
});

app.post('/createDwn', async (req, res) => {
    try {
      const { did, web5 } = await Web5.connect({
        didCreateOptions: {
          dwnEndpoints: ['https://dwn.gcda.xyz']
        },
      });
      
    
      const dwn = web5.dwn;

      console.log(dwn, did);

      issuerDidUri = did;


      const { protocol, status } = await web5.dwn.protocols.configure({
        message: {
          definition: protocolDefinition
        }
    });
    
    console.log("configured protocol", protocol)

    console.log("status", status.detail);
    //sends protocol to remote DWNs immediately (vs waiting for sync)
    await protocol.send(issuerDidUri);
  
      // Render the createDwn EJS view with the appropriate variables
      res.render('createDwn', { dwn, did, error: null });
      
    } catch (error) {
      console.error('Failed to create DWN:', error);
      res.render('createDwn', { dwn: null, did: null, error: 'Failed to create DWN. Please try again.' });
    }
  });
  
  

// Manage DIDs Route
app.get('/manageDids', (req, res) => {
    res.render('manageDids');
});

// Manage DWNs Route
app.get('/manageDwns', (req, res) => {
    res.render('manageDwns');
});

app.get('/issueKcc', (req, res) => {
    // Render the form before issuing a KCC
    res.render('issueKcc', { kccIssuanceDate: null, kccEvidenceType: null, error: null });
  });

app.post('/issueKcc', async (req, res) => {
    
    try {
    
    const known_customer_credential = await VerifiableCredential.create({
        issuer: issuerDidUri, // Issuer's DID URI
        subject: customerDidUri, // Customer's DID URI 
        expirationDate: '2026-05-19T08:02:04Z',
        data: {
          countryOfResidence: "US", // 2 letter country code
          tier: "Gold", // optional KYC tier
          jurisdiction: { 
            country: "US" // optional 2 letter country code where IDV was performed
          }
        },
        credentialSchema: [
          {
            id: "https://vc.schemas.host/kcc.schema.json", // URL to the schema used
            type: "JsonSchema", // Format type of the schema used for the KCC
          }
        ],
        // (optional) Evidence describing the due diligence performed to verify the identity of the known customer
        evidence: [
          {
            "kind": "document_verification",
            "checks": ["passport", "utility_bill"]
          },
          {
            "kind": "sanction_screening",
            "checks": ["PEP"]
          }
        ]
      });


      //known_customer_credential.

    
      //vc = await known_customer_credential.sign(issuerDidUri)

       //vcType = known_customer_credential.type;
       
       //console.log("vc", vc);
       //console.log("vcType", vcType);

       

      console.log(known_customer_credential.vcDataModel.evidence[0]);
    
      res.render('issueKcc',{kccIssuanceDate: known_customer_credential.vcDataModel.issuanceDate, kccEvidenceType: known_customer_credential.vcDataModel.evidence[0], error:null})
    }

    catch (e) {
        console.error('Failed to issue Kcc:', error);

        res.render('error', { message: error.message });
    }
});

app.post('/contactAlice', async (req, res) => {
  try {
    const url = `https://vc-to-dwn.tbddev.org/authorize?issuerDid=${issuerDidUri}`;
    
    const response = await axios.get(url);
    
    console.log('Authorization Response:', response.data);
    //res.render('authorizeDwn', { data: response.data });
    
} catch (error) {
    console.error('Failed to authorize:', error);
    //res.render('authorizeDwn', { error: 'Failed to authorize DWN. Please try again.' });
}
})

app.post('/storeVc', async (req, res) => {
  try {
 
    const { record } = await web5.dwn.records.create({
      data: vc,
      message: {
        schema: vcType,
        dataFormat: 'application/vc+jwt',
      },
    });
    

    console.log("success stored vc", record)
    // (optional) immediately send record to users remote DWNs
    const { status } = await record.send(customerDidUri);

    console.log("success sent vc", status);

  } catch (error) {

    console.error('Failed to store Vc:', error);
    
  }
})

// Start the server
app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
