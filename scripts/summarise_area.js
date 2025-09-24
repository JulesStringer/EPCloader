const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const ExcelJS = require('exceljs');
const error_handler = require('../../error_handler/error_handler.js');
// Load and parse epc_data.csv
// Get UPRN lookup
// Look up each building's UPRN in the lookup and classify it by
//
// Area code on one dimension and on the other by:
// 1. Current EPC rating
// 2. Potential EPC rating
// 3. Number of certificates
// 4. Primary fuel type
// 5. Counts of top recommendations
//
// Installed heat pumps, solar panels.
//
let datadir = path.join(__dirname, '../data');
let uprn_lookup_file = '/mnt/www/stringerhj.co.uk/mapdata/uprn/uprn_lookup.json';
let layers_file = '/mnt/www/stringerhj.co.uk/mapdata/layers.json';
let map_output = null;
let code_name = 'PARISH_CODE';
let configPath = path.join(__dirname, '../config.json');
// Eliminate second and subsequent duplicate certificates
let uprn_lookup = {};
// These objects will be used to store data for our summary.
let recordCount = 0;
let no_uprn_count = 0;
let uniqueAreaCodes = 0;
let allMap;
const uniqueBuilding = new Set();
const areaData = new Map();

let jsonFilePath = path.join(__dirname, '../data/summary_output.json');
let xlsxFilePath = path.join(__dirname, '../data/summary_output.xlsx');

async function load_uprn_lookup() {
    try {
        const data = await fs.promises.readFile(uprn_lookup_file, 'utf8');
        uprn_lookup = JSON.parse(data);
        console.log('UPRN lookup loaded successfully.');
    } catch (error) {
        console.error('Error loading UPRN lookup:', error);
    }
}
let config = {
    attributes: [
        'current-energy-rating',
        'potential-energy-rating'
    ]
};
async function load_config() {
    try {
        const data = await fs.promises.readFile(configPath, 'utf8');
        config = JSON.parse(data);
    } catch (error) {
        console.error('Error loading config:', error);
    }
}
/**
 * Generates a JSON file from the summarized data.
 * @param {Map} data - The nested Map containing the summary data.
 */
async function generateJsonOutput(data) {
    const outputObject = {};
    for (const [areaCode, areaMap] of data.entries()) {
        const areaObject = {};
        for (const [attribute, valueMap] of areaMap.entries()) {
            if ( attribute === 'certificates' ) {
                areaObject[attribute] = valueMap; // Store the count of certificates directly
            } else if ( typeof valueMap === 'object' && !Array.isArray(valueMap) ) {
                // Convert Map to a plain object for JSON serialization
                areaObject[attribute] = Object.fromEntries(valueMap);
            }
        }
        outputObject[areaCode] = areaObject;
    }
    try {
        await fs.promises.writeFile(jsonFilePath, JSON.stringify(outputObject, null, 2), 'utf8');
        console.log(`JSON output successfully written to ${jsonFilePath}`);
    } catch (err) {
        console.error(`Error writing JSON file: ${err}`);
    }
    return outputObject;
}
/**
 * Generates an XLSX file with each attribute on a separate sheet.
 * @param {Map} data - The nested Map containing the summary data.
 * @param {Array} attributes - An array of attributes to summarize.
 */
async function generateXlsxOutput(data, attributes) {
    const workbook = new ExcelJS.Workbook();
    const allAttributes = ['certificates', ...attributes /*, 'recommendations', 'features'*/];
    
    for (const attribute of allAttributes) {
        if (!data.size) continue;
        
        const worksheet = workbook.addWorksheet(attribute);
        const uniqueValues = new Set();
        
        // Collect all unique values for the current attribute across all area codes
        for (const areaMap of data.values()) {
            const attributeMap = areaMap.get(attribute);
            if ( attribute === 'certificates' ) {
                uniqueValues.add('certificates');
            } else {
                if (attributeMap){
                    if (typeof(attributeMap) === 'object' && !Array.isArray(attributeMap)) {
                        for (const value of attributeMap.keys()) {
                            uniqueValues.add(value);
                        }
                    } else {
                        console.warn(`Expected attributeMap to be an object, but got ${typeof attributeMap} for attribute ${attribute}.`);
                    }
                }
            }
        }
        const areaMap = data.get('all');
        const attributeMap = areaMap.get(attribute);
        //const orderedValues = Array.from(uniqueValues);
        const orderedValues = orderheadings(Array.from(uniqueValues), attribute, config, attributeMap);
        // Create header row
        const header = ['Area Code', ...orderedValues];
        worksheet.addRow(header);

        // Populate data rows
        for (const [areaCode, areaMap] of data.entries()) {
            const rowData = [areaCode];
            const attributeMap = areaMap.get(attribute);
            if ( attribute === 'certificates' ){
                let count = parseInt(attributeMap);
                rowData.push(count || 0);
            } else {
                for (const value of orderedValues) {
                    rowData.push(attributeMap ? (attributeMap.get(value) || 0) : 0);
                }
            }
            worksheet.addRow(rowData);
        }
    }

    try {
        await workbook.xlsx.writeFile(xlsxFilePath);
        console.log(`XLSX output successfully written to ${xlsxFilePath}`);
    } catch (err) {
        console.error(`Error writing XLSX file: ${err}`);
    }
}

