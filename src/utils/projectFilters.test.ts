import { describe, expect, it } from 'vitest';
import { initialProjects } from '../data/seed';
import { createEmptyFilters, filterProjects } from './projectFilters';

describe('project filters', () => {
  it('finds projects by accent-insensitive text search', () => {
    const result = filterProjects(initialProjects, {
      ...createEmptyFilters(),
      query: 'autenticacao'
    });

    expect(result.map((project) => project.id)).toContain('template-authentication');
  });

  it('filters by area and technology without requiring a fixed stack', () => {
    const result = filterProjects(initialProjects, {
      ...createEmptyFilters(),
      area: 'Data Analysis',
      technology: 'Pandas'
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Dashboard de Dados Públicos');
  });

  it('filters by project type', () => {
    const result = filterProjects(initialProjects, {
      ...createEmptyFilters(),
      type: 'Focus Project'
    });

    expect(result).toHaveLength(9);
  });
});
