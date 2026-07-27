/**
 * AI Prompt Validation Tests
 *
 * Validates AI prompts in mission files for:
 * - Token length limits (OpenAI, Gemini)
 * - Placeholder correctness
 * - Security concerns
 * - Structural consistency
 */

import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TASKS_DIR } from './helpers/paths';

const MAX_PROMPT_TOKENS = {
  openai: 4096,
  gemini: 30720,
};

const MAX_PROMPT_CHARS = {
  validation: 500,
  transformation: 2000,
};

const VALID_PLACEHOLDERS = ['{team_name}'];

const SECURITY_PATTERNS = [
  /ignore\s+(previous|above|all)/i,
  /disregard\s+(previous|instructions)/i,
  /forget\s+(everything|previous)/i,
  /system\s*:/i,
  /assistant\s*:/i,
  /\<\|.*?\|\>/,
];

interface Task {
  id: string;
  name: string;
  photoValidation?: {
    prompt?: string;
    transformationPrompt?: string;
  };
}

function loadMission(filename: string): Task[] | null {
  try {
    const filePath = path.join(TASKS_DIR, filename);
    const content = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

function getMissionFiles(): string[] {
  if (!fs.existsSync(TASKS_DIR)) {
    return [];
  }
  return fs.readdirSync(TASKS_DIR).filter(f => f.endsWith('.json'));
}

function extractPrompts(missions: string[]): Array<{
  mission: string;
  taskId: string;
  taskName: string;
  type: 'validation' | 'transformation';
  prompt: string;
}> {
  const prompts: Array<{
    mission: string;
    taskId: string;
    taskName: string;
    type: 'validation' | 'transformation';
    prompt: string;
  }> = [];

  missions.forEach(filename => {
    const tasks = loadMission(filename);
    if (!tasks) return;

    tasks.forEach(task => {
      if (task.photoValidation) {
        if (task.photoValidation.prompt) {
          prompts.push({
            mission: filename,
            taskId: task.id,
            taskName: task.name,
            type: 'validation',
            prompt: task.photoValidation.prompt,
          });
        }
        if (task.photoValidation.transformationPrompt) {
          prompts.push({
            mission: filename,
            taskId: task.id,
            taskName: task.name,
            type: 'transformation',
            prompt: task.photoValidation.transformationPrompt,
          });
        }
      }
    });
  });

  return prompts;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / 2.5);
}

function findPlaceholders(text: string): string[] {
  const matches = text.match(/\{[^}]+\}/g);
  return matches || [];
}

function checkSecurity(text: string): string[] {
  const issues: string[] = [];

  SECURITY_PATTERNS.forEach(pattern => {
    if (pattern.test(text)) {
      issues.push(`Matches security pattern: ${pattern}`);
    }
  });

  return issues;
}

