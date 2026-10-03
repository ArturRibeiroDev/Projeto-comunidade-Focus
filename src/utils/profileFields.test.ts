import { describe, expect, it } from 'vitest';
import {
  addTag,
  availabilityHours,
  bioLength,
  BIO_MAX_LENGTH,
  canAddCustomTag,
  limitBio,
  safeExternalUrl,
  tagSuggestions,
} from './profileFields';

describe('profile fields', () => {
  it('normalizes custom tags without case-insensitive duplicates', () => {
    expect(addTag(['React'], '  react  ')).toEqual(['React']);
    expect(addTag(['React'], '  Astro   JS ')).toEqual(['React', 'Astro JS']);
  });
  it('offers unselected skills on focus and reuses case-insensitive matches', () => {
    const skills = ['TypeScript', 'React', 'React Native', 'react', 'Python'];
    expect(tagSuggestions(['React'], skills, '')).toEqual(['TypeScript', 'React Native', 'Python']);
    expect(tagSuggestions([], skills, '  REA  ')).toEqual(['React', 'React Native']);
    expect(canAddCustomTag([], skills, ' react ')).toBe(false);
    expect(canAddCustomTag([], skills, 'Astro')).toBe(true);
    expect(canAddCustomTag([], skills, '/')).toBe(false);
  });
  it('accepts only safe external links', () => {
    expect(safeExternalUrl('https://github.com/example')).toBe('https://github.com/example');
    expect(safeExternalUrl('javascript:alert(1)')).toBeUndefined();
    expect(safeExternalUrl('data:text/html,hello')).toBeUndefined();
    expect(safeExternalUrl('github.com/example')).toBeUndefined();
  });
  it('extracts weekly hours without preserving arbitrary free text', () => {
    expect(availabilityHours('6 horas/semana')).toBe('6');
    expect(availabilityHours('umas horas aí')).toBe('');
  });
  it('keeps the database bio limit in Unicode characters and preserves line breaks', () => {
    expect(BIO_MAX_LENGTH).toBe(600);
    const bio = 'Backend.\n\nGosto de APIs.';
    expect(limitBio(bio)).toBe(bio);
    expect(bioLength('😀')).toBe(1);
    expect(bioLength(limitBio('😀'.repeat(BIO_MAX_LENGTH + 1)))).toBe(BIO_MAX_LENGTH);
    expect(bioLength(limitBio('x'.repeat(601)))).toBe(600);
  });
});
