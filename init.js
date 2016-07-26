const http = require('http');
const fs = require('fs');
const unzip = require('unzip');
const async = require('async');
const Writable = require('stream').Writable;
const kml2sql = require('./kml2sql').kml2sql;

processURLFile('skyfool.txt');

/**
 * Read url file line-by-line and process each URL
 */
function processURLFile(file) {
    fs.readFile(file, function(err, data) {
        if(err) throw err;
        const urlList = data.toString()
            .replace(/\r\n/g,'\n').split('\n') // split lines
            .filter(x => x.length > 0); // remove empty lines

        async.map(urlList, processURL, function(err, sqlList) {
            if(err) throw err;
            fs.writeFile('data.sql', sqlList.join('\n'), function(err) {
                if(err) throw err;
            });
        });
    });
}

/**
 * Download KMZ file, extract the KML file and convert to SQL
 */
function processURL(url, callback) {
    http.get(url, response => {
        response.pipe(unzip.Parse())
            .on('entry', entry => {
                if(entry.path === 'doc.kml') {
                    kml2sql(url, entry, callback);
                }
            });
    });
}
