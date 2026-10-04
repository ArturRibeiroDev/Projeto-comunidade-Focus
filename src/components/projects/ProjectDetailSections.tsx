import { ExternalLink } from 'lucide-react';
import type { ReactNode } from 'react';
import { formatProjectDuration } from '../../domain/projectSchedule';
import type { ProjectDisplay } from '../../types';
import { formatDate } from '../../utils/format';
import { Badge } from '../ui/Badge';
import { ProjectMembers, type ProjectMembersProps } from './ProjectMembers';

export type DetailTab = 'overview' | 'scope' | 'stack' | 'squad' | 'details' | 'delivery';

export function projectDetailTabs(
  project: ProjectDisplay,
): Array<{ id: DetailTab; label: string }> {
  if (project.kind === 'template') {
    return [
      { id: 'overview', label: 'Visão geral' },
      ...(project.suggestedFeatures?.length || project.evolutionIdeas?.length
        ? [{ id: 'scope' as const, label: 'Escopo' }]
        : []),
      ...(project.recommendedAreas.length ||
      project.suggestedTechnologies.length ||
      project.suggestedRoles.length ||
      project.possibleStacks.length
        ? [{ id: 'stack' as const, label: 'Stack & Áreas' }]
        : []),
      ...(project.outcomes.length || project.acceptanceCriteria?.length
        ? [{ id: 'delivery' as const, label: 'Entrega' }]
        : []),
    ];
  }

  const hasDetails = Boolean(
    project.plannedStartDate ||
    project.plannedEndDate ||
    project.suggestedTechnologies.length ||
    project.recommendedAreas.length ||
    project.possibleStacks.length ||
    project.suggestedFeatures?.length ||
    project.evolutionIdeas?.length,
  );
  const hasDelivery = Boolean(
    project.startedAt ||
    project.completedAt ||
    project.cancelledAt ||
    project.archivedAt ||
    project.completionSummary ||
    project.cancellationReason ||
    project.repositoryUrl ||
    project.demoUrl ||
    project.outcomes.length ||
    project.acceptanceCriteria?.length,
  );

  return [
    { id: 'overview', label: 'Visão geral' },
    { id: 'squad', label: 'Squad' },
    ...(hasDetails ? [{ id: 'details' as const, label: 'Detalhes' }] : []),
    ...(hasDelivery ? [{ id: 'delivery' as const, label: 'Entrega' }] : []),
  ];
}

function DetailSection({
  title,
  caption,
  children,
}: {
  title: string;
  caption?: string;
  children: ReactNode;
}) {
  return (
    <section className="detail-section">
      <div className="detail-section-heading">
        <h3>{title}</h3>
        {caption && <p>{caption}</p>}
      </div>
      {children}
    </section>
  );
}

