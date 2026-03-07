/**
 * Data Paths Configuration
 *
 * Defines paths for application data following XDG Base Directory Specification.
 * Dynamic data files (schedules, gongs) are stored in ~/.local/share/gong/
 * Static/template files remain in assets/data/
 */

const path = require('path');
const os = require('os');
const fs = require('fs');

// XDG Base Directory Specification
// Use XDG_DATA_HOME if set, otherwise default to ~/.local/share
const XDG_DATA_HOME = process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share');

// Application data directory
const APP_NAME = 'gong';

// Environment-based subdirectory to separate prod and dev data
// Defaults to 'dev' to protect production data during development
const NODE_ENV = process.env.NODE_ENV || 'development';
const ENV_SUBDIR = NODE_ENV === 'production' ? 'prod' : 'dev';

const DATA_DIR = path.join(XDG_DATA_HOME, APP_NAME, ENV_SUBDIR);

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
  'systemSettings.json'
];

/**
 * Default content for each dynamic data file (used for initialization)
 */
const DEFAULT_FILE_CONTENTS = {
  'coursesSchedule.json': '[]',
  'archivedCoursesSchedule.json': '[]',
  'manualGong.json': '[]',
  'obsoleteManualGong.json': '[]',
  'systemSettings.json': '{ "runSecurityCheck": false, "alertLocation": "דגניה", "pollingInterval": 10 }'
};

/**
 * Validate that a file contains valid JSON
 * @param {string} filePath - Path to the file to validate
 * @returns {{ valid: boolean, error?: string }} Validation result
 */
function validateJsonFile(filePath) {
  try {
    if (!fs.existsSync(filePath)) {
      return { valid: false, error: 'File does not exist' };
    }

    const content = fs.readFileSync(filePath, 'utf8');

    if (!content || content.trim() === '') {
      return { valid: false, error: 'File is empty' };
    }

    JSON.parse(content);
    return { valid: true };
  } catch (error) {
    if (error instanceof SyntaxError) {
      return { valid: false, error: `Invalid JSON: ${error.message}` };
    }
    return { valid: false, error: error.message };
  }
}

/**
 * Ensure the data directory exists
 * @returns {boolean} True if directory exists or was created
 */
function ensureDataDirExists() {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
      console.log(`[dataPaths] Created data directory: ${DATA_DIR}`);
    }
    return true;
  } catch (error) {
    console.error(`[dataPaths] Failed to create data directory: ${error.message}`);
    return false;
  }
}

/**
 * Initialize all required data files, creating them with default content if missing or corrupted
 * This should be called once at application startup before any file operations.
 * 
 * @returns {{ success: boolean, initialized: string[], repaired: string[], errors: string[] }}
 */
function initializeDataFiles() {
  const result = {
    success: true,
    initialized: [],
    repaired: [],
    errors: [],
  };

  // First ensure the directory exists
  if (!ensureDataDirExists()) {
    result.success = false;
    result.errors.push(`Failed to create data directory: ${DATA_DIR}`);
    return result;
  }

  // Check and initialize each required file
  for (const filename of DYNAMIC_DATA_FILES) {
    const filePath = getDataFilePath(filename);
    const defaultContent = DEFAULT_FILE_CONTENTS[filename] || '[]';

    try {
      const validation = validateJsonFile(filePath);

      if (!validation.valid) {
        const wasExisting = fs.existsSync(filePath);

        // Write default content to the file
        fs.writeFileSync(filePath, defaultContent, 'utf8');

        if (wasExisting) {
          console.log(`[dataPaths] Repaired corrupted file ${filename}: ${validation.error}`);
          result.repaired.push(filename);
        } else {
          console.log(`[dataPaths] Created missing file ${filename}`);
          result.initialized.push(filename);
        }
      }
    } catch (error) {
      console.error(`[dataPaths] Error processing ${filename}: ${error.message}`);
      result.errors.push(`${filename}: ${error.message}`);
      result.success = false;
    }
  }

  return result;
}

/**
 * Write data to a file atomically (write to temp file, then rename)
 * This prevents file corruption if the write is interrupted.
 * 
 * @param {string} filePath - Target file path
 * @param {string} content - Content to write
 * @returns {Promise<void>}
 */
function atomicWriteFile(filePath, content) {
  return new Promise((resolve, reject) => {
    const tempPath = `${filePath}.tmp.${Date.now()}`;

    fs.writeFile(tempPath, content, 'utf8', (writeErr) => {
      if (writeErr) {
        // Clean up temp file if it exists
        try {
          if (fs.existsSync(tempPath)) {
            fs.unlinkSync(tempPath);
          }
        } catch (cleanupErr) {
          // Ignore cleanup errors
        }
        reject(writeErr);
        return;
      }

      // Rename temp file to target (atomic operation on most filesystems)
      fs.rename(tempPath, filePath, (renameErr) => {
        if (renameErr) {
          // Try to clean up temp file
          try {
            if (fs.existsSync(tempPath)) {
              fs.unlinkSync(tempPath);
            }
          } catch (cleanupErr) {
            // Ignore cleanup errors
          }
          reject(renameErr);
          return;
        }
        resolve();
      });
    });
  });
}

/**
 * Synchronous version of atomic write for critical operations
 * 
 * @param {string} filePath - Target file path
 * @param {string} content - Content to write
 */
function atomicWriteFileSync(filePath, content) {
  const tempPath = `${filePath}.tmp.${Date.now()}`;

  try {
    fs.writeFileSync(tempPath, content, 'utf8');
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      if (fs.existsSync(tempPath)) {
        fs.unlinkSync(tempPath);
      }
    } catch (cleanupErr) {
      // Ignore cleanup errors
    }
    throw error;
  }
}

module.exports = {
  DATA_DIR,
  ENV_SUBDIR,
  STATIC_ASSETS_DIR,
  DYNAMIC_DATA_FILES,
  DEFAULT_FILE_CONTENTS,
  getDataFilePath,
  getStaticAssetPath,
  validateJsonFile,
  ensureDataDirExists,
  initializeDataFiles,
  atomicWriteFile,
  atomicWriteFileSync,
};

