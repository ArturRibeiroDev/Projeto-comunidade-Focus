export const normalizeTag = (value: string) => value.trim().replace(/\s+/g, ' ');
export const tagKey = (value: string) =>
  normalizeTag(value)
    .toLocaleLowerCase('pt-BR')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
export const BIO_MAX_LENGTH = 600;
export const bioLength = (value: string) => Array.from(value).length;
export const limitBio = (value: string) => Array.from(value).slice(0, BIO_MAX_LENGTH).join('');

export function addTag(values: string[], value: string): string[] {
  const normalized = normalizeTag(value);
  if (!normalized || values.some((item) => tagKey(item) === tagKey(normalized))) return values;
  return [...values, normalized];
}

export function tagSuggestions(
  values: string[],
  suggestions: string[],
  query: string,
  limit = 8,
): string[] {
  const unique = new Map<string, string>();
  for (const item of suggestions) if (!unique.has(tagKey(item))) unique.set(tagKey(item), item);
  return [...unique.values()]
    .filter(
      (item) =>
        !values.some((value) => tagKey(value) === tagKey(item)) &&
        tagKey(item).includes(tagKey(query)),
    )
    .slice(0, limit);
}

export function canAddCustomTag(values: string[], suggestions: string[], query: string): boolean {
  const value = normalizeTag(query);
  return (
    value.length >= 2 &&
    value.length <= 80 &&
    /[\p{L}\p{N}]/u.test(value) &&
    ![...values, ...suggestions].some((item) => tagKey(item) === tagKey(value))
  );
}

export function safeExternalUrl(value?: string): string | undefined {
  if (!value?.trim()) return undefined;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : undefined;
  } catch {
    return undefined;
  }
}

export function availabilityHours(value: string): string {
  const match = value.match(/\d+/);
  return match ? match[0] : '';
}
