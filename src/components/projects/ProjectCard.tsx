import { ArrowUpRight, Clock3, UsersRound } from 'lucide-react';
import type { ProjectDisplay } from '../../types';
import { Badge } from '../ui/Badge';
import { ModerationBadge, ProjectStatusBadge, ProjectTypeBadge } from './ProjectStatusBadge';
import { formatProjectDuration } from '../../domain/projectSchedule';

export function ProjectCard({
  project,
  selected = false,
  onSelect,
}: {
  project: ProjectDisplay;
  selected?: boolean;
  onSelect: () => void;
}) {
  const occupancy =
    project.kind === 'project'
      ? Math.min(Math.round((project.members.length / project.memberLimit) * 100), 100)
      : 0;
  const examples =
    project.kind === 'template'
      ? project.possibleStacks.map((stack) =>
          stack.replace('HTML + CSS + JavaScript', 'HTML/CSS/JS'),
        )
      : project.suggestedTechnologies;

  return (
    <article className={`project-card ${selected ? 'selected' : ''}`}>
      <button
        className="card-hit-area"
        onClick={onSelect}
        aria-label={`${project.kind === 'template' ? 'Ver ideia' : 'Ver projeto'} ${project.name}`}
      />
      <div className="project-card-top">
        <ProjectTypeBadge type={project.type} />
        {project.status && <ProjectStatusBadge status={project.status} />}
        <ModerationBadge status={project.moderationStatus} />
      </div>
      <div className="project-card-copy">
        <h3>{project.name}</h3>
        <p>{project.shortDescription}</p>
      </div>
      <div className="project-meta">
        <span>
          <UsersRound size={14} />
          {project.kind === 'template'
            ? `até ${project.memberLimit} sugeridos`
            : `${project.members.length}/${project.memberLimit} membros`}
        </span>
        {project.kind === 'project' &&
          formatProjectDuration(project.kind, project.suggestedDuration, project) && (
            <span>
              <Clock3 size={14} />
              {formatProjectDuration(project.kind, project.suggestedDuration, project)}
            </span>
          )}
        <span>{project.difficulty}</span>
      </div>
      {project.kind === 'project' && (
        <div className="member-meter" aria-label={`${occupancy}% das vagas ocupadas`}>
          <span style={{ width: `${occupancy}%` }} />
        </div>
      )}
      <div className="project-card-footer">
        <div className="chip-row" aria-label="Stacks possíveis">
          {examples.slice(0, 2).map((technology) => (
            <Badge key={technology}>{technology}</Badge>
          ))}
          {examples.length > 2 && <span className="more-count">+{examples.length - 2}</span>}
        </div>
        <span className="card-link">
          {project.kind === 'template' ? 'Ver ideia' : 'Ver projeto'} <ArrowUpRight size={15} />
        </span>
      </div>
    </article>
  );
}
