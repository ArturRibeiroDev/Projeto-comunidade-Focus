import { Clock3, CopyPlus, Layers3, UsersRound } from 'lucide-react';
import type { Project } from '../../types';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { ProjectMembers } from './ProjectMembers';
import { ProjectStatusBadge, ProjectTypeBadge } from './ProjectStatusBadge';

export function ProjectDetail({ project, profileId, onJoin, onReuse }: {
  project: Project;
  profileId: string;
  onJoin: () => void;
  onReuse: () => void;
}) {
  const alreadyJoined = project.members.some((member) => member.memberId === profileId);
  const isFull = project.members.length >= project.memberLimit;

  return (
    <aside className="project-detail" aria-label="Detalhes do projeto selecionado">
      <header className="detail-header">
        <div className="badge-row"><ProjectTypeBadge type={project.type} /><ProjectStatusBadge status={project.status} /></div>
        <h2>{project.name}</h2>
        <p>{project.shortDescription}</p>
      </header>

      <dl className="detail-facts">
        <div><dt><Clock3 size={15} />Duração</dt><dd>{project.suggestedDuration}</dd></div>
        <div><dt><Layers3 size={15} />Dificuldade</dt><dd>{project.difficulty}</dd></div>
        <div><dt><UsersRound size={15} />Membros</dt><dd>{project.members.length}/{project.memberLimit}</dd></div>
      </dl>

      <div className="detail-actions">
        <Button
          aria-disabled={alreadyJoined || isFull}
          icon={<UsersRound size={17} />}
          onClick={onJoin}
          title={alreadyJoined ? 'Você já participa desta squad' : isFull ? 'Esta squad está completa' : undefined}
          variant="primary"
        >
          {alreadyJoined ? 'Você já participa' : isFull ? 'Squad completa' : 'Entrar no projeto'}
        </Button>
        <Button icon={<CopyPlus size={17} />} onClick={onReuse}>Usar como template</Button>
      </div>

      <section className="detail-section">
        <div className="detail-title"><h3>Squad</h3><span>{project.members.length} participantes</span></div>
        <ProjectMembers project={project} />
      </section>

      <section className="detail-section">
        <div className="detail-title"><h3>Composição sugerida</h3></div>
        <div className="recommendation-grid">
          {project.suggestedRoles.map((recommendation) => {
            const amount = project.members.filter((member) => member.role === recommendation.role).length;
            return <div className="recommendation" key={recommendation.role}><span>{recommendation.role}</span><strong>{amount}/{recommendation.amount}</strong></div>;
          })}
        </div>
        <p className="recommendation-note">Esta é apenas uma recomendação. A squad pode definir sua própria composição.</p>
      </section>

      <section className="detail-section">
        <div className="detail-title"><h3>Tecnologias</h3></div>
        <div className="chip-row">{project.suggestedTechnologies.map((technology) => <Badge key={technology}>{technology}</Badge>)}</div>
      </section>

      <section className="detail-section">
        <div className="detail-title"><h3>Escopo e entregáveis</h3></div>
        <ul className="outcome-list">{project.outcomes.map((outcome) => <li key={outcome}>{outcome}</li>)}</ul>
      </section>

      <section className="detail-section">
        <div className="detail-title"><h3>Stacks possíveis</h3></div>
        <ul className="stack-list">{project.possibleStacks.map((stack) => <li key={stack}>{stack}</li>)}</ul>
      </section>

    </aside>
  );
}
