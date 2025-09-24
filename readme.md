# EPCloader

Scripts to maintain a copy of the latest EPC data for a district  in csv format from [https://epc.opendatacommunities.org](https://epc.opendatacommunities.org). This uses their published API [https://epc.opendatacommunities.org/docs/api/domestic](https://epc.opendatacommunities.org/docs/api/domestic).

A configurable script then summarises this as an xlsx or json output which uses the uprn attribute to look up an area code, such as parish or ward. A geojson file is then generated from the geography specified and the json output.

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
This uses the script summarise_area.js this takes a number of command line arguments:
|argument|content|Example|
|--------|-------|-------|
|datadir=|Full path used to store csv download|~/Projects/maploaders/EPCloader/data|
|code_name=|Attribute name in uprn look for associated area code|PARISH_CODE|
|uprn_lookup=|Full path of attribute lookup file|/mnt/www/stringerhj.co.uk/mapdata/uprn/uprn_lookup.json|
|json_output=|Full path of json output file|~/Projects/maploaders/EPCloader/summaries/summary_by_parish.json|
|xlsx_output=|Full path of xlsx output file|~/Projects/maploaders/EPCloader/summaries/summary_by_parish.xlsx|
|layers=|Full path of layer definitions file|/mnt/www/stringerhj.co.uk/mapdata/layers.json|
|map_output=|key into config.maps for definition of output layer|parish_EPC|
|config=|Full path of config.json path|./config.json (default)|

## config.json
### Configuring summaries
The configuration has the following sections:
#### attributes
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
            },
            "order":*<option from ascending, descending, value, specific>*
            "specific":*[only applies to specific order, in which case it is an array of column headers in the orde they should appear]*
        }
        * or for continous variables *
        *<attribute_name>*{
            "stats":["count","mean","variance","standard-deviation","min","max"]
            * attributes are the above statistics options *
        }
    }
}
```
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
#### maps
Specifies generation of output map layers which merge the geometry of a geography layer and json output.
```json
    "maps":{
        "parish_EPC":{
            "geography":"TeignbridgeParishes",
            "key":"CODE",
            "geography_attributes":["CODE","NAME"]
        },
        "ward_EPC":{
            "geography":"TeignbridgeWards",
            "key":"CODE",
            "geography_attributes":["CODE","NAME"]
        }
    }
```
The map generation process uses the map_output argument to get the maps section, and if found reads the layers file to get the geojson file in the geography attribute. It then iterates through the features of this geojson. For each feature it gets the value of the key attribute and uses this to get the attribute record for that key value; a new feature is formed with the source geometry and properties combined from the attributes specified in geography_attributes in the source geography feature and the attributes of the json output for that key.
The new geojson is then written to a file composed of the base path of the layers file, /epc_data/ and {map_output}.json
If this layer doesn't exist in the layers file an entry for it is added.

## Changes in this release
+ json output merged with a specified map layer
+ version data added to summaries
+ versions file updated for output map layers
+ summary and map only updated if a component has been updated, for summary this is csv or config version, for map this is summary version components or geography version.
26/8/2025
+ update.sh updated to use new UPRN lookup from ONS including OA21, LSOA21 and MSOA21 as well as Ward and Parish.
24/9/2025
+ error_handler used to send error email on failure
+ update.sh changed to use PARISH attribute rather than PAR in uprn lookup to reflect the parish from geocoding using current TeignbridgeParishes.json rather than latest parish code from ONS which is currently different for Newton Abbot and Ogwell.
## Outstanding issues
+ Handle attribute ranges on continuous variables
+ Display as themed maps - how to select area type, attribute and ranges.
+ Configure maplayer generation for ONS census areas as data becomes available.
