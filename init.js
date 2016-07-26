const http = require('http');
const fs = require('fs');
const unzip = require('unzip');
const async = require('async');
const crypto = require('crypto');
const Writable = require('stream').Writable;
const kml2sql = require('./kml2sql').kml2sql;

fs.mkdirSync('data');
processURLFile('skyfool.txt');

/**
 * Read url file line-by-line and process each URL
 */
function processURLFile(file) {
    fs.readFile(file, function(err, data) {
        if(err) throw err;
        const urlList = data.toString()
            .replace(/\r\n/g,'\n').split('\n') // split lines
            .filter(x => x.length > 0) // remove empty lines
            .filter(x => !x.startsWith('#')); // remove comment lines

        async.eachSeries(urlList, processURL, function(err) {
            if(err) throw err;
            console.log('Finished.');
        });
    });
}

/**
 * Download KMZ file, extract the KML file and convert to SQL
 */
function processURL(url, callback) {
    console.log('Process %s', url);
    http.get(url, response => {
        response.pipe(unzip.Parse())
            .on('entry', entry => {
                if(entry.path === 'doc.kml') {
                    const importId = crypto.createHash('md5').update(url).digest('hex');
                    const fd = fs.createWriteStream('data/' + importId + '.sql');
                    kml2sql(importId, url, entry, fd, callback);
                }
            });
    });
}
