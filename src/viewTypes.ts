import type { ProjectDifficulty } from './types';

export type View = 'dashboard' | 'catalog' | 'my-projects' | 'create' | 'profile' | 'admin';

export type ToastMessage = {
  title: string;
  message: string;
};

export type ProjectFormState = {
  name: string;
  shortDescription: string;
  category: string;
  memberLimit: number;
  difficulty: ProjectDifficulty;
  suggestedDuration: string;
  plannedStartDate: string;
  plannedEndDate: string;
  recommendedAreas: string;
  ownerParticipationRole: string;
  suggestedTechnologies: string;
  possibleStacks: string;
  outcomes: string;
};

export const defaultProjectForm: ProjectFormState = {
  name: '',
  shortDescription: '',
  category: '',
  memberLimit: 5,
  difficulty: 'Misto',
  suggestedDuration: '',
  plannedStartDate: '',
  plannedEndDate: '',
  recommendedAreas: '',
  ownerParticipationRole: '',
  suggestedTechnologies: 'TypeScript, React, Node.js',
  possibleStacks: 'Stack a definir pela squad',
  outcomes: 'MVP navegável, README, apresentação final',
};
