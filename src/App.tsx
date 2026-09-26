import {
  BookOpen,
  Boxes,
  BriefcaseBusiness,
  Check,
  ChevronRight,
  CirclePlus,
  ClipboardList,
  CopyPlus,
  Filter,
  Github,
  LayoutDashboard,
  Linkedin,
  ListChecks,
  Plus,
  RotateCcw,
  Save,
  Search,
  Sparkles,
  UserRound,
  UsersRound,
  X
} from 'lucide-react';
import { FormEvent, useEffect, useMemo, useState } from 'react';
import { projectDifficulties, projectStatuses, projectTypes, roleOptions, technologySuggestions } from './data/options';
import { initialState } from './data/seed';
import { loadHubState, resetHubState, saveHubState } from './storage';
import type { Filters, HubState, MemberProfile, Project, ProjectDifficulty, ProjectStatus, ProjectType } from './types';
import { collectProjectOptions, createEmptyFilters, filterProjects } from './utils/projectFilters';

type View = 'catalog' | 'my-projects' | 'create' | 'profile';

type Toast = {
  title: string;
  message: string;
};

type ProjectFormState = {
  name: string;
  shortDescription: string;
  category: string;
  memberLimit: number;
  difficulty: ProjectDifficulty;
  suggestedDuration: string;
  recommendedAreas: string;
  suggestedTechnologies: string;
  possibleStacks: string;
  outcomes: string;
};

const defaultProjectForm: ProjectFormState = {
  name: '',
  shortDescription: '',
  category: '',
  memberLimit: 5,
  difficulty: 'Misto',
  suggestedDuration: '4 a 6 semanas',
  recommendedAreas: 'Backend, Frontend, UX/UI, QA',
  suggestedTechnologies: 'TypeScript, React, Node.js',
  possibleStacks: 'Stack a definir pela squad',
  outcomes: 'MVP navegável, README, apresentação final'
};

const toList = (value: string) =>
  value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);

const formatDate = (value: string) =>
  new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  }).format(new Date(value));

const getStatusClass = (status: ProjectStatus) =>
  ({
    Aberto: 'badge badge-green',
    'Em formação': 'badge badge-blue',
    'Em andamento': 'badge badge-amber',
    Concluído: 'badge badge-neutral'
  })[status];

const getTypeClass = (type: ProjectType) =>
  type === 'Focus Project' ? 'badge badge-focus' : 'badge badge-community';

