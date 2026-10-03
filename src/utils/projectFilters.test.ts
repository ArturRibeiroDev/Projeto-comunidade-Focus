import { describe, expect, it } from 'vitest';
import type { ProjectDisplay } from '../types';
import { createEmptyFilters, filterProjects, searchProjects } from './projectFilters';

const examples: ProjectDisplay[] = [
  {
    id: 'auth',
    kind: 'template',
    name: 'Sistema de Autenticação',
    shortDescription: 'Login',
    category: 'Web',
    memberLimit: 5,
    suggestedTechnologies: ['React'],
    recommendedAreas: ['Backend'],
    difficulty: 'Intermediário',
    suggestedDuration: '4 semanas',
    type: 'Focus Project',
    suggestedRoles: [],
    possibleStacks: [],
    outcomes: [],
    members: [],
  },
  {
    id: 'data',
    kind: 'template',
    name: 'Dashboard de Dados Públicos',
    shortDescription: 'Análise',
    category: 'Dados',
    memberLimit: 5,
    suggestedTechnologies: ['Pandas'],
    recommendedAreas: ['Data Analysis'],
    difficulty: 'Iniciante',
    suggestedDuration: '4 semanas',
    type: 'Focus Project',
    suggestedRoles: [],
    possibleStacks: [],
    outcomes: [],
    members: [],
  },
  {
    id: 'community',
    kind: 'project',
    name: 'Projeto próprio',
    shortDescription: 'Comunidade',
    category: 'Web',
    status: 'FORMING',
    memberLimit: 5,
    suggestedTechnologies: [],
    recommendedAreas: [],
    difficulty: 'Misto',
    suggestedDuration: '4 semanas',
    type: 'Community Project',
    suggestedRoles: [],
    possibleStacks: [],
    outcomes: [],
    members: [],
  },
];

describe('project filters', () => {
  it('finds projects by accent-insensitive text search', () => {
    expect(
      filterProjects(examples, { ...createEmptyFilters(), query: 'autenticacao' }).map(
        (item) => item.id,
      ),
    ).toEqual(['auth']);
    expect(searchProjects(examples, '  Sistema   de Aut ').map((item) => item.id)).toEqual([
      'auth',
    ]);
    expect(searchProjects(examples, 'react').map((item) => item.id)).toEqual(['auth']);
    expect(searchProjects(examples, 'sem resultado')).toEqual([]);
  });
  it('filters by area and technology', () => {
    expect(
      filterProjects(examples, {
        ...createEmptyFilters(),
        area: 'Data Analysis',
        technology: 'Pandas',
      }).map((item) => item.id),
    ).toEqual(['data']);
  });
  it('filters by project type', () => {
    expect(
      filterProjects(examples, { ...createEmptyFilters(), type: 'Focus Project' }),
    ).toHaveLength(2);
    expect(filterProjects(examples, { ...createEmptyFilters(), query: 'Focus Idea' })).toHaveLength(
      2,
    );
  });
  it('keeps templates separate from project status', () => {
    expect(
      filterProjects(examples, { ...createEmptyFilters(), status: 'FORMING' }).map(
        (item) => item.id,
      ),
    ).toEqual(['community']);
  });
});