// records are in descending data order so once a UPRN is found it is not looked up again
function applyattribute_to_map(ratingMap,attributeValue, stats){
    if ( stats ){
        ratingMap.set('n', (ratingMap.get('n') || 0) + 1);
        let x = parseFloat(attributeValue);
        let x2 = x * x;
        ratingMap.set('x', (ratingMap.get('x') || 0) + x);
        ratingMap.set('x2', (ratingMap.get('x2') || 0) + x2);
        let min = ratingMap.get('min') || null;
        if ( min == null || min > x) {
            ratingMap.set('min',x);
        }
        let max = ratingMap.get('max') || null;
        if  (max == null ||  max < x) {
            ratingMap.set('max',x);
        }
    } else {
        ratingMap.set(attributeValue, (ratingMap.get(attributeValue) || 0) + 1);
    }
}
async function process_csv(filePath) {
    return new Promise((resolve, reject) => {
        // Create a readable stream from the file path. This is key to
        // processing large files without loading them all into memory.
        fs.createReadStream(filePath)
        // Pipe the readable stream through the 'csv-parser' transform stream.
        // This library automatically handles splitting lines and creating objects
        // based on the CSV headers.
        .pipe(csv())
        // Listen for the 'data' event. This event fires for each row
        // that is successfully parsed into an object.
        .on('data', (data) => {
            // Increment the total record count
            recordCount++;
        
            // Add the UPRN to our Set to track unique values
            let building = data['building-reference-number'];
            let uprn = data['uprn'];
            if ( !uprn ) {
                no_uprn_count++;
            }
            if (building && !uniqueBuilding.has(building)) {
                uniqueBuilding.add(uprn);
                let uprn_data = uprn_lookup[uprn];
                if (uprn_data) {
                    // If the UPRN exists in our lookup, we can use it to classify the
                    // record by area code.
                    let areaCode = uprn_data[code_name];
                    if (areaCode) {
                        // If the area code exists, we can classify the record by it.
                        if (!areaData.has(areaCode)) {
                            areaData.set(areaCode, new Map());
                            uniqueAreaCodes++;
                        }
                        const areaMap = areaData.get(areaCode);
                        areaMap.set('certificates', (areaMap.get('certificates') || 0) + 1);
                        allMap.set('certificates', (allMap.get('certificates') || 0) + 1);
                        // Loop through the configured attributes and summarize them
                        for( const attribute of config.attributes) {
                            let attributeValue = data[attribute];
                            if (attributeValue) {
                                let stats = null;
                                //console.log('Attribute: ' + attribute);
                                if ( config.attribute_handling[attribute]){
                                    let handling = config.attribute_handling[attribute];
                                    if ( handling ){
                                        if ( handling.mapping ){
                                            let nv = handling.mapping[attributeValue];
                                            if ( nv ){
                                                attributeValue = nv;
                                            }
                                        }
                                        stats = handling.stats;
                                    }
                                }
                                // Use the rating as a key and increment its count
                                if (!areaMap.has(attribute)) {
                                    areaMap.set(attribute, new Map());
                                }
                                if ( !allMap.has(attribute)) {
                                    allMap.set(attribute, new Map());
                                }
                                const ratingMap = areaMap.get(attribute);
                                applyattribute_to_map(ratingMap,attributeValue, stats);
                                const all_ratingMap = allMap.get(attribute);
                                applyattribute_to_map(all_ratingMap,attributeValue, stats);
                            }
                        }
                    }
                } else {
                    // If the UPRN does not exist in our lookup, we can log it or handle it as needed.
                    //console.warn(`UPRN ${uprn} not found in lookup.`);
                    no_uprn_count++;
                }
            }
        })
        // Listen for the 'end' event. This fires once the entire file has been processed.
        .on('end', () => {
            resolve(areaData);
        })    // Listen for the 'error' event to catch any issues during file reading.
        .on('error', (err) => {
            console.error('An error occurred:', err);
            reject(err); // Reject the promise if an error occurs.
        });
        // Resolve the promise once the stream ends.
        //resolve();
    });
}
function orderheadings(keys, attribute, config, attributeMap){
    let attribute_handling = config.attributes.includes(attribute) &&
                             config.attribute_handling[attribute];
    switch(attribute_handling.order){
        case 'ascending':
            keys = keys.sort(function(a,b){
                return a > b ? 1 : -1;
            });
            break;
        case 'descending':
            keys = keys.sort(function(a,b){
                return b > a ? 1 : -1;
            });
            break;
        case 'value':
            let values = [];
            for(let key of keys){
                let value = {
                    k : key,
                    v : attributeMap.get(key)
                }
                values.push(value);
            }
            values.sort( function(a, b){
                return b.v - a.v;
            });
            keys = [];
            for ( let v of values){
                keys.push(v.k);
            }
            break;
        case 'specific':
            keys =  attribute_handling.specific;
            break;
        default:
            break;
    }
    return keys;
}
/**
 * A utility script to perform post-processing on the aggregated area data.
 * This function calculates final statistics for continuous variables and
 * returns a new Map with the calculated data.
 * @param {Map} areaData The Map containing all the aggregated data, where keys are area codes.
 * @param {object} config The configuration object used during processing.
 * @returns {Map} A new Map with the final calculated statistics.
 */
