/**
 * Text Tags Validation Tests
 *
 * Validates that all custom text tags in mission task text fields
 * are properly formatted and closed:
 * - [href="URL"]text[/href] - Links
 * - [digital]text[/digital] - Digital display font
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TASKS_DIR } from './helpers/paths';

const HREF_OPEN_REGEX = /\[href="([^"]*)"\]/g;
const HREF_CLOSE_REGEX = /\[\/href\]/g;
const DIGITAL_OPEN_REGEX = /\[digital\]/g;
const DIGITAL_CLOSE_REGEX = /\[\/digital\]/g;

const HREF_COMPLETE_REGEX = /\[href="([^"]*)"\]([^[]*)\[\/href\]/g;
const DIGITAL_COMPLETE_REGEX = /\[digital\]([^[]*)\[\/digital\]/g;

interface TagError {
  mission: string;
  taskId: string;
  field: string;
  error: string;
  context?: string;
}

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

function extractTextContent(text: string | string[] | undefined): string {
  if (!text) return '';
  if (Array.isArray(text)) {
    return text.join('\n');
  }
  return text;
}

function countMatches(text: string, regex: RegExp): number {
  const matches = text.match(regex);
  return matches ? matches.length : 0;
}

function validateHrefTags(
  text: string,
  mission: string,
  taskId: string,
  field: string
): TagError[] {
  const errors: TagError[] = [];

  HREF_OPEN_REGEX.lastIndex = 0;
  HREF_CLOSE_REGEX.lastIndex = 0;
  HREF_COMPLETE_REGEX.lastIndex = 0;

  const openCount = countMatches(text, HREF_OPEN_REGEX);
  const closeCount = countMatches(text, HREF_CLOSE_REGEX);

  if (openCount !== closeCount) {
    errors.push({
      mission,
      taskId,
      field,
      error: `Unbalanced href tags: ${openCount} open, ${closeCount} close`,
      context: text.substring(0, 100),
    });
  }

  let match;
  HREF_OPEN_REGEX.lastIndex = 0;
  while ((match = HREF_OPEN_REGEX.exec(text)) !== null) {
    const url = match[1];
    if (!url || url.trim() === '') {
      errors.push({
        mission,
        taskId,
        field,
        error: 'Empty href URL',
        context: match[0],
      });
    } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
      errors.push({
        mission,
        taskId,
        field,
        error: `Invalid href URL (must start with http:// or https://): ${url}`,
        context: match[0],
      });
    }
  }

  HREF_COMPLETE_REGEX.lastIndex = 0;
  while ((match = HREF_COMPLETE_REGEX.exec(text)) !== null) {
    const linkText = match[2];
    if (!linkText || linkText.trim() === '') {
      errors.push({
        mission,
        taskId,
        field,
        error: 'Empty href link text',
        context: match[0],
      });
    }
  }

  return errors;
}

function validateDigitalTags(
  text: string,
  mission: string,
  taskId: string,
  field: string
): TagError[] {
  const errors: TagError[] = [];

  DIGITAL_OPEN_REGEX.lastIndex = 0;
  DIGITAL_CLOSE_REGEX.lastIndex = 0;
  DIGITAL_COMPLETE_REGEX.lastIndex = 0;

  const openCount = countMatches(text, DIGITAL_OPEN_REGEX);
  const closeCount = countMatches(text, DIGITAL_CLOSE_REGEX);

  if (openCount !== closeCount) {
    errors.push({
      mission,
      taskId,
      field,
      error: `Unbalanced digital tags: ${openCount} open, ${closeCount} close`,
      context: text.substring(0, 100),
    });
  }

  let match;
  DIGITAL_COMPLETE_REGEX.lastIndex = 0;
  while ((match = DIGITAL_COMPLETE_REGEX.exec(text)) !== null) {
    const content = match[1];
    if (!content || content.trim() === '') {
      errors.push({
        mission,
        taskId,
        field,
        error: 'Empty digital tag content',
        context: match[0],
      });
    }
  }

  return errors;
}

function getTaskTextFields(task: any): { field: string; text: string }[] {
  const fields: { field: string; text: string }[] = [];

  if (task.text) {
    fields.push({ field: 'text', text: extractTextContent(task.text) });
  }

  if (task.hint?.text) {
    fields.push({ field: 'hint.text', text: extractTextContent(task.hint.text) });
  }

  if (task.reward?.text) {
    fields.push({ field: 'reward.text', text: extractTextContent(task.reward.text) });
  }

  if (task.rewardCarousel?.text) {
    fields.push({ field: 'rewardCarousel.text', text: extractTextContent(task.rewardCarousel.text) });
  }

  if (task.startCarousel?.text) {
    fields.push({ field: 'startCarousel.text', text: extractTextContent(task.startCarousel.text) });
  }

  return fields;
}

describe('Text Tags Validation', () => {

  it('should have properly closed href tags', () => {
    console.log(`\n🏷️ Validating href tag closure in missions...\n`);

    const missionFiles = getMissionFiles();
    const allErrors: TagError[] = [];
    let totalTags = 0;

    for (const filename of missionFiles) {
      const missionCode = filename.replace('.json', '');
      const tasks = loadMission(filename);

      if (!tasks || !Array.isArray(tasks)) continue;

      for (const task of tasks) {
        const textFields = getTaskTextFields(task);

        for (const { field, text } of textFields) {
          HREF_OPEN_REGEX.lastIndex = 0;
          totalTags += countMatches(text, HREF_OPEN_REGEX);

          const errors = validateHrefTags(text, missionCode, task.id, field);
          allErrors.push(...errors);
        }
      }
    }

    console.log(`  📊 Total href tags found: ${totalTags}`);
    console.log(`  ❌ Errors found: ${allErrors.length}\n`);

    if (allErrors.length > 0) {
      console.error('❌ Href Tag Errors:\n');
      allErrors.forEach(({ mission, taskId, field, error, context }) => {
        console.error(`  • [${mission}] Task "${taskId}" (${field})`);
        console.error(`    Error: ${error}`);
        if (context) console.error(`    Context: ${context.substring(0, 80)}...\n`);
      });
    }

    expect(allErrors, `Found ${allErrors.length} href tag errors`).toEqual([]);
  });

  it('should have properly closed digital tags', () => {
    console.log(`\n🔢 Validating digital tag closure in missions...\n`);

    const missionFiles = getMissionFiles();
    const allErrors: TagError[] = [];
    let totalTags = 0;

    for (const filename of missionFiles) {
      const missionCode = filename.replace('.json', '');
      const tasks = loadMission(filename);

      if (!tasks || !Array.isArray(tasks)) continue;

      for (const task of tasks) {
        const textFields = getTaskTextFields(task);

        for (const { field, text } of textFields) {
          DIGITAL_OPEN_REGEX.lastIndex = 0;
          totalTags += countMatches(text, DIGITAL_OPEN_REGEX);

          const errors = validateDigitalTags(text, missionCode, task.id, field);
          allErrors.push(...errors);
        }
      }
    }

    console.log(`  📊 Total digital tags found: ${totalTags}`);
    console.log(`  ❌ Errors found: ${allErrors.length}\n`);

    if (allErrors.length > 0) {
      console.error('❌ Digital Tag Errors:\n');
      allErrors.forEach(({ mission, taskId, field, error, context }) => {
        console.error(`  • [${mission}] Task "${taskId}" (${field})`);
        console.error(`    Error: ${error}`);
        if (context) console.error(`    Context: ${context.substring(0, 80)}...\n`);
      });
    }

    expect(allErrors, `Found ${allErrors.length} digital tag errors`).toEqual([]);
  });

  it('should have valid href URLs (not empty, valid format)', () => {
    console.log(`\n🔗 Validating href URL formats...\n`);

    const missionFiles = getMissionFiles();
    const urlErrors: TagError[] = [];

    for (const filename of missionFiles) {
      const missionCode = filename.replace('.json', '');
      const tasks = loadMission(filename);

      if (!tasks || !Array.isArray(tasks)) continue;

      for (const task of tasks) {
        const textFields = getTaskTextFields(task);

        for (const { field, text } of textFields) {
          HREF_OPEN_REGEX.lastIndex = 0;
          let match;
          while ((match = HREF_OPEN_REGEX.exec(text)) !== null) {
            const url = match[1];
            if (!url || url.trim() === '') {
              urlErrors.push({
                mission: missionCode,
                taskId: task.id,
                field,
                error: 'Empty URL',
                context: match[0],
              });
            } else if (!url.startsWith('http://') && !url.startsWith('https://')) {
              urlErrors.push({
                mission: missionCode,
                taskId: task.id,
                field,
                error: 'URL must start with http:// or https://',
                context: url.substring(0, 50),
              });
            }
          }
        }
      }
    }

    if (urlErrors.length > 0) {
      console.error('❌ Invalid URL Formats:\n');
      urlErrors.forEach(({ mission, taskId, field, error, context }) => {
        console.error(`  • [${mission}] Task "${taskId}" (${field}): ${error}`);
        if (context) console.error(`    URL: ${context}\n`);
      });
    } else {
      console.log('  ✅ All href URLs have valid format\n');
    }

    expect(urlErrors, `Found ${urlErrors.length} invalid URL formats`).toEqual([]);
  });

  describe('Tag validation functions', () => {

    it('should detect unclosed href tag', () => {
      const text = 'Some text [href="https://example.com"]link without closing';
      const errors = validateHrefTags(text, 'test', '1', 'text');
      expect(errors.some(e => e.error.includes('Unbalanced'))).toBe(true);
    });

    it('should detect empty href URL', () => {
      const text = 'Some text [href=""]empty url[/href]';
      const errors = validateHrefTags(text, 'test', '1', 'text');
      expect(errors.some(e => e.error.includes('Empty href URL'))).toBe(true);
    });

    it('should detect invalid URL format', () => {
      const text = 'Some text [href="not-a-url"]bad url[/href]';
      const errors = validateHrefTags(text, 'test', '1', 'text');
      expect(errors.some(e => e.error.includes('Invalid href URL'))).toBe(true);
    });

    it('should pass valid href tags', () => {
      const text = 'Check [href="https://example.com"]this link[/href] here';
      const errors = validateHrefTags(text, 'test', '1', 'text');
      expect(errors).toEqual([]);
    });

    it('should detect unclosed digital tag', () => {
      const text = 'Number: [digital]1234 without closing';
      const errors = validateDigitalTags(text, 'test', '1', 'text');
      expect(errors.some(e => e.error.includes('Unbalanced'))).toBe(true);
    });

    it('should detect empty digital tag', () => {
      const text = 'Number: [digital][/digital]';
      const errors = validateDigitalTags(text, 'test', '1', 'text');
      expect(errors.some(e => e.error.includes('Empty digital tag'))).toBe(true);
    });

    it('should pass valid digital tags', () => {
      const text = 'The code is [digital]9902[/digital]';
      const errors = validateDigitalTags(text, 'test', '1', 'text');
      expect(errors).toEqual([]);
    });

  });
});
