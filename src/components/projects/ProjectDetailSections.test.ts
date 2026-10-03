import { describe, expect, it } from 'vitest';
import type { ProjectDisplay } from '../../types';
import { projectDetailTabs } from './ProjectDetailSections';

const idea: ProjectDisplay = {
  id: 'idea',
  kind: 'template',
  name: 'Ideia Focus',
  shortDescription: 'Escopo',
  category: 'Web',
  memberLimit: 5,
  suggestedTechnologies: [],
  recommendedAreas: [],
  difficulty: 'Iniciante',
  suggestedDuration: '',
  type: 'Focus Project',
  suggestedRoles: [],
  possibleStacks: [],
  outcomes: [],
  members: [],
};

describe('project detail tabs', () => {
  it('omits empty sections for a Focus Idea', () => {
    expect(projectDetailTabs(idea).map((tab) => tab.label)).toEqual(['Visão geral']);
    expect(
      projectDetailTabs({
        ...idea,
        suggestedFeatures: ['Catálogo'],
        recommendedAreas: ['UX/UI'],
        outcomes: ['Aplicação publicada'],
      }).map((tab) => tab.label),
    ).toEqual(['Visão geral', 'Escopo', 'Stack & Áreas', 'Entrega']);
  });

  it('keeps squad separate from a project delivery', () => {
    const project: ProjectDisplay = {
      ...idea,
      kind: 'project',
      type: 'Community Project',
      status: 'FORMING',
      ownerId: 'owner',
      ownerName: 'Owner',
    };
    expect(projectDetailTabs(project).map((tab) => tab.label)).toEqual(['Visão geral', 'Squad']);
    expect(
      projectDetailTabs({
        ...project,
        plannedStartDate: '2026-10-01',
        completedAt: '2026-11-01',
      }).map((tab) => tab.label),
    ).toEqual(['Visão geral', 'Squad', 'Detalhes', 'Entrega']);
  });
});
