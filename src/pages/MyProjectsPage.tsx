import { Search } from 'lucide-react';
import type { MemberProfile, Project } from '../types';
import { ProjectCard } from '../components/projects/ProjectCard';
import { Button } from '../components/ui/Button';
import { EmptyState } from '../components/ui/EmptyState';
import { PageHeader } from '../components/ui/PageHeader';

export function MyProjectsPage({ projects, allProjects, profile, onExplore, onSelect }: {
  projects: Project[];
  allProjects: Project[];
  profile: MemberProfile;
  onExplore: () => void;
  onSelect: (projectId: string) => void;
}) {
  const completed = allProjects.filter((project) => profile.completedProjectIds.includes(project.id));

  return (
    <div className="page-stack content-narrow">
      <PageHeader eyebrow="Participação ativa" title="Meus projetos" description="Squads das quais você participa e histórico de projetos concluídos." actions={<Button icon={<Search size={16} />} onClick={onExplore}>Explorar catálogo</Button>} />
      {projects.length > 0 ? <div className="project-grid my-projects-grid">{projects.map((project) => <ProjectCard key={project.id} onSelect={() => onSelect(project.id)} project={project} />)}</div> : <EmptyState title="Nenhum projeto ativo ainda" description="Entre em um Focus Project ou crie uma squad comunitária." action={<Button onClick={onExplore} variant="primary">Explorar projetos</Button>} />}
      <section className="history-panel">
        <div className="section-heading"><div><span className="section-kicker">Histórico</span><h2>Projetos concluídos</h2></div><span>{completed.length}</span></div>
        {completed.length > 0 ? <ul>{completed.map((project) => <li key={project.id}>{project.name}</li>)}</ul> : <p>Ainda não há projetos concluídos registrados no perfil.</p>}
      </section>
    </div>
  );
}
