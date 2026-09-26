import { ArrowUpRight, Clock3, UsersRound } from 'lucide-react';
import type { Project } from '../../types';
import { Badge } from '../ui/Badge';
import { ProjectStatusBadge, ProjectTypeBadge } from './ProjectStatusBadge';

export function ProjectCard({ project, selected = false, onSelect }: { project: Project; selected?: boolean; onSelect: () => void }) {
  const occupancy = Math.min(Math.round((project.members.length / project.memberLimit) * 100), 100);

  return (
    <article className={`project-card ${selected ? 'selected' : ''}`}>
      <button className="card-hit-area" onClick={onSelect} aria-label={`Ver projeto ${project.name}`} />
      <div className="project-card-top">
        <ProjectTypeBadge type={project.type} />
        <ProjectStatusBadge status={project.status} />
      </div>
      <div className="project-card-copy">
        <h3>{project.name}</h3>
        <p>{project.shortDescription}</p>
      </div>
      <div className="project-meta">
        <span><UsersRound size={14} />{project.members.length}/{project.memberLimit} membros</span>
        <span><Clock3 size={14} />{project.suggestedDuration}</span>
        <span>{project.difficulty}</span>
      </div>
      <div className="member-meter" aria-label={`${occupancy}% das vagas ocupadas`}>
        <span style={{ width: `${occupancy}%` }} />
      </div>
      <div className="project-card-footer">
        <div className="chip-row" aria-label="Tecnologias sugeridas">
          {project.suggestedTechnologies.slice(0, 2).map((technology) => <Badge key={technology}>{technology}</Badge>)}
          {project.suggestedTechnologies.length > 2 && <span className="more-count">+{project.suggestedTechnologies.length - 2}</span>}
        </div>
        <span className="card-link">Ver projeto <ArrowUpRight size={15} /></span>
      </div>
    </article>
  );
}
