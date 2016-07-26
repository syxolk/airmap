module.exports = {
    // PostreSQL connection URL
    db: 'postgres://user:password@localhost:port/database',

    // Insert everything from data.sql into
    // the database on startup if database is empty
    autoPopulate: true,

    // Maximal radius for location requests (in meters)
    maxRadius: 5000
};
