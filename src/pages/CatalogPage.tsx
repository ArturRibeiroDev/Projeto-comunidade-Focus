import { Plus } from 'lucide-react';
import type {
  LifecycleDetails,
  LifecycleTarget,
} from '../components/projects/ProjectLifecycleModal';
import type { ProjectEditInput } from '../services/projectService';
import type { DiscordConnection } from '../services/useDiscordIntegration';
import type { Filters, ProjectDisplay } from '../types';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectDetail } from '../components/projects/ProjectDetail';
import { ProjectFilters } from '../components/projects/ProjectFilters';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';
import { Modal } from '../components/ui/Modal';

export function CatalogPage({
  filters,
  onMembersChanged,
  projectOptions,
  projects,
  selectedProject,
  profileId,
  discordConnected,
  canManageDiscord,
  discordRefresh,
  discord,
  onChangeFilters,
  onClearFilters,
  onCreate,
  onJoin,
  onConnectDiscord,
  onDecideJoinRequest,
  onReuse,
  onLeave,
  onEdit,
  onResubmit,
  onTransition,
  onSelect,
  onCloseDetail,
  busy,
}: {
  filters: Filters;
  onMembersChanged?: () => Promise<void>;
  projectOptions: { areas: string[]; technologies: string[] };
  projects: ProjectDisplay[];
  selectedProject?: ProjectDisplay;
  profileId: string;
  discordConnected: boolean;
  canManageDiscord: boolean;
  discordRefresh: number;
  discord: DiscordConnection;
  onChangeFilters: <Key extends keyof Filters>(key: Key, value: Filters[Key]) => void;
  onClearFilters: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onConnectDiscord: () => void;
  onDecideJoinRequest: (requestId: string, decision: 'APPROVED' | 'REJECTED') => void;
  onReuse: (projectId: string) => void;
  onLeave: (projectId: string) => void;
  onEdit: (projectId: string, input: ProjectEditInput) => Promise<boolean>;
  onResubmit: (projectId: string) => Promise<boolean>;
  onTransition: (
    projectId: string,
    target: LifecycleTarget,
    details: LifecycleDetails,
  ) => Promise<boolean>;
  onSelect: (projectId: string) => void;
  onCloseDetail: () => void;
  busy: boolean;
}) {
  const activeFilterCount = [
    filters.status !== 'Todos',
    filters.area !== 'Todas',
    filters.technology !== 'Todas',
    filters.difficulty !== 'Todas',
    filters.type !== 'Todos',
  ].filter(Boolean).length;
  const hasFilters = activeFilterCount > 0 || filters.query.trim() !== '';

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="Projetos"
        title="Catálogo de projetos"
        description="Explore escopos preparados pela Focus e ideias criadas pela comunidade."
        actions={
          <Button icon={<Plus size={17} />} onClick={onCreate} variant="primary">
            Criar projeto
          </Button>
        }
      />
      <ProjectFilters
        activeCount={activeFilterCount}
        filters={filters}
        onChange={onChangeFilters}
        onClear={onClearFilters}
        projectOptions={projectOptions}
      />
      <div className="catalog-layout">
        <section className="catalog-main">
          <div className="results-heading">
            <strong>
              {projects.length} {projects.length === 1 ? 'projeto' : 'projetos'}
            </strong>
            <span>Resultados atualizados pelos filtros ativos</span>
          </div>
          {projects.length > 0 ? (
            <div className="project-grid">
              {projects.map((project) => (
                <ProjectCard
                  key={project.id}
                  onSelect={() => onSelect(project.id)}
                  project={project}
                  selected={selectedProject?.id === project.id}
                />
              ))}
            </div>
          ) : (
            <EmptyState
              title={
                hasFilters ? 'Nenhum projeto encontrado' : 'Nenhum projeto disponível no momento'
              }
              description={
                hasFilters
                  ? 'Tente remover alguns filtros ou crie um novo projeto.'
                  : 'O catálogo ainda não possui templates ou projetos publicados.'
              }
              action={
                hasFilters ? (
                  <Button onClick={onClearFilters}>Limpar filtros</Button>
                ) : (
                  <Button onClick={onCreate}>Criar projeto</Button>
                )
              }
            />
          )}
        </section>
        {selectedProject && (
          <Modal open title="Detalhes do projeto" onClose={onCloseDetail} variant="drawer">
            <ProjectDetail
              key={selectedProject.id}
              busy={busy}
              onEdit={(input) => onEdit(selectedProject.id, input)}
              onResubmit={() => onResubmit(selectedProject.id)}
              onTransition={(target, details) => onTransition(selectedProject.id, target, details)}
              onConnectDiscord={onConnectDiscord}
              onDecideJoinRequest={onDecideJoinRequest}
              onJoin={onJoin}
              onLeave={() => onLeave(selectedProject.id)}
              onReuse={() => onReuse(selectedProject.id)}
              profileId={profileId}
              discordConnected={discordConnected}
              canManageDiscord={canManageDiscord}
              discordRefresh={discordRefresh}
              onMembersChanged={onMembersChanged}
              discord={discord}
              project={selectedProject}
            />
          </Modal>
        )}
      </div>
    </div>
  );
}
