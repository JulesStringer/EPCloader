const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const ExcelJS = require('exceljs');
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
        const sortedValues = Array.from(uniqueValues).sort();
        
        // Create header row
        const header = ['Area Code', ...sortedValues];
        worksheet.addRow(header);

        // Populate data rows
        for (const [areaCode, areaMap] of data.entries()) {
            const rowData = [areaCode];
            const attributeMap = areaMap.get(attribute);
            if ( attribute === 'certificates' ){
                let count = parseInt(attributeMap);
                rowData.push(count || 0);
            } else {
                for (const value of sortedValues) {
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
                                if ( config.attribute_handling[attribute]){
                                    let nv = config.attribute_handling[attribute].mapping[attributeValue];
                                    if ( nv ){
                                        attributeValue = nv;
                                    }
                                }
                                // Use the rating as a key and increment its count
                                if (!areaMap.has(attribute)) {
                                    areaMap.set(attribute, new Map());
                                }
                                const ratingMap = areaMap.get(attribute);
                                ratingMap.set(attributeValue, (ratingMap.get(attributeValue) || 0) + 1);

                                if ( !allMap.has(attribute)) {
                                    allMap.set(attribute, new Map());
                                }
                                const all_ratingMap = allMap.get(attribute);
                                all_ratingMap.set(attributeValue, (all_ratingMap.get(attributeValue) || 0) + 1);
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
        let areaData = await process_csv(filePath);
        console.log('-----------------------------------');
        console.log('CSV file processing complete!');
        console.log('-----------------------------------');
        console.log(`Total records processed: ${recordCount}`);
        console.log(`Total unique Buildings EPCs: ${uniqueBuilding.size}`);
        console.log(`Total records with no UPRN: ${no_uprn_count}`);
        // Generate and write the output files
        await generateJsonOutput(areaData);
        const allAttributesToSummarize = [...config.attributes /*, ...config.recommendations, ...config.features*/];
        await generateXlsxOutput(areaData, allAttributesToSummarize);
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
}
run().then(() => {
    console.log('Summary complete.');
}).catch(err => {
    console.error('Error summarising area:', err);
});
// Ability to put aa spreadsheet on a map - as a plug-in