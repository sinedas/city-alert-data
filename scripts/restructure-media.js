#!/usr/bin/env node

/**
 * Media clean-up: one shared folder for the wizard / fairy missions, unused media removed.
 *
 *  1. Wizard family (WIZARD_FAMILY) moves to folder `wizard`:
 *     - a file used by two or more of the old folders (same content) -> wizard/<name>
 *     - a file only one old folder uses                              -> wizard/<old folder>/<name>
 *       (klaipedos_burtininkas already lives in `wizard`; its own files go to
 *        wizard/klaipedos_burtininkas/)
 *     Task files (main + _extended) and missions.json get the new paths and
 *     `"folder": "wizard"`; url.json remoteMissionVersions are bumped so apps
 *     fetch the new task files instead of their bundled copies.
 *  2. DROP_MISSIONS (+ --drop <code>) are switched off: `"active": false`, removed
 *     from url.json, their media deleted (the list cover stays with the entry).
 *     TASK_FILES_TO_DELETE are deleted.
 *     REMOVE_GALLERY missions lose their start screen gallery (`images`, v1/preview).
 *  3. Every file under v1/img, v1/preview and v1/audio that no live mission and no
 *     app collection uses afterwards is deleted.
 *
 * What a live mission uses is read the way the app reads it: missions in url.json
 * remoteMissions from v1/tasks here, the others from the app's bundled copies
 * (<app>/config/missions); collections from <app>/config/packages. So the app repo
 * must be next to this one (or passed with --app).
 *
 * JSON files are edited as text (only the changed strings), so their formatting
 * and the diff stay small.
 *
 * Usage:
 *   node scripts/restructure-media.js                 # analysis only, changes nothing
 *   node scripts/restructure-media.js --apply --version 1.0.36   (above the app's version)
 *   options: --app <path to city-alert>  (default ../city-alert)
 *            --drop <code>               (also switch off a mission, e.g. future)
 *            --plan <file>               (write the full plan as JSON)
 */

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// --- Configuration ---------------------------------------------------------

const TARGET_FOLDER = 'wizard';

/** Missions whose images move to TARGET_FOLDER (burtininkai + kuprinės, LT and EN). */
const WIZARD_FAMILY = [
  'bernardinu_burtininkas',
  'bernardinai_wizard_en',
  'birzu_burtininkas',
  'kauno_burtininkas',
  'kaunas_wizard_en',
  'klaipedos_burtininkas',
  'traku_burtininkas',
  'zveryno_burtininkas',
  'vilnius_kuprine',
  'vilnius_fairy_en',
  'kaunas_kuprine',
  'kaunas_fairy_en',
  'trakai_kuprine',
];

/** Missions not in use for now: switched off, media deleted. */
const DROP_MISSIONS = ['prague_wizard_en'];

/** Task files deleted outright (relative to v1/tasks). */
const TASK_FILES_TO_DELETE = [
  'prague_wizard_en.json',
  'prague_wizard_en_extended.json',
];

/** Missions whose start screen gallery (missions.json `images`, v1/preview/) goes for now. */
const REMOVE_GALLERY = [];

const MEDIA_RE = /^[^\s"<>]+\.(webp|png|jpe?g|gif|mp3|m4a|wav|ogg)$/i;
const AUDIO_RE = /\.(mp3|m4a|wav|ogg)$/i;
const MEDIA_ROOTS = ['v1/img', 'v1/preview', 'v1/audio'];
const JSDELIVR_LIMIT_MB = 50;

// --- Arguments --------------------------------------------------------------

const DATA = path.resolve(__dirname, '..');
const args = process.argv.slice(2);
const argValue = (name) => {
  const index = args.indexOf(name);
  return index === -1 ? undefined : args[index + 1];
};
const APPLY = args.includes('--apply');
const APP = path.resolve(DATA, argValue('--app') || '../city-alert');
const NEW_VERSION = argValue('--version');
const PLAN_FILE = argValue('--plan');
const drops = [...DROP_MISSIONS];
args.forEach((arg, i) => {
  if (arg === '--drop' && args[i + 1]) drops.push(args[i + 1]);
});

if (APPLY && !/^\d+\.\d+\.\d+$/.test(NEW_VERSION || '')) {
  fail('--apply needs --version x.y.z, higher than any app version (url.json remoteMissionVersions)');
}

// --- Helpers ----------------------------------------------------------------

function fail(message) {
  console.error(`\n✖ ${message}`);
  process.exit(1);
}

const rel = (abs) => path.relative(DATA, abs).split(path.sep).join('/');
const abs = (relPath) => path.join(DATA, relPath);
const exists = (relPath) => fs.existsSync(abs(relPath));
const readJson = (file) => JSON.parse(fs.readFileSync(file, 'utf8'));
const mb = (bytes) => `${(bytes / 1e6).toFixed(1)} MB`;

const hashCache = new Map();
function hashOf(relPath) {
  if (!hashCache.has(relPath)) {
    hashCache.set(relPath, crypto.createHash('md5').update(fs.readFileSync(abs(relPath))).digest('hex'));
  }
  return hashCache.get(relPath);
}
const sizeOf = (relPath) => fs.statSync(abs(relPath)).size;

function listFiles(relDir) {
  const out = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.name.startsWith('.')) continue;
      if (entry.isDirectory()) walk(full);
      else out.push(rel(full));
    }
  };
  walk(abs(relDir));
  return out;
}

