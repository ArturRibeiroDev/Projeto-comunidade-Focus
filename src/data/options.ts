import type { ProjectDifficulty, ProjectStatus, ProjectType } from '../types';

export const roleOptions = [
  'Backend',
  'Frontend',
  'Full Stack',
  'Mobile',
  'QA',
  'UX/UI',
  'Data Analysis',
  'Data Engineering',
  'Data Science',
  'Machine Learning / IA',
  'DevOps',
  'Cloud',
  'Cybersecurity',
  'Game Development',
  'Product',
  'Project Management',
  'Outra',
];

export const technologySuggestions = [
  'Java',
  'Spring',
  'Python',
  'Django',
  'FastAPI',
  'PHP',
  'Node.js',
  'TypeScript',
  'JavaScript',
  'C#',
  '.NET',
  'React',
  'Angular',
  'Vue',
  'Next.js',
  'Flutter',
  'React Native',
  'Kotlin',
  'PostgreSQL',
  'MySQL',
  'MongoDB',
  'Docker',
  'Linux',
  'AWS',
  'Power BI',
  'Pandas',
  'Playwright',
  'Cypress',
  'Godot',
  'Unity',
];

export const projectStatuses: Array<'Todos' | ProjectStatus> = [
  'Todos',
  'FORMING',
  'ACTIVE',
  'COMPLETED',
];

export const projectDifficulties: Array<'Todas' | ProjectDifficulty> = [
  'Todas',
  'Iniciante',
  'Intermediário',
  'Avançado',
  'Misto',
];

export const projectTypes: Array<'Todos' | ProjectType> = [
  'Todos',
  'Focus Project',
  'Community Project',
];
