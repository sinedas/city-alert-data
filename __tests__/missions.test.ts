/**
 * Missions / Tasks Validation Tests
 *
 * Validates task JSON files in city-alert-data/v1/tasks/
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { isTaskInAlertCircle, calculateDistance } from './helpers/distance';
import { TASKS_DIR, MISSIONS_JSON, URL_JSON, PACKAGES_DIR } from './helpers/paths';

const VALID_TASK_TYPES = [
  'text_answer',
  'wordle',
  'photoValidation',
  'timepointer',
  'timeline',
  'team_name',
  'roulette',
  'audio',
  'chain',
  'bomb',
  'matchmaker'
];

const REQUIRED_FIELDS = ['id', 'name', 'lat', 'lng'];

const MAX_PHOTO_VALIDATION_PROMPT_LEN = 1000;
const MAX_PHOTO_VALIDATION_TRANSFORM_PROMPT_LEN = 1000;

function getMissionFiles(): string[] {
  if (!fs.existsSync(TASKS_DIR)) {
    return [];
  }
  return fs.readdirSync(TASKS_DIR).filter(f => f.endsWith('.json'));
}

function loadMission(filename: string): any[] | null {
  try {
    const filePath = path.join(TASKS_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Get available collection names from packages dirs (if present).
 * city-alert-data has no packages — returns empty list.
 */
function getAvailableCollections(): string[] {
  if (!PACKAGES_DIR) {
    return [];
  }
  const names = new Set<string>();
  for (const locale of ['lt', 'en']) {
    const dir = path.join(PACKAGES_DIR, locale);
    if (!fs.existsSync(dir)) continue;
    const files = fs.readdirSync(dir);
    files
      .filter((f) => f.endsWith('.json') && !f.includes('_copy'))
      .forEach((f) => names.add(f.replace('.json', '')));
  }
  return Array.from(names);
}

