import { Check, X } from 'lucide-react';
import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { AppShell } from './components/layout/AppShell';
import { JoinProjectModal } from './components/projects/JoinProjectModal';
import { ProjectPlanModal } from './components/projects/ProjectPlanModal';
import { Button } from './components/ui/Button';
import { displayProject, displayTemplate } from './domain/projectDisplay';
import { appearsInCatalogue } from './domain/projectLifecycle';
import { validProjectPlan } from './domain/projectSchedule';
import { AuthPage } from './pages/AuthPage';
import { CatalogPage } from './pages/CatalogPage';
import { CreateProjectPage } from './pages/CreateProjectPage';
import { DashboardPage } from './pages/DashboardPage';
import { MyProjectsPage } from './pages/MyProjectsPage';
import { ProfilePage } from './pages/ProfilePage';
import { friendlyAuthError, getSession, signOut, watchSession } from './services/authService';
import { useDiscordIntegration } from './services/useDiscordIntegration';
import { getEvidence } from './services/evidenceService';
import { getSkillSuggestions, getProfile, updateProfile } from './services/profileService';
import { deleteAvatar, ownAvatarPath, uploadAvatar } from './services/avatarService';
import {
  createCommunityProject,
  createProjectFromTemplate,
  decideProjectJoinRequest,
  getMyGamification,
  getProjects,
  requestProjectJoin,
  leaveProject,
  replicateProject,
  resubmitProject,
  transitionProject,
  updateProject,
} from './services/projectService';
import { getPlatformAccount } from './services/adminService';
import { friendlyProjectError } from './services/projectErrors';
import { processDiscordEvents } from './services/discordService';
import { getTemplates } from './services/templateService';
import type {
  Filters,
  GamificationProgress,
  MemberProfile,
  PlatformAccount,
  Project,
  ProjectTemplate,
} from './types';
import { collectProjectOptions, createEmptyFilters, filterProjects } from './utils/projectFilters';
import {
  defaultProjectForm,
  type ProjectFormState,
  type ToastMessage,
  type View,
} from './viewTypes';

const defaultJoinIntent =
  'Quero contribuir com entregas práticas, documentação e revisão da solução.';

const AdminPage = lazy(() =>
  import('./pages/AdminPage').then((module) => ({ default: module.AdminPage })),
);

function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [passwordRecovery, setPasswordRecovery] = useState(false);
  const [profile, setProfile] = useState<MemberProfile | null>(null);
  const [account, setAccount] = useState<PlatformAccount | null>(null);
  const [gamification, setGamification] = useState<GamificationProgress | null>(null);
  const [authRevision, setAuthRevision] = useState(0);
  const [profileDraft, setProfileDraft] = useState<MemberProfile | null>(null);
  const [templates, setTemplates] = useState<ProjectTemplate[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [skillOptions, setSkillOptions] = useState<{
    technologies: string[];
    areas: string[];
  }>({ technologies: [], areas: [] });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [activeView, setActiveView] = useState<View>(() =>
    new URLSearchParams(window.location.search).has('project')
      ? 'catalog'
      : new URLSearchParams(window.location.search).get('view') === 'profile'
        ? 'profile'
        : 'dashboard',
  );
  const [filters, setFilters] = useState<Filters>(createEmptyFilters);
  const [selectedId, setSelectedId] = useState(
    () => new URLSearchParams(window.location.search).get('project') ?? '',
  );
  const [joinProjectId, setJoinProjectId] = useState<string>();
  const [creationSourceId, setCreationSourceId] = useState<string>();
  const [projectForm, setProjectForm] = useState<ProjectFormState>(defaultProjectForm);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const [profileEditRequest, setProfileEditRequest] = useState(0);
  const [discordRefresh, setDiscordRefresh] = useState(0);
  const sessionUserRef = useRef<string | undefined>(undefined);
  const actionInFlight = useRef(false);
  const userId = session?.user.id;
  const discord = useDiscordIntegration(userId, authRevision, activeView === 'profile');
  const discordConnected = discord.connected;
  sessionUserRef.current = userId;

  useEffect(() => {
    if (activeView !== 'catalog') {
      setSelectedId('');
      const url = new URL(window.location.href);
      url.searchParams.delete('project');
      window.history.replaceState(null, '', url);
    }
  }, [activeView]);

  useEffect(() => {
    let active = true;
    try {
      const unsubscribe = watchSession((next, event) => {
        if (active) {
          if (event === 'PASSWORD_RECOVERY') setPasswordRecovery(true);
          if (event === 'SIGNED_OUT') setPasswordRecovery(false);
          setSession(next);
          setAuthRevision((revision) => revision + 1);
          setAuthReady(true);
        }
      });
      getSession()
        .then((next) => {
          if (active) {
            setSession(next);
            setAuthReady(true);
          }
        })
        .catch((cause) => {
          if (active) {
            setError(friendlyAuthError(cause));
            setAuthReady(true);
          }
        });
      return () => {
        active = false;
        unsubscribe();
      };
    } catch (cause) {
      setError(friendlyAuthError(cause));
      setAuthReady(true);
    }
  }, []);

  const reload = useCallback(async (userId: string) => {
    const [nextTemplates, nextProjects, evidence, nextSkills, nextAccount, nextGamification] =
      await Promise.all([
        getTemplates(),
        getProjects(),
        getEvidence(userId),
        getSkillSuggestions(),
        getPlatformAccount(userId),
        getMyGamification().catch(() => null),
      ]);
    const nextProfile = await getProfile(userId, evidence);
    if (sessionUserRef.current !== userId) return;
    setTemplates(nextTemplates);
    setProjects(nextProjects);
    setSkillOptions(nextSkills);
    setProfile(nextProfile);
    setProfileDraft(nextProfile);
    setAccount(nextAccount);
    setGamification(nextGamification);
  }, []);

  useEffect(() => {
    if (!userId) {
      setProfile(null);
      setProfileDraft(null);
      setAccount(null);
      setGamification(null);
      setProjects([]);
      setTemplates([]);
      return;
    }
    let active = true;
    setLoading(true);
    setError('');
    reload(userId)
      .catch(() => {
        if (active) setError('Não foi possível carregar os dados. Tente novamente.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [userId, reload]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const catalogue = useMemo(() => {
    const templateById = new Map(templates.map((item) => [item.id, item]));
    return [
      ...templates.map(displayTemplate),
      ...projects.map((item) =>
        displayProject(item, item.templateId ? templateById.get(item.templateId) : undefined),
      ),
    ];
  }, [templates, projects]);
  const operationalCatalogue = useMemo(
    () => catalogue.filter((item) => appearsInCatalogue(item, profile?.id)),
    [catalogue, profile?.id],
  );
  const visibleProjects = useMemo(
    () => filterProjects(operationalCatalogue, filters),
    [operationalCatalogue, filters],
  );
  const selectedProject = catalogue.find((item) => item.id === selectedId);
  const joinTarget = catalogue.find((item) => item.id === joinProjectId);
  const creationSource = catalogue.find((item) => item.id === creationSourceId);
  const projectOptions = useMemo(() => collectProjectOptions(catalogue), [catalogue]);

  const showToast = (title: string, message: string) => setToast({ title, message });
  const updateFilters = <Key extends keyof Filters>(key: Key, value: Filters[Key]) =>
    setFilters((current) => ({ ...current, [key]: value }));
  const selectProject = (id: string) => {
    setSelectedId(id);
    setActiveView('catalog');
    const url = new URL(window.location.href);
    url.searchParams.set('project', id);
    window.history.replaceState(null, '', url);
  };

  const runAction = async (
    action: () => Promise<void>,
    title: string,
    message: string,
  ): Promise<boolean> => {
    if (actionInFlight.current || !session) return false;
    actionInFlight.current = true;
    setBusy(true);
    try {
      await action();
      await reload(session.user.id);
      showToast(title, message);
      return true;
    } catch (cause) {
      showToast(
        'Ação não concluída',
        friendlyProjectError(cause instanceof Error ? cause.message : 'Tente novamente.'),
      );
      return false;
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  };

  const requestJoin = () => {
    if (
      !selectedProject ||
      selectedProject.kind !== 'project' ||
      selectedProject.status !== 'FORMING' ||
      !profile
    )
      return;
    if (selectedProject.members.some((member) => member.memberId === profile.id)) return;
    if (selectedProject.members.length >= selectedProject.memberLimit) return;
    setJoinProjectId(selectedProject.id);
  };
  const connectDiscord = () => void discord.connect();
  const joinSelectedProject = (id: string, role: string, intent: string) =>
    void runAction(
      async () => {
        await requestProjectJoin(id, role, intent);
        setJoinProjectId(undefined);
      },
      'Solicitação enviada',
      `O líder da squad vai analisar sua solicitação para atuar como ${role}.`,
    );
  const decideJoinRequest = (requestId: string, decision: 'APPROVED' | 'REJECTED') =>
    runAction(
      () => decideProjectJoinRequest(requestId, decision),
      decision === 'APPROVED' ? 'Solicitação aprovada' : 'Solicitação rejeitada',
      decision === 'APPROVED'
        ? 'A pessoa agora faz parte da squad.'
        : 'A solicitação foi encerrada.',
    );
  const reuse = (id: string) => setCreationSourceId(id);
  const confirmReuse = (role: string, start?: string, end?: string): Promise<boolean> => {
    if (!creationSource) return Promise.resolve(false);
    return runAction(
      async () => {
        const id =
          creationSource.kind === 'template'
            ? await createProjectFromTemplate(creationSource.id, role, start, end)
            : await replicateProject(creationSource.id, role, start, end);
        selectProject(id);
      },
      'Projeto criado',
      'Uma nova squad foi criada e adicionada aos seus projetos.',
    );
  };
  const create = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (
      !projectForm.name.trim() ||
      !projectForm.shortDescription.trim() ||
      !projectForm.ownerParticipationRole ||
      !projectForm.recommendedAreas
        .split(',')
        .map((area) => area.trim())
        .includes(projectForm.ownerParticipationRole) ||
      !validProjectPlan(projectForm)
    )
      return;
    void runAction(
      async () => {
        selectProject(await createCommunityProject(projectForm));
        setProjectForm(defaultProjectForm);
      },
      'Projeto criado',
      'Seu projeto aguarda revisão e já aparece em Meus projetos.',
    );
  };
  const saveProfile = async (file?: File): Promise<boolean> => {
    if (!profileDraft || !profile) return false;
    return runAction(
      async () => {
        let uploaded: Awaited<ReturnType<typeof uploadAvatar>> | undefined;
        const oldPath = ownAvatarPath(profile.avatarUrl, profile.id);
        try {
          if (file) uploaded = await uploadAvatar(profile.id, file);
          await updateProfile({
            ...profileDraft,
            avatarUrl: uploaded?.url ?? profileDraft.avatarUrl,
          });
        } catch (cause) {
          if (uploaded) await deleteAvatar(uploaded.path).catch(() => {});
          throw cause;
        }
        if (oldPath && (uploaded || !profileDraft.avatarUrl))
          await deleteAvatar(oldPath).catch(() => {});
      },
      'Perfil atualizado',
      'Suas informações foram salvas.',
    );
  };
  const editProject = (id: string, input: Parameters<typeof updateProject>[1]) =>
    runAction(
      () => updateProject(id, input),
      'Projeto atualizado',
      projects.find((item) => item.id === id)?.moderationStatus === 'APPROVED' &&
        projects.find((item) => item.id === id)?.origin !== 'template'
        ? 'Alterações salvas. O projeto voltou para revisão.'
        : 'As informações da squad foram salvas.',
    );
  const changeProjectStatus = (
    id: string,
    target: Parameters<typeof transitionProject>[1],
    details: Parameters<typeof transitionProject>[2],
  ) =>
    runAction(
      async () => {
        await transitionProject(id, target, details);
        void processDiscordEvents(id)
          .then(() => {
            setDiscordRefresh((value) => value + 1);
            if (session) void reload(session.user.id).catch(() => {});
          })
          .catch(() => {});
      },
      'Projeto atualizado',
      target === 'ACTIVE'
        ? 'A squad iniciou o projeto.'
        : target === 'COMPLETED'
          ? 'Conclusão e evidências registradas.'
          : target === 'CANCELLED'
            ? 'O projeto foi cancelado.'
            : 'O projeto foi arquivado.',
    );
  const signOutUser = () =>
    void signOut().catch((cause) => showToast('Não foi possível sair', friendlyAuthError(cause)));

  if (!authReady) return <main className="app-loading">Carregando FocusAcademy...</main>;
  if (error && !session)
    return (
      <main className="app-loading">
        <p>{error}</p>
        <Button onClick={() => window.location.reload()}>Tentar novamente</Button>
      </main>
    );
  if (!session) return <AuthPage />;
  if (passwordRecovery) return <AuthPage recovery onRecovered={() => setPasswordRecovery(false)} />;
  if (error)
    return (
      <main className="app-loading">
        <p>{error}</p>
        <Button
          onClick={() => {
            setError('');
            setLoading(true);
            reload(session.user.id)
              .catch(() => setError('Não foi possível carregar os dados. Tente novamente.'))
              .finally(() => setLoading(false));
          }}
        >
          Tentar novamente
        </Button>
      </main>
    );
  if (loading || !profile || !profileDraft || !account || profile.id !== session.user.id)
    return <main className="app-loading">Carregando projetos...</main>;
  if (account.account_status === 'SUSPENDED')
    return (
      <main className="app-loading">
        <h1>Sua conta está temporariamente suspensa.</h1>
        {account.suspension_reason && <p>{account.suspension_reason}</p>}
        <Button onClick={signOutUser}>Sair</Button>
      </main>
    );
  const navigate = (view: View) => {
    if (view !== 'admin' || account.platform_role !== 'MEMBER') setActiveView(view);
  };

  return (
    <AppShell
      activeView={activeView}
      accountRole={account.platform_role}
      filters={filters}
      searchProjects={operationalCatalogue}
      onNavigate={navigate}
      onEditProfile={() => {
        setActiveView('profile');
        setProfileEditRequest((value) => value + 1);
      }}
      onQueryChange={(query) => updateFilters('query', query)}
      onSelectSearchProject={(id) => {
        setFilters(createEmptyFilters());
        selectProject(id);
      }}
      onViewAllSearch={() => {
        setFilters((current) => ({
          ...createEmptyFilters(),
          query: current.query,
        }));
        setActiveView('catalog');
      }}
      onSignOut={signOutUser}
      profile={profile}
    >
      {activeView === 'dashboard' && (
        <DashboardPage
          onNavigate={setActiveView}
          onSelectProject={selectProject}
          profile={profile}
          projects={catalogue}
        />
      )}
      {activeView === 'catalog' && (
        <CatalogPage
          canManageDiscord={account.platform_role === 'ADMIN'}
          discordRefresh={discordRefresh}
          discord={discord}
          busy={busy}
          filters={filters}
          onChangeFilters={updateFilters}
          onClearFilters={() => setFilters(createEmptyFilters())}
          onCreate={() => setActiveView('create')}
          onJoin={requestJoin}
          onConnectDiscord={connectDiscord}
          onDecideJoinRequest={(requestId, decision) => void decideJoinRequest(requestId, decision)}
          onLeave={(id) =>
            void runAction(() => leaveProject(id), 'Participação encerrada', 'Você saiu da squad.')
          }
          onEdit={editProject}
          onResubmit={(id) =>
            runAction(
              () => resubmitProject(id),
              'Enviado para revisão',
              'Seu projeto está aguardando análise.',
            )
          }
          onTransition={changeProjectStatus}
          onReuse={reuse}
          onSelect={selectProject}
          onCloseDetail={() => {
            setSelectedId('');
            const url = new URL(window.location.href);
            url.searchParams.delete('project');
            window.history.replaceState(null, '', url);
          }}
          profileId={profile.id}
          discordConnected={discordConnected}
          projectOptions={projectOptions}
          projects={visibleProjects}
          selectedProject={selectedProject}
        />
      )}
      {activeView === 'my-projects' && (
        <MyProjectsPage
          allProjects={catalogue}
          onExplore={() => setActiveView('catalog')}
          onSelect={selectProject}
          profile={profile}
        />
      )}
      {activeView === 'create' && (
        <CreateProjectPage
          busy={busy}
          onFormChange={setProjectForm}
          onReuseTemplate={reuse}
          onSubmit={create}
          projectForm={projectForm}
          areaOptions={skillOptions.areas}
          templates={templates}
        />
      )}
      {activeView === 'profile' && (
        <ProfilePage
          discord={discord}
          busy={busy}
          editRequest={profileEditRequest}
          onCancel={() => setProfileDraft(profile)}
          onChange={setProfileDraft}
          onSubmit={saveProfile}
          profile={profileDraft}
          gamification={gamification}
          savedProfile={profile}
          projects={catalogue}
          skillOptions={skillOptions}
        />
      )}
      {activeView === 'admin' && account.platform_role !== 'MEMBER' && (
        <Suspense fallback={<p role="status">Carregando administração...</p>}>
          <AdminPage
            role={account.platform_role}
            onOpenProject={selectProject}
            onChanged={() =>
              void reload(session.user.id).catch(() =>
                setError('Não foi possível carregar os dados. Tente novamente.'),
              )
            }
          />
        </Suspense>
      )}
      <JoinProjectModal
        busy={busy}
        defaultIntent={defaultJoinIntent}
        defaultRole={profile.primaryRole}
        onClose={() => setJoinProjectId(undefined)}
        onJoin={joinSelectedProject}
        open={Boolean(joinTarget)}
        project={joinTarget}
      />
      <ProjectPlanModal
        busy={busy}
        name={creationSource?.name}
        areas={creationSource?.recommendedAreas ?? []}
        onClose={() => setCreationSourceId(undefined)}
        onCreate={confirmReuse}
      />
      {toast && (
        <div className="toast" role="status">
          <span className="toast-icon">
            <Check size={17} />
          </span>
          <div>
            <strong>{toast.title}</strong>
            <span>{toast.message}</span>
          </div>
          <Button
            aria-label="Fechar aviso"
            icon={<X size={15} />}
            onClick={() => setToast(null)}
            size="icon"
            variant="ghost"
          />
        </div>
      )}
    </AppShell>
  );
}

export default App;
