#!/usr/bin/env node

/**
 * Checks that a content host serves every file under v1/ with the same size as the
 * repository, and that nothing outside v1/ is reachable.
 *
 * Usage:
 *   node scripts/verify-host.js https://city-alert-data.pages.dev
 *
 * Exit code 1 if any file is missing or differs in size, or a private path is reachable.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const CONCURRENCY = 16;
const PRIVATE_PATHS = ['url.json', 'package.json', 'scripts/verify-host.js', '__tests__/missions.test.ts'];

const host = (process.argv[2] || '').replace(/\/+$/, '');
if (!/^https?:\/\//.test(host)) {
  console.error('Usage: node scripts/verify-host.js <https://host>');
  process.exit(2);
}

function listFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    return entry.isDirectory() ? listFiles(full) : [full];
  });
}

async function fetchStatus(urlPath) {
  const url = `${host}/${urlPath.split('/').map(encodeURIComponent).join('/')}`;
  const res = await fetch(url);
  const size = Number((await res.arrayBuffer()).byteLength);
  return { status: res.status, size };
}

async function runPool(items, worker) {
  const queue = [...items];
  await Promise.all(
    Array.from({ length: CONCURRENCY }, async () => {
      while (queue.length) await worker(queue.shift());
    })
  );
}

async function main() {
  const files = listFiles(path.join(ROOT, 'v1')).map((f) => path.relative(ROOT, f).split(path.sep).join('/'));
  const problems = [];

  await runPool(files, async (file) => {
    try {
      const { status, size } = await fetchStatus(file);
      const expected = fs.statSync(path.join(ROOT, file)).size;
      if (status !== 200) problems.push(`${status} ${file}`);
      else if (size !== expected) problems.push(`size ${size} != ${expected} ${file}`);
    } catch (err) {
      problems.push(`error ${file}: ${err.message}`);
    }
  });

  for (const file of PRIVATE_PATHS) {
    const { status } = await fetchStatus(file);
    if (status === 200) problems.push(`REACHABLE (should be 404) ${file}`);
  }

  console.log(`Checked ${files.length} files under v1/ on ${host}`);
  if (problems.length) {
    problems.sort().forEach((p) => console.error(`✗ ${p}`));
    console.error(`${problems.length} problem(s)`);
    process.exit(1);
  }
  console.log('✓ all files match, private paths not reachable');
}

main();