function App() {
  const [state, setState] = useState<HubState>(() => loadHubState());
  const [activeView, setActiveView] = useState<View>('catalog');
  const [filters, setFilters] = useState<Filters>(() => createEmptyFilters());
  const [selectedProjectId, setSelectedProjectId] = useState(state.projects[0]?.id ?? '');
  const [joinRole, setJoinRole] = useState(state.profile.primaryRole);
  const [joinIntent, setJoinIntent] = useState('Quero contribuir com entregas práticas, documentação e revisão da solução.');
  const [projectForm, setProjectForm] = useState<ProjectFormState>(defaultProjectForm);
  const [profileDraft, setProfileDraft] = useState<MemberProfile>(state.profile);
  const [toast, setToast] = useState<Toast | null>(null);

  useEffect(() => {
    saveHubState(state);
  }, [state]);

  useEffect(() => {
    setProfileDraft(state.profile);
  }, [state.profile]);

  useEffect(() => {
    if (toast) {
      const timer = window.setTimeout(() => setToast(null), 4200);
      return () => window.clearTimeout(timer);
    }
  }, [toast]);

  const selectedProject = state.projects.find((project) => project.id === selectedProjectId) ?? state.projects[0];
  const visibleProjects = useMemo(() => filterProjects(state.projects, filters), [state.projects, filters]);
  const projectOptions = useMemo(() => collectProjectOptions(state.projects), [state.projects]);
  const currentProjects = state.projects.filter((project) =>
    project.members.some((member) => member.memberId === state.profile.id)
  );
  const focusProjectCount = state.projects.filter((project) => project.type === 'Focus Project').length;
  const communityProjectCount = state.projects.filter((project) => project.type === 'Community Project').length;
  const openSlots = state.projects.reduce(
    (total, project) => total + Math.max(project.memberLimit - project.members.length, 0),
    0
  );

  const updateFilters = <Key extends keyof Filters>(key: Key, value: Filters[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const showToast = (title: string, message: string) => {
    setToast({ title, message });
  };

  const selectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveView('catalog');
  };

  const joinSelectedProject = () => {
    if (!selectedProject) {
      return;
    }

    const alreadyJoined = selectedProject.members.some((member) => member.memberId === state.profile.id);

    if (alreadyJoined) {
      showToast('Você já está na squad', 'Abra Meus projetos para acompanhar sua participação.');
      return;
    }

    if (selectedProject.members.length >= selectedProject.memberLimit) {
      showToast('Squad completa', 'Use este template para originar uma nova squad com outra composição.');
      return;
    }

    const joinedAt = new Date().toISOString();

    setState((current) => ({
      ...current,
      profile: {
        ...current.profile,
        currentProjectIds: Array.from(new Set([...current.profile.currentProjectIds, selectedProject.id])),
        evidence: [
          {
            id: `evidence-${selectedProject.id}-${Date.now()}`,
            label: `Entrou no projeto ${selectedProject.name} como ${joinRole}`,
            projectId: selectedProject.id,
            technology: selectedProject.suggestedTechnologies[0],
            recordedAt: joinedAt
          },
          ...current.profile.evidence
        ]
      },
      projects: current.projects.map((project) =>
        project.id === selectedProject.id
          ? {
              ...project,
              status: project.status === 'Aberto' ? 'Em formação' : project.status,
              members: [
                ...project.members,
                {
                  memberId: current.profile.id,
                  name: current.profile.name,
                  avatarUrl: current.profile.avatarUrl,
                  role: joinRole,
                  contributionIntent: joinIntent,
                  joinedAt
                }
              ]
            }
          : project
      )
    }));

    showToast('Entrada registrada', `Você entrou em ${selectedProject.name} como ${joinRole}.`);
  };

  const reuseSelectedTemplate = () => {
    if (!selectedProject) {
      return;
    }

    const reusedAt = new Date().toISOString();
    const projectNumber = state.projects.filter((project) => project.originTemplateId === selectedProject.id).length + 1;
    const newProject: Project = {
      ...selectedProject,
      id: `community-${selectedProject.id}-${Date.now()}`,
      name: `${selectedProject.name} - Squad ${projectNumber}`,
      status: 'Em formação',
      type: 'Community Project',
      createdBy: state.profile.name,
      originTemplateId: selectedProject.originTemplateId ?? selectedProject.id,
      members: [
        {
          memberId: state.profile.id,
          name: state.profile.name,
          avatarUrl: state.profile.avatarUrl,
          role: state.profile.primaryRole,
          contributionIntent: 'Iniciou a squad a partir de um template Focus.',
          joinedAt: reusedAt
        }
      ]
    };

    setState((current) => ({
      ...current,
      profile: {
        ...current.profile,
        currentProjectIds: Array.from(new Set([...current.profile.currentProjectIds, newProject.id])),
        evidence: [
          {
            id: `evidence-reuse-${Date.now()}`,
            label: `Originou uma nova squad a partir de ${selectedProject.name}`,
            projectId: newProject.id,
            recordedAt: reusedAt
          },
          ...current.profile.evidence
        ]
      },
      projects: [newProject, ...current.projects]
    }));
    setSelectedProjectId(newProject.id);
    showToast('Template reutilizado', 'Uma nova squad comunitária foi criada a partir do projeto selecionado.');
  };

  const createCommunityProject = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const createdAt = new Date().toISOString();
    const project: Project = {
      id: `community-project-${Date.now()}`,
      name: projectForm.name.trim(),
      shortDescription: projectForm.shortDescription.trim(),
      category: projectForm.category.trim() || 'Comunidade',
      status: 'Em formação',
      memberLimit: projectForm.memberLimit,
      suggestedTechnologies: toList(projectForm.suggestedTechnologies),
      recommendedAreas: toList(projectForm.recommendedAreas),
      difficulty: projectForm.difficulty,
      suggestedDuration: projectForm.suggestedDuration.trim(),
      type: 'Community Project',
      suggestedRoles: toList(projectForm.recommendedAreas).map((role) => ({ role, amount: 1 })),
      possibleStacks: toList(projectForm.possibleStacks),
      outcomes: toList(projectForm.outcomes),
      createdBy: state.profile.name,
      members: [
        {
          memberId: state.profile.id,
          name: state.profile.name,
          avatarUrl: state.profile.avatarUrl,
          role: state.profile.primaryRole,
          contributionIntent: 'Criou o projeto e está formando a squad inicial.',
          joinedAt: createdAt
        }
      ]
    };

    if (!project.name || !project.shortDescription) {
      showToast('Dados obrigatórios', 'Informe pelo menos nome e descrição curta para criar o projeto.');
      return;
    }

    setState((current) => ({
      ...current,
      profile: {
        ...current.profile,
        currentProjectIds: Array.from(new Set([...current.profile.currentProjectIds, project.id])),
        evidence: [
          {
            id: `evidence-create-${Date.now()}`,
            label: `Criou o projeto comunitário ${project.name}`,
            projectId: project.id,
            recordedAt: createdAt
          },
          ...current.profile.evidence
        ]
      },
      projects: [project, ...current.projects]
    }));
    setProjectForm(defaultProjectForm);
    setSelectedProjectId(project.id);
    setActiveView('catalog');
    showToast('Projeto criado', 'Seu projeto comunitário já aparece no catálogo.');
  };

  const saveProfile = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setState((current) => ({ ...current, profile: profileDraft }));
    setJoinRole(profileDraft.primaryRole);
    showToast('Perfil atualizado', 'Suas áreas e tecnologias já serão usadas nas próximas participações.');
  };

  const restoreSeed = () => {
    resetHubState();
    setState(initialState);
    setSelectedProjectId(initialState.projects[0].id);
    setFilters(createEmptyFilters());
    setActiveView('catalog');
    showToast('Dados restaurados', 'O Focus Hub voltou ao estado inicial de demonstração.');
  };

  return (
    <div className="app-shell">
      <aside className="sidebar" aria-label="Navegação principal">
        <div className="brand-block">
          <div className="brand-mark">FH</div>
          <div>
            <p className="eyebrow">Focus Tecnologia</p>
            <h1>Focus Hub</h1>
          </div>
        </div>

        <nav className="nav-list">
          <button className={activeView === 'catalog' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('catalog')}>
            <LayoutDashboard size={18} />
            Projetos
          </button>
          <button
            className={activeView === 'my-projects' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveView('my-projects')}
          >
            <BriefcaseBusiness size={18} />
            Meus projetos
          </button>
          <button className={activeView === 'create' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('create')}>
            <CirclePlus size={18} />
            Criar projeto
          </button>
          <button className={activeView === 'profile' ? 'nav-item active' : 'nav-item'} onClick={() => setActiveView('profile')}>
            <UserRound size={18} />
            Perfil
          </button>
        </nav>

        <div className="sidebar-footer">
          <div className="profile-mini">
            <img src={state.profile.avatarUrl} alt="" />
            <div>
              <strong>{state.profile.name}</strong>
              <span>{state.profile.primaryRole}</span>
            </div>
          </div>
          <button className="icon-button" onClick={restoreSeed} title="Restaurar dados iniciais">
            <RotateCcw size={18} />
          </button>
        </div>
      </aside>

      <main className="workspace">
        <header className="topbar">
          <div>
            <p className="eyebrow">Projetos e squads como centro da comunidade</p>
            <h2>{activeView === 'catalog' ? 'Catálogo de projetos' : pageTitle(activeView)}</h2>
          </div>
          <div className="topbar-actions">
            <div className="global-search">
              <Search size={17} />
              <input
                aria-label="Buscar projetos"
                value={filters.query}
                onChange={(event) => {
                  updateFilters('query', event.target.value);
                  setActiveView('catalog');
                }}
                placeholder="Buscar projeto, stack, área..."
              />
            </div>
            <button className="primary-button" onClick={() => setActiveView('create')}>
              <Plus size={18} />
              Novo
            </button>
          </div>
        </header>

        <section className="metrics-grid" aria-label="Resumo do hub">
          <Metric icon={<BookOpen size={19} />} label="Templates Focus" value={focusProjectCount} />
          <Metric icon={<UsersRound size={19} />} label="Squads comunitárias" value={communityProjectCount} />
          <Metric icon={<Boxes size={19} />} label="Vagas abertas" value={openSlots} />
          <Metric icon={<ListChecks size={19} />} label="Seus projetos" value={currentProjects.length} />
        </section>

        {activeView === 'catalog' && (
          <CatalogView
            filters={filters}
            updateFilters={updateFilters}
            projectOptions={projectOptions}
            visibleProjects={visibleProjects}
            selectedProject={selectedProject}
            selectProject={selectProject}
            joinRole={joinRole}
            setJoinRole={setJoinRole}
            joinIntent={joinIntent}
            setJoinIntent={setJoinIntent}
            joinSelectedProject={joinSelectedProject}
            reuseSelectedTemplate={reuseSelectedTemplate}
            profileId={state.profile.id}
          />
        )}

        {activeView === 'my-projects' && (
          <MyProjectsView
            projects={currentProjects}
            allProjects={state.projects}
            profile={state.profile}
            selectProject={selectProject}
            setActiveView={setActiveView}
          />
        )}

        {activeView === 'create' && (
          <CreateProjectView projectForm={projectForm} setProjectForm={setProjectForm} onSubmit={createCommunityProject} />
        )}

        {activeView === 'profile' && (
          <ProfileView profileDraft={profileDraft} setProfileDraft={setProfileDraft} onSubmit={saveProfile} projects={state.projects} />
        )}
      </main>

      {toast && (
        <div className="toast" role="status">
          <Check size={18} />
          <div>
            <strong>{toast.title}</strong>
            <span>{toast.message}</span>
          </div>
          <button className="icon-button small" onClick={() => setToast(null)} title="Fechar aviso">
            <X size={16} />
          </button>
        </div>
      )}
    </div>
  );
}