describe('Bundled Missions Validation', () => {
  const missionFiles = getMissionFiles();

  it('should have at least one mission file', () => {
    expect(missionFiles.length).toBeGreaterThan(0);
  });

  describe.each(missionFiles)('Mission: %s', (filename) => {
    const missionCode = filename.replace('.json', '');
    const tasks = loadMission(filename);

    it('should be valid JSON', () => {
      expect(tasks).not.toBeNull();
    });

    it('should be an array', () => {
      expect(Array.isArray(tasks)).toBe(true);
    });

    if (!tasks || !Array.isArray(tasks)) {
      return;
    }

    it('should have at least one task', () => {
      expect(tasks.length).toBeGreaterThan(0);
    });

    describe('Task IDs', () => {
      it('should have unique task IDs', () => {
        const ids = tasks.map(t => t.id).filter(Boolean);
        const uniqueIds = new Set(ids);
        const duplicates = ids.filter((id, index) => ids.indexOf(id) !== index);

        expect(duplicates).toEqual([]);
        expect(ids.length).toBe(uniqueIds.size);
      });

      it('should have valid task ID format', () => {
        tasks.forEach((task, index) => {
          expect(task.id, `Task [${index}] should have an ID`).toBeDefined();
          expect(typeof task.id, `Task [${index}] ID should be a string`).toBe('string');
          expect(task.id.length, `Task [${index}] ID should not be empty`).toBeGreaterThan(0);
        });
      });
    });

    describe('Required Fields', () => {
      it('should have all required fields', () => {
        tasks.forEach((task, index) => {
          REQUIRED_FIELDS.forEach(field => {
            expect(
              task[field],
              `Task [${index}] "${task.id}" should have field "${field}"`
            ).toBeDefined();

            expect(
              task[field] !== null && task[field] !== '',
              `Task [${index}] "${task.id}" field "${field}" should not be null or empty`
            ).toBe(true);
          });
        });
      });
    });

    describe('Task Types', () => {
      it('should have valid task types', () => {
        tasks.forEach((task, index) => {
          const taskType = task.type || 'text_answer';
          expect(
            VALID_TASK_TYPES.includes(taskType),
            `Task [${index}] "${task.id}" has invalid type "${taskType}". Valid types: ${VALID_TASK_TYPES.join(', ')}`
          ).toBe(true);
        });
      });
    });

    describe('Photo validation prompts (API limits)', () => {
      it('prompt and transformationPrompt must not exceed backend init limits', () => {
        tasks.forEach((task, index) => {
          const taskType = task.type || 'text_answer';
          if (taskType !== 'photoValidation' || !task.photoValidation) return;

          const pv = task.photoValidation;
          if (typeof pv.prompt === 'string') {
            expect(
              pv.prompt.length,
              `${filename} task [${index}] "${task.id}" photoValidation.prompt length ${pv.prompt.length} exceeds ${MAX_PHOTO_VALIDATION_PROMPT_LEN} (POST /v1/photo/validate/init will return 400)`
            ).toBeLessThanOrEqual(MAX_PHOTO_VALIDATION_PROMPT_LEN);
          }
          if (typeof pv.transformationPrompt === 'string') {
            expect(
              pv.transformationPrompt.length,
              `${filename} task [${index}] "${task.id}" photoValidation.transformationPrompt length ${pv.transformationPrompt.length} exceeds ${MAX_PHOTO_VALIDATION_TRANSFORM_PROMPT_LEN} (POST /v1/photo/validate/init will return 400)`
            ).toBeLessThanOrEqual(MAX_PHOTO_VALIDATION_TRANSFORM_PROMPT_LEN);
          }
        });
      });
    });

    describe('Coordinates', () => {
      it('should have valid latitude', () => {
        tasks.forEach((task, index) => {
          if (typeof task.lat === 'number') {
            expect(
              task.lat,
              `Task [${index}] "${task.id}" latitude should be between -90 and 90`
            ).toBeGreaterThanOrEqual(-90);
            expect(task.lat).toBeLessThanOrEqual(90);
          }
        });
      });

      it('should have valid longitude', () => {
        tasks.forEach((task, index) => {
          if (typeof task.lng === 'number') {
            expect(
              task.lng,
              `Task [${index}] "${task.id}" longitude should be between -180 and 180`
            ).toBeGreaterThanOrEqual(-180);
            expect(task.lng).toBeLessThanOrEqual(180);
          }
        });
      });
    });

    describe('Task References', () => {
      const taskIds = new Set(tasks.map(t => t.id));

      it('should have valid nextTaskId references', () => {
        tasks.forEach((task, index) => {
          if (task.nextTaskId) {
            expect(
              taskIds.has(task.nextTaskId),
              `Task [${index}] "${task.id}" nextTaskId "${task.nextTaskId}" does not exist`
            ).toBe(true);
          }
        });
      });

      it('should have valid reward.transformedImage references', () => {
        tasks.forEach((task, index) => {
          if (task.reward?.transformedImage) {
            expect(
              taskIds.has(task.reward.transformedImage),
              `Task [${index}] "${task.id}" reward.transformedImage "${task.reward.transformedImage}" does not exist`
            ).toBe(true);
          }
        });
      });

      it('should have reward.transformedImage pointing to photoValidation tasks only', () => {
        const taskTypeMap = new Map<string, string>();
        tasks.forEach((task) => {
          taskTypeMap.set(task.id, task.type || 'text_answer');
        });

        tasks.forEach((task, index) => {
          if (task.reward?.transformedImage) {
            const referencedTaskId = task.reward.transformedImage;
            const referencedTaskType = taskTypeMap.get(referencedTaskId);

            expect(
              referencedTaskType === 'photoValidation',
              `Task [${index}] "${task.id}" reward.transformedImage "${referencedTaskId}" points to task with type "${referencedTaskType}", but should point to "photoValidation" task`
            ).toBe(true);
          }
        });
      });

      it('should have valid task-level transformedImage references', () => {
        tasks.forEach((task, index) => {
          if (task.transformedImage) {
            expect(
              taskIds.has(task.transformedImage),
              `Task [${index}] "${task.id}" transformedImage "${task.transformedImage}" does not exist`
            ).toBe(true);
          }
        });
      });

      it('should have task-level transformedImage pointing to photoValidation tasks only', () => {
        const taskTypeMap = new Map<string, string>();
        tasks.forEach((task) => {
          taskTypeMap.set(task.id, task.type || 'text_answer');
        });

        tasks.forEach((task, index) => {
          if (task.transformedImage) {
            const referencedTaskId = task.transformedImage;
            const referencedTaskType = taskTypeMap.get(referencedTaskId);

            expect(
              referencedTaskType === 'photoValidation',
              `Task [${index}] "${task.id}" transformedImage "${referencedTaskId}" points to task with type "${referencedTaskType}", but should point to "photoValidation" task`
            ).toBe(true);
          }
        });
      });
    });

    describe('Collection References', () => {
      // Skip collection-existence checks when packages are not in this repo
      const availableCollections = getAvailableCollections();
      const packagesAvailable = PACKAGES_DIR != null && availableCollections.length > 0;

      it('should have valid random collection references', () => {
        if (!packagesAvailable) {
          // city-alert-data has no config/packages — do not fail CI
          expect(true).toBe(true);
          return;
        }

        tasks.forEach((task, index) => {
          const taskType = task.type || 'text_answer';

          if (['timeline', 'timepointer', 'wordle'].includes(taskType) && task.random) {
            expect(
              availableCollections.includes(task.random),
              `Task [${index}] "${task.id}" references non-existent collection "${task.random}"`
            ).toBe(true);
          }

          if (task.alternative && task.alternative.random) {
            expect(
              availableCollections.includes(task.alternative.random),
              `Task [${index}] "${task.id}" alternative references non-existent collection "${task.alternative.random}"`
            ).toBe(true);
          }
        });
      });
    });

    describe('Timeline/Timepointer Tasks', () => {
      it('should have valid timeline event structure', () => {
        tasks.forEach((task, index) => {
          const taskType = task.type || 'text_answer';

          if (['timeline', 'timepointer'].includes(taskType)) {
            if (task.events && !task.random) {
              expect(
                Array.isArray(task.events),
                `Task [${index}] "${task.id}" events should be an array`
              ).toBe(true);

              expect(
                task.events.length,
                `Task [${index}] "${task.id}" should have at least 2 events`
              ).toBeGreaterThanOrEqual(2);

              task.events.forEach((event: any, eventIndex: number) => {
                expect(
                  event.name,
                  `Task [${index}] "${task.id}" event [${eventIndex}] should have a name`
                ).toBeDefined();

                expect(
                  typeof event.order === 'number',
                  `Task [${index}] "${task.id}" event [${eventIndex}] should have numeric order`
                ).toBe(true);
              });

              const orders = task.events.map((e: any) => e.order).sort((a: number, b: number) => a - b);
              const expectedOrders = Array.from({ length: orders.length }, (_, i) => i + 1);

              expect(
                JSON.stringify(orders),
                `Task [${index}] "${task.id}" events should have sequential order (1, 2, 3, ...)`
              ).toBe(JSON.stringify(expectedOrders));
            }

            if (task.random && !task.events) {
              expect(true).toBe(true);
            }

            if (!task.events && !task.random) {
              expect(
                false,
                `Task [${index}] "${task.id}" must have either "events" or "random" field`
              ).toBe(true);
            }
          }
        });
      });
    });

    describe('Wordle Tasks', () => {
      it('should have valid fixed word format (if specified)', () => {
        tasks.forEach((task, index) => {
          const taskType = task.type || 'text_answer';

          if (taskType === 'wordle' && task.word) {
            expect(
              typeof task.word === 'string',
              `Task [${index}] "${task.id}" wordle word should be a string`
            ).toBe(true);

            expect(
              task.word === task.word.toUpperCase(),
              `Task [${index}] "${task.id}" wordle word "${task.word}" should be UPPERCASE`
            ).toBe(true);

            expect(
              task.word.length >= 5 && task.word.length <= 8,
              `Task [${index}] "${task.id}" wordle word "${task.word}" should be 5-8 characters (got ${task.word.length})`
            ).toBe(true);

            expect(
              /^[A-Z]+$/.test(task.word),
              `Task [${index}] "${task.id}" wordle word "${task.word}" should contain only letters (A-Z)`
            ).toBe(true);

            expect(
              !/[ĄČĘĖĮŠŲŪŽ]/i.test(task.word),
              `Task [${index}] "${task.id}" wordle word "${task.word}" should not contain Lithuanian diacritics`
            ).toBe(true);
          }

          if (task.alternative && task.alternative.type === 'wordle' && task.alternative.word) {
            const word = task.alternative.word;

            expect(
              typeof word === 'string',
              `Task [${index}] "${task.id}" alternative wordle word should be a string`
            ).toBe(true);

            expect(
              word === word.toUpperCase(),
              `Task [${index}] "${task.id}" alternative wordle word "${word}" should be UPPERCASE`
            ).toBe(true);

            expect(
              word.length >= 5 && word.length <= 8,
              `Task [${index}] "${task.id}" alternative wordle word "${word}" should be 5-8 characters (got ${word.length})`
            ).toBe(true);

            expect(
              /^[A-Z]+$/.test(word),
              `Task [${index}] "${task.id}" alternative wordle word "${word}" should contain only letters (A-Z)`
            ).toBe(true);

            expect(
              !/[ĄČĘĖĮŠŲŪŽ]/i.test(word),
              `Task [${index}] "${task.id}" alternative wordle word "${word}" should not contain Lithuanian diacritics`
            ).toBe(true);
          }
        });
      });
    });

    describe('Alternative Content', () => {
      it('should have valid alternative structure', () => {
        tasks.forEach((task, index) => {
          if (task.alternative) {
            expect(
              task.alternative.type,
              `Task [${index}] "${task.id}" alternative should have a type`
            ).toBeDefined();

            expect(
              VALID_TASK_TYPES.includes(task.alternative.type),
              `Task [${index}] "${task.id}" alternative has invalid type "${task.alternative.type}"`
            ).toBe(true);
          }
        });
      });
    });

    describe('Branching Detection', () => {
      it('should warn about potential branching (multiple tasks pointing to same nextTaskId)', () => {
        const nextTaskIdMap = new Map<string, string[]>();

        tasks.forEach((task) => {
          if (task.nextTaskId) {
            if (!nextTaskIdMap.has(task.nextTaskId)) {
              nextTaskIdMap.set(task.nextTaskId, []);
            }
            nextTaskIdMap.get(task.nextTaskId)!.push(task.id);
          }
        });

        const branchingTasks: string[] = [];
        nextTaskIdMap.forEach((referencingTasks, nextId) => {
          if (referencingTasks.length > 1) {
            branchingTasks.push(`"${nextId}" ← [${referencingTasks.join(', ')}]`);
          }
        });

        if (branchingTasks.length > 0) {
          console.warn(`⚠️  Potential branching in ${missionCode}: ${branchingTasks.join(', ')}`);
        }

        expect(true).toBe(true);
      });
    });
  });
});

