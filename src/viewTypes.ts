import type { ProjectDifficulty } from './types';

export type View = 'dashboard' | 'catalog' | 'my-projects' | 'create' | 'profile';

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
  recommendedAreas: string;
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
  suggestedDuration: '4 a 6 semanas',
  recommendedAreas: 'Backend, Frontend, UX/UI, QA',
  suggestedTechnologies: 'TypeScript, React, Node.js',
  possibleStacks: 'Stack a definir pela squad',
  outcomes: 'MVP navegável, README, apresentação final'
};
