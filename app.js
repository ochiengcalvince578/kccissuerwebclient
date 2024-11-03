const express = require('express');
const bodyParser = require('body-parser');
const axios = require('axios');
const { Web5 } = require('@web5/api');
const { DidDht } = require('@web5/dids');
const expressLayouts = require('express-ejs-layouts');
const { VerifiableCredential } = require("@web5/credentials");

const app = express();
const port = 3000;

app.set('view engine', 'ejs');
app.use(bodyParser.urlencoded({ extended: true }));

app.use(expressLayouts);

app.set('layout', 'layout'); 

app.use(express.static('public'));





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
let web5Instance = null;
let subjectAuthorization = false;
let kccStorage = false; 
let protocolConfigured = false;



app.get('/', (req, res) => {

    res.render('index', { header: 'Home' });
});

app.get('/createDwn', (req, res) => {
    

    res.render('createDwn', { did: null, error: null, title: 'Create DWN' });
});

app.post('/createDwn', async (req, res) => {
  try {
    const useCommunityNode = req.body.useCommunityNode === 'true';

    const { did, web5 } = await Web5.connect({
      didCreateOptions: useCommunityNode
        ? { dwnEndpoints: ['https://dwn.gcda.xyz'] }
        : {}
    });
    
    const dwn = web5.dwn;
    console.log(dwn, did);

    web5Instance = web5;
    issuerDidUri = did;

    const { protocol, status } = await web5.dwn.protocols.configure({
      message: {
        definition: protocolDefinition
      }
    });
    
    if (status.code = 202) {
       protocolConfigured = true;
    }
  
    await protocol.send(issuerDidUri);


    res.render('createDwn', {protocolConfigured: protocolConfigured, dwn, did, error: null });
    
  } catch (error) {
    console.error('Failed to create DWN:', error);
    res.render('createDwn', { dwn: null, did: null, error: 'Failed to create DWN. Please try again.' });
  }
});

  

app.get('/connectionStatus', (req, res) => {
  const isConnected = !!web5Instance; // `true` if connected, `false` otherwise
  res.json({ isConnected });
});


app.get('/issueKcc', (req, res) => {
 
    res.render('issueKcc', { subjectAuthorization: subjectAuthorization, kccStorage: kccStorage, title: 'Issue Kcc', kccIssuanceDate: null, kccId: null, error: null });
  });

app.post('/issueKcc', async (req, res) => {
 
  const { subjectDidUri, countryOfResidence, jurisdiction, tier } = req.body;

    try {
    
    const known_customer_credential = await VerifiableCredential.create({
        issuer: issuerDidUri, 
        subject: subjectDidUri,
        expirationDate: '2026-05-19T08:02:04Z',
        data: {
          countryOfResidence: countryOfResidence, // 2 letter country code
          tier: tier, // optional KYC tier
          jurisdiction: { 
            country: jurisdiction // optional 2 letter country code where IDV was performed
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

    const authData = await authorizeContactAlice();
    console.log('Authorization Data:', authData);
   
    if (authData.status = 200) {
        
        subjectAuthorization = true; 
    }

  
    const storageResult = await storeVerifiableCredential(known_customer_credential);

    if (storageResult.status = 200) {
      
      kccStorage = true;
    
    }
    console.log('Storage Result:', storageResult);

    res.render('issueKcc',{subjectAuthorization: subjectAuthorization, kccStorage: kccStorage, kccIssuanceDate: known_customer_credential.vcDataModel.issuanceDate, kccId: known_customer_credential.vcDataModel.id, error:null})
      
      
    }

    catch (error) {
        console.error('Failed to issue Kcc:', error);

        res.render('error', { message: error.message });
    }
});


async function authorizeContactAlice() {
  const url = `https://vc-to-dwn.tbddev.org/authorize?issuerDid=${issuerDidUri}`;
  const response = await axios.get(url);
  console.log('Authorization Response:', response.data);
  return response.data;
}


async function storeVerifiableCredential(vc) {
  const { record } = await web5Instance.dwn.records.create({
    data: vc,
    message: {
      schema: "https://vc.schemas.host/kcc.schema.json",
      dataFormat: 'application/vc+jwt',
    },
  });
  console.log("Successfully stored VC", record);

  
  const status = await record.send(vc.subject); 
  console.log("VC successfully sent", status);

  return { record, status };
}


app.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
});
