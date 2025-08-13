# EPCloader

Scripts to maintain a copy of the latest EPC data for a district from [https://epc.opendatacommunities.org/docs/api/domestic](https://epc.opendatacommunities.org/docs/api/domestic) in csv format.

## Access to the EPC data
You require a registered account to use this API, and all requests to this API must be authenticated to your account using HTTP Basic Auth. When you requister you will be assigned a Base64-encoded token and an apikey. You should create a hidden file .env in the root of the of EPCloader and put the token in it thus:
```
EPC_DATA_TOKEN= your base64 combined token from the welcome page.
```
## Configuration
The configuration is the local authority code and directory to maintain data in.
This is done by parameters on the command line for running the script fetch_data.js
These are:
+ district or local-authority , the statistical code for the authority of interest (defaults to E07000045 Teignbridge)
+ datadir , the directory to store downloaded EPC csv files and version records.
These parameters are set up update.sh
## Running it
This is run using
```
./update.sh
```