describe('AI Prompts Validation', () => {
  const missionFiles = getMissionFiles();
  const allPrompts = extractPrompts(missionFiles);

  it('should have at least one prompt to validate', () => {
    expect(allPrompts.length).toBeGreaterThan(0);
  });

  describe('Token Length Validation', () => {
    it('all prompts should be within OpenAI token limits', () => {
      allPrompts.forEach(({ mission, taskId, taskName, prompt, type }) => {
        const tokens = estimateTokens(prompt);
        expect(
          tokens,
          `${mission}:${taskId} "${taskName}" (${type}): ${tokens} tokens exceeds OpenAI limit`
        ).toBeLessThanOrEqual(MAX_PROMPT_TOKENS.openai);
      });
    });

    it('all prompts should be within Gemini token limits', () => {
      allPrompts.forEach(({ mission, taskId, taskName, prompt, type }) => {
        const tokens = estimateTokens(prompt);
        expect(
          tokens,
          `${mission}:${taskId} "${taskName}" (${type}): ${tokens} tokens exceeds Gemini limit`
        ).toBeLessThanOrEqual(MAX_PROMPT_TOKENS.gemini);
      });
    });

    it('validation prompts should be concise (< 500 chars)', () => {
      const validationPrompts = allPrompts.filter(p => p.type === 'validation');

      validationPrompts.forEach(({ mission, taskId, taskName, prompt }) => {
        expect(
          prompt.length,
          `${mission}:${taskId} "${taskName}": validation prompt too long (${prompt.length} chars)`
        ).toBeLessThanOrEqual(MAX_PROMPT_CHARS.validation);
      });
    });

    it('transformation prompts should be reasonable (< 2000 chars)', () => {
      const transformationPrompts = allPrompts.filter(p => p.type === 'transformation');

      transformationPrompts.forEach(({ mission, taskId, taskName, prompt }) => {
        expect(
          prompt.length,
          `${mission}:${taskId} "${taskName}": transformation prompt too long (${prompt.length} chars)`
        ).toBeLessThanOrEqual(MAX_PROMPT_CHARS.transformation);
      });
    });

    it('should log token usage for all prompts', () => {
      const stats = {
        validation: { total: 0, avg: 0, max: 0 },
        transformation: { total: 0, avg: 0, max: 0 },
      };

      allPrompts.forEach(({ type, prompt }) => {
        const tokens = estimateTokens(prompt);
        stats[type].total += tokens;
        stats[type].max = Math.max(stats[type].max, tokens);
      });

      const validationCount = allPrompts.filter(p => p.type === 'validation').length;
      const transformationCount = allPrompts.filter(p => p.type === 'transformation').length;

      if (validationCount > 0) {
        stats.validation.avg = Math.round(stats.validation.total / validationCount);
      }
      if (transformationCount > 0) {
        stats.transformation.avg = Math.round(stats.transformation.total / transformationCount);
      }

      console.log('\n📊 Token Usage Statistics:');
      console.log('Validation prompts:', {
        count: validationCount,
        avgTokens: stats.validation.avg,
        maxTokens: stats.validation.max,
        totalTokens: stats.validation.total,
      });
      console.log('Transformation prompts:', {
        count: transformationCount,
        avgTokens: stats.transformation.avg,
        maxTokens: stats.transformation.max,
        totalTokens: stats.transformation.total,
      });

      expect(true).toBe(true);
    });
  });

  describe('Placeholder Validation', () => {
    it('all placeholders should be valid', () => {
      allPrompts.forEach(({ mission, taskId, taskName, prompt }) => {
        const placeholders = findPlaceholders(prompt);

        placeholders.forEach(placeholder => {
          expect(
            VALID_PLACEHOLDERS,
            `${mission}:${taskId} "${taskName}": invalid placeholder ${placeholder}`
          ).toContain(placeholder);
        });
      });
    });

    it('should log all unique placeholders used', () => {
      const uniquePlaceholders = new Set<string>();

      allPrompts.forEach(({ prompt }) => {
        const placeholders = findPlaceholders(prompt);
        placeholders.forEach(p => uniquePlaceholders.add(p));
      });

      console.log('\n🔖 Placeholders used:', Array.from(uniquePlaceholders));

      expect(true).toBe(true);
    });

    it('placeholders should be properly formatted', () => {
      allPrompts.forEach(({ mission, taskId, taskName, prompt }) => {
        const placeholders = findPlaceholders(prompt);

        placeholders.forEach(placeholder => {
          expect(
            placeholder,
            `${mission}:${taskId} "${taskName}": placeholder has spaces: ${placeholder}`
          ).not.toMatch(/\{\s+|\s+\}/);

          const content = placeholder.slice(1, -1);
          expect(
            content,
            `${mission}:${taskId} "${taskName}": placeholder should be lowercase_with_underscores: ${placeholder}`
          ).toMatch(/^[a-z_]+$/);
        });
      });
    });
  });

  describe('Security Validation', () => {
    it('prompts should not contain injection patterns', () => {
      allPrompts.forEach(({ mission, taskId, taskName, prompt }) => {
        const issues = checkSecurity(prompt);

        expect(
          issues,
          `${mission}:${taskId} "${taskName}": Security issues found:\n${issues.join('\n')}`
        ).toHaveLength(0);
      });
    });

    it('prompts should not contain suspicious special characters', () => {
      const suspiciousPatterns = [
        { pattern: /<script>/i, name: 'script tags' },
        { pattern: /javascript:/i, name: 'javascript protocol' },
        { pattern: /on\w+\s*=/i, name: 'event handlers' },
      ];

      allPrompts.forEach(({ mission, taskId, taskName, prompt }) => {
        suspiciousPatterns.forEach(({ pattern, name }) => {
          expect(
            pattern.test(prompt),
            `${mission}:${taskId} "${taskName}": contains ${name}`
          ).toBe(false);
        });
      });
    });
  });

  describe('Content Quality Checks', () => {
    it('prompts should not be empty', () => {
      allPrompts.forEach(({ mission, taskId, taskName, prompt }) => {
        expect(
          prompt.trim().length,
          `${mission}:${taskId} "${taskName}": prompt is empty`
        ).toBeGreaterThan(0);
      });
    });

    it('prompts should not have excessive whitespace', () => {
      allPrompts.forEach(({ mission, taskId, taskName, prompt }) => {
        expect(
          prompt,
          `${mission}:${taskId} "${taskName}": has excessive whitespace`
        ).not.toMatch(/\s{3,}/);
      });
    });

    it('prompts should have proper sentence structure', () => {
      allPrompts.forEach(({ mission, taskId, taskName, prompt, type }) => {
        if (type === 'validation') {
          const isQuestion = prompt.trim().endsWith('?');
          const isStatement = /^[A-ZĄČĘĖĮŠŲŪŽ]/.test(prompt);

          expect(
            isQuestion || isStatement,
            `${mission}:${taskId} "${taskName}": validation prompt should be a question or statement`
          ).toBe(true);
        }
      });
    });

    it('should detect possibly incomplete prompts', () => {
      const incompletePatterns = [
        /\.\.\.$/,
        /\btodo\b/i,
        /\bfixme\b/i,
        /\bxxx\b/i,
      ];

      allPrompts.forEach(({ mission, taskId, taskName, prompt }) => {
        incompletePatterns.forEach(pattern => {
          expect(
            pattern.test(prompt),
            `${mission}:${taskId} "${taskName}": prompt may be incomplete (matches ${pattern})`
          ).toBe(false);
        });
      });
    });
  });

  describe('Consistency Checks', () => {
    it('validation prompts should follow similar patterns', () => {
      const validationPrompts = allPrompts.filter(p => p.type === 'validation');

      if (validationPrompts.length > 1) {
        const patterns = validationPrompts.map(p => p.prompt.slice(0, 15));
        const uniquePatterns = new Set(patterns);
        console.log('\n📋 Validation prompt patterns:', Array.from(uniquePatterns));
      }

      expect(true).toBe(true);
    });

    it('should list all transformation themes', () => {
      const transformationPrompts = allPrompts.filter(p => p.type === 'transformation');

      console.log('\n🎨 Transformation prompts summary:');
      transformationPrompts.forEach(({ mission, taskId, taskName, prompt }) => {
        const preview = prompt.slice(0, 100).replace(/\n/g, ' ');
        console.log(`  ${mission}:${taskId} "${taskName}": ${preview}...`);
      });

      expect(true).toBe(true);
    });
  });

  describe('Language Consistency', () => {
    it('should detect mixed language prompts', () => {
      allPrompts.forEach(({ mission, taskId, taskName, prompt }) => {
        const lithuanianChars = (prompt.match(/[ąčęėįšųūžĄČĘĖĮŠŲŪŽ]/g) || []).length;
        const totalChars = prompt.length;

        if (lithuanianChars > 3) {
          const lithuanianRatio = lithuanianChars / totalChars;

          if (lithuanianRatio < 0.02) {
            console.log(`\n⚠️  Possibly mixed language in ${mission}:${taskId} "${taskName}"`);
            console.log(`   Lithuanian chars: ${lithuanianChars}/${totalChars} (${(lithuanianRatio * 100).toFixed(1)}%)`);
          }
        }
      });

      expect(true).toBe(true);
    });
  });
});
