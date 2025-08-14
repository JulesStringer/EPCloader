# EPCloader

Scripts to maintain a copy of the latest EPC data for a district  in csv format from [https://epc.opendatacommunities.org](https://epc.opendatacommunities.org). This uses their published API [https://epc.opendatacommunities.org/docs/api/domestic](https://epc.opendatacommunities.org/docs/api/domestic).

A configurable script then summarises this as an xlsx or json output which uses the uprn attribute to look up an area code, such as parish or ward.

## Access to the EPC data
You require a registered account to use this API, and all requests to this API must be authenticated to your account using HTTP Basic Auth. When you requister you will be assigned a Base64-encoded token and an apikey. You should create a hidden file .env in the root of the of EPCloader and put the token in it thus:
```
EPC_DATA_TOKEN= your base64 combined token from the welcome page.
```
## Configuring the download
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
This checks that the data is up to date and then summarises it.
## Guidance about the data available
Here is the published guidance, which includes available data fields. [https://epc.opendatacommunities.org/docs/guidance](https://epc.opendatacommunities.org/docs/guidance)

## Summarising the data
The summarise script follows on from downloading the latest csv in update.sh
It is configured by config.json, which enables you to specify which attributes are included in the summary.

### Configuring summaries
The configuration has the following sections:
```
{
    attributes: [
*... list of attribute names to be tabulated ...*
    ],
    attribute_handling:{
        *<attribute_name>*{
            "mapping":{
                *<original_name>*:*<tabulated_name>*,
                ...
            }
        }
    }
}
#### attribute_handling
Specifies processing that it applied to an attribute before / when it is tabulated.
Attribute values encountered in the data can be mapped to replacement values, this enables specific values entered over time to
be grouped together, say for example we want to group all types of mains gas together.
``` 
    "attribute_handling":{
        "main-fuel":{
            "mapping":{
                "mains gas (not community)": "mains gas",
                "mains gas (community)": "mains gas",
                "mains gas - this is for backwards compatibility only and should not be used": "mains gas",
                "Gas: mains gas": "mains gas",
```
## Outstanding issues
+ Handle attribute ranges
+ Display as themed maps - how to select area type, attribute and ranges.
+ sums and averages - on attributes like 