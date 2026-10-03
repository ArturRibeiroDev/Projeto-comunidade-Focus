import { ArrowUpRight, Search } from 'lucide-react';
import type { MemberProfile, ProjectDisplay, ProjectStatus } from '../types';
import { formatDate } from '../utils/format';
import { ModerationBadge, ProjectStatusBadge } from '../components/projects/ProjectStatusBadge';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';

const sections: Array<{ title: string; statuses: ProjectStatus[] }> = [
  { title: 'Em formação', statuses: ['FORMING'] },
  { title: 'Em andamento', statuses: ['ACTIVE'] },
  { title: 'Concluídos', statuses: ['COMPLETED'] },
  { title: 'Histórico', statuses: ['CANCELLED', 'ARCHIVED'] },
];

function ProjectEntry({
  project,
  role,
  onSelect,
}: {
  project: ProjectDisplay;
  role: string;
  onSelect: () => void;
}) {
  return (
    <article className="my-project-entry">
      <div className="my-project-entry-heading">
        <button onClick={onSelect}>
          <strong>{project.name}</strong>
          <ArrowUpRight size={15} />
        </button>
        {project.status && <ProjectStatusBadge status={project.status} />}
        <ModerationBadge status={project.moderationStatus} />
      </div>
      <dl className="my-project-entry-facts">
        <div>
          <dt>Sua função</dt>
          <dd>{role}</dd>
        </div>
        <div>
          <dt>Squad</dt>
          <dd>
            {project.members.length}/{project.memberLimit} membros
          </dd>
        </div>
        <div>
          <dt>Responsável</dt>
          <dd>{project.ownerName ?? 'Responsável Focus'}</dd>
        </div>
        {project.createdAt && (
          <div>
            <dt>Criado</dt>
            <dd>{formatDate(project.createdAt)}</dd>
          </div>
        )}
        {project.startedAt && (
          <div>
            <dt>Iniciado</dt>
            <dd>{formatDate(project.startedAt)}</dd>
          </div>
        )}
        {project.completedAt && (
          <div>
            <dt>Concluído</dt>
            <dd>{formatDate(project.completedAt)}</dd>
          </div>
        )}
        {project.cancelledAt && (
          <div>
            <dt>Cancelado</dt>
            <dd>{formatDate(project.cancelledAt)}</dd>
          </div>
        )}
        {project.archivedAt && (
          <div>
            <dt>Arquivado</dt>
            <dd>{formatDate(project.archivedAt)}</dd>
          </div>
        )}
      </dl>
      {(project.repositoryUrl || project.demoUrl) && (
        <div className="delivery-links">
          {project.repositoryUrl && (
            <a href={project.repositoryUrl} target="_blank" rel="noopener noreferrer">
              Repositório
            </a>
          )}
          {project.demoUrl && (
            <a href={project.demoUrl} target="_blank" rel="noopener noreferrer">
              Projeto publicado
            </a>
          )}
        </div>
      )}
    </article>
  );
}

export function MyProjectsPage({
  allProjects,
  profile,
  onExplore,
  onSelect,
}: {
  allProjects: ProjectDisplay[];
  profile: MemberProfile;
  onExplore: () => void;
  onSelect: (projectId: string) => void;
}) {
  const mine = allProjects.filter(
    (project) =>
      project.kind === 'project' &&
      project.members.some((member) => member.memberId === profile.id),
  );
  return (
    <div className="page-stack content-narrow">
      <PageHeader
        eyebrow="Sua participação"
        title="Meus projetos"
        description="Squads em formação, projetos em andamento e histórico das suas entregas."
        actions={
          <Button icon={<Search size={16} />} onClick={onExplore}>
            Explorar catálogo
          </Button>
        }
      />
      {mine.length === 0 ? (
        <EmptyState
          title="Nenhum projeto ainda"
          description="Use um template Focus ou crie uma squad comunitária."
          action={
            <Button onClick={onExplore} variant="primary">
              Explorar projetos
            </Button>
          }
        />
      ) : (
        sections.map((section) => {
          const items = mine.filter(
            (project) => project.status && section.statuses.includes(project.status),
          );
          return (
            <section className="my-project-section" key={section.title}>
              <div className="section-heading">
                <div>
                  <span className="section-kicker">Participação</span>
                  <h2>{section.title}</h2>
                </div>
                <span>{items.length}</span>
              </div>
              {items.length > 0 ? (
                <div className="my-project-entries">
                  {items.map((project) => (
                    <ProjectEntry
                      key={project.id}
                      project={project}
                      role={
                        project.members.find((member) => member.memberId === profile.id)?.role ??
                        'Outra'
                      }
                      onSelect={() => onSelect(project.id)}
                    />
                  ))}
                </div>
              ) : (
                <p className="muted-copy">Nenhum projeto nesta etapa.</p>
              )}
            </section>
          );
        })
      )}
    </div>
  );
}
