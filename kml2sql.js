const path = require('path');
const fs = require('fs');
const sax = require('sax');
const cheerio = require('cheerio');
const escape = require('pg-escape');
const uuid = require('node-uuid');

function coordsToWKT(coords) {
    coords = coords.trim().split(/ +/);
    if(coords.length <= 3) return null;
    return 'POLYGON((' + coords.map(function(point) {
        return point.split(',').slice(0,2).join(' ');
    }).join(',') + '))';
}

function parseDescription(html) {
    if(typeof html !== 'string') return {};

    const result = {};
    const $ = cheerio.load(html);
    $('tr').each(function(i, elem) {
        const tds = $(this).children('td');
        if(tds.length === 2)  {
            const key = tds.eq(0).text();
            const value = tds.eq(1).text();
            var match;
            if(key.includes('Floor')) {
                if(match = value.match(/([0-9]+) m/)) {
                    result.floor = match[1];
                }
            } else if(key.includes('Ceiling')) {
                if(match = value.match(/([0-9]+) m/)) {
                    result.ceiling = match[1];
                }
            } else if(key.includes('Class')) {
                result.class = value.trim();
            }
        }
    });

    return result;
}

module.exports.kml2sql = function(importName, input, callback) {
    const importId = uuid.v4();

    var saxStream = require("sax").createStream(false, {
        trim: true,
        normalize: true,
        lowercase: true
    });

    const result = [];
    result.push('insert into import(id, name) values\n');
    result.push(escape('(%L, %L)', importId, importName) + ';\n');
    result.push(`insert into area(import_id, class, name, floor, ceiling, boundary) values\n`);
    var placemark = {}, record = false, textBuffer;
    var first = true, inPlacemark = false;
    var folders = [];

    saxStream.on('opentag', function(node) {
        switch(node.name) {
        case 'placemark':
            inPlacemark = true;
            placemark = {};
            break;
        case 'name':
        case 'coordinates':
        case 'description':
            record = true;
            textBuffer = '';
            break;
        }
    });
    saxStream.on('closetag', function(node) {
        switch(node) {
        case 'placemark':
            var wkt = coordsToWKT(placemark.coords);
            if(wkt) {
                if(! first) {
                    result.push(',\n');
                }
                first = false;
                const desc = parseDescription(placemark.description);
                result.push(escape(`(%L, %L, %L, %L, %L, ST_GeogFromText(%L))`,
                    importId, desc.class || (folders.length >= 2 ? folders[1] : null),
                    placemark.name, desc.floor || null, desc.ceiling || null, wkt));
            }
            inPlacemark = false;
            break;
        case 'name':
            if(inPlacemark) {
                placemark.name = textBuffer;
            } else {
                folders.push(textBuffer);
            }
            record = false;
            break;
        case 'coordinates':
            placemark.coords = textBuffer;
            record = false;
            break;
        case 'description':
            placemark.description = textBuffer;
            record = false;
            break;
        case 'folder':
            folders.pop();
            break;
        }
    });
    saxStream.on('text', function(node) {
        if(record) {
            if(textBuffer !== '') {
                textBuffer += ' ';
            }
            textBuffer += node;
        }
    });
    saxStream.on('end', function() {
        callback(null, result.join('') + ';');
    });

    input.pipe(saxStream);
};
