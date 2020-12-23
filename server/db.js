/**
 * This file contains all the setup and initialization logic for the databases.
 */

const fs = require('fs');
const path = require('path');
const Promise = require('bluebird');
const mongoose = require('mongoose');
const semver = require('semver');
const dbConf = require('./config').dbConnection;
const logger = require('../utils/logger')(module);

const { mongoURI,mongoURIFORANALYSIS } = dbConf;

/**
 * Creates the default mongoose connection
 *
 * @returns {Promise.<boolean>}
 */
const initMongoDB = async () => {
  // set Bluebird as the PromiseProvider for mongoose
  mongoose.Promise = Promise;

  // create the connection and return the connection promise
  try {
    await mongoose.connect(mongoURI, { useNewUrlParser: true, useFindAndModify: false, useUnifiedTopology: true});

    const db = mongoose.connection.db;

    await Promise.all([

    ]);

    logger.info('MongoDB: Connection Successful');

    return upgradeMongoSchema(db);
  } catch (error) {
    logger.error('MongoDB: Connection Failed!', error);
  }
};

const upgradeMongoSchema = async (db) => {
  const upgradesPath = path.join(__dirname, 'db', 'upgrades');
  const upgrades = fs.readdirSync(upgradesPath);
  const currentSchema = await db.collection('schema')
    .find({})
    .sort({ _id: -1 })
    .limit(1)
    .next();
  const currentVersion = currentSchema ? currentSchema.version : '0.0.0';

  for (const upgrade of upgrades) {
    if(!/\.js$/.test(upgrade)) {
      continue;
    }
    const version = path.basename(upgrade, '.js');
    if (semver.gt(version, currentVersion)) {
      logger.warn(`Attempt MongoDB schema upgrade to version ${version} ...`);
      try {
        // eslint-disable-next-line
        await require(path.join(upgradesPath, upgrade))(db);
        await db.collection('schema').insertOne({ version: version, upgradedAt: Date.now() });
        logger.info(`Upgrade to version ${version} done.`);
      } catch (error) {
        logger.error(error);
        process.exit(1);
      }
    }
  }

  return true;
};

/**
 * A promise that resolves as soon as all the databases are ready to go.
 *
 * @type {Promise.<*[]>}
 */
const ready = Promise.all([
  initMongoDB(),
]);



module.exports = {
  ready,
  /**
   * Returns the current Mongoose instance.
   *
   * @returns {Mongoose}
   */
  getMongoose: () => mongoose,
  /**
   * Returns the native MongoDB driver instance
   *
   * @returns {mongodb.Db}
   */
  getMongo: () => mongoose.connection.db,

  getAnalysisDb:() =>  mongoose.createConnection(mongoURIFORANALYSIS,{ useNewUrlParser: true,useUnifiedTopology: false}),

};
