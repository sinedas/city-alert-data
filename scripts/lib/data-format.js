/**
 * One format for the mission data files (v1/missions.json, v1/tasks/*.json),
 * shared by scripts/format-data.js and any future editor that writes them:
 * JSON.stringify with 4 spaces, LF, a trailing newline, keys in the order below.
 *
 * The orders follow the files as they were (2026-11-06), chosen so the one-off
 * reformat moves as few keys as possible: 4 spaces is what most files used, and
 * e.g. startType / startCarousel before type, image before text, as in most tasks.
 * Keys no file used yet sit next to their relatives.
 *
 * Keys the order does not know keep their place after the known ones and are
 * reported: in this data they have so far been typos (startCarosel) or
 * switched-off fields ("reward eyeball").
 *
 * Key lists follow city-alert types/gameTypes.ts (Challenge, Task) plus fields
 * the data uses that the type does not declare (level, route, routeImageUrl).
 */

const INDENT = 4;

const LAT_LNG = { keys: ['lat', 'lng'] };
const PAGE = { keys: ['title', 'text', 'image'] };
const CAROUSEL = { keys: ['text', 'images', 'changeInterval'] };

const MISSION = {
  keys: [
    'code',
    'folder',
    'title',
    'image',
    'images',
    'location',
    'initialDiameter',
    'finalDiameter',
    'duration',
    'active',
    'level',
    'circleMode',
    'locked',
    'demo',
    'circle',
    'description',
    'longDescription',
    'city',
    'start',
    'finish',
    'startLocation',
    'route',
    'routeImageUrl',
    'missionUrl',
    'routeUrl',
    'hints',
    'beforeTeamName',
    'checkLocation',
    'details',
    'teamName',
    'afterTeamName',
    'pointsPerLeftMinutes',
    'missingPhotosCount',
    'missingPhotosIntro',
    'missingPhotosAlbumImage',
    'missingPhotosAlbumText',
    'endPage',
  ],
  fields: {
    location: LAT_LNG,
    startLocation: LAT_LNG,
    beforeTeamName: PAGE,
    teamName: { keys: ['title', 'time', 'text', 'points'] },
    afterTeamName: PAGE,
    missingPhotosIntro: PAGE,
    endPage: PAGE,
  },
};

const TASK = {
  keys: [
    'id',
    'name',
    'lat',
    'lng',
    'radius',
    'startType',
    'startCarousel',
    'type',
    'audio',
    'image',
    'transformedImage',
    'iconType',
    'photoValidation',
    'photoTransformation',
    'text',
    'matchmaker',
    'answer',
    'word',
    'random',
    'events',
    'points',
    'attempts',
    'minusPointsOnAttempt',
    'time',
    'hint',
    'rewardType',
    'reward',
    'rewardCarousel',
    'alternative',
    'nextTaskId',
  ],
  fields: {
    startCarousel: CAROUSEL,
    events: { keys: ['name', 'order', 'text', 'description', 'image'] },
    matchmaker: { keys: ['images', 'displayCount'] },
    photoValidation: { keys: ['prompt', 'transformationPrompt'] },
    photoTransformation: { keys: ['prompt', 'validationPrompt'] },
    hint: { keys: ['text', 'image', 'points'] },
    reward: { keys: ['text', 'image', 'transformedImage'] },
    rewardCarousel: CAROUSEL,
    alternative: { keys: ['type', 'random', 'text', 'image', 'word'] },
  },
};

const KINDS = {
  missions: { schema: MISSION, idKey: 'code', label: 'mission' },
  tasks: { schema: TASK, idKey: 'id', label: 'task' },
};

function isPlainObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Arrays (e.g. timeline events) get the schema applied to each item. */
function orderValue(value, schema, where, unknownKeys) {
  if (Array.isArray(value)) {
    return value.map((item) => orderValue(item, schema, where, unknownKeys));
  }
  if (!isPlainObject(value)) return value;

  const ordered = {};
  const child = (key) => {
    const childSchema = schema.fields && schema.fields[key];
    return childSchema ? orderValue(value[key], childSchema, `${where}.${key}`, unknownKeys) : value[key];
  };
  for (const key of schema.keys) {
    if (Object.prototype.hasOwnProperty.call(value, key)) ordered[key] = child(key);
  }
  for (const key of Object.keys(value)) {
    if (schema.keys.includes(key)) continue;
    unknownKeys.push(`${where}: ${key}`);
    ordered[key] = value[key];
  }
  return ordered;
}

/** Same data regardless of key order - guards the formatter against changing content. */
function sortedJson(value) {
  return JSON.stringify(value, (_key, v) =>
    isPlainObject(v) ? Object.fromEntries(Object.keys(v).sort().map((k) => [k, v[k]])) : v
  );
}

/**
 * Formats the text of one data file.
 * @param {string} text file contents
 * @param {'missions' | 'tasks'} kind
 * @returns {{ output: string, unknownKeys: string[] }}
 */
function formatDocument(text, kind) {
  const { schema, idKey, label } = KINDS[kind];
  const data = JSON.parse(text.replace(/^\uFEFF/, ''));
  if (!Array.isArray(data)) throw new Error(`expected a JSON array of ${label}s`);

  const unknownKeys = [];
  const ordered = data.map((item, index) => {
    const id = isPlainObject(item) && item[idKey] !== undefined ? item[idKey] : `#${index}`;
    return orderValue(item, schema, `${label} "${id}"`, unknownKeys);
  });
  const output = JSON.stringify(ordered, null, INDENT) + '\n';

  if (sortedJson(JSON.parse(output)) !== sortedJson(data)) {
    throw new Error('formatting would change the data');
  }
  return { output, unknownKeys };
}

/** Which kind a repo-relative path is, or null for files the format does not cover. */
function kindOf(relativePath) {
  const p = relativePath.split('\\').join('/');
  if (p === 'v1/missions.json') return 'missions';
  if (/^v1\/tasks\/[^/]+\.json$/.test(p)) return 'tasks';
  return null;
}

module.exports = { INDENT, formatDocument, kindOf };
