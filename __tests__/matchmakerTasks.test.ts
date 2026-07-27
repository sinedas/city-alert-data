/**
 * Matchmaker Task Data Validation
 *
 * Validates the shape of every matchmaker task found in mission task files
 * (both main `<code>.json` and extended `<code>_extended.json`):
 *  - has a `matchmaker` object with a non-empty `images` pool
 *  - `displayCount` is a positive integer
 *  - every correct `answer` id exists in the pool
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TASKS_DIR } from './helpers/paths';

function collectMatchmakerTasks(): { file: string; task: any }[] {
  const out: { file: string; task: any }[] = [];
  if (!fs.existsSync(TASKS_DIR)) return out;
  const files = fs.readdirSync(TASKS_DIR).filter((f) => f.endsWith('.json'));
  for (const file of files) {
    const raw = fs.readFileSync(path.join(TASKS_DIR, file), 'utf-8');
    let data: any;
    try {
      data = JSON.parse(raw);
    } catch {
      continue;
    }
    if (!Array.isArray(data)) continue;
    for (const task of data) {
      if (task && task.type === 'matchmaker') {
        out.push({ file, task });
      }
    }
  }
  return out;
}

const matchmakerTasks = collectMatchmakerTasks();

describe('Matchmaker task data', () => {
  it('there is at least one matchmaker task in the bundled data', () => {
    expect(matchmakerTasks.length).toBeGreaterThan(0);
  });

  it.each(matchmakerTasks)('$file task $task.id has a valid matchmaker shape', ({ task }) => {
    expect(task.matchmaker).toBeDefined();
    expect(Array.isArray(task.matchmaker.images)).toBe(true);
    expect(task.matchmaker.images.length).toBeGreaterThan(0);

    expect(typeof task.matchmaker.displayCount).toBe('number');
    expect(Number.isInteger(task.matchmaker.displayCount)).toBe(true);
    expect(task.matchmaker.displayCount).toBeGreaterThanOrEqual(1);

    // Single attempt is the product requirement for matchmaker.
    expect(task.attempts).toBe(1);
  });

  it.each(matchmakerTasks)('$file task $task.id answers all exist in the pool', ({ task }) => {
    expect(Array.isArray(task.answer)).toBe(true);
    expect(task.answer.length).toBeGreaterThan(0);
    for (const ans of task.answer) {
      expect(task.matchmaker.images).toContain(ans);
    }
  });
});
