/**
 * Data file format (scripts/lib/data-format.js)
 *
 * The formatter only reorders keys and rewrites whitespace; these tests pin
 * the output so a future editor writing the same files stays in step.
 */

import { describe, it, expect } from 'vitest';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { formatDocument, kindOf } = require('../scripts/lib/data-format.js');

const json = (value: unknown) => JSON.stringify(value);

describe('formatDocument', () => {
  it('writes 4-space JSON with LF and a trailing newline', () => {
    const input = '[\r\n  {\r\n    "id": "t1", "name": "A", "lat": 1, "lng": 2, "text": [], "answer": ["x"], "points": 1, "attempts": 1, "time": 1\r\n  }\r\n]';
    const { output } = formatDocument(input, 'tasks');

    expect(output.endsWith('}\n]\n')).toBe(true);
    expect(output).not.toContain('\r');
    expect(output.split('\n')[1]).toBe('    {');
    expect(output.split('\n')[2]).toBe('        "id": "t1",');
  });

  it('strips a byte order mark', () => {
    const { output } = formatDocument('�[]', 'tasks');
    expect(output).toBe('[]\n');
  });

  it('puts task keys in the canonical order', () => {
    const input = json([{ time: 60, points: 10, answer: ['a'], text: ['q'], lng: 2, lat: 1, name: 'N', id: 't1' }]);
    const [task] = JSON.parse(formatDocument(input, 'tasks').output);

    expect(Object.keys(task)).toEqual(['id', 'name', 'lat', 'lng', 'text', 'answer', 'points', 'time']);
  });

  it('keeps the order most tasks already had: start screen, type, picture, question, scoring, reward', () => {
    const input = json([
      {
        reward: { text: ['r'] },
        hint: { text: ['h'] },
        time: 5,
        minusPointsOnAttempt: 1,
        attempts: 3,
        points: 10,
        answer: ['a'],
        text: ['q'],
        photoValidation: { prompt: 'p' },
        iconType: 'photo',
        image: 'i.webp',
        type: 'photoValidation',
        startCarousel: { text: ['s'], images: [] },
        startType: 'carousel',
        lng: 2,
        lat: 1,
        name: 'N',
        id: 't1',
      },
    ]);
    const [task] = JSON.parse(formatDocument(input, 'tasks').output);

    expect(Object.keys(task)).toEqual([
      'id',
      'name',
      'lat',
      'lng',
      'startType',
      'startCarousel',
      'type',
      'image',
      'iconType',
      'photoValidation',
      'text',
      'answer',
      'points',
      'attempts',
      'minusPointsOnAttempt',
      'time',
      'hint',
      'reward',
    ]);
  });

  it('orders keys inside nested task objects', () => {
    const input = json([
      {
        id: 't1',
        hint: { points: 5, image: 'h.webp', text: ['h'] },
        reward: { image: 'r.webp', text: ['r'] },
        startCarousel: { images: ['a.webp'], text: ['s'] },
        events: [{ image: 'e.webp', order: 1, name: 'E' }],
      },
    ]);
    const [task] = JSON.parse(formatDocument(input, 'tasks').output);

    expect(Object.keys(task.hint)).toEqual(['text', 'image', 'points']);
    expect(Object.keys(task.reward)).toEqual(['text', 'image']);
    expect(Object.keys(task.startCarousel)).toEqual(['text', 'images']);
    expect(Object.keys(task.events[0])).toEqual(['name', 'order', 'image']);
  });

  it('puts mission keys in the canonical order, nested ones too', () => {
    const input = json([
      {
        title: 'T',
        location: { lng: 25, lat: 54 },
        code: 'm1',
        afterTeamName: { image: 'a.webp', text: ['t'], title: 'A' },
      },
    ]);
    const [mission] = JSON.parse(formatDocument(input, 'missions').output);

    expect(Object.keys(mission)).toEqual(['code', 'title', 'location', 'afterTeamName']);
    expect(Object.keys(mission.location)).toEqual(['lat', 'lng']);
    expect(Object.keys(mission.afterTeamName)).toEqual(['title', 'text', 'image']);
  });

  it('keeps unknown keys after the known ones and reports them with the item id', () => {
    const input = json([{ startCarosel: { text: [] }, id: 's1', 'reward eyeball': 'carousel', name: 'N' }]);
    const { output, unknownKeys } = formatDocument(input, 'tasks');
    const [task] = JSON.parse(output);

    expect(Object.keys(task)).toEqual(['id', 'name', 'startCarosel', 'reward eyeball']);
    expect(unknownKeys).toEqual(['task "s1": startCarosel', 'task "s1": reward eyeball']);
  });

  it('reports unknown keys in nested objects with their path', () => {
    const input = json([{ id: 't1', hint: { text: ['h'], pionts: 5 } }]);
    const { unknownKeys } = formatDocument(input, 'tasks');

    expect(unknownKeys).toEqual(['task "t1".hint: pionts']);
  });

  it('labels items without an id by their position', () => {
    const { unknownKeys } = formatDocument(json([{ foo: 1 }]), 'missions');
    expect(unknownKeys).toEqual(['mission "#0": foo']);
  });

  it('leaves values untouched (strings, arrays, numbers)', () => {
    const task = { id: 't1', text: ['Ąžuolas „kabutės“', ''], answer: ['5', 'penki'], lat: 54.6872, lng: 25.28, points: 0 };
    const [out] = JSON.parse(formatDocument(json([task]), 'tasks').output);

    expect(out).toEqual(task);
  });

  it('is stable: formatting formatted output changes nothing', () => {
    const input = json([{ name: 'N', id: 't1', hint: { points: 1, text: 'h' }, extra: true }]);
    const once = formatDocument(input, 'tasks').output;

    expect(formatDocument(once, 'tasks').output).toBe(once);
  });

  it('rejects a file that is not an array', () => {
    expect(() => formatDocument('{"id": "t1"}', 'tasks')).toThrow('expected a JSON array of tasks');
  });

  it('rejects invalid JSON', () => {
    expect(() => formatDocument('[{"id": "t1",}]', 'tasks')).toThrow();
  });
});

describe('kindOf', () => {
  it('recognises missions.json and task files only', () => {
    expect(kindOf('v1/missions.json')).toBe('missions');
    expect(kindOf('v1/tasks/ona.json')).toBe('tasks');
    expect(kindOf('v1\\tasks\\ona_extended.json')).toBe('tasks');
    expect(kindOf('url.json')).toBeNull();
    expect(kindOf('v1/tasks/sub/ona.json')).toBeNull();
  });
});