/** Every media-looking string in a JSON value, with its key path. */
function mediaStrings(value, keyPath = [], out = []) {
  if (Array.isArray(value)) value.forEach((item, i) => mediaStrings(item, [...keyPath, i], out));
  else if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) mediaStrings(item, [...keyPath, key], out);
  } else if (typeof value === 'string' && MEDIA_RE.test(value) && !value.startsWith('http')) {
    out.push({ value, keyPath });
  }
  return out;
}

// --- Load -------------------------------------------------------------------

if (!fs.existsSync(path.join(APP, 'config/missions'))) {
  fail(`App repo not found at ${APP} (needed for bundled missions and collections). Pass --app <path>.`);
}

// An app whose version equals a mission's remoteMissionVersions uses its bundled tasks
// (old paths), so the new version must be above every released app version.
const appVersion = (fs.readFileSync(path.join(APP, 'app.config.js'), 'utf8').match(/const version = '([\d.]+)'/) || [])[1];
const versionParts = (v) => v.split('.').map(Number);
const isAbove = (a, b) => {
  const [x, y] = [versionParts(a), versionParts(b)];
  for (let i = 0; i < 3; i++) if (x[i] !== y[i]) return x[i] > y[i];
  return false;
};
if (APPLY && appVersion && !isAbove(NEW_VERSION, appVersion)) {
  fail(`--version ${NEW_VERSION} must be above the app version ${appVersion} (app.config.js)`);
}

const missionsText = fs.readFileSync(abs('v1/missions.json'), 'utf8');
const missionsJson = JSON.parse(missionsText);
const missionList = Array.isArray(missionsJson) ? missionsJson : missionsJson.missions || missionsJson.challenges;
const urlText = fs.readFileSync(abs('url.json'), 'utf8');
const urlJson = JSON.parse(urlText);
const remoteMissions = new Set(urlJson.remoteMissions || []);

for (const code of [...WIZARD_FAMILY, ...drops]) {
  if (!missionList.some((m) => m.code === code)) fail(`Unknown mission in configuration: ${code}`);
}

const liveMissions = missionList.filter((m) => m.active === true && !drops.includes(m.code));
const familyMissions = liveMissions.filter((m) => WIZARD_FAMILY.includes(m.code));
const folderOf = (mission) => mission.folder || mission.code;
// As app/challenge/[id].tsx: the gallery lives in v1/preview/<folder or code>
const previewPath = (mission, file) => `v1/preview/${folderOf(mission)}/${file}`;

/** The task files the app uses for a mission: remote ones from here, the rest bundled in the app. */
function taskSources(code) {
  const base = remoteMissions.has(code) ? abs('v1/tasks') : path.join(APP, 'config/missions');
  return [`${code}.json`, `${code}_extended.json`]
    .map((name) => path.join(base, name))
    .filter((file) => fs.existsSync(file));
}

const problems = [];
const unresolved = [];

/** A reference: which mission, where it is written, and which file it means. */
function resolveRef(mission, value) {
  if (value.startsWith('shared/')) return `v1/img/${value}`;
  // Audio stays per mission code, not folder (store prefetchChallengeAudios(challengeCode))
  if (AUDIO_RE.test(value)) return `v1/audio/${mission.code}/${value}`;
  return `v1/img/${folderOf(mission)}/${value}`;
}

