const fs = require('fs');
const path = require('path');
// Load environment variables from .env file
require('dotenv').config({quiet: true}); // This will find the .env file in the root
// A .env file is used to store the token supplied by the Open Data Communities API
// https://epc.opendatacommunities.org/docs/api/domestic
//
const token = process.env.EPC_DATA_TOKEN;

if (token) {
  console.log('Token successfully loaded!');
  // Use the token in your API calls
} else {
  console.error('API token not found!');
}
let headers = {
    'Accept': 'text/csv',
    'Authorization': 'Basic ' + token
};
let datadir = path.join(__dirname, '../data');
// 
const apiUrl = 'https://epc.opendatacommunities.org/api/v1/domestic/search?';

const versionUrl = 'https://epc.opendatacommunities.org/api/v1/info';

// as each record is fetched it's UPRN is matched and codes fetched
async function fetch_block(query){
    let url = apiUrl + new URLSearchParams(query).toString();
    console.log('Fetching data from: ' + url);
    try {
        const response = await fetch(url, { headers: headers });
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.text();
        search_after = response.headers.get('X-Next-Search-After');
        console.log('Next search after: ' + search_after);
        return {
            data: data,
            search_after: search_after
        };
    } catch (error) {
        console.error('Error fetching data:', error);
    }
}
async function run(query){
    // read version
    let versionfile = path.join(datadir, 'version.json');
    let current = {};
    let cdata = await fs.promises.readFile(versionfile, 'utf8').catch((err) => {
        if (err.code === 'ENOENT') {
            console.log('Version file not found, creating a new one.');
            return '{}';
        } else {
            throw err; // Re-throw other errors
        }
    });
    current = JSON.parse(cdata);
    // fetch version from API
    let hdrs = {
        'Accept': 'application/json',   
        'Authorization': 'Basic ' + token
    };
    let versionResponse = await fetch(versionUrl, { headers: hdrs });
    if (!versionResponse.ok) {
        throw new Error(`HTTP error! status: ${versionResponse.status}`);
    }
    let versionData = await versionResponse.json();
    // check if the version has changed
    if (current.updatedDate === versionData.updatedDate && current.latestDate === versionData.latestDate) {
        console.log('Data is up to date. No need to fetch new data.');
        return;
    }
    let search_after = null;
    let result = {
        data: '',
        search_after: null
    }
    let data = '';
    do {
        if (search_after) {
            query['search-after'] = search_after;
        }
        result = await fetch_block(query, result.search_after);
        data += result.data;
        search_after = result.search_after;
    } while (result.search_after);
    const filepath = path.join(datadir, 'epc_data.csv');
    fs.writeFileSync(filepath, data);
    // Save the data to a file
    console.log('Data saved to ' + filepath);
    fs.writeFileSync(versionfile, JSON.stringify(versionData));
    console.log('Version updated to ' + JSON.stringify(versionData));
}

// Get arguments
let query = {
    'local-authority':'E07000045', // default to Teignbridge
    'size': 5000
}
const args = process.argv.slice(2);
for(let arg of args){
    if ( arg.startsWith('district=' || arg.startsWith('local-authority='))) {
        var district = arg.split('=')[1];
        query['local-authority'] = district;
    } else if (arg.startsWith('datadir=')){
        datadir = arg.split('=')[1];
        if (!fs.existsSync(datadir)) {
            fs.mkdirSync(datadir, { recursive: true });
        }
    }
}
console.log('Query : ' + JSON.stringify(query));
run(query).then(() => {
    console.log('Data fetch complete.');
}).catch(err => {
    console.error('Error fetching data:', err);
});