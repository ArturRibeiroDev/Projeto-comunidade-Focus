export type ProjectStatus = 'FORMING' | 'ACTIVE' | 'COMPLETED' | 'CANCELLED' | 'ARCHIVED';
export type ModerationStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
export type PlatformRole = 'MEMBER' | 'MODERATOR' | 'ADMIN';
export type AccountStatus = 'ACTIVE' | 'SUSPENDED';
export type PlatformAccount = {
  user_id: string;
  platform_role: PlatformRole;
  account_status: AccountStatus;
  suspension_reason: string | null;
};

export type ProjectType = 'Focus Project' | 'Community Project';

export type ProjectDifficulty = 'Iniciante' | 'Intermediário' | 'Avançado' | 'Misto';

export type SquadRecommendation = { role: string; amount: number };

export type ProjectTemplate = {
  id: string;
  name: string;
  description: string;
  category: string;
  problem: string;
  objective: string;
  suggestedFeatures: string[];
  acceptanceCriteria: string[];
  difficulty: ProjectDifficulty;
  suggestedDuration: string;
  audience: string;
  evolutionIdeas: string[];
  recommendedMaxMembers: number;
  suggestedComposition: SquadRecommendation[];
  suggestedTechnologies: string[];
  relatedAreas: string[];
  possibleStacks: string[];
  outcomes: string[];
  official: boolean;
  archived: boolean;
  createdAt: string;
  updatedAt: string;
};

export type ProjectMember = {
  communityId?: string;
  memberId: string;
  name: string;
  avatarUrl: string;
  role: string;
  contributionIntent: string;
  joinedAt: string;
};

export type ProjectJoinRequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED';

export type ProjectJoinRequest = {
  communityId?: string;
  bio?: string;
  interests?: string[];
  id: string;
  projectId: string;
  userId: string;
  name: string;
  avatarUrl: string;
  role: string;
  contributionIntent: string;
  status: ProjectJoinRequestStatus;
  requestedAt: string;
  decidedAt?: string;
  decidedBy?: string;
  discordConnected: boolean;
  areas: string[];
  technologies: string[];
};

export type Project = {
  id: string;
  templateId?: string;
  sourceProjectId?: string;
  ownerId: string;
  ownerName: string;
  name: string;
  description: string;
  category: string;
  problem: string;
  objective: string;
  status: ProjectStatus;
  moderationStatus: ModerationStatus;
  moderationReason?: string;
  origin: 'template' | 'community' | 'replica';
  maxMembers: number;
  duration: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  difficulty: ProjectDifficulty;
  technologies: string[];
  relatedAreas: string[];
  suggestedComposition: SquadRecommendation[];
  possibleStacks: string[];
  outcomes: string[];
  members: ProjectMember[];
  joinRequests: ProjectJoinRequest[];
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  archivedAt?: string;
  cancellationReason?: string;
  repositoryUrl?: string;
  demoUrl?: string;
  completionSummary?: string;
  createdAt: string;
  updatedAt: string;
};

export type GamificationAchievement = {
  code: string;
  name: string;
  description: string;
  unlockedAt?: string;
};

export type GamificationProgress = {
  points: number;
  level: number;
  currentLevelPoints: number;
  nextLevelPoints: number | null;
  achievements: GamificationAchievement[];
};

export type MemberEvidence = {
  id: string;
  label: string;
  technology?: string;
  projectId?: string;
  recordedAt: string;
  kind?: 'participation' | 'join' | 'completion';
  role?: string;
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
  links: { github?: string; linkedin?: string; portfolio?: string };
  currentProjectIds: string[];
  completedProjectIds: string[];
  evidence: MemberEvidence[];
};

// The existing catalogue components use this projection for both scope and execution.
export type ProjectDisplay = {
  id: string;
  kind: 'template' | 'project';
  name: string;
  shortDescription: string;
  category: string;
  status?: ProjectStatus;
  moderationStatus?: ModerationStatus;
  moderationReason?: string;
  memberLimit: number;
  suggestedTechnologies: string[];
  recommendedAreas: string[];
  difficulty: ProjectDifficulty;
  suggestedDuration: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  problem?: string;
  audience?: string;
  suggestedFeatures?: string[];
  evolutionIdeas?: string[];
  acceptanceCriteria?: string[];
  type: ProjectType;
  suggestedRoles: SquadRecommendation[];
  possibleStacks: string[];
  outcomes: string[];
  members: ProjectMember[];
  joinRequests?: ProjectJoinRequest[];
  ownerId?: string;
  ownerName?: string;
  objective?: string;
  startedAt?: string;
  completedAt?: string;
  cancelledAt?: string;
  archivedAt?: string;
  cancellationReason?: string;
  repositoryUrl?: string;
  demoUrl?: string;
  completionSummary?: string;
  createdAt?: string;
};

export type Filters = {
  query: string;
  status: 'Todos' | ProjectStatus;
  area: 'Todas' | string;
  technology: 'Todas' | string;
  difficulty: 'Todas' | ProjectDifficulty;
  type: 'Todos' | ProjectType;
};
