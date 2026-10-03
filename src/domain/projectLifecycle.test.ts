import { describe, expect, it } from 'vitest';
import type { ProjectDisplay, ProjectStatus } from '../types';
import { appearsInCatalogue, canTransition, ownerActions } from './projectLifecycle';

const valid: Array<[ProjectStatus, ProjectStatus]> = [
  ['FORMING', 'ACTIVE'],
  ['FORMING', 'CANCELLED'],
  ['ACTIVE', 'COMPLETED'],
  ['ACTIVE', 'CANCELLED'],
  ['COMPLETED', 'ARCHIVED'],
  ['CANCELLED', 'ARCHIVED'],
];

describe('project lifecycle', () => {
  it('allows only the defined forward transitions', () => {
    const statuses: ProjectStatus[] = ['FORMING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED'];
    for (const from of statuses)
      for (const to of statuses) {
        expect(canTransition(from, to)).toBe(
          valid.some(([start, end]) => start === from && end === to),
        );
      }
  });

  it('shows owner commands only in matching stages', () => {
    expect(ownerActions('FORMING', true)).toEqual(['edit', 'start', 'cancel']);
    expect(ownerActions('ACTIVE', true)).toEqual(['complete', 'cancel']);
    expect(ownerActions('COMPLETED', true)).toEqual(['archive']);
    expect(ownerActions('CANCELLED', true)).toEqual(['archive']);
    expect(ownerActions('ARCHIVED', true)).toEqual([]);
    expect(ownerActions('FORMING', false)).toEqual([]);
  });

  it('keeps closed history out of the operational catalogue', () => {
    const base: ProjectDisplay = {
      id: 'p',
      kind: 'project',
      name: 'Projeto',
      shortDescription: '',
      category: '',
      memberLimit: 2,
      suggestedTechnologies: [],
      recommendedAreas: [],
      difficulty: 'Misto',
      suggestedDuration: '4 semanas',
      type: 'Community Project',
      suggestedRoles: [],
      possibleStacks: [],
      outcomes: [],
      members: [],
      moderationStatus: 'APPROVED',
    };
    expect(appearsInCatalogue({ ...base, kind: 'template' })).toBe(true);
    expect(appearsInCatalogue({ ...base, status: 'FORMING' })).toBe(true);
    expect(appearsInCatalogue({ ...base, status: 'ACTIVE' })).toBe(true);
    expect(appearsInCatalogue({ ...base, status: 'COMPLETED' })).toBe(true);
    expect(appearsInCatalogue({ ...base, status: 'CANCELLED' })).toBe(false);
    expect(appearsInCatalogue({ ...base, status: 'ARCHIVED' })).toBe(false);
    expect(
      appearsInCatalogue(
        {
          ...base,
          moderationStatus: 'PENDING',
          ownerId: 'owner',
          status: 'FORMING',
        },
        'other',
      ),
    ).toBe(false);
    expect(
      appearsInCatalogue(
        {
          ...base,
          moderationStatus: 'REJECTED',
          ownerId: 'owner',
          status: 'FORMING',
        },
        'owner',
      ),
    ).toBe(true);
  });
});