function calculateStats(areaData, config) {
    // Create a new Map to hold the final results, maintaining the original structure.
    const finalResultsMap = new Map();

    // Iterate through all area codes and their data maps.
    for (const [areaCode, areaMap] of areaData.entries()) {
        const areaOutputMap = new Map();
        
        // Iterate through all attributes for the current area.
        for (const [attribute, attributeMap] of areaMap.entries()) {
            // Check if the attribute is configured for continuous stats.
            const statsConfig = config.attributes.includes(attribute) && 
                              config.attribute_handling[attribute] && 
                              config.attribute_handling[attribute].stats;
            if (statsConfig) {
                // If it's a continuous variable, calculate the final stats.
                const n = attributeMap.get('n') || 0;
                const x = attributeMap.get('x') || 0;
                const x2 = attributeMap.get('x2') || 0;
                const min = attributeMap.get('min');
                const max = attributeMap.get('max');

                let mean = 0;
                let variance = 0;
                let sd = 0;
                
                if (n > 0) {
                    mean = x / n;
                    // This is a sample so we want the sample variance
                    variance = (x2 - n * (mean * mean))/(n-1);
                    sd = Math.sqrt(variance);
                }

                // Store the calculated stats in a new Map.
                const statsMap = new Map();
                for(const att of statsConfig){
                    switch(att){
                        case 'count':
                            statsMap.set('count', n);
                            break;
                        case 'mean':
                            statsMap.set('mean', mean);
                            break;
                        case 'variance':
                            statsMap.set('variance', variance);
                            break;
                        case 'standard-deviation':
                            statsMap.set('standard-deviation', sd);
                            break;
                        case 'min':
                            statsMap.set('min', min);
                            break;
                        case 'max':
                            statsMap.set('max', max);
                            break;
                    }
                }
                areaOutputMap.set(attribute, statsMap);
            } else {
                // If it's a discrete variable, copy the counts directly.
                // Since the original attributeMap is already a Map, we can clone it.
                if ( attribute === 'certificates'){
                    areaOutputMap.set(attribute, attributeMap);
                } else {
                    let keys = Array.from(attributeMap.keys());
                    keys = orderheadings(keys, attribute, config, attributeMap);
                    let attMap = new Map();
                    for ( const key of keys){
                        attMap.set(key, attributeMap.get(key));
                    }
                    areaOutputMap.set(attribute, attMap);
                }
            }
        }
        // Add the processed area data Map to the final results Map.
        finalResultsMap.set(areaCode, areaOutputMap);
    }
    
    // Return the new Map object.
    return finalResultsMap;
}
async function getgeography_version(file_path){
    // get directory path
    let versions_file = path.join(path.dirname(file_path),'versions.json');
    let versions_data = await fs.promises.readFile(versions_file).catch(err => {
        if ( err.code == 'ENOENT'){
            return '{}';
        }else{
            throw err;
        }
    });
    let versions = JSON.parse(versions_data);
    let file_name = path.basename(file_path);
    let version = versions[file_name];
    if ( !version ){
        return '{}';
    }
    return version;
}
async function update_versions(out_file, result_version){
    let versions_file = path.join(path.dirname(out_file),'versions.json');
    let versions_data = await fs.promises.readFile(versions_file).catch(err => {
        if ( err.code == 'ENOENT'){
            return '{}';
        }else{
            throw err;
        }
    });
    let versions = JSON.parse(versions_data);
    let file_name = path.basename(out_file);
    versions[file_name] = result_version;
    await fs.promises.writeFile(versions_file,JSON.stringify(versions));
}