const refs = []; // { code, file (task file | 'missions.json'), keyPath, value, path }

for (const mission of liveMissions) {
  const sources = taskSources(mission.code);
  if (sources.length === 0) problems.push(`${mission.code}: no task file (data or app) - its media would be deleted`);
  for (const file of sources) {
    for (const { value, keyPath } of mediaStrings(readJson(file))) {
      const target = resolveRef(mission, value);
      if (!target || !exists(target)) unresolved.push(`${mission.code}: ${value} (${path.basename(file)})`);
      else refs.push({ code: mission.code, file, keyPath, value, path: target });
    }
  }
  // Mission list fields: the cover at the img root, the gallery in v1/preview/<code>,
  // everything else (afterTeamName.image, endPage.image, ...) in the mission folder.
  for (const { value, keyPath } of mediaStrings(mission)) {
    if (keyPath[0] === 'images' && REMOVE_GALLERY.includes(mission.code)) continue;
    let target;
    if (keyPath.length === 1 && keyPath[0] === 'image') target = `v1/img/${value}`;
    else if (keyPath[0] === 'images') target = previewPath(mission, value);
    else target = resolveRef(mission, value);
    if (!target || !exists(target)) unresolved.push(`${mission.code}: ${value} (missions.json ${keyPath.join('.')})`);
    else refs.push({ code: mission.code, file: 'missions.json', keyPath, value, path: target });
  }
}

const collectionRefs = new Set();
for (const locale of fs.readdirSync(path.join(APP, 'config/packages'))) {
  const dir = path.join(APP, 'config/packages', locale);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const name of fs.readdirSync(dir).filter((n) => n.endsWith('.json'))) {
    for (const { value } of mediaStrings(readJson(path.join(dir, name)))) {
      const target = value.startsWith('shared/') ? `v1/img/${value}` : null;
      if (target && exists(target)) collectionRefs.add(target);
      else unresolved.push(`collection ${locale}/${name}: ${value}`);
    }
  }
}

// --- Plan the wizard folder -------------------------------------------------

/** Only images in a family mission's own folder move; covers, previews, shared/ and audio stay. */
const isMovable = (ref) => {
  const mission = liveMissions.find((m) => m.code === ref.code);
  return (
    WIZARD_FAMILY.includes(ref.code) &&
    ref.path.startsWith(`v1/img/${folderOf(mission)}/`) &&
    !(ref.keyPath.length === 1 && ref.keyPath[0] === 'image')
  );
};

/** Old folder tag of a file: its folder, or the mission's code for files already in `wizard`. */
function ownerTag(ref) {
  const mission = liveMissions.find((m) => m.code === ref.code);
  const folder = folderOf(mission);
  return folder === TARGET_FOLDER ? mission.code : folder;
}

const foldersByHash = new Map();
for (const ref of refs.filter(isMovable)) {
  const hash = hashOf(ref.path);
  if (!foldersByHash.has(hash)) foldersByHash.set(hash, new Set());
  foldersByHash.get(hash).add(ownerTag(ref));
}

const targetByHash = new Map(); // hash -> relative path inside TARGET_FOLDER
const hashByTarget = new Map();
const collisions = [];

function claim(hash, wanted) {
  const taken = hashByTarget.get(wanted);
  if (taken && taken !== hash) {
    const ext = path.extname(wanted);
    const renamed = `${wanted.slice(0, -ext.length)}_${hash.slice(0, 6)}${ext}`;
    collisions.push(`${wanted} -> ${renamed}`);
    wanted = renamed;
  }
  hashByTarget.set(wanted, hash);
  targetByHash.set(hash, wanted);
}

// Shared files first, so a shared name keeps the plain wizard/<name>.
const movable = refs.filter(isMovable);
const sorted = [...movable].sort((a, b) => foldersByHash.get(hashOf(b.path)).size - foldersByHash.get(hashOf(a.path)).size);
for (const ref of sorted) {
  const hash = hashOf(ref.path);
  if (targetByHash.has(hash)) continue;
  const name = path.basename(ref.value);
  claim(hash, foldersByHash.get(hash).size > 1 ? name : `${ownerTag(ref)}/${name}`);
}

/** New value (relative to the mission folder) for every moved reference. */
for (const ref of movable) {
  ref.newValue = targetByHash.get(hashOf(ref.path));
  ref.newPath = `v1/img/${TARGET_FOLDER}/${ref.newValue}`;
}

