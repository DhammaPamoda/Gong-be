/**
 * Data Paths Configuration
 *
 * Defines paths for application data following XDG Base Directory Specification.
 * Dynamic data files (schedules, gongs) are stored in ~/.local/share/gong/
 * Static/template files remain in assets/data/
 */

const path = require('path');
const os = require('os');

// XDG Base Directory Specification
// Use XDG_DATA_HOME if set, otherwise default to ~/.local/share
const XDG_DATA_HOME = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');

// Application data directory
const APP_NAME = 'gong';
const DATA_DIR = path.join(XDG_DATA_HOME, APP_NAME);

// Static assets directory (read-only files, templates)
const STATIC_ASSETS_DIR = 'assets/data';

/**
 * Get the full path for a dynamic data file
 * @param {string} filename - The filename (e.g., 'coursesSchedule.json')
 * @returns {string} Full path to the file in the XDG data directory
 */
function getDataFilePath(filename) {
  return path.join(DATA_DIR, filename);
}

/**
 * Get the full path for a static asset file
 * @param {string} filename - The filename (e.g., 'staticData.json')
 * @returns {string} Full path to the file in the assets directory
 */
function getStaticAssetPath(filename) {
  return path.join(STATIC_ASSETS_DIR, filename);
}

/**
 * List of dynamic data files that should be in XDG data directory
 */
const DYNAMIC_DATA_FILES = [
  'coursesSchedule.json',
  'archivedCoursesSchedule.json',
  'manualGong.json',
  'obsoleteManualGong.json',
];

/**
 * Default content for each dynamic data file (used for initialization)
 */
const DEFAULT_FILE_CONTENTS = {
  'coursesSchedule.json': '[]',
  'archivedCoursesSchedule.json': '[]',
  'manualGong.json': '[]',
  'obsoleteManualGong.json': '[]',
};

module.exports = {
  DATA_DIR,
  STATIC_ASSETS_DIR,
  DYNAMIC_DATA_FILES,
  DEFAULT_FILE_CONTENTS,
  getDataFilePath,
  getStaticAssetPath,
};

