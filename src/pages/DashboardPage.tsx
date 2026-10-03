import { ArrowRight, BookOpen, BriefcaseBusiness, Layers3, UsersRound } from 'lucide-react';
import { summarizeDashboard } from '../domain/dashboardSummary';
import type { MemberProfile, ProjectDisplay } from '../types';
import type { View } from '../viewTypes';
import { formatDate } from '../utils/format';
import { ProjectCard } from '../components/projects/ProjectCard';
import { Button } from '../components/ui/Button';
import { PageHeader } from '../components/ui/PageHeader';

export function DashboardPage({
  projects,
  profile,
  onNavigate,
  onSelectProject,
}: {
  projects: ProjectDisplay[];
  profile: MemberProfile;
  onNavigate: (view: View) => void;
  onSelectProject: (projectId: string) => void;
}) {
  const { currentProjects, availableProjects, formingSquads, activeProjects } = summarizeDashboard(
    projects,
    profile.id,
  );
  const recentProjects = (
    currentProjects.length > 0
      ? currentProjects
      : availableProjects.length > 0
        ? availableProjects
        : projects.filter((project) => project.kind === 'template')
  ).slice(0, 3);

  const metrics = [
    {
      label: 'Projetos disponíveis',
      value: availableProjects.length,
      detail: 'templates e squads com vagas',
      icon: BookOpen,
      view: 'catalog' as View,
    },
    {
      label: 'Squads formando',
      value: formingSquads.length,
      detail: 'projetos em formação',
      icon: UsersRound,
      view: 'catalog' as View,
    },
    {
      label: 'Em andamento',
      value: activeProjects.length,
      detail: 'projetos ativos',
      icon: Layers3,
      view: 'catalog' as View,
    },
    {
      label: 'Meus projetos',
      value: currentProjects.length,
      detail: 'participações atuais',
      icon: BriefcaseBusiness,
      view: 'my-projects' as View,
    },
  ];

  return (
    <div className="page-stack">
      <PageHeader
        eyebrow="FocusAcademy"
        title={`Olá, ${profile.name.split(' ')[0]}`}
        description="Acompanhe suas squads e encontre o próximo projeto para transformar conhecimento em prática."
        actions={
          <Button
            icon={<ArrowRight size={17} />}
            onClick={() => onNavigate('catalog')}
            variant="primary"
          >
            Explorar projetos
          </Button>
        }
      />

      <section className="metrics-grid" aria-label="Resumo dos projetos">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <button className="metric" key={metric.label} onClick={() => onNavigate(metric.view)}>
              <span className="metric-icon">
                <Icon size={18} />
              </span>
              <span>
                <strong>{metric.value}</strong>
                <small>{metric.label}</small>
                <em>{metric.detail}</em>
              </span>
              <ArrowRight className="metric-arrow" size={15} />
            </button>
          );
        })}
      </section>

      <div className="dashboard-grid">
        <section className="dashboard-main">
          <div className="section-heading">
            <div>
              <span className="section-kicker">
                {currentProjects.length > 0 ? 'Sua jornada' : 'Para começar'}
              </span>
              <h2>
                {currentProjects.length > 0 ? 'Continue seus projetos' : 'Projetos com vagas'}
              </h2>
            </div>
            <Button
              icon={<ArrowRight size={15} />}
              onClick={() => onNavigate(currentProjects.length > 0 ? 'my-projects' : 'catalog')}
              size="small"
              variant="ghost"
            >
              Ver todos
            </Button>
          </div>
          <div className="project-grid dashboard-projects">
            {recentProjects.map((project) => (
              <ProjectCard
                key={project.id}
                onSelect={() => onSelectProject(project.id)}
                project={project}
              />
            ))}
          </div>
        </section>

        <aside className="activity-panel">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Perfil</span>
              <h2>Atividade recente</h2>
            </div>
          </div>
          <div className="activity-list">
            {profile.evidence.slice(0, 5).map((evidence) => (
              <div className="activity-item" key={evidence.id}>
                <i aria-hidden="true" />
                <div>
                  <strong>{evidence.label}</strong>
                  <time>{formatDate(evidence.recordedAt)}</time>
                </div>
              </div>
            ))}
          </div>
          <Button onClick={() => onNavigate('profile')} size="small">
            Ver perfil e evidências
          </Button>
        </aside>
      </div>
    </div>
  );
}
