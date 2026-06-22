import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync } from 'fs';
import { dirname, join as joinPath } from 'path';

/**
 * This script updates the version value in package.json file.
 */
const __dirname = dirname(fileURLToPath(import.meta.url));

const VERSION_REGEXP = /^\d+\.\d+\.\d+(?:-beta\.\d+)?$/;
const version = process.argv[2];

if (!version) {
  console.log(`Usage: npm run version [version]`);
  process.exit(0);
}
if (!VERSION_REGEXP.test(version)) {
  console.error(`Illegal version: ${version}`);
  process.exit(1);
}

const packageFileName = 'package.json';

const rootDir = joinPath(__dirname, '..');
const packageFile = joinPath(rootDir, packageFileName);

function readPackageFile() {
  return JSON.parse(readFileSync(packageFile));
}

function writePackageFile(data) {
  writeFileSync(packageFile, JSON.stringify(data, null, 2));
}

writePackageFile({ ...readPackageFile(), version });
