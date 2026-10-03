import { describe, expect, it } from 'vitest';
import { displayProject, displayTemplate } from './projectDisplay';
import type { Project, ProjectTemplate } from '../types';

const template: ProjectTemplate = {
  id: 'scope',
  name: 'Escopo Focus',
  description: 'Descrição',
  category: 'Web',
  problem: 'Problema',
  objective: 'Objetivo',
  suggestedFeatures: [],
  acceptanceCriteria: [],
  audience: '',
  evolutionIdeas: [],
  difficulty: 'Misto',
  suggestedDuration: '4 semanas',
  recommendedMaxMembers: 4,
  suggestedComposition: [{ role: 'QA', amount: 1 }],
  suggestedTechnologies: ['React'],
  relatedAreas: ['QA'],
  possibleStacks: [],
  outcomes: [],
  official: true,
  archived: false,
  createdAt: '',
  updatedAt: '',
};
const project: Project = {
  id: 'run',
  templateId: 'scope',
  ownerId: 'owner',
  ownerName: 'Ana',
  name: 'Execução',
  description: 'Descrição',
  category: 'Web',
  problem: 'Problema',
  objective: 'Objetivo',
  status: 'FORMING',
  moderationStatus: 'APPROVED',
  origin: 'template',
  maxMembers: 4,
  duration: '4 semanas',
  difficulty: 'Misto',
  technologies: ['React'],
  relatedAreas: ['QA'],
  suggestedComposition: [{ role: 'QA', amount: 1 }],
  possibleStacks: [],
  outcomes: [],
  joinRequests: [],
  members: [
    {
      memberId: 'owner',
      name: 'Ana',
      avatarUrl: '',
      role: 'Design de Serviço',
      contributionIntent: '',
      joinedAt: '',
    },
  ],
  createdAt: '',
  updatedAt: '',
};

describe('catalogue projection', () => {
  it('does not turn a template into an active squad', () => {
    const result = displayTemplate(template);
    expect(result.kind).toBe('template');
    expect(result.members).toEqual([]);
    expect(result.status).toBeUndefined();
  });
  it('retains execution status and chosen member role', () => {
    const result = displayProject(project);
    expect(result.kind).toBe('project');
    expect(result.status).toBe('FORMING');
    expect(result.ownerName).toBe('Ana');
    expect(result.members[0].role).toBe('Design de Serviço');
  });
});