function pageTitle(view: View) {
  return {
    catalog: 'Catálogo de projetos',
    'my-projects': 'Meus projetos',
    create: 'Criar projeto',
    profile: 'Perfil do membro'
  }[view];
}

function Metric({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="metric">
      <div className="metric-icon">{icon}</div>
      <div>
        <strong>{value}</strong>
        <span>{label}</span>
      </div>
    </div>
  );
}

function CatalogView({
  filters,
  updateFilters,
  projectOptions,
  visibleProjects,
  selectedProject,
  selectProject,
  joinRole,
  setJoinRole,
  joinIntent,
  setJoinIntent,
  joinSelectedProject,
  reuseSelectedTemplate,
  profileId
}: {
  filters: Filters;
  updateFilters: <Key extends keyof Filters>(key: Key, value: Filters[Key]) => void;
  projectOptions: { areas: string[]; technologies: string[] };
  visibleProjects: Project[];
  selectedProject?: Project;
  selectProject: (projectId: string) => void;
  joinRole: string;
  setJoinRole: (role: string) => void;
  joinIntent: string;
  setJoinIntent: (intent: string) => void;
  joinSelectedProject: () => void;
  reuseSelectedTemplate: () => void;
  profileId: string;
}) {
  return (
    <div className="catalog-layout">
      <section className="catalog-main">
        <div className="filter-bar">
          <div className="filter-title">
            <Filter size={17} />
            <span>Filtros</span>
          </div>
          <SelectField
            label="Status"
            value={filters.status}
            onChange={(value) => updateFilters('status', value as Filters['status'])}
            options={projectStatuses}
          />
          <SelectField
            label="Área"
            value={filters.area}
            onChange={(value) => updateFilters('area', value)}
            options={['Todas', ...projectOptions.areas]}
          />
          <SelectField
            label="Tecnologia"
            value={filters.technology}
            onChange={(value) => updateFilters('technology', value)}
            options={['Todas', ...projectOptions.technologies]}
          />
          <SelectField
            label="Dificuldade"
            value={filters.difficulty}
            onChange={(value) => updateFilters('difficulty', value as Filters['difficulty'])}
            options={projectDifficulties}
          />
          <SelectField
            label="Tipo"
            value={filters.type}
            onChange={(value) => updateFilters('type', value as Filters['type'])}
            options={projectTypes}
          />
        </div>

        <div className="section-heading">
          <div>
            <p className="eyebrow">{visibleProjects.length} projetos encontrados</p>
            <h3>Projetos disponíveis</h3>
          </div>
        </div>

        <div className="project-grid">
          {visibleProjects.map((project) => (
            <ProjectCard
              key={project.id}
              project={project}
              selected={selectedProject?.id === project.id}
              onSelect={() => selectProject(project.id)}
            />
          ))}
        </div>

        {visibleProjects.length === 0 && (
          <div className="empty-state">
            <ClipboardList size={36} />
            <strong>Nenhum projeto encontrado</strong>
            <span>Ajuste os filtros ou crie um projeto comunitário para abrir uma nova trilha.</span>
          </div>
        )}
      </section>

      {selectedProject && (
        <ProjectDetail
          project={selectedProject}
          joinRole={joinRole}
          setJoinRole={setJoinRole}
          joinIntent={joinIntent}
          setJoinIntent={setJoinIntent}
          onJoin={joinSelectedProject}
          onReuse={reuseSelectedTemplate}
          profileId={profileId}
        />
      )}
    </div>
  );
}

