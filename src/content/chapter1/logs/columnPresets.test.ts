import { describe, it, expect } from 'vitest';
import { COLUMN_PRESETS } from './columnPresets';
import { sentinelLogCorpus } from './index';

const corpusFields = new Set<string>([
  'source',
  'message',
  ...sentinelLogCorpus.flatMap((event) => Object.keys(event.fields)),
]);

describe('COLUMN_PRESETS', () => {
  it('only names fields the corpus can actually produce', () => {
    for (const preset of COLUMN_PRESETS) {
      for (const field of preset.fields) {
        expect(corpusFields.has(field), `preset "${preset.id}" names unknown field "${field}"`).toBe(
          true
        );
      }
    }
  });

  it('never lists the pinned time column', () => {
    for (const preset of COLUMN_PRESETS) {
      expect(preset.fields).not.toContain('time');
    }
  });

  it('uses unique ids', () => {
    const ids = COLUMN_PRESETS.map((preset) => preset.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('offers a default that matches the table before it is touched', () => {
    const fallback = COLUMN_PRESETS.find((preset) => preset.id === 'default');
    expect(fallback?.fields).toEqual(['source', 'message']);
  });

  it('never offers an empty layout', () => {
    for (const preset of COLUMN_PRESETS) {
      expect(preset.fields.length).toBeGreaterThan(0);
    }
  });
});
