const os = require('os');
const path = require('path');
const { DataSource } = require('typeorm');
const entities = require('./entitySchemas');

const environmentDirectory = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
const dataDirectory = path.join(
  process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'),
  'gong',
  environmentDirectory,
);

const dataSource = new DataSource({
  type: 'better-sqlite3',
  database: path.join(dataDirectory, 'gong.sqlite'),
  entities,
  synchronize: false,
});

let initializationPromise;

function initializeDatabase() {
  if (!initializationPromise) {
    initializationPromise = dataSource.initialize();
  }
  return initializationPromise;
}

async function getDatabase() {
  if (!dataSource.isInitialized) {
    await initializeDatabase();
  }
  return dataSource;
}

module.exports = {
  dataSource,
  dataDirectory,
  initializeDatabase,
  getDatabase,
};
