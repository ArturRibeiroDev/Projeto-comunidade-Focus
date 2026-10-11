import { ArrowUpRight, Clock3, UsersRound } from 'lucide-react';
import type { MemberProfile, ProjectDisplay } from '../../types';
import { Badge } from '../ui/Badge';
import { ModerationBadge, ProjectStatusBadge, ProjectTypeBadge } from './ProjectStatusBadge';
import { formatProjectDuration } from '../../domain/projectSchedule';

export function ProjectCard({
  project,
  profile,
  selected = false,
  onSelect,
}: {
  project: ProjectDisplay;
  profile: MemberProfile;
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
  const areaMatch = project.recommendedAreas.some(
    (area) =>
      area.toLocaleLowerCase('pt-BR') === profile.primaryRole.toLocaleLowerCase('pt-BR') ||
      profile.areas.some(
        (profileArea) => profileArea.toLocaleLowerCase('pt-BR') === area.toLocaleLowerCase('pt-BR'),
      ),
  );
  const matchingTechnologies = project.suggestedTechnologies.filter((technology) =>
    profile.technologies.some(
      (profileTechnology) =>
        profileTechnology.toLocaleLowerCase('pt-BR') === technology.toLocaleLowerCase('pt-BR'),
    ),
  );

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
        {project.ownerName && <span>Owner: {project.ownerName}</span>}
      </div>
      <div className="project-card-context" aria-label="Áreas e tecnologias do projeto">
        {project.recommendedAreas.slice(0, 2).map((area) => (
          <Badge key={area}>{area}</Badge>
        ))}
        {project.recommendedAreas.length > 2 && (
          <span className="more-count">+{project.recommendedAreas.length - 2}</span>
        )}
      </div>
      {(areaMatch || matchingTechnologies.length > 0) && (
        <div className="profile-match-note">
          {areaMatch
            ? 'Sua área combina com este projeto'
            : `Você já conhece ${matchingTechnologies.slice(0, 2).join(' e ')}`}
        </div>
      )}
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
          {project.kind === 'template'
            ? 'Ver ideia'
            : project.status === 'FORMING'
              ? 'Ver projeto / solicitar entrada'
              : 'Ver projeto'}{' '}
          <ArrowUpRight size={15} />
        </span>
      </div>
    </article>
  );
}
