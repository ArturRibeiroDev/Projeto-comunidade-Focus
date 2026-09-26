import type { ProjectStatus, ProjectType } from '../../types';
import { Badge, type BadgeTone } from '../ui/Badge';

const statusTone: Record<ProjectStatus, BadgeTone> = {
  Aberto: 'green',
  'Em formação': 'sky',
  'Em andamento': 'amber',
  Concluído: 'zinc'
};

const statusLabel: Record<ProjectStatus, string> = {
  Aberto: 'Aberto',
  'Em formação': 'Formando squad',
  'Em andamento': 'Em andamento',
  Concluído: 'Concluído'
};

export function ProjectStatusBadge({ status }: { status: ProjectStatus }) {
  return <Badge tone={statusTone[status]}><i className="status-dot" aria-hidden="true" />{statusLabel[status]}</Badge>;
}

export function ProjectTypeBadge({ type }: { type: ProjectType }) {
  return <Badge tone={type === 'Focus Project' ? 'orange' : 'violet'}>{type}</Badge>;
}
