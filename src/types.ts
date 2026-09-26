export type ProjectStatus = 'Aberto' | 'Em formação' | 'Em andamento' | 'Concluído';

export type ProjectType = 'Focus Project' | 'Community Project';

export type ProjectDifficulty = 'Iniciante' | 'Intermediário' | 'Avançado' | 'Misto';

export type LinkMap = {
  github?: string;
  linkedin?: string;
  portfolio?: string;
};

export type MemberEvidence = {
  id: string;
  label: string;
  technology?: string;
  projectId?: string;
  recordedAt: string;
};

export type MemberProfile = {
  id: string;
  name: string;
  avatarUrl: string;
  bio: string;
  primaryRole: string;
  secondaryRoles: string[];
  areas: string[];
  technologies: string[];
  interests: string[];
  availability: string;
  links: LinkMap;
  currentProjectIds: string[];
  completedProjectIds: string[];
  evidence: MemberEvidence[];
};

export type ProjectMember = {
  memberId: string;
  name: string;
  avatarUrl: string;
  role: string;
  contributionIntent: string;
  joinedAt: string;
};

export type SquadRecommendation = {
  role: string;
  amount: number;
};

export type Project = {
  id: string;
  name: string;
  shortDescription: string;
  category: string;
  status: ProjectStatus;
  memberLimit: number;
  suggestedTechnologies: string[];
  recommendedAreas: string[];
  difficulty: ProjectDifficulty;
  suggestedDuration: string;
  type: ProjectType;
  suggestedRoles: SquadRecommendation[];
  possibleStacks: string[];
  outcomes: string[];
  createdBy: string;
  originTemplateId?: string;
  members: ProjectMember[];
};

export type Filters = {
  query: string;
  status: 'Todos' | ProjectStatus;
  area: 'Todas' | string;
  technology: 'Todas' | string;
  difficulty: 'Todas' | ProjectDifficulty;
  type: 'Todos' | ProjectType;
};

export type HubState = {
  profile: MemberProfile;
  projects: Project[];
};
