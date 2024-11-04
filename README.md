# KCC Issuance Web Client

* Run `npm install` to install project dependencies and `npm start` to start the server.
* Once running the user should connect to a Decentralized Web Node (DWN), upon which they can `Issue KCC` from a list of avaialable requests.

## Explanation of how DIDs, VCs, and other requirements were used:

* User initates DWN connection, upon which a local DWN instance and Decentralized Identifier (DID) are provisioned.
* Under the hood the DWN is configured to the VC protocol and sent to the remote DWN.
* User initiates KCC issuance to Alice, KCC is generated.
* Under the hood authorization is sought with Alice's DWN and generated kcc sent to Alice'S DWN
* DWN issuance success!!
