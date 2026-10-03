import type { ProjectDisplay } from '../types';

const closedStatuses = new Set(['COMPLETED', 'CANCELLED', 'ARCHIVED']);

export function summarizeDashboard(projects: ProjectDisplay[], profileId: string) {
  const executions = projects.filter((project) => project.kind === 'project');
  const currentProjects = executions.filter(
    (project) =>
      !closedStatuses.has(project.status ?? '') &&
      project.members.some((member) => member.memberId === profileId),
  );
  const availableProjects = projects.filter(
    (project) =>
      project.kind === 'template' ||
      (project.status === 'FORMING' &&
        project.moderationStatus !== 'PENDING' &&
        project.moderationStatus !== 'REJECTED' &&
        project.members.length < project.memberLimit),
  );
  return {
    currentProjects,
    availableProjects,
    formingSquads: executions.filter(
      (project) =>
        project.status === 'FORMING' &&
        project.moderationStatus !== 'PENDING' &&
        project.moderationStatus !== 'REJECTED',
    ),
    activeProjects: executions.filter((project) => project.status === 'ACTIVE'),
  };
}
