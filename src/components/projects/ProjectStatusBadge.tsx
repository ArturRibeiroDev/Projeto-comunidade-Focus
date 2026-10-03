import type { ModerationStatus, ProjectStatus, ProjectType } from '../../types';
import { projectStatusLabels } from '../../domain/projectLifecycle';
import { Badge, type BadgeTone } from '../ui/Badge';

const statusTone: Record<ProjectStatus, BadgeTone> = {
  FORMING: 'sky',
  ACTIVE: 'amber',
  COMPLETED: 'zinc',
  CANCELLED: 'zinc',
  ARCHIVED: 'zinc',
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return (
    <Badge tone={statusTone[status]}>
      <i className="status-dot" aria-hidden="true" />
      {projectStatusLabels[status]}
    </Badge>
  );
}

export function ProjectTypeBadge({ type }: { type: ProjectType }) {
  return (
    <Badge tone={type === 'Focus Project' ? 'orange' : 'violet'}>
      {type === 'Focus Project' ? 'Focus Idea' : type}
    </Badge>
  );
}

export function ModerationBadge({ status }: { status?: ModerationStatus }) {
  if (!status || status === 'APPROVED') return null;
  return (
    <Badge tone={status === 'PENDING' ? 'amber' : 'zinc'}>
      {status === 'PENDING' ? 'Aguardando revisão' : 'Projeto não aprovado'}
    </Badge>
  );
}
