const restify = require('restify');
const validator = require('express-validator');
const bluebird = require('bluebird');
const Sequelize = require('sequelize');
const fs = bluebird.promisifyAll(require('fs'));
const config = require('./config');

const sequelize = new Sequelize(config.db, {
    logging: process.env.NODE_ENV === 'production' ? false : console.log,
    define: {
        timestamps: false,
        freezeTableName: true
    }
});

const Import = sequelize.define('Import', {
    id: {
        primaryKey: true,
        type: Sequelize.TEXT
    },
    name: {
        type: Sequelize.TEXT,
        allowNull: false
    }
}, {
    tableName: 'import'
});

const Area = sequelize.define('Area', {
    name: Sequelize.TEXT,
    class: Sequelize.TEXT,
    floor: Sequelize.INTEGER,
    ceiling: Sequelize.INTEGER,
    boundary: Sequelize.GEOGRAPHY('POLYGON', 4326)
}, {
    tableName: 'area',
    indexes: [
        {
            method: 'GIST',
            fields: ['boundary']
        }
    ]
});

Area.belongsTo(Import, {
    onDelete: 'CASCADE',
    foreignKey: {
        name: 'import_id',
        allowNull: false
    }
});

sequelize.sync()
.then(function() {
    return Import.count();
})
.then(function(numOfImports) {
    if(numOfImports === 0 && config.autoPopulate) {
        console.log('Populate database...');
        return fs.readdirAsync('data').filter(function(file) {
            return file.endsWith('.sql');
        }).map(function(file) {
            return fs.readFileAsync('data/' + file, 'utf8');
        }).each(function(sql) {
            return sequelize.query(sql, {raw: true, logging: false});
        });
    }
})
.then(function() {
    const app = restify.createServer();
    app.use(restify.queryParser());
    app.use(validator());

    app.get('/location', function(req, res) {
        req.checkQuery('lat', 'Latitude is required and must be float').isFloat();
        req.checkQuery('lng', 'Longitude is required and must be float').isFloat();
        req.checkQuery('r', 'Radius is optional and must be float').optional().isFloat({min: 0});
        req.checkQuery('geojson', 'GeoJSON is optional and must be boolean').optional().isBoolean();
        req.checkQuery('kml', 'KML is optional and must be boolean').optional().isBoolean();
        req.checkQuery('compass', 'Compass is optional and must be boolean').optional().isBoolean();

        const errors = req.validationErrors();

        if(errors) {
            return res.send(400, buildValidationErrorResponse(errors));
        }

        const lat = req.sanitizeQuery('lat').toFloat();
        const lng = req.sanitizeQuery('lng').toFloat();
        const r = Math.min(req.sanitizeQuery('r').toFloat() || 0, config.maxRadius);
        const geojson = req.sanitizeQuery('geojson').toBoolean(true);
        const kml = req.sanitizeQuery('kml').toBoolean(true);
        const compass = req.sanitizeQuery('compass').toBoolean(true);

        const attributes = ['name', 'class', 'floor', 'ceiling',
            [sequelize.fn('ST_Distance', sequelize.col('boundary'), sequelize.cast(sequelize.fn('ST_SetSRID',
            sequelize.fn('ST_Point', lng, lat), 4326), 'geography')), 'distance']];
        if(geojson) {
            attributes.push([sequelize.fn('ST_AsGeoJSON', sequelize.col('boundary')), 'geojson']);
        }
        if(kml) {
            attributes.push([sequelize.fn('ST_AsKML', sequelize.col('boundary')), 'kml']);
        }
        if(compass) {
            attributes.push([sequelize.fn('degrees', sequelize.fn('ST_Azimuth',
                sequelize.cast(sequelize.fn('ST_SetSRID', sequelize.fn('ST_Point', lng, lat), 4326), 'geography'),
                sequelize.cast(sequelize.fn('ST_Centroid', sequelize.cast(sequelize.col('boundary'), 'geometry')), 'geography')
            )), 'compass']);
        }

        Area.findAll({
            attributes,
            where: sequelize.where(sequelize.fn('ST_DWithin',
                sequelize.col('boundary'), sequelize.cast(sequelize.fn('ST_SetSRID',
                sequelize.fn('ST_Point', lng, lat), 4326), 'geography'), r), true),
            order: [
                [sequelize.col('distance'), 'ASC'],
                [sequelize.col('floor'), 'ASC'],
                [sequelize.col('ceiling'), 'ASC']
            ]
        }).then(function(areas) {
            res.send({
                status: 'success',
                data: areas.map(x => {
                    x = x.toJSON();
                    if(geojson) x.geojson = JSON.parse(x.geojson);
                    if(compass) x.compass = normalizeAngle(x.compass);
                    return x;
                })
            });
        });
    });

    app.get('/info', function(req, res) {
        Import.findAll().then(function(imports) {
            bluebird.map(imports, function(imp) {
                return Area.count({
                    where: {
                        import_id: imp.id
                    }
                });
            }).then(function(result) {
                res.send({
                    status: 'success',
                    data: imports.map((x, index) => {
                        return {
                            name: x.name,
                            count: result[index]
                        };
                    })
                });
            });
        });
    });

    app.listen(process.env.PORT || 8080, function(err) {
        if(err) throw err;
        console.log('Server ready.');
    });
});

function buildValidationErrorResponse(errors)  {
    const data = {};
    errors.forEach(error => data[error.param] = error.msg);
    return {
        status: 'fail',
        data: data
    }
}

function normalizeAngle(x) {
    return Math.round(x < 0 ? x + 360 : x);
}