// --- Final state ------------------------------------------------------------

/** path in the final tree -> source file it comes from */
const finalFiles = new Map();
for (const ref of refs) {
  const finalPath = ref.newPath || ref.path;
  if (!finalFiles.has(finalPath)) finalFiles.set(finalPath, ref.path);
}
for (const p of collectionRefs) finalFiles.set(p, p);
// Every missions.json entry keeps its cover, switched-off ones too (the entry stays,
// and __tests__/imageFilesExist checks all covers).
for (const mission of missionList) {
  const cover = typeof mission.image === 'string' ? `v1/img/${mission.image}` : null;
  if (cover && exists(cover)) finalFiles.set(cover, cover);
}

const allMedia = MEDIA_ROOTS.flatMap(listFiles);
const toDelete = allMedia.filter((p) => !finalFiles.has(p));
const toWrite = [...finalFiles].filter(([finalPath, source]) => finalPath !== source || !exists(finalPath));

// Every reference must end up at an existing (or written) file.
for (const ref of refs) {
  if (!finalFiles.has(ref.newPath || ref.path)) problems.push(`${ref.code}: ${ref.value} has no final file`);
}

// --- Report -----------------------------------------------------------------

const sum = (paths) => paths.reduce((total, p) => total + sizeOf(p), 0);
const topFolder = (p) => p.split('/').slice(0, 3).join('/');
const byTop = (paths, sizeFn) => {
  const totals = new Map();
  for (const p of paths) totals.set(topFolder(p), (totals.get(topFolder(p)) || 0) + sizeFn(p));
  return [...totals].sort((a, b) => b[1] - a[1]);
};

const beforeMedia = sum(allMedia);
const afterMedia = [...finalFiles.values()].reduce((total, source) => total + sizeOf(source), 0);
// What git tracks outside the media folders (what jsDelivr counts besides media)
const otherFiles = require('child_process')
  .execSync('git ls-files', { cwd: DATA, encoding: 'utf8' })
  .split('\n')
  .filter((p) => p && exists(p) && !MEDIA_ROOTS.some((root) => p.startsWith(`${root}/`)));
const otherSize = sum(otherFiles);

console.log(`\n=== Media restructure ${APPLY ? '(APPLY)' : '(analysis only)'} ===`);
console.log(`Live missions: ${liveMissions.length}; wizard family: ${familyMissions.map((m) => m.code).join(', ')}`);
console.log(`Switched off: ${drops.join(', ')}; gallery removed: ${REMOVE_GALLERY.join(', ')}`);
console.log(`\nMedia before: ${allMedia.length} files, ${mb(beforeMedia)}`);
console.log(`Media after:  ${finalFiles.size} files, ${mb(afterMedia)}  (deleted ${toDelete.length}, written ${toWrite.length})`);
console.log(`Rest of the repo (tasks, scripts, ...): ${mb(otherSize)}`);
const total = afterMedia + otherSize;
console.log(
  `Repo after: ~${mb(total)} - jsDelivr limit ${JSDELIVR_LIMIT_MB} MB: ${total / 1e6 < JSDELIVR_LIMIT_MB ? 'fits' : 'STILL OVER'}`
);

console.log('\nAfter, by folder:');
for (const [folder, bytes] of byTop([...finalFiles.keys()], (p) => sizeOf(finalFiles.get(p)))) {
  console.log(`  ${mb(bytes).padStart(9)}  ${folder}`);
}
console.log('\nDeleted, by folder:');
for (const [folder, bytes] of byTop(toDelete, sizeOf)) console.log(`  ${mb(bytes).padStart(9)}  ${folder}`);

const missionSize = (code) => {
  const paths = new Set(refs.filter((r) => r.code === code).map((r) => r.newPath || r.path));
  return [...paths].reduce((total, p) => total + sizeOf(finalFiles.get(p)), 0);
};
console.log('\nMedia per live mission (what a player downloads):');
for (const mission of [...liveMissions].sort((a, b) => missionSize(b.code) - missionSize(a.code))) {
  console.log(`  ${mb(missionSize(mission.code)).padStart(9)}  ${mission.code}${remoteMissions.has(mission.code) ? '' : ' (bundled tasks)'}`);
}

