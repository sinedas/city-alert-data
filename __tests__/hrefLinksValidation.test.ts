/**
 * Href Links Validation Tests
 *
 * Validates that all href links in mission task text fields
 * are accessible (return 200-399 status codes)
 *
 * Href format: [href="https://..."]Link text[/href]
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TASKS_DIR } from './helpers/paths';

const HREF_REGEX = /\[href="([^"]+)"\]/g;

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

function extractHrefUrls(task: any): { field: string; url: string }[] {
  const hrefs: { field: string; url: string }[] = [];

  const extractFromText = (text: string | string[] | undefined, fieldName: string) => {
    const content = extractTextContent(text);
    let match;
    while ((match = HREF_REGEX.exec(content)) !== null) {
      hrefs.push({ field: fieldName, url: match[1] });
    }
    HREF_REGEX.lastIndex = 0;
  };

  extractFromText(task.text, 'text');

  if (task.hint?.text) {
    extractFromText(task.hint.text, 'hint.text');
  }

  if (task.reward?.text) {
    extractFromText(task.reward.text, 'reward.text');
  }

  if (task.rewardCarousel?.text) {
    extractFromText(task.rewardCarousel.text, 'rewardCarousel.text');
  }

  if (task.startCarousel?.text) {
    extractFromText(task.startCarousel.text, 'startCarousel.text');
  }

  return hrefs;
}

async function checkUrlAccessible(url: string): Promise<{ accessible: boolean; status?: number; error?: string }> {
  try {
    let response = await fetch(url, {
      method: 'HEAD',
      redirect: 'follow',
    });

    if (response.status === 405 || response.status === 403) {
      response = await fetch(url, {
        method: 'GET',
        redirect: 'follow',
      });
    }

    const accessible = response.status >= 200 && response.status < 400;
    return { accessible, status: response.status };
  } catch (e: any) {
    return { accessible: false, error: e.message };
  }
}

// Network-dependent: opt-in via RUN_HREF_LINK_TESTS=true (skipped in default CI)
const RUN_HREF_LINK_TESTS = process.env.RUN_HREF_LINK_TESTS === 'true';

describe('Href Links Validation', () => {
  it.skipIf(!RUN_HREF_LINK_TESTS)('should have all href links accessible', async () => {
    console.log(`\n🔗 Validating href links in missions...\n`);

    const missionFiles = getMissionFiles();
    const brokenLinks: { mission: string; task: string; field: string; url: string; error: string }[] = [];
    const validLinks: string[] = [];
    const checkedUrls = new Set<string>();

    for (const filename of missionFiles) {
      const missionCode = filename.replace('.json', '');
      const tasks = loadMission(filename);

      if (!tasks || !Array.isArray(tasks)) {
        continue;
      }

      console.log(`  📝 Checking mission: ${missionCode}`);

      for (const task of tasks) {
        const hrefs = extractHrefUrls(task);

        for (const { field, url } of hrefs) {
          if (checkedUrls.has(url)) {
            continue;
          }
          checkedUrls.add(url);

          const result = await checkUrlAccessible(url);

          if (!result.accessible) {
            const errorMsg = result.error || `HTTP ${result.status}`;
            brokenLinks.push({
              mission: missionCode,
              task: task.id,
              field,
              url,
              error: errorMsg,
            });
            console.error(`    ❌ Broken: ${url.substring(0, 60)}... (${errorMsg})`);
          } else {
            validLinks.push(url);
            console.log(`    ✅ Valid: ${url.substring(0, 60)}...`);
          }
        }
      }
    }

    console.log(`\n📊 Href Links Validation Summary:`);
    console.log(`  ✅ Valid: ${validLinks.length} links`);
    console.log(`  ❌ Broken: ${brokenLinks.length} links\n`);

    if (brokenLinks.length > 0) {
      console.error(`\n❌ Broken Links Details:\n`);
      brokenLinks.forEach(({ mission, task, field, url, error }) => {
        console.error(`  • [${mission}] Task "${task}" (${field})`);
        console.error(`    URL: ${url}`);
        console.error(`    Error: ${error}\n`);
      });
    }

    expect(
      brokenLinks,
      `Found ${brokenLinks.length} broken href links. See console for details.`
    ).toEqual([]);
  }, 180000); // 3 minute timeout for checking all links

  it('should extract href URLs correctly', () => {
    const testTask = {
      id: 'test',
      text: [
        'Some text here',
        '[href="https://example.com/page1"]Link 1[/href]',
        'More text [href="https://example.com/page2"]Link 2[/href] end',
      ],
      hint: {
        text: '[href="https://example.com/hint"]Hint link[/href]',
      },
      reward: {
        text: ['[href="https://example.com/reward"]Reward[/href]'],
      },
    };

    const hrefs = extractHrefUrls(testTask);

    expect(hrefs).toHaveLength(4);
    expect(hrefs.map(h => h.url)).toContain('https://example.com/page1');
    expect(hrefs.map(h => h.url)).toContain('https://example.com/page2');
    expect(hrefs.map(h => h.url)).toContain('https://example.com/hint');
    expect(hrefs.map(h => h.url)).toContain('https://example.com/reward');
  });
});
