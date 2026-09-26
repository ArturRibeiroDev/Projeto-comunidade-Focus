import { Plus } from 'lucide-react';
import type { Filters, Project } from '../types';
import { ProjectCard } from '../components/projects/ProjectCard';
import { ProjectDetail } from '../components/projects/ProjectDetail';
import { ProjectFilters } from '../components/projects/ProjectFilters';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';

export function CatalogPage({ filters, projectOptions, projects, selectedProject, profileId, onChangeFilters, onClearFilters, onCreate, onJoin, onReuse, onSelect }: {
  filters: Filters;
  projectOptions: { areas: string[]; technologies: string[] };
  projects: Project[];
  selectedProject?: Project;
  profileId: string;
  onChangeFilters: <Key extends keyof Filters>(key: Key, value: Filters[Key]) => void;
  onClearFilters: () => void;
  onCreate: () => void;
  onJoin: () => void;
  onReuse: (projectId: string) => void;
  onSelect: (projectId: string) => void;
}) {
  const activeFilterCount = [filters.status !== 'Todos', filters.area !== 'Todas', filters.technology !== 'Todas', filters.difficulty !== 'Todas', filters.type !== 'Todos'].filter(Boolean).length;

  return (
    <div className="page-stack">
      <PageHeader eyebrow="Projetos" title="Catálogo de projetos" description="Explore escopos preparados pela Focus e ideias criadas pela comunidade." actions={<Button icon={<Plus size={17} />} onClick={onCreate} variant="primary">Criar projeto</Button>} />
      <ProjectFilters activeCount={activeFilterCount} filters={filters} onChange={onChangeFilters} onClear={onClearFilters} projectOptions={projectOptions} />
      <div className="catalog-layout">
        <section className="catalog-main">
          <div className="results-heading"><strong>{projects.length} {projects.length === 1 ? 'projeto' : 'projetos'}</strong><span>Resultados atualizados pelos filtros ativos</span></div>
          {projects.length > 0 ? (
            <div className="project-grid">{projects.map((project) => <ProjectCard key={project.id} onSelect={() => onSelect(project.id)} project={project} selected={selectedProject?.id === project.id} />)}</div>
          ) : (
            <EmptyState title="Nenhum projeto encontrado" description="Tente remover alguns filtros ou crie um novo projeto." action={<Button onClick={onClearFilters}>Limpar filtros</Button>} />
          )}
        </section>
        {selectedProject && <ProjectDetail onJoin={onJoin} onReuse={() => onReuse(selectedProject.id)} profileId={profileId} project={selectedProject} />}
      </div>
    </div>
  );
}
