/**
 * Local image file existence checks for mission content.
 *
 * Walks v1/missions.json covers + every v1/tasks/*.json image reference and
 * asserts the file exists under v1/img/. Runs as part of `npm test` / CI
 * (validate-stage.yml) — no network.
 *
 * Path rules (mirror city-alert image loading):
 *  - mission cover `image` → v1/img/{file}
 *  - task images → v1/img/{folder}/{file}
 *  - endPage.image → v1/img/{folder}/{file} (same as task images)
 *  - `shared/...` → v1/img/shared/...
 *  - folder = missions.json `folder` ?? code; `*_extended` uses parent folder
 *  - http(s) URLs skipped; `[img source=…]` text tags are app assets (not checked)
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TASKS_DIR, MISSIONS_JSON, IMG_DIR } from './helpers/paths';

interface MissingImage {
  source: string;
  task?: string;
  image: string;
  expectedPath: string;
}

function getTaskFiles(): string[] {
  if (!fs.existsSync(TASKS_DIR)) return [];
  return fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith('.json'));
}

function loadJson(filePath: string): unknown {
  return JSON.parse(fs.readFileSync(filePath, 'utf-8'));
}

/** code → image folder under v1/img/ */
function getMissionImageFolderMap(): Record<string, string> {
  const map: Record<string, string> = {};
  if (!fs.existsSync(MISSIONS_JSON)) return map;
  const list = loadJson(MISSIONS_JSON);
  if (!Array.isArray(list)) return map;
  for (const m of list) {
    const code = m?.code;
    if (typeof code === 'string') {
      map[code] = typeof m?.folder === 'string' ? m.folder : code;
    }
  }
  return map;
}

/**
 * `<code>_extended` shares the parent mission's image folder.
 * Honor missions.json `folder` when present (e.g. london_en → london).
 */
function resolveImageFolder(
  missionCode: string,
  imageFolderByCode: Record<string, string>
): string {
  const baseCode = missionCode.endsWith('_extended')
    ? missionCode.slice(0, -'_extended'.length)
    : missionCode;
  return imageFolderByCode[baseCode] ?? imageFolderByCode[missionCode] ?? baseCode;
}

/** Collect every CDN/local image filename referenced by a task object. */
function extractImagePaths(task: Record<string, any>): string[] {
  const images: string[] = [];

  if (task.image) images.push(task.image);
  if (task.startImage) images.push(task.startImage);
  if (task.startCarousel?.images && Array.isArray(task.startCarousel.images)) {
    images.push(...task.startCarousel.images);
  }
  if (task.alternative?.image) images.push(task.alternative.image);
  if (task.reward?.image) images.push(task.reward.image);
  if (task.rewardCarousel?.images && Array.isArray(task.rewardCarousel.images)) {
    images.push(...task.rewardCarousel.images);
  }
  if (task.hint?.image) images.push(task.hint.image);
  if (task.events && Array.isArray(task.events)) {
    for (const event of task.events) {
      if (event?.image) images.push(event.image);
    }
  }
  if (task.matchmaker?.images && Array.isArray(task.matchmaker.images)) {
    images.push(...task.matchmaker.images);
  }

  return Array.from(new Set(images.filter((v) => typeof v === 'string' && v.length > 0)));
}

function isRemoteUrl(imagePath: string): boolean {
  return /^https?:\/\//i.test(imagePath);
}

/**
 * Resolve a referenced image to an absolute path under v1/img/.
 * Returns null for remote URLs (nothing to check on disk).
 */
function resolveLocalImagePath(imagePath: string, imageFolder: string): string | null {
  if (isRemoteUrl(imagePath)) return null;
  const normalized = imagePath.replace(/^\/+/, '');
  if (normalized.startsWith('shared/')) {
    return path.join(IMG_DIR, normalized);
  }
  return path.join(IMG_DIR, imageFolder, normalized);
}

