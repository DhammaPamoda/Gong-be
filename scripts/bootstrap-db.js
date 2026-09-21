#!/usr/bin/env node

const fs = require('fs');
const os = require('os');
const path = require('path');

const environmentDirectory = process.env.NODE_ENV === 'production' ? 'prod' : 'dev';
const dataDirectory = path.join(
  process.env.XDG_DATA_HOME || path.join(os.homedir(), '.local', 'share'),
  'gong',
  environmentDirectory,
);
const source = path.resolve(__dirname, '..', 'gong-base.sqlite');
const destination = path.join(dataDirectory, 'gong.sqlite');

if (!fs.existsSync(source)) {
  throw new Error(`Baseline database not found: ${source}`);
}

fs.mkdirSync(dataDirectory, { recursive: true });
fs.copyFileSync(source, destination);
console.log(`Bootstrapped ${environmentDirectory} database at ${destination}`);
