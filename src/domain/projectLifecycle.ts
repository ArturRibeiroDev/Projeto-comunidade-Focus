import type { ProjectDisplay, ProjectStatus } from '../types';

export const projectStatusLabels: Record<ProjectStatus, string> = {
  FORMING: 'Em formação',
  ACTIVE: 'Em andamento',
  COMPLETED: 'Concluído',
  CANCELLED: 'Cancelado',
  ARCHIVED: 'Arquivado',
};

const transitions: Record<ProjectStatus, ProjectStatus[]> = {
  FORMING: ['ACTIVE', 'CANCELLED'],
  ACTIVE: ['COMPLETED', 'CANCELLED'],
  COMPLETED: ['ARCHIVED'],
  CANCELLED: ['ARCHIVED'],
  ARCHIVED: [],
};

export function canTransition(from: ProjectStatus, to: ProjectStatus) {
  return transitions[from].includes(to);
}

export type OwnerAction = 'edit' | 'start' | 'cancel' | 'complete' | 'archive';

export function ownerActions(status: ProjectStatus, isOwner: boolean): OwnerAction[] {
  if (!isOwner) return [];
  if (status === 'FORMING') return ['edit', 'start', 'cancel'];
  if (status === 'ACTIVE') return ['complete', 'cancel'];
  if (status === 'COMPLETED' || status === 'CANCELLED') return ['archive'];
  return [];
}

export function appearsInCatalogue(project: ProjectDisplay, viewerId?: string) {
  return (
    project.kind === 'template' ||
    (project.status !== 'CANCELLED' &&
      project.status !== 'ARCHIVED' &&
      (project.moderationStatus === 'APPROVED' || project.ownerId === viewerId))
  );
}