describe('Mission List (missions.json)', () => {
  let missions: any[] = [];
  let parseError: Error | null = null;

  beforeAll(() => {
    try {
      const content = fs.readFileSync(MISSIONS_JSON, 'utf-8');
      missions = JSON.parse(content);
    } catch (e: any) {
      parseError = e;
    }
  });

  it('should exist', () => {
    expect(fs.existsSync(MISSIONS_JSON)).toBe(true);
  });

  it('should be valid JSON', () => {
    if (parseError) {
      throw new Error(`Failed to parse missions.json: ${parseError.message}\nLine: ${parseError.message.match(/line (\d+)/i)?.[1] || 'unknown'}`);
    }
    expect(missions).not.toBeNull();
  });

  it('should be an array', () => {
    expect(Array.isArray(missions)).toBe(true);
  });

  it('should have at least one mission', () => {
    expect(missions.length).toBeGreaterThan(0);
  });

  describe('Required Fields', () => {
    if (!missions || !Array.isArray(missions) || missions.length === 0) {
      it.skip('skipped - no missions available', () => {});
      return;
    }
    missions.forEach((mission, index) => {
      describe(`Mission [${index}] "${mission.code || 'unknown'}"`, () => {
        it('should have code', () => {
          expect(mission.code, `Mission [${index}] should have "code" field`).toBeDefined();
          expect(typeof mission.code, `Mission [${index}] code should be a string`).toBe('string');
          expect(mission.code.length, `Mission [${index}] code should not be empty`).toBeGreaterThan(0);
        });

        it('should have title', () => {
          expect(mission.title, `Mission [${index}] "${mission.code}" should have "title"`).toBeDefined();
          expect(typeof mission.title, `Mission [${index}] "${mission.code}" title should be a string`).toBe('string');
        });

        it('should have location', () => {
          expect(mission.location, `Mission [${index}] "${mission.code}" should have "location"`).toBeDefined();
          expect(typeof mission.location, `Mission [${index}] "${mission.code}" location should be an object`).toBe('object');

          if (mission.location) {
            expect(typeof mission.location.lat, `Mission [${index}] "${mission.code}" location.lat should be a number`).toBe('number');
            expect(typeof mission.location.lng, `Mission [${index}] "${mission.code}" location.lng should be a number`).toBe('number');
          }
        });

        it('should have active flag', () => {
          expect(mission.active, `Mission [${index}] "${mission.code}" should have "active" field`).toBeDefined();
          expect(typeof mission.active, `Mission [${index}] "${mission.code}" active should be boolean`).toBe('boolean');
        });

        it('should have locked flag', () => {
          expect(mission.locked, `Mission [${index}] "${mission.code}" should have "locked" field`).toBeDefined();
          expect(typeof mission.locked, `Mission [${index}] "${mission.code}" locked should be boolean`).toBe('boolean');
        });

        it('should have checkLocation flag', () => {
          expect(mission.checkLocation, `Mission [${index}] "${mission.code}" should have "checkLocation" field`).toBeDefined();
          expect(typeof mission.checkLocation, `Mission [${index}] "${mission.code}" checkLocation should be boolean`).toBe('boolean');
        });
      });
    });
  });

  describe('Data Logic', () => {
    it('should have unique mission codes', () => {
      const codes = missions.map(m => m.code).filter(Boolean);
      const uniqueCodes = new Set(codes);
      const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index);

      expect(duplicates, `Duplicate mission codes found: ${duplicates.join(', ')}`).toEqual([]);
      expect(codes.length).toBe(uniqueCodes.size);
    });

    it('should have valid coordinates', () => {
      missions.forEach((mission, index) => {
        if (mission.location) {
          expect(
            mission.location.lat,
            `Mission [${index}] "${mission.code}" latitude should be between -90 and 90`
          ).toBeGreaterThanOrEqual(-90);
          expect(mission.location.lat).toBeLessThanOrEqual(90);

          expect(
            mission.location.lng,
            `Mission [${index}] "${mission.code}" longitude should be between -180 and 180`
          ).toBeGreaterThanOrEqual(-180);
          expect(mission.location.lng).toBeLessThanOrEqual(180);
        }
      });
    });

    it('should have valid duration (positive number)', () => {
      missions.forEach((mission, index) => {
        if (mission.duration !== undefined) {
          expect(
            typeof mission.duration,
            `Mission [${index}] "${mission.code}" duration should be a number`
          ).toBe('number');
          expect(
            mission.duration,
            `Mission [${index}] "${mission.code}" duration should be positive`
          ).toBeGreaterThan(0);
        }
      });
    });

    it('should have valid hints (non-negative number)', () => {
      missions.forEach((mission, index) => {
        if (mission.hints !== undefined) {
          expect(
            typeof mission.hints,
            `Mission [${index}] "${mission.code}" hints should be a number`
          ).toBe('number');
          expect(
            mission.hints,
            `Mission [${index}] "${mission.code}" hints should be non-negative`
          ).toBeGreaterThanOrEqual(0);
        }
      });
    });

    it('should have valid diameter values', () => {
      missions.forEach((mission, index) => {
        if (mission.initialDiameter !== undefined && mission.finalDiameter !== undefined) {
          expect(
            mission.initialDiameter,
            `Mission [${index}] "${mission.code}" initialDiameter should be >= finalDiameter`
          ).toBeGreaterThanOrEqual(mission.finalDiameter);
        }
      });
    });

    it('all tasks should fall within the initial alert circle', () => {
      const failures: string[] = [];

      missions.forEach((mission) => {
        if (!mission?.code || !mission.location || mission.initialDiameter == null) {
          return;
        }

        const center = {
          latitude: mission.location.lat,
          longitude: mission.location.lng,
        };
        const diameter = mission.initialDiameter;
        const radius = diameter / 2;

        const taskFiles = [
          path.join(TASKS_DIR, `${mission.code}.json`),
          path.join(TASKS_DIR, `${mission.code}_extended.json`),
        ];

        for (const taskFile of taskFiles) {
          if (!fs.existsSync(taskFile)) continue;

          let tasks: any[];
          try {
            tasks = JSON.parse(fs.readFileSync(taskFile, 'utf-8'));
          } catch {
            failures.push(`${mission.code}: failed to parse ${path.basename(taskFile)}`);
            continue;
          }
          if (!Array.isArray(tasks)) continue;

          for (const task of tasks) {
            if (typeof task?.lat !== 'number' || typeof task?.lng !== 'number') continue;

            const inside = isTaskInAlertCircle(task.lat, task.lng, center, diameter);
            if (inside) continue;

            const distance = Math.round(
              calculateDistance(
                { latitude: task.lat, longitude: task.lng },
                center
              )
            );
            const overBy = distance - Math.round(radius);
            failures.push(
              `${mission.code} task "${task.id}" (${path.basename(taskFile)}): ` +
                `${distance}m from center, radius ${Math.round(radius)}m ` +
                `(outside by ${overBy}m)`
            );
          }
        }
      });

      expect(
        failures,
        `Tasks outside initial circle (location + initialDiameter/2):\n${failures.join('\n')}`
      ).toEqual([]);
    });

    it('remoteMissions in url.json should have corresponding task files', () => {
      expect(fs.existsSync(URL_JSON), 'url.json should exist').toBe(true);
      const urlConfig = JSON.parse(fs.readFileSync(URL_JSON, 'utf-8'));
      const remoteMissions: string[] = Array.isArray(urlConfig.remoteMissions)
        ? urlConfig.remoteMissions
        : [];

      expect(remoteMissions.length, 'url.json remoteMissions should not be empty').toBeGreaterThan(0);

      const missionCodes = new Set(missions.map((m) => m.code).filter(Boolean));

      remoteMissions.forEach((code) => {
        expect(
          missionCodes.has(code),
          `remoteMission "${code}" should also be listed in v1/missions.json`
        ).toBe(true);

        const taskFile = path.join(TASKS_DIR, `${code}.json`);
        expect(
          fs.existsSync(taskFile),
          `remoteMission "${code}" should have v1/tasks/${code}.json`
        ).toBe(true);
      });
    });

    it('should not have orphaned mission files', () => {
      const missionFiles = fs.existsSync(TASKS_DIR)
        ? fs.readdirSync(TASKS_DIR)
            .filter(f => f.endsWith('.json'))
            // Extended task files are expected companions, not orphans
            .filter(f => !f.endsWith('_extended.json'))
            .map(f => f.replace('.json', ''))
        : [];

      const missionCodes = new Set(missions.map(m => m.code));
      const orphanedFiles = missionFiles.filter(code => !missionCodes.has(code));

      if (orphanedFiles.length > 0) {
        console.warn(`⚠️  Orphaned mission files (not in missions.json): ${orphanedFiles.join(', ')}`);
      }

      expect(true).toBe(true);
    });

    it('should have valid teamName structure (if present)', () => {
      missions.forEach((mission, index) => {
        if (mission.teamName) {
          expect(
            mission.teamName.title,
            `Mission [${index}] "${mission.code}" teamName should have "title"`
          ).toBeDefined();

          expect(
            typeof mission.teamName.time,
            `Mission [${index}] "${mission.code}" teamName.time should be a number`
          ).toBe('number');

          if (mission.teamName.text) {
            expect(
              Array.isArray(mission.teamName.text),
              `Mission [${index}] "${mission.code}" teamName.text should be an array`
            ).toBe(true);

            mission.teamName.text.forEach((textItem: any, textIndex: number) => {
              expect(
                typeof textItem === 'string',
                `Mission [${index}] "${mission.code}" teamName.text[${textIndex}] should be a string`
              ).toBe(true);
            });
          }

          if (mission.teamName.points !== undefined) {
            expect(
              typeof mission.teamName.points,
              `Mission [${index}] "${mission.code}" teamName.points should be a number`
            ).toBe('number');
          }
        }
      });
    });

    it('should have valid endPage structure (if present)', () => {
      missions.forEach((mission, index) => {
        if (mission.endPage) {
          expect(
            mission.endPage.title,
            `Mission [${index}] "${mission.code}" endPage should have "title"`
          ).toBeDefined();

          if (mission.endPage.text) {
            expect(
              Array.isArray(mission.endPage.text),
              `Mission [${index}] "${mission.code}" endPage.text should be an array`
            ).toBe(true);

            mission.endPage.text.forEach((textItem: any, textIndex: number) => {
              expect(
                typeof textItem === 'string',
                `Mission [${index}] "${mission.code}" endPage.text[${textIndex}] should be a string`
              ).toBe(true);
            });
          }

          if (mission.endPage.image !== undefined) {
            expect(
              typeof mission.endPage.image,
              `Mission [${index}] "${mission.code}" endPage.image should be a string`
            ).toBe('string');
          }
        }
      });
    });
  });
});