if (collisions.length) console.log(`\nName clashes in ${TARGET_FOLDER}/ (renamed):\n  ${collisions.join('\n  ')}`);
if (unresolved.length) console.log(`\nReferences without a file (left as they are):\n  ${unresolved.join('\n  ')}`);
if (problems.length) console.log(`\nPROBLEMS:\n  ${problems.join('\n  ')}`);

if (PLAN_FILE) {
  const plan = {
    renames: movable
      .filter((r) => r.newValue !== r.value || r.file !== 'missions.json')
      .map((r) => ({ mission: r.code, file: path.basename(r.file), from: r.value, to: r.newValue })),
    write: toWrite.map(([to, from]) => ({ from, to })),
    delete: toDelete,
    collisions,
    unresolved,
    problems,
  };
  fs.writeFileSync(path.resolve(PLAN_FILE), JSON.stringify(plan, null, 2));
  console.log(`\nPlan written to ${PLAN_FILE}`);
}

if (!APPLY) {
  console.log('\nNothing changed. Run with --apply --version x.y.z to do it.');
  process.exit(problems.length ? 1 : 0);
}
if (problems.length) fail('Not applying while there are problems.');

// --- Apply ------------------------------------------------------------------

/** Spans of the mission objects in missions.json, so edits stay inside one mission. */
function missionSpans(text) {
  const spans = [];
  let depth = 0;
  let inString = false;
  let escaped = false;
  let arrayDepth = null;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inString) {
      if (escaped) escaped = false;
      else if (ch === '\\') escaped = true;
      else if (ch === '"') inString = false;
      continue;
    }
    if (ch === '"') inString = true;
    else if (ch === '[' || ch === '{') {
      if (ch === '[' && arrayDepth === null) arrayDepth = depth + 1;
      depth++;
      if (ch === '{' && depth === arrayDepth + 1) start = i;
    } else if (ch === ']' || ch === '}') {
      if (ch === '}' && depth === arrayDepth + 1) spans.push([start, i + 1]);
      depth--;
    }
  }
  return spans;
}

const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function replaceOnce(text, pattern, replacement, what) {
  const re = new RegExp(pattern);
  if (!re.test(text)) fail(`Could not edit ${what}`);
  return text.replace(re, replacement);
}

// 1. Media into place (via a staging copy, so a target never overwrites a source still needed).
const staging = abs('.restructure-staging');
fs.rmSync(staging, { recursive: true, force: true });
fs.mkdirSync(staging);
for (const [, source] of toWrite) {
  fs.copyFileSync(abs(source), path.join(staging, hashOf(source)));
}
for (const p of toDelete) fs.rmSync(abs(p));
for (const [finalPath, source] of toWrite) {
  fs.mkdirSync(path.dirname(abs(finalPath)), { recursive: true });
  fs.copyFileSync(path.join(staging, hashOf(source)), abs(finalPath));
}
fs.rmSync(staging, { recursive: true, force: true });
const removeEmptyDirs = (dir) => {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.isDirectory()) removeEmptyDirs(path.join(dir, entry.name));
  }
  const left = fs.readdirSync(dir).filter((name) => name !== '.DS_Store');
  if (left.length === 0) fs.rmSync(dir, { recursive: true, force: true });
};
MEDIA_ROOTS.forEach((root) => removeEmptyDirs(abs(root)));

// 2. Task files of the family: the moved strings, as text.
const byTaskFile = new Map();
for (const ref of movable.filter((r) => r.file !== 'missions.json' && r.newValue !== r.value)) {
  if (!byTaskFile.has(ref.file)) byTaskFile.set(ref.file, new Map());
  byTaskFile.get(ref.file).set(ref.value, ref.newValue);
}
for (const [file, renames] of byTaskFile) {
  let text = fs.readFileSync(file, 'utf8');
  for (const [from, to] of renames) text = text.split(`"${from}"`).join(`"${to}"`);
  fs.writeFileSync(file, text);
}
for (const name of TASK_FILES_TO_DELETE) fs.rmSync(abs(`v1/tasks/${name}`), { force: true });

