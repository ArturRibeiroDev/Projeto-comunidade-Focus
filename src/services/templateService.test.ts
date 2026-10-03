import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getTemplates } from './templateService';

const state = vi.hoisted(() => ({
  responses: new Map<string, { data: unknown[] | null; error: { code: string } | null }>(),
}));

vi.mock('../lib/supabase', () => ({
  getSupabase: () => ({
    from: (table: string) => {
      const query = {
        select: () => query,
        eq: () => query,
        order: () => query,
        then: (resolve: (value: unknown) => void, reject: (reason: unknown) => void) =>
          Promise.resolve(state.responses.get(table)).then(resolve, reject),
      };
      return query;
    },
  }),
}));

beforeEach(() => {
  state.responses.clear();
  for (const table of [
    'project_templates',
    'project_template_technologies',
    'project_template_areas',
    'skills',
  ]) {
    state.responses.set(table, { data: [], error: null });
  }
});

describe('template loading', () => {
  it('keeps a genuine empty catalogue empty', async () => {
    await expect(getTemplates()).resolves.toEqual([]);
  });

  it('does not turn a database error into an empty catalogue', async () => {
    state.responses.set('project_templates', {
      data: null,
      error: { code: '42501' },
    });
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    try {
      await expect(getTemplates()).rejects.toThrow('Não foi possível carregar os templates.');
      expect(log).toHaveBeenCalledWith('[FocusAcademy] Falha ao consultar project_templates', {
        code: '42501',
      });
    } finally {
      log.mockRestore();
    }
  });
});