async function generatemap(config, map_output, layers_file, jsonFilePath, version){
    if ( map_output ){
        let json_data = await fs.promises.readFile(jsonFilePath).catch(err => {
            if ( err.code == 'ENOENT'){
                console.log(jsonFilePath + ' not found');
                throw err;
            }
            throw err;
        });
        let jsonOutput = JSON.parse(json_data);
        let layerdata = await fs.promises.readFile(layers_file);
        let layers = JSON.parse(layerdata);
        if ( config.maps && config.maps[map_output]){
            let map = config.maps[map_output];
            let geography_layer = layers[map.geography];
            // get geography version and target version
            let geo_version = await getgeography_version(geography_layer.path);
            let out_dir = path.join(path.dirname(layers_file),'epc_data');
            let out_file = path.join(out_dir,map_output + '.json'); 
            let out_version = await getgeography_version(out_file);
            let changed = false;
            if ( out_version.geography !== geo_version.version ){
                changed = true;
                console.log('geography changed - out_version.geography: ' + out_version.geography + ' geo_version.version ' + geo_version.version);
            }
            if ( out_version.csv_updated !== version.csv_updated ){
                changed = true;
                console.log('csv changed out_version.csv_updated: ' + out_version.cs_updated + ' version.csv_updated: ' + version.csv_updated);
            }
            if ( out_version.config_version !== version.config_version ){
                changed = true;
                console.log('Config changed');
            }
            if ( !changed ){
                console.log('Map unchanged');
            }
            if ( changed ){
                console.log('Source layer ' + map.geography);
                console.log('Source path: ' + geography_layer.path);
                console.log('Generating map layer ' + map_output);
                // get geography_data
                let geography_data = await(fs.promises.readFile(geography_layer.path));
                let geography = JSON.parse(geography_data);
                result = {
                    type: "FeatureCollection",
                    name: map_output,
                    crs: {
                        type: "name",
                        properties: {
                            name: "urn:ogc:def:crs:EPSG::27700"
                        }
                    },
                    features: [
                    ]
                };
                for(let feature of geography.features){
                    let key = feature.properties[map.key];
                    if ( jsonOutput[key]){
                        let properties = {};
                        for(let att in map.geography_attributes){
                            let attval = map.geography_attributes[att];
                            properties[att] = feature.properties[attval];
                        }
                        let epcdata = jsonOutput[key];
                        for(let att in epcdata){
                            properties[att] = epcdata[att];
                        }
                        let epc_feature = {
                            type: "Feature",
                            properties: properties,
                            geometry: feature.geometry
                        };
                        result.features.push(epc_feature);
                    } else {
                        console.log('Not EPC data for ' + key);
                    }
                }
                let layer = {
                    path: out_file,
                    location:"local"
                }
                if ( layers[map_output]){
                    layer = layers[map_output];
                    // if layer definition has been changed manually it could be different from the default
                }
                out_file = layer.path;
                out_dir = path.dirname(out_file);
                // check outdir exists
                await fs.promises.access(out_dir).catch(async(err) => {
                    if ( err.code == 'ENOENT'){
                        console.log('Creating ' + out_dir);
                        await fs.promises.mkdir(out_dir);
                        return;
                    } else {
                        throw err;
                    }
                });
                await fs.promises.writeFile(out_file, JSON.stringify(result));
                if ( !layers[map_output]){
                    console.log('Adding ' + map_output + ' to layers.json');
                    layers[map_output] = layer;
                    await fs.promises.writeFile(layers_file, JSON.stringify(layers));
                }
                // write versions file
                let d = new Date();
                let version_string = d.toISOString().split('T')[0];
                let result_version = {
                    version: version_string,
                    loaded: d.toISOString(),
                    csv_updated: version.csv_updated,
                    config_version:version.config_version,
                    geography: geo_version.version
                };
                await update_versions(out_file, result_version);
            }
        }
    }
}
async function getcsv_version(datadir){
    let versionfile = path.join(datadir, 'version.json');
    let versiondata = await fs.promises.readFile(versionfile).catch(err => {
        if ( err.code == 'ENOENT'){
            return '{}';
        } else {
            throw err;
        }
    });
    return JSON.parse(versiondata);
}
async function getsummary_version(versionfile){
    let versiondata = await fs.promises.readFile(versionfile).catch(err => {
        if ( err.code == 'ENOENT'){
            return '{}';
        } else {
            throw err;
        }
    });
    return JSON.parse(versiondata);
}
async function run(){
    await load_config();
    await load_uprn_lookup();
    if (!areaData.has['all']){
        areaData.set('all', new Map());
    }
    allMap = areaData.get('all');

    let filePath = path.join(datadir, 'epc_data.csv');
    if (fs.existsSync(filePath)) {
        console.log(`Processing file: ${filePath}`);
        // get source version
        let csv_version = await getcsv_version(datadir);
        // get summary version
        let versionfile = path.join(path.dirname(jsonFilePath),'version.json');
        let version = await getsummary_version(versionfile);
        let changed = false;
        // Check csv source version
        if ( version.csv_updated != csv_version.updatedDate  ){
            console.log('csv versions differ version.csv_updated: ' + version.csv_updated + ' csv_version.csv_updated: ' + csv_version.updatedDate);
            changed = true;
        }
        // Check config version
        if ( version.config_version !== config.version ){
            console.log('Config versions differ version.config_verion: ' + version.config_version + ' config.version: ' + config.version);
            changed = true;
        }
        // Check that output files exist
        await fs.promises.access(xlsxFilePath,fs.constants.R_OK).catch(err => {
            if ( err.code === 'ENOENT'){
                changed = true;
                return;
            }
            throw err;
        });
        await fs.promises.access(jsonFilePath,fs.constants.R_OK).catch(err => {
            if ( err.code === 'ENOENT'){
                changed = true;
                return;
            }
            throw err;
        });
        if ( changed ) {
            console.log("csv data updated or config change - updating summaries");
            let areaData = await process_csv(filePath);
            console.log('got areaData from process_csv');
            let newAreaData = calculateStats(areaData, config);
            console.log('-----------------------------------');
            console.log('CSV file processing complete!');
            console.log('-----------------------------------');
            console.log(`Total records processed: ${recordCount}`);
            console.log(`Total unique Buildings EPCs: ${uniqueBuilding.size}`);
            console.log(`Total records with no UPRN: ${no_uprn_count}`);
            // Generate and write the output files
            let jsonOutput = await generateJsonOutput(newAreaData);
            const allAttributesToSummarize = [...config.attributes /*, ...config.recommendations, ...config.features*/];
            await generateXlsxOutput(newAreaData, allAttributesToSummarize);
            // write summary version
            version = {
                csv_updated: csv_version.updatedDate,
                config_version: config.version
            };
            await fs.promises.writeFile(versionfile, JSON.stringify(version));
        }
        // merge geoJSON with map if available
        await generatemap(config, map_output, layers_file, jsonFilePath, version);
    } else {
        console.error(`File not found: ${filePath}`);
    }
}
const args = process.argv.slice(2);
for(const arg of args){
    if(arg.startsWith('datadir=')){
        let d = arg.split('=')[1];
        datadir = d;
    }
    if ( arg.startsWith('uprn_lookup=')) {
        uprn_lookup_file = arg.split('=')[1];
    }
    if ( arg.startsWith('code_name=')) {
        code_name = arg.split('=')[1];
    }
    if ( arg.startsWith('config=')) {
        configPath = arg.split('=')[1];
    }
    if ( arg.startsWith('json_output=')) {
        jsonFilePath = arg.split('=')[1];
    }
    if ( arg.startsWith('xlsx_output=')) {
        xlsxFilePath = arg.split('=')[1];
    }
    if ( arg.startsWith('layers=')){
        layers_file = arg.split('=')[1];
    }
    if ( arg.startsWith('map_output=')){
        map_output = arg.split('=')[1];
    }
}
run().then(() => {
    console.log('Summary complete.');
}).catch(err => {
    error_handler.send_error_email(err, "EPC Loader summarise_area error");
    console.error('Error summarising area:', err);
});
// Ability to put aa spreadsheet on a map - as a plug-in