import { Check, X } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { AppShell } from './components/layout/AppShell';
import { JoinProjectModal } from './components/projects/JoinProjectModal';
import { Button } from './components/ui/Button';
import { initialState } from './data/seed';
import { CatalogPage } from './pages/CatalogPage';
import { CreateProjectPage } from './pages/CreateProjectPage';
import { DashboardPage } from './pages/DashboardPage';
import { MyProjectsPage } from './pages/MyProjectsPage';
import { ProfilePage } from './pages/ProfilePage';
import { loadHubState, resetHubState, saveHubState } from './storage';
import type { Filters, HubState, MemberProfile, Project } from './types';
import { toList } from './utils/format';
import { collectProjectOptions, createEmptyFilters, filterProjects } from './utils/projectFilters';
import { defaultProjectForm, type ProjectFormState, type ToastMessage, type View } from './viewTypes';

const defaultJoinIntent = 'Quero contribuir com entregas práticas, documentação e revisão da solução.';

function App() {
  const [state, setState] = useState<HubState>(() => loadHubState());
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [filters, setFilters] = useState<Filters>(() => createEmptyFilters());
  const [selectedProjectId, setSelectedProjectId] = useState(state.projects[0]?.id ?? '');
  const [joinProjectId, setJoinProjectId] = useState<string>();
  const [joinRole, setJoinRole] = useState(state.profile.primaryRole);
  const [joinIntent, setJoinIntent] = useState(defaultJoinIntent);
  const [projectForm, setProjectForm] = useState<ProjectFormState>(defaultProjectForm);
  const [profileDraft, setProfileDraft] = useState<MemberProfile>(state.profile);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  useEffect(() => saveHubState(state), [state]);
  useEffect(() => setProfileDraft(state.profile), [state.profile]);
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectedProject = state.projects.find((project) => project.id === selectedProjectId) ?? state.projects[0];
  const joinProject = state.projects.find((project) => project.id === joinProjectId);
  const visibleProjects = useMemo(() => filterProjects(state.projects, filters), [state.projects, filters]);
  const projectOptions = useMemo(() => collectProjectOptions(state.projects), [state.projects]);
  const currentProjects = state.projects.filter((project) => project.members.some((member) => member.memberId === state.profile.id));

  const showToast = (title: string, message: string) => setToast({ title, message });

  const updateFilters = <Key extends keyof Filters>(key: Key, value: Filters[Key]) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  const navigate = (view: View) => setActiveView(view);

  const selectProject = (projectId: string) => {
    setSelectedProjectId(projectId);
    setActiveView('catalog');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const requestJoin = (projectId: string) => {
    const project = state.projects.find((item) => item.id === projectId);
    if (!project) return;
    if (project.members.some((member) => member.memberId === state.profile.id)) {
      showToast('Você já está na squad', 'Abra Meus projetos para acompanhar sua participação.');
      return;
    }
    if (project.members.length >= project.memberLimit) {
      showToast('Squad completa', 'Use este projeto como template para formar uma nova squad.');
      return;
    }
    setJoinProjectId(projectId);
  };

  const joinSelectedProject = (projectId: string, role: string, intent: string) => {
    const project = state.projects.find((item) => item.id === projectId);
    if (!project) {
      showToast('Projeto indisponível', 'Não foi possível encontrar este projeto.');
      return;
    }
    if (project.members.some((member) => member.memberId === state.profile.id)) {
      showToast('Você já está na squad', 'Sua participação continua registrada em Meus projetos.');
      return;
    }
    if (project.members.length >= project.memberLimit) {
      showToast('Squad completa', 'As vagas deste projeto foram preenchidas.');
      return;
    }

    const joinedAt = new Date().toISOString();
    setState((current) => ({
      ...current,
      profile: {
        ...current.profile,
        currentProjectIds: Array.from(new Set([...current.profile.currentProjectIds, project.id])),
        evidence: [{ id: `evidence-${project.id}-${Date.now()}`, label: `Entrou no projeto ${project.name} como ${role}`, projectId: project.id, technology: project.suggestedTechnologies[0], recordedAt: joinedAt }, ...current.profile.evidence]
      },
      projects: current.projects.map((item) => item.id === project.id ? {
        ...item,
        status: item.status === 'Aberto' ? 'Em formação' : item.status,
        members: [...item.members, { memberId: current.profile.id, name: current.profile.name, avatarUrl: current.profile.avatarUrl, role, contributionIntent: intent, joinedAt }]
      } : item)
    }));
    setJoinRole(role);
    setJoinIntent(intent);
    showToast('Entrada registrada', `Você entrou em ${project.name} como ${role}.`);
  };

  const reuseTemplate = (projectId: string) => {
    const source = state.projects.find((project) => project.id === projectId);
    if (!source) {
      showToast('Template indisponível', 'Não foi possível localizar o projeto selecionado.');
      return;
    }

    const reusedAt = new Date().toISOString();
    const originTemplateId = source.originTemplateId ?? source.id;
    const projectNumber = state.projects.filter((project) => project.originTemplateId === originTemplateId).length + 1;
    const newProject: Project = {
      ...source,
      id: `community-${source.id}-${Date.now()}`,
      name: `${source.name} - Squad ${projectNumber}`,
      status: 'Em formação',
      type: 'Community Project',
      createdBy: state.profile.name,
      originTemplateId,
      members: [{ memberId: state.profile.id, name: state.profile.name, avatarUrl: state.profile.avatarUrl, role: state.profile.primaryRole, contributionIntent: 'Iniciou a squad a partir de um template Focus.', joinedAt: reusedAt }]
    };

    setState((current) => ({
      ...current,
      profile: {
        ...current.profile,
        currentProjectIds: Array.from(new Set([...current.profile.currentProjectIds, newProject.id])),
        evidence: [{ id: `evidence-reuse-${Date.now()}`, label: `Originou uma nova squad a partir de ${source.name}`, projectId: newProject.id, recordedAt: reusedAt }, ...current.profile.evidence]
      },
      projects: [newProject, ...current.projects]
    }));
    setSelectedProjectId(newProject.id);
    setActiveView('catalog');
    showToast('Template reutilizado', 'Uma nova squad comunitária foi criada e adicionada aos seus projetos.');
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
      members: [{ memberId: state.profile.id, name: state.profile.name, avatarUrl: state.profile.avatarUrl, role: state.profile.primaryRole, contributionIntent: 'Criou o projeto e está formando a squad inicial.', joinedAt: createdAt }]
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
        evidence: [{ id: `evidence-create-${Date.now()}`, label: `Criou o projeto comunitário ${project.name}`, projectId: project.id, recordedAt: createdAt }, ...current.profile.evidence]
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
    showToast('Perfil atualizado', 'Suas áreas e tecnologias foram salvas.');
  };

  const restoreSeed = () => {
    resetHubState();
    setState(initialState);
    setProfileDraft(initialState.profile);
    setSelectedProjectId(initialState.projects[0].id);
    setFilters(createEmptyFilters());
    setActiveView('dashboard');
    showToast('Dados restaurados', 'O FocusEdu voltou ao estado inicial de demonstração.');
  };

  return (
    <AppShell activeView={activeView} filters={filters} onNavigate={navigate} onQueryChange={(query) => { updateFilters('query', query); setActiveView('catalog'); }} onRestore={restoreSeed} profile={state.profile}>
      {activeView === 'dashboard' && <DashboardPage onNavigate={navigate} onSelectProject={selectProject} profile={state.profile} projects={state.projects} />}
      {activeView === 'catalog' && <CatalogPage filters={filters} onChangeFilters={updateFilters} onClearFilters={() => setFilters(createEmptyFilters())} onCreate={() => navigate('create')} onJoin={() => selectedProject && requestJoin(selectedProject.id)} onReuse={reuseTemplate} onSelect={selectProject} profileId={state.profile.id} projectOptions={projectOptions} projects={visibleProjects} selectedProject={selectedProject} />}
      {activeView === 'my-projects' && <MyProjectsPage allProjects={state.projects} onExplore={() => navigate('catalog')} onSelect={selectProject} profile={state.profile} projects={currentProjects} />}
      {activeView === 'create' && <CreateProjectPage onFormChange={setProjectForm} onReuseTemplate={reuseTemplate} onSubmit={createCommunityProject} projectForm={projectForm} templates={state.projects.filter((project) => project.type === 'Focus Project')} />}
      {activeView === 'profile' && <ProfilePage onChange={setProfileDraft} onSubmit={saveProfile} profile={profileDraft} projects={state.projects} />}

      <JoinProjectModal defaultIntent={joinIntent} defaultRole={joinRole} onClose={() => setJoinProjectId(undefined)} onJoin={joinSelectedProject} open={Boolean(joinProject)} project={joinProject} />
      {toast && (
        <div className="toast" role="status">
          <span className="toast-icon"><Check size={17} /></span>
          <div><strong>{toast.title}</strong><span>{toast.message}</span></div>
          <Button aria-label="Fechar aviso" icon={<X size={15} />} onClick={() => setToast(null)} size="icon" variant="ghost" />
        </div>
      )}
    </AppShell>
  );
}

export default App;