// 3. missions.json: folder, nested image fields, switched-off missions.
let missionsOut = missionsText;
const spans = missionSpans(missionsText);
if (spans.length !== missionList.length) fail('missions.json: could not find every mission object');
for (let index = spans.length - 1; index >= 0; index--) {
  const mission = missionList[index];
  const [start, end] = spans[index];
  let span = missionsOut.slice(start, end);
  if (familyMissions.includes(mission)) {
    if (/"folder"\s*:\s*"[^"]*"/.test(span)) {
      span = span.replace(/("folder"\s*:\s*)"[^"]*"/, `$1"${TARGET_FOLDER}"`);
    } else {
      span = replaceOnce(
        span,
        `(\\n([ \\t]*)"code"\\s*:\\s*"${escapeRe(mission.code)}"\\s*,)`,
        `$1\n$2"folder": "${TARGET_FOLDER}",`,
        `${mission.code} folder`
      );
    }
    for (const ref of movable.filter((r) => r.code === mission.code && r.file === 'missions.json' && r.newValue !== r.value)) {
      const [parent, key] = ref.keyPath.length === 2 ? ref.keyPath : [null, ref.keyPath[0]];
      const pattern = parent
        ? `("${escapeRe(parent)}"\\s*:\\s*\\{[^{}]*?"${escapeRe(key)}"\\s*:\\s*)"${escapeRe(ref.value)}"`
        : `("${escapeRe(key)}"\\s*:\\s*)"${escapeRe(ref.value)}"`;
      span = replaceOnce(span, pattern, `$1"${ref.newValue}"`, `${mission.code} ${ref.keyPath.join('.')}`);
    }
  }
  if (drops.includes(mission.code)) {
    span = replaceOnce(span, `("active"\\s*:\\s*)true`, '$1false', `${mission.code} active`);
  }
  if (REMOVE_GALLERY.includes(mission.code) && mission.images) {
    span = replaceOnce(span, `,\\s*"images"\\s*:\\s*\\[[^\\]]*\\]`, '', `${mission.code} images`);
  }
  missionsOut = missionsOut.slice(0, start) + span + missionsOut.slice(end);
}
JSON.parse(missionsOut);
fs.writeFileSync(abs('v1/missions.json'), missionsOut);

// 4. url.json: drop switched-off missions, bump the family's versions.
let urlOut = urlText;
for (const code of drops) {
  const item = `"${escapeRe(code)}"`;
  urlOut = urlOut.replace(new RegExp(`${item}\\s*,\\s*|,\\s*${item}(?=\\s*\\])`), '');
  urlOut = urlOut.replace(new RegExp(`${item}\\s*:\\s*"[^"]*"\\s*,\\s*|,\\s*${item}\\s*:\\s*"[^"]*"(?=\\s*\\})`), '');
}
for (const mission of familyMissions) {
  const item = `"${escapeRe(mission.code)}"\\s*:\\s*`;
  if (new RegExp(item).test(urlOut)) {
    urlOut = urlOut.replace(new RegExp(`(${item})"[^"]*"`), `$1"${NEW_VERSION}"`);
  } else {
    console.warn(`  url.json has no remoteMissionVersions entry for ${mission.code} - add "${NEW_VERSION}" by hand`);
  }
}
const urlCheck = JSON.parse(urlOut);
for (const code of drops) {
  if ((urlCheck.remoteMissions || []).includes(code)) fail(`url.json: ${code} still in remoteMissions`);
}
fs.writeFileSync(abs('url.json'), urlOut);

// 5. Check the result the way the app will read it.
const after = readJson(abs('v1/missions.json'));
const afterList = Array.isArray(after) ? after : after.missions || after.challenges;
let missing = 0;
for (const mission of afterList.filter((m) => m.active === true)) {
  const files = taskSources(mission.code).map(readJson).concat([mission]);
  for (const data of files) {
    for (const { value, keyPath } of mediaStrings(data)) {
      let target;
      if (data === mission && keyPath.length === 1 && keyPath[0] === 'image') target = `v1/img/${value}`;
      else if (data === mission && keyPath[0] === 'images') target = previewPath(mission, value);
      else target = resolveRef(mission, value);
      if (target && !exists(target) && !unresolved.some((u) => u.startsWith(`${mission.code}: ${value} `))) {
        console.error(`  missing after apply: ${mission.code} ${value} -> ${target}`);
        missing++;
      }
    }
  }
}
if (missing) fail(`${missing} references point to missing files - check before committing (git checkout . undoes it)`);

console.log('\n✔ Applied. Next:');
console.log('  - npm run format:check and npm test, then commit and push (prod); move the url.json version bumps to stage when switching');
console.log(`  - app repo: copy the changed v1/tasks/*.json and the wizard folder change into config/missions for the next release`);
