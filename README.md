# airmap

[![Dependency Status](https://dependencyci.com/github/syxolk/airmap/badge)](https://dependencyci.com/github/syxolk/airmap)

Airmap is a simple web service that returns information about restricted flight
areas in a certain area. It is using PostGIS under the hood for efficient
geospatial queries.

## Installation
First: Install Node.js and PostgreSQL with PostGIS for your system.

```
git clone https://github.com/syxolk/airmap.git
cd airmap
cp template.config.js config.js

# Configure database connection
nano config.js

npm install
node init.js
npm start
```

## API
### GET `/location`
Parameters:
- `lat`: Latitude for location
- `lng`: Longitude for location
- `r` (optional, defaults to 0): Radius of circle that is checked for restricted areas (in meters)
- `geojson` (optional, defaults to false): Return boundary of areas as GeoJSON
- `kml` (optional, defaults to false): Return boundary of areas as KML
- `compass` (optional, defaults to false): Return cardinal direction (0 = N, 90 = E, 180 = S, 270 = W) to center of area, relative from given location

Response:
```
{  
    "status":"success",
    "data":[  
        {  
            "name": "CTR Muenchen",
            "class": "CTR",
            "floor": 0,
            "ceiling": 1066,
            "distance": 0
        }, {  
            "name": "ED-R1 Garching H24",
            "class": "Restricted",
            "floor": 0,
            "ceiling": 1097,
            "distance": 0
        }
   ]
}
```

## Data
Restricted areas are downloaded from [skyfool.de](http://www.skyfool.de/)
for the following countries:
- Germany
- Swiss
- France
- Italy
- Slovakia
- Czech
- Australia

The data sets may not be complete or up-to-date. The developers of this
project are not responsible for any wrong or outdated information.

## Docker
Set `db` in `config.js` to `postgres://postgres@postgres:5432/postgres`.

```
docker run --name airmap-postgis -d mdillon/postgis
docker build -t airmap .
docker run -d --name airmap -v $PWD/config.js:/usr/src/app/config.js --link airmap-postgis:postgres -p 8080:8080 airmap
```