function DetailList({ items }: { items: string[] }) {
  return (
    <ul className="outcome-list">
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}

function DetailChips({ items }: { items: string[] }) {
  return (
    <div className="chip-row">
      {items.map((item) => (
        <Badge key={item}>{item}</Badge>
      ))}
    </div>
  );
}

function Composition({ project }: { project: ProjectDisplay }) {
  return (
    <DetailSection
      title="Composição sugerida"
      caption="Uma referência para formar a squad, nunca um requisito."
    >
      <div className="recommendation-grid">
        {project.suggestedRoles.map((recommendation) => {
          const amount = project.members.filter(
            (member) => member.role === recommendation.role,
          ).length;
          return (
            <div className="recommendation" key={recommendation.role}>
              <span>{recommendation.role}</span>
              <strong>
                {project.kind === 'template'
                  ? recommendation.amount
                  : `${amount}/${recommendation.amount}`}
              </strong>
            </div>
          );
        })}
      </div>
      <p className="recommendation-note">A squad pode definir sua própria composição.</p>
    </DetailSection>
  );
}

function Overview({ project, alreadyJoined }: { project: ProjectDisplay; alreadyJoined: boolean }) {
  const duration =
    project.kind === 'project'
      ? formatProjectDuration(project.kind, project.suggestedDuration, project)
      : '';

  return (
    <>
      <dl className="detail-facts">
        <div>
          <dt>Dificuldade</dt>
          <dd>{project.difficulty}</dd>
        </div>
        <div>
          <dt>{project.kind === 'template' ? 'Squad sugerida' : 'Membros'}</dt>
          <dd>
            {project.kind === 'template'
              ? `Até ${project.memberLimit}`
              : `${project.members.length} / ${project.memberLimit}`}
          </dd>
        </div>
        <div>
          <dt>{project.kind === 'template' ? 'Área' : 'Planejamento'}</dt>
          <dd>
            {project.kind === 'template' ? project.category : duration || 'Sem prazo definido'}
          </dd>
        </div>
      </dl>

      {(project.problem || project.objective) && (
        <DetailSection
          title={project.kind === 'template' ? 'Sobre a ideia' : 'Sobre o projeto'}
          caption="Contexto e direção do escopo."
        >
          <div className="detail-copy-grid">
            {project.problem && (
              <div>
                <strong>Problema</strong>
                <p>{project.problem}</p>
              </div>
            )}
            {project.objective && (
              <div>
                <strong>Objetivo</strong>
                <p>{project.objective}</p>
              </div>
            )}
          </div>
        </DetailSection>
      )}

      {project.audience && project.kind === 'template' && (
        <DetailSection title="Para quem é">
          <p className="detail-note">{project.audience}</p>
        </DetailSection>
      )}

      {project.kind === 'project' && project.createdAt && (
        <DetailSection title="Histórico">
          <p className="detail-note">Criado em {formatDate(project.createdAt)}.</p>
        </DetailSection>
      )}

      {project.kind === 'project' && project.status === 'ACTIVE' && alreadyJoined && (
        <p className="detail-guidance">
          Este projeto já está em andamento. Fale com o responsável pela squad para ajustar sua
          participação.
        </p>
      )}
    </>
  );
}

function Scope({ project }: { project: ProjectDisplay }) {
  return (
    <>
      {Boolean(project.suggestedFeatures?.length) && (
        <DetailSection title="Funcionalidades essenciais" caption="O núcleo da primeira entrega.">
          <DetailList items={project.suggestedFeatures ?? []} />
        </DetailSection>
      )}
      {Boolean(project.evolutionIdeas?.length) && (
        <DetailSection
          title="Possíveis evoluções"
          caption="Caminhos para ampliar o projeto depois do escopo inicial."
        >
          <DetailList items={project.evolutionIdeas ?? []} />
        </DetailSection>
      )}
    </>
  );
}

function StackAndAreas({ project }: { project: ProjectDisplay }) {
  return (
    <>
      {project.recommendedAreas.length > 0 && (
        <DetailSection
          title="Áreas sugeridas para contribuir"
          caption="A squad pode incluir outras especialidades."
        >
          <DetailChips items={project.recommendedAreas} />
        </DetailSection>
      )}
      {project.suggestedTechnologies.length > 0 && (
        <DetailSection title="Tecnologias">
          <DetailChips items={project.suggestedTechnologies} />
        </DetailSection>
      )}
      {project.possibleStacks.length > 0 && (
        <DetailSection
          title="Stacks possíveis"
          caption="Exemplos de caminhos técnicos, não uma exigência."
        >
          <DetailList items={project.possibleStacks} />
        </DetailSection>
      )}
      {project.suggestedRoles.length > 0 && <Composition project={project} />}
    </>
  );
}

function Squad({ project, profileId, onMembersChanged }: ProjectMembersProps) {
  return (
    <>
      <DetailSection
        title="Squad"
        caption={`${project.members.length} participantes de até ${project.memberLimit}.`}
      >
        <p className="detail-note">
          <strong>Responsável:</strong> {project.ownerName ?? 'Responsável Focus'}
        </p>
        <ProjectMembers
          project={project}
          profileId={profileId}
          onMembersChanged={onMembersChanged}
        />
      </DetailSection>
      {project.suggestedRoles.length > 0 && <Composition project={project} />}
    </>
  );
}

function ProjectDetails({ project }: { project: ProjectDisplay }) {
  const duration = formatProjectDuration(project.kind, project.suggestedDuration, project);
  return (
    <>
      {duration && (
        <DetailSection title="Planejamento">
          <p className="detail-note">{duration}</p>
        </DetailSection>
      )}
      {Boolean(project.suggestedFeatures?.length || project.evolutionIdeas?.length) && (
        <Scope project={project} />
      )}
      {project.recommendedAreas.length > 0 && (
        <DetailSection title="Áreas de contribuição">
          <DetailChips items={project.recommendedAreas} />
        </DetailSection>
      )}
      {project.suggestedTechnologies.length > 0 && (
        <DetailSection title="Tecnologias">
          <DetailChips items={project.suggestedTechnologies} />
        </DetailSection>
      )}
      {project.possibleStacks.length > 0 && (
        <DetailSection title="Stacks possíveis">
          <DetailList items={project.possibleStacks} />
        </DetailSection>
      )}
    </>
  );
}

function Delivery({ project }: { project: ProjectDisplay }) {
  const milestones =
    project.kind === 'project'
      ? [
          ['Criado', project.createdAt],
          ['Iniciado', project.startedAt],
          ['Concluído', project.completedAt],
          ['Cancelado', project.cancelledAt],
          ['Arquivado', project.archivedAt],
        ].filter((item): item is [string, string] => Boolean(item[1]))
      : [];

  return (
    <>
      {milestones.length > 0 && (
        <DetailSection title="Linha do tempo">
          <dl className="lifecycle-dates">
            {milestones.map(([label, date]) => (
              <div key={label}>
                <dt>{label}</dt>
                <dd>{formatDate(date)}</dd>
              </div>
            ))}
          </dl>
        </DetailSection>
      )}
      {project.completionSummary && (
        <DetailSection title="Resumo da entrega">
          <p className="detail-note">{project.completionSummary}</p>
        </DetailSection>
      )}
      {project.cancellationReason && (
        <DetailSection title="Cancelamento">
          <p className="detail-note">{project.cancellationReason}</p>
        </DetailSection>
      )}
      {(project.repositoryUrl || project.demoUrl) && (
        <DetailSection title="Links da entrega">
          <div className="delivery-links">
            {project.repositoryUrl && (
              <a href={project.repositoryUrl} target="_blank" rel="noopener noreferrer">
                Repositório <ExternalLink size={14} />
              </a>
            )}
            {project.demoUrl && (
              <a href={project.demoUrl} target="_blank" rel="noopener noreferrer">
                Projeto publicado <ExternalLink size={14} />
              </a>
            )}
          </div>
        </DetailSection>
      )}
      {project.outcomes.length > 0 && (
        <DetailSection
          title="Escopo e entregáveis"
          caption="Resultados esperados para esta execução."
        >
          <DetailList items={project.outcomes} />
        </DetailSection>
      )}
      {Boolean(project.acceptanceCriteria?.length) && (
        <DetailSection title="Critérios de entrega">
          <DetailList items={project.acceptanceCriteria ?? []} />
        </DetailSection>
      )}
    </>
  );
}

export function ProjectDetailSections({
  project,
  tab,
  alreadyJoined,
  profileId,
  onMembersChanged,
}: ProjectMembersProps & {
  tab: DetailTab;
  alreadyJoined: boolean;
}) {
  if (tab === 'overview') return <Overview project={project} alreadyJoined={alreadyJoined} />;
  if (tab === 'scope') return <Scope project={project} />;
  if (tab === 'stack') return <StackAndAreas project={project} />;
  if (tab === 'squad')
    return <Squad project={project} profileId={profileId} onMembersChanged={onMembersChanged} />;
  if (tab === 'details') return <ProjectDetails project={project} />;
  return <Delivery project={project} />;
}
