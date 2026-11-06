#!/usr/bin/env node

/**
 * Formats v1/missions.json and v1/tasks/*.json (format: scripts/lib/data-format.js).
 * Run before committing; no hook does it for you.
 *
 * Usage:
 *   node scripts/format-data.js           # rewrites files that are not formatted
 *   node scripts/format-data.js --check   # lists them and exits 1, changes nothing
 *
 * Unknown keys are printed as warnings and do not change the exit code.
 */

const fs = require('fs');
const path = require('path');
const { formatDocument, kindOf } = require('./lib/data-format');

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const RESET = '\x1b[0m';

const ROOT = path.resolve(__dirname, '..');
const CHECK = process.argv.slice(2).includes('--check');

function dataFiles() {
  const tasks = fs
    .readdirSync(path.join(ROOT, 'v1/tasks'))
    .filter((name) => name.endsWith('.json'))
    .sort()
    .map((name) => `v1/tasks/${name}`);
  return ['v1/missions.json', ...tasks];
}

let unformatted = 0;
let failed = 0;
const warnings = [];

for (const file of dataFiles()) {
  const fullPath = path.join(ROOT, file);
  const text = fs.readFileSync(fullPath, 'utf8');
  let result;
  try {
    result = formatDocument(text, kindOf(file));
  } catch (err) {
    console.error(`${RED}✗${RESET} ${file}: ${err.message}`);
    failed++;
    continue;
  }
  result.unknownKeys.forEach((key) => warnings.push(`${file} ${key}`));
  if (result.output === text) continue;

  unformatted++;
  if (CHECK) {
    console.log(`${YELLOW}needs formatting${RESET} ${file}`);
  } else {
    fs.writeFileSync(fullPath, result.output);
    console.log(`${GREEN}formatted${RESET} ${file}`);
  }
}

if (warnings.length > 0) {
  console.warn(`\n${YELLOW}Unknown keys (kept as they are, check for typos):${RESET}`);
  warnings.forEach((w) => console.warn(`  ${YELLOW}⚠${RESET} ${w}`));
}

if (failed > 0) {
  console.error(`\n${RED}${failed} file(s) could not be formatted.${RESET}`);
  process.exit(1);
}
if (CHECK && unformatted > 0) {
  console.log(`\n${unformatted} file(s) need formatting: run npm run format`);
  process.exit(1);
}
console.log(unformatted === 0 ? '\nAll data files are formatted.' : `\n${unformatted} file(s) formatted.`);
