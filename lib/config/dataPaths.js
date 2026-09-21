/**
 * Data paths shared by SQLite and static asset readers.
 */

const path = require('path');
const os = require('os');

const XDG_DATA_HOME = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');
const APP_NAME = 'gong';
const NODE_ENV = process.env.NODE_ENV || 'development';
const ENV_SUBDIR = NODE_ENV === 'production' ? 'prod' : 'dev';
const DATA_DIR = path.join(XDG_DATA_HOME, APP_NAME, ENV_SUBDIR);

const STATIC_ASSETS_DIR = 'assets/data';
const I18N_ASSETS_DIR = 'assets/i18n';

function getStaticAssetPath(filename) {
  return path.join(STATIC_ASSETS_DIR, filename);
}

function getI18nPath(filename) {
  return path.join(I18N_ASSETS_DIR, filename);
}

module.exports = {
  DATA_DIR,
  ENV_SUBDIR,
  STATIC_ASSETS_DIR,
  I18N_ASSETS_DIR,
  getStaticAssetPath,
  getI18nPath,
};
