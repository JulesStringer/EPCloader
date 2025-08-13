# EPCloader

Scripts to download the latest EPC data for a district from [https://epc.opendatacommunities.org/docs/api/domestic](https://epc.opendatacommunities.org/docs/api/domestic) in csv format.

## Access to the EPC data
You require a registered account to use this API, and all requests to this API must be authenticated to your account using HTTP Basic Auth. When you requister you will be assigned a Base64-encoded token and an apikey. You should create a hidden file .env in the root of the of EPCloader and put the token in it thus:
```
EPC_DATA_TOKEN= your base64 combined token from the welcome page.
```
## Running it