function SelectField({
  label,
  value,
  onChange,
  options
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  options: string[];
}) {
  return (
    <label className="select-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

function ProjectCard({ project, selected, onSelect }: { project: Project; selected: boolean; onSelect: () => void }) {
  const occupancy = Math.round((project.members.length / project.memberLimit) * 100);

  return (
    <article className={selected ? 'project-card selected' : 'project-card'}>
      <button className="card-hit-area" onClick={onSelect} aria-label={`Abrir ${project.name}`} />
      <div className="card-header">
        <div className="badges">
          <span className={getStatusClass(project.status)}>{project.status}</span>
          <span className={getTypeClass(project.type)}>{project.type}</span>
        </div>
        <ChevronRight size={18} />
      </div>
      <h4>{project.name}</h4>
      <p>{project.shortDescription}</p>
      <div className="card-meta">
        <span>{project.category}</span>
        <span>{project.difficulty}</span>
        <span>{project.suggestedDuration}</span>
      </div>
      <div className="member-meter">
        <div>
          <strong>
            {project.members.length}/{project.memberLimit}
          </strong>
          <span>membros</span>
        </div>
        <div className="meter-track" aria-hidden="true">
          <div style={{ width: `${Math.min(occupancy, 100)}%` }} />
        </div>
      </div>
      <div className="chip-row">
        {project.suggestedTechnologies.slice(0, 5).map((technology) => (
          <span className="chip" key={technology}>
            {technology}
          </span>
        ))}
      </div>
    </article>
  );
}

function ProjectDetail({
  project,
  joinRole,
  setJoinRole,
  joinIntent,
  setJoinIntent,
  onJoin,
  onReuse,
  profileId
}: {
  project: Project;
  joinRole: string;
  setJoinRole: (role: string) => void;
  joinIntent: string;
  setJoinIntent: (intent: string) => void;
  onJoin: () => void;
  onReuse: () => void;
  profileId: string;
}) {
  const alreadyJoined = project.members.some((member) => member.memberId === profileId);
  const isFull = project.members.length >= project.memberLimit;

  return (
    <aside className="detail-panel" aria-label="Detalhes do projeto selecionado">
      <div className="detail-head">
        <div>
          <div className="badges">
            <span className={getStatusClass(project.status)}>{project.status}</span>
            <span className={getTypeClass(project.type)}>{project.type}</span>
          </div>
          <h3>{project.name}</h3>
          <p>{project.shortDescription}</p>
        </div>
      </div>

      <div className="detail-block">
        <h4>Squad atual</h4>
        <div className="member-list">
          {project.members.map((member) => (
            <div className="member-row" key={`${project.id}-${member.memberId}`}>
              <img src={member.avatarUrl} alt="" />
              <div>
                <strong>{member.name}</strong>
                <span>{member.role}</span>
              </div>
              <time>{formatDate(member.joinedAt)}</time>
            </div>
          ))}
          {project.members.length === 0 && (
            <div className="subtle-box">
              <UsersRound size={20} />
              <span>Squad aberta para primeira formação.</span>
            </div>
          )}
        </div>
      </div>

      <div className="detail-block">
        <h4>Composição sugerida</h4>
        <div className="recommendation-grid">
          {project.suggestedRoles.map((recommendation) => {
            const currentAmount = project.members.filter((member) => member.role === recommendation.role).length;
            return (
              <div className="recommendation" key={recommendation.role}>
                <span>{recommendation.role}</span>
                <strong>
                  {currentAmount}/{recommendation.amount}
                </strong>
              </div>
            );
          })}
        </div>
      </div>

      <div className="detail-block">
        <h4>Tecnologias sugeridas</h4>
        <div className="chip-row">
          {project.suggestedTechnologies.map((technology) => (
            <span className="chip" key={technology}>
              {technology}
            </span>
          ))}
        </div>
      </div>

      <div className="detail-block">
        <h4>Stacks possíveis</h4>
        <ul className="clean-list">
          {project.possibleStacks.map((stack) => (
            <li key={stack}>{stack}</li>
          ))}
        </ul>
      </div>

      <div className="join-box">
        <label>
          <span>Função de contribuição</span>
          <select value={joinRole} onChange={(event) => setJoinRole(event.target.value)}>
            {roleOptions.map((role) => (
              <option value={role} key={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Intenção</span>
          <textarea value={joinIntent} onChange={(event) => setJoinIntent(event.target.value)} rows={4} />
        </label>
        <div className="action-row">
          <button className="primary-button" onClick={onJoin} disabled={alreadyJoined || isFull}>
            <UsersRound size={18} />
            {alreadyJoined ? 'Participando' : isFull ? 'Squad cheia' : 'Entrar'}
          </button>
          <button className="secondary-button" onClick={onReuse}>
            <CopyPlus size={18} />
            Reutilizar
          </button>
        </div>
      </div>
    </aside>
  );
}

function MyProjectsView({
  projects,
  allProjects,
  profile,
  selectProject,
  setActiveView
}: {
  projects: Project[];
  allProjects: Project[];
  profile: MemberProfile;
  selectProject: (projectId: string) => void;
  setActiveView: (view: View) => void;
}) {
  const completedProjects = allProjects.filter((project) => profile.completedProjectIds.includes(project.id));

  return (
    <section className="single-column">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Participação ativa</p>
          <h3>Meus projetos</h3>
        </div>
        <button className="secondary-button" onClick={() => setActiveView('catalog')}>
          <Search size={18} />
          Explorar
        </button>
      </div>

      {projects.length > 0 ? (
        <div className="project-grid compact">
          {projects.map((project) => (
            <ProjectCard key={project.id} project={project} selected={false} onSelect={() => selectProject(project.id)} />
          ))}
        </div>
      ) : (
        <div className="empty-state">
          <BriefcaseBusiness size={36} />
          <strong>Nenhum projeto ativo ainda</strong>
          <span>Entre em um template Focus ou crie uma squad comunitária.</span>
        </div>
      )}

      <div className="history-panel">
        <h3>Projetos concluídos</h3>
        {completedProjects.length === 0 ? (
          <p>Ainda não há projetos concluídos registrados no perfil.</p>
        ) : (
          <ul className="clean-list">
            {completedProjects.map((project) => (
              <li key={project.id}>{project.name}</li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

function CreateProjectView({
  projectForm,
  setProjectForm,
  onSubmit
}: {
  projectForm: ProjectFormState;
  setProjectForm: (state: ProjectFormState) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  const update = <Key extends keyof ProjectFormState>(key: Key, value: ProjectFormState[Key]) => {
    setProjectForm({ ...projectForm, [key]: value });
  };

  return (
    <section className="form-page">
      <div className="section-heading">
        <div>
          <p className="eyebrow">Community Project</p>
          <h3>Criar projeto</h3>
        </div>
      </div>

      <form className="structured-form" onSubmit={onSubmit}>
        <label className="wide">
          <span>Nome</span>
          <input value={projectForm.name} onChange={(event) => update('name', event.target.value)} placeholder="Ex.: Portal de Mentorias" />
        </label>
        <label className="wide">
          <span>Descrição curta</span>
          <textarea
            rows={3}
            value={projectForm.shortDescription}
            onChange={(event) => update('shortDescription', event.target.value)}
            placeholder="Descreva o problema, público e resultado esperado."
          />
        </label>
        <label>
          <span>Categoria</span>
          <input value={projectForm.category} onChange={(event) => update('category', event.target.value)} placeholder="Comunidade" />
        </label>
        <label>
          <span>Limite de membros</span>
          <input
            type="number"
            min={2}
            max={12}
            value={projectForm.memberLimit}
            onChange={(event) => update('memberLimit', Number(event.target.value))}
          />
        </label>
        <label>
          <span>Dificuldade</span>
          <select
            value={projectForm.difficulty}
            onChange={(event) => update('difficulty', event.target.value as ProjectDifficulty)}
          >
            {projectDifficulties
              .filter((difficulty) => difficulty !== 'Todas')
              .map((difficulty) => (
                <option value={difficulty} key={difficulty}>
                  {difficulty}
                </option>
              ))}
          </select>
        </label>
        <label>
          <span>Duração sugerida</span>
          <input value={projectForm.suggestedDuration} onChange={(event) => update('suggestedDuration', event.target.value)} />
        </label>
        <TagInput
          label="Áreas recomendadas"
          value={projectForm.recommendedAreas}
          onChange={(value) => update('recommendedAreas', value)}
          suggestions={roleOptions}
        />
        <TagInput
          label="Tecnologias sugeridas"
          value={projectForm.suggestedTechnologies}
          onChange={(value) => update('suggestedTechnologies', value)}
          suggestions={technologySuggestions}
        />
        <label className="wide">
          <span>Stacks possíveis</span>
          <input value={projectForm.possibleStacks} onChange={(event) => update('possibleStacks', event.target.value)} />
        </label>
        <label className="wide">
          <span>Entregáveis</span>
          <input value={projectForm.outcomes} onChange={(event) => update('outcomes', event.target.value)} />
        </label>
        <div className="form-actions wide">
          <button className="primary-button" type="submit">
            <Save size={18} />
            Criar
          </button>
        </div>
      </form>
    </section>
  );
}

function TagInput({
  label,
  value,
  onChange,
  suggestions
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
}) {
  return (
    <label className="wide">
      <span>{label}</span>
      <input value={value} onChange={(event) => onChange(event.target.value)} list={`${label}-options`} />
      <datalist id={`${label}-options`}>
        {suggestions.map((suggestion) => (
          <option value={suggestion} key={suggestion} />
        ))}
      </datalist>
    </label>
  );
}

function ProfileView({
  profileDraft,
  setProfileDraft,
  onSubmit,
  projects
}: {
  profileDraft: MemberProfile;
  setProfileDraft: (profile: MemberProfile) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  projects: Project[];
}) {
  const update = <Key extends keyof MemberProfile>(key: Key, value: MemberProfile[Key]) => {
    setProfileDraft({ ...profileDraft, [key]: value });
  };

  const projectName = (projectId?: string) => projects.find((project) => project.id === projectId)?.name;

  return (
    <section className="profile-layout">
      <form className="structured-form profile-form" onSubmit={onSubmit}>
        <label>
          <span>Nome</span>
          <input value={profileDraft.name} onChange={(event) => update('name', event.target.value)} />
        </label>
        <label>
          <span>Avatar</span>
          <input value={profileDraft.avatarUrl} onChange={(event) => update('avatarUrl', event.target.value)} />
        </label>
        <label className="wide">
          <span>Bio curta</span>
          <textarea rows={3} value={profileDraft.bio} onChange={(event) => update('bio', event.target.value)} />
        </label>
        <label>
          <span>Função principal</span>
          <select value={profileDraft.primaryRole} onChange={(event) => update('primaryRole', event.target.value)}>
            {roleOptions.map((role) => (
              <option value={role} key={role}>
                {role}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Disponibilidade</span>
          <input value={profileDraft.availability} onChange={(event) => update('availability', event.target.value)} />
        </label>
        <ProfileTagField label="Áreas" values={profileDraft.areas} onChange={(values) => update('areas', values)} />
        <ProfileTagField label="Funções secundárias" values={profileDraft.secondaryRoles} onChange={(values) => update('secondaryRoles', values)} />
        <ProfileTagField label="Tecnologias" values={profileDraft.technologies} onChange={(values) => update('technologies', values)} />
        <ProfileTagField label="Interesses" values={profileDraft.interests} onChange={(values) => update('interests', values)} />
        <label>
          <span>GitHub</span>
          <input
            value={profileDraft.links.github ?? ''}
            onChange={(event) => update('links', { ...profileDraft.links, github: event.target.value })}
          />
        </label>
        <label>
          <span>LinkedIn</span>
          <input
            value={profileDraft.links.linkedin ?? ''}
            onChange={(event) => update('links', { ...profileDraft.links, linkedin: event.target.value })}
          />
        </label>
        <div className="form-actions wide">
          <button className="primary-button" type="submit">
            <Save size={18} />
            Salvar perfil
          </button>
        </div>
      </form>

      <aside className="profile-summary">
        <div className="profile-hero">
          <img src={profileDraft.avatarUrl} alt="" />
          <div>
            <h3>{profileDraft.name}</h3>
            <span>{profileDraft.primaryRole}</span>
          </div>
        </div>
        <p>{profileDraft.bio}</p>
        <div className="chip-row">
          {profileDraft.technologies.map((technology) => (
            <span className="chip" key={technology}>
              {technology}
            </span>
          ))}
        </div>
        <div className="link-row">
          {profileDraft.links.github && (
            <a href={profileDraft.links.github} target="_blank" rel="noreferrer">
              <Github size={17} />
              GitHub
            </a>
          )}
          {profileDraft.links.linkedin && (
            <a href={profileDraft.links.linkedin} target="_blank" rel="noreferrer">
              <Linkedin size={17} />
              LinkedIn
            </a>
          )}
        </div>
        <div className="evidence-list">
          <h4>Evidências</h4>
          {profileDraft.evidence.map((evidence) => (
            <div className="evidence-item" key={evidence.id}>
              <Sparkles size={17} />
              <div>
                <strong>{evidence.label}</strong>
                <span>{[projectName(evidence.projectId), evidence.technology, formatDate(evidence.recordedAt)].filter(Boolean).join(' · ')}</span>
              </div>
            </div>
          ))}
        </div>
      </aside>
    </section>
  );
}

function ProfileTagField({
  label,
  values,
  onChange
}: {
  label: string;
  values: string[];
  onChange: (values: string[]) => void;
}) {
  return (
    <label className="wide">
      <span>{label}</span>
      <input value={values.join(', ')} onChange={(event) => onChange(toList(event.target.value))} />
    </label>
  );
}

export default App;