describe('Mission image files exist on disk', () => {
  it('v1/img directory exists', () => {
    expect(fs.existsSync(IMG_DIR), `Missing image root: ${IMG_DIR}`).toBe(true);
  });

  it('all missions.json cover images exist under v1/img/', () => {
    expect(fs.existsSync(MISSIONS_JSON)).toBe(true);
    const list = loadJson(MISSIONS_JSON);
    expect(Array.isArray(list)).toBe(true);

    const missing: MissingImage[] = [];
    for (const m of list as any[]) {
      const cover = m?.image;
      if (!cover || typeof cover !== 'string' || isRemoteUrl(cover)) continue;
      const expectedPath = path.join(IMG_DIR, cover.replace(/^\/+/, ''));
      if (!fs.existsSync(expectedPath)) {
        missing.push({
          source: `missions.json:${m.code ?? '?'}`,
          image: cover,
          expectedPath: path.relative(path.join(IMG_DIR, '..', '..'), expectedPath),
        });
      }
    }

    expect(missing, formatMissing(missing)).toEqual([]);
  });

  it('all missions.json endPage images exist under v1/img/{folder}/', () => {
    expect(fs.existsSync(MISSIONS_JSON)).toBe(true);
    const list = loadJson(MISSIONS_JSON);
    expect(Array.isArray(list)).toBe(true);

    const imageFolderByCode = getMissionImageFolderMap();
    const missing: MissingImage[] = [];
    let checked = 0;

    for (const m of list as any[]) {
      const endPageImage = m?.endPage?.image;
      if (
        !endPageImage ||
        typeof endPageImage !== 'string' ||
        isRemoteUrl(endPageImage)
      ) {
        continue;
      }

      const code = m?.code;
      if (typeof code !== 'string') continue;

      const imageFolder = resolveImageFolder(code, imageFolderByCode);
      const absolute = resolveLocalImagePath(endPageImage, imageFolder);
      if (!absolute) continue;

      checked += 1;
      if (!fs.existsSync(absolute)) {
        missing.push({
          source: `missions.json:${code}:endPage`,
          image: endPageImage,
          expectedPath: path.relative(path.join(IMG_DIR, '..', '..'), absolute),
        });
      }
    }

    expect(
      checked,
      'Expected at least one missions.json endPage.image to verify on disk'
    ).toBeGreaterThan(0);
    expect(missing, formatMissing(missing)).toEqual([]);
  });

  it('all task JSON image references exist under v1/img/', () => {
    const taskFiles = getTaskFiles();
    expect(taskFiles.length).toBeGreaterThan(0);

    const imageFolderByCode = getMissionImageFolderMap();
    const missing: MissingImage[] = [];
    let checked = 0;

    for (const filename of taskFiles) {
      const missionCode = filename.replace(/\.json$/, '');
      const tasks = loadJson(path.join(TASKS_DIR, filename));
      if (!Array.isArray(tasks)) continue;

      const imageFolder = resolveImageFolder(missionCode, imageFolderByCode);

      for (const task of tasks) {
        if (!task || typeof task !== 'object') continue;
        for (const imagePath of extractImagePaths(task)) {
          const absolute = resolveLocalImagePath(imagePath, imageFolder);
          if (!absolute) continue; // remote URL
          checked += 1;
          if (!fs.existsSync(absolute)) {
            missing.push({
              source: filename,
              task: task.id ?? '(no id)',
              image: imagePath,
              expectedPath: path.relative(path.join(IMG_DIR, '..', '..'), absolute),
            });
          }
        }
      }
    }

    expect(checked, 'Expected to find at least some local image references').toBeGreaterThan(0);
    expect(missing, formatMissing(missing)).toEqual([]);
  });
});

function formatMissing(missing: MissingImage[]): string {
  if (missing.length === 0) return '';
  const lines = missing.map((m) => {
    const task = m.task ? ` task="${m.task}"` : '';
    return `  • [${m.source}]${task} → ${m.image} (expected ${m.expectedPath})`;
  });
  return `Missing ${missing.length} image file(s):\n${lines.join('\n')}`;
}
