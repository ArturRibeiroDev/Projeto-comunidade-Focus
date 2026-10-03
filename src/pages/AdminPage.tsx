import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { Archive, Check, Pencil, RotateCcw, Search, ShieldAlert, X } from 'lucide-react';
import type { PlatformRole } from '../types';
import { getSupabase } from '../lib/supabase';
import {
  getAdminAudit,
  getAdminOverview,
  getAdminDiscordOverview,
  getAdminProjects,
  getAdminSettings,
  getAdminTemplateSkills,
  getAdminTemplates,
  getAdminUsers,
  moderateProject,
  saveAdminTemplate,
  setAdminTemplateArchived,
  setAdminUser,
  updateAdminSettings,
  type AdminAudit,
  type AdminOverview,
  type AdminDiscordOverview,
  type AdminProject,
  type AdminSettings,
  type AdminTemplate,
  type AdminUser,
} from '../services/adminService';
import { formatDate } from '../utils/format';
import { toList } from '../utils/format';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PageHeader } from '../components/ui/PageHeader';

type Tab = 'overview' | 'users' | 'projects' | 'templates' | 'settings' | 'audit';
type TemplateDraft = {
  name: string;
  description: string;
  category: string;
  problem: string;
  objective: string;
  suggested_features: string;
  acceptance_criteria: string;
  difficulty: string;
  recommended_max_members: number;
  suggested_composition: string;
  possible_stacks: string;
  outcomes: string;
  audience: string;
  technologies: string;
  areas: string;
};
const blankTemplate: TemplateDraft = {
  name: '',
  description: '',
  category: 'Comunidade',
  problem: '',
  objective: '',
  suggested_features: '',
  acceptance_criteria: '',
  difficulty: 'Misto',
  recommended_max_members: 5,
  suggested_composition: '',
  possible_stacks: '',
  outcomes: '',
  audience: '',
  technologies: '',
  areas: '',
};
const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'overview', label: 'Visão geral' },
  { id: 'users', label: 'Usuários' },
  { id: 'projects', label: 'Projetos' },
  { id: 'templates', label: 'Templates' },
  { id: 'settings', label: 'Configurações' },
  { id: 'audit', label: 'Auditoria' },
];

export function AdminPage({
  role,
  onOpenProject,
  onChanged,
}: {
  role: PlatformRole;
  onOpenProject: (id: string) => void;
  onChanged: () => void;
}) {
  const [tab, setTab] = useState<Tab>(role === 'MODERATOR' ? 'projects' : 'overview');
  const [overview, setOverview] = useState<AdminOverview>();
  const [discordOverview, setDiscordOverview] = useState<AdminDiscordOverview>();
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [templates, setTemplates] = useState<AdminTemplate[]>([]);
  const [settings, setSettings] = useState<AdminSettings>();
  const [audit, setAudit] = useState<AdminAudit[]>([]);
  const [busy, setBusy] = useState(false);
  const actionInFlight = useRef(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [moderationFilter, setModerationFilter] = useState('ALL');
  const [originFilter, setOriginFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('');
  const [reasonAction, setReasonAction] = useState<{
    id: string;
    action: 'REJECTED' | 'CANCELLED' | 'SUSPENDED';
  }>();
  const [reason, setReason] = useState('');
  const [profileDetail, setProfileDetail] = useState<Record<string, unknown>>();
  const [editingTemplate, setEditingTemplate] = useState<string | null | undefined>();
  const [templateDraft, setTemplateDraft] = useState<TemplateDraft>(blankTemplate);

  const load = async (current: Tab) => {
    setLoading(true);
    setError('');
    try {
      if (current === 'overview') {
        const [nextOverview, nextDiscord] = await Promise.all([
          getAdminOverview(),
          getAdminDiscordOverview(),
        ]);
        setOverview(nextOverview);
        setDiscordOverview(nextDiscord);
      }
      if (current === 'users') setUsers(await getAdminUsers());
      if (current === 'projects') setProjects(await getAdminProjects());
      if (current === 'templates') setTemplates(await getAdminTemplates());
      if (current === 'settings') setSettings(await getAdminSettings());
      if (current === 'audit') setAudit(await getAdminAudit());
    } catch {
      setError('Não foi possível carregar dados administrativos.');
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load(tab);
  }, [tab]);

  const act = async (operation: () => Promise<unknown>, success: string) => {
    if (actionInFlight.current) return;
    actionInFlight.current = true;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      await operation();
      setNotice(success);
      await load(tab);
      onChanged();
    } catch {
      setError('Operação não concluída. Verifique os dados e sua permissão e tente novamente.');
    } finally {
      actionInFlight.current = false;
      setBusy(false);
    }
  };
  const showProfile = async (userId: string) => {
    const { data, error: readError } = await getSupabase()
      .from('profiles')
      .select('name,avatar_url,bio,main_role,availability,github_url,linkedin_url')
      .eq('id', userId)
      .single();
    if (readError) setError('Não foi possível carregar este perfil.');
    else setProfileDetail(data as Record<string, unknown>);
  };
  const filteredUsers = users.filter((user) =>
    `${user.name} ${user.email}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()),
  );
  const filteredProjects = useMemo(
    () =>
      projects.filter(
        (project) =>
          `${project.name} ${project.owner_name}`
            .toLocaleLowerCase()
            .includes(search.toLocaleLowerCase()) &&
          (statusFilter === 'ALL' || project.status === statusFilter) &&
          (moderationFilter === 'ALL' || project.moderation_status === moderationFilter) &&
          (originFilter === 'ALL' || project.origin === originFilter) &&
          (!dateFilter || project.created_at.slice(0, 10) === dateFilter),
      ),
    [projects, search, statusFilter, moderationFilter, originFilter, dateFilter],
  );

  const editTemplate = async (item?: AdminTemplate) => {
    let skills = { technologies: [] as string[], areas: [] as string[] };
    if (item) {
      try {
        skills = await getAdminTemplateSkills(item.id);
      } catch {
        setError('Não foi possível carregar as skills do template.');
        return;
      }
    }
    setEditingTemplate(item?.id ?? null);
    setTemplateDraft(
      item
        ? {
            name: item.name,
            description: item.description,
            category: item.category,
            problem: item.problem,
            objective: item.objective,
            suggested_features: item.suggested_features.join(', '),
            acceptance_criteria: item.acceptance_criteria.join(', '),
            difficulty: item.difficulty,
            recommended_max_members: item.recommended_max_members,
            suggested_composition: item.suggested_composition
              .map((entry) => `${entry.role}:${entry.amount}`)
              .join(', '),
            possible_stacks: item.possible_stacks.join(', '),
            outcomes: item.outcomes.join(', '),
            audience: item.audience,
            technologies: skills.technologies.join(', '),
            areas: skills.areas.join(', '),
          }
        : blankTemplate,
    );
  };
  const saveTemplate = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const composition = toList(templateDraft.suggested_composition).map((entry) => {
      const [role, amount] = entry.split(':');
      return { role: role.trim(), amount: Number(amount) || 1 };
    });
    void act(async () => {
      await saveAdminTemplate(editingTemplate ?? null, {
        ...templateDraft,
        suggested_features: toList(templateDraft.suggested_features),
        acceptance_criteria: toList(templateDraft.acceptance_criteria),
        suggested_composition: composition,
        possible_stacks: toList(templateDraft.possible_stacks),
        outcomes: toList(templateDraft.outcomes),
        technologies: toList(templateDraft.technologies),
        areas: toList(templateDraft.areas),
      });
      setEditingTemplate(undefined);
    }, 'Template salvo.');
  };

  return (
    <div className="page-stack admin-page">
      <PageHeader
        eyebrow="FocusAcademy"
        title={role === 'MODERATOR' ? 'Moderação' : 'Administração'}
        description="Operações da plataforma e histórico de decisões."
      />
      <div className="admin-tabs" role="tablist" aria-label="Administração">
        {(role === 'ADMIN' ? tabs : tabs.filter((item) => item.id === 'projects')).map((item) => (
          <button
            aria-selected={tab === item.id}
            className={tab === item.id ? 'active' : ''}
            key={item.id}
            onClick={() => {
              setSearch('');
              setTab(item.id);
            }}
            role="tab"
          >
            {item.label}
          </button>
        ))}
      </div>
      {loading && <p className="muted-copy">Carregando...</p>}
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}

      {tab === 'overview' && overview && !loading && (
        <>
          <div className="admin-metrics">
            {(
              [
                ['Usuários', overview.users, 'users'],
                ['Projetos em formação', overview.forming, 'projects'],
                ['Projetos ativos', overview.active, 'projects'],
                ['Concluídos', overview.completed, 'projects'],
                ['Pendentes de moderação', overview.pending, 'projects'],
                ['Cancelados', overview.cancelled, 'projects'],
                ['Usuários suspensos', overview.suspended, 'users'],
              ] as const
            ).map(([label, value, destination]) => (
              <button
                className="admin-metric"
                key={label}
                onClick={() => {
                  setStatusFilter('ALL');
                  setModerationFilter(label === 'Pendentes de moderação' ? 'PENDING' : 'ALL');
                  setTab(destination);
                }}
              >
                <strong>{value}</strong>
                <span>{label}</span>
              </button>
            ))}
          </div>
          {discordOverview && (
            <section className="admin-section">
              <h2>Discord</h2>
              <p className="muted-copy">
                {discordOverview.connectedUsers} pessoas conectadas ·{' '}
                {discordOverview.connectedProjects} projetos com canal ·{' '}
                {discordOverview.pendingEvents} pendentes · {discordOverview.processingEvents}{' '}
                processando · {discordOverview.completedEvents} concluídos ·{' '}
                {discordOverview.failedEvents} falhas ({discordOverview.retryableFailedEvents} com
                retry, {discordOverview.finalFailedEvents} finais)
              </p>
              {(discordOverview.latestEvents ?? []).length > 0 && (
                <div className="admin-list">
                  {(discordOverview.latestEvents ?? []).map((event) => (
                    <article className="admin-row" key={event.id}>
                      <div>
                        <strong>
                          {event.eventType} · {event.status}
                        </strong>
                        <p className="muted-copy">
                          Tentativas: {event.attempts} · Última:{' '}
                          {event.lastAttemptedAt ? formatDate(event.lastAttemptedAt) : 'nunca'} ·
                          Próxima: {event.nextAttemptAt ? formatDate(event.nextAttemptAt) : '-'}
                        </p>
                        {event.lastError && <p className="field-error">{event.lastError}</p>}
                      </div>
                      <Button variant="ghost" onClick={() => onOpenProject(event.projectId)}>
                        Abrir
                      </Button>
                    </article>
                  ))}
                </div>
              )}
            </section>
          )}
        </>
      )}

      {tab === 'users' && !loading && (
        <section className="admin-section">
          <div className="admin-toolbar">
            <label className="admin-search">
              <Search size={16} />
              <input
                aria-label="Buscar usuários"
                placeholder="Buscar nome ou email"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
          </div>
          <div className="admin-list">
            {filteredUsers.map((user) => (
              <article className="admin-row" key={user.user_id}>
                <img
                  className="admin-avatar"
                  src={
                    user.avatar_url ||
                    `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(user.name)}`
                  }
                  alt=""
                />
                <div className="admin-row-main">
                  <strong>{user.name}</strong>
                  <small>{user.email}</small>
                  <small>
                    Entrou em {formatDate(user.created_at)} · {user.active_projects} projetos ativos
                  </small>
                </div>
                <div className="admin-row-status">
                  <Badge tone={user.platform_role === 'ADMIN' ? 'orange' : 'zinc'}>
                    {user.platform_role}
                  </Badge>
                  <Badge tone={user.account_status === 'SUSPENDED' ? 'red' : 'green'}>
                    {user.account_status === 'SUSPENDED' ? 'Suspenso' : 'Ativo'}
                  </Badge>
                </div>
                <div className="admin-row-actions">
                  <Button
                    disabled={busy}
                    onClick={() => void showProfile(user.user_id)}
                    size="small"
                  >
                    Ver perfil
                  </Button>
                  {user.platform_role !== 'ADMIN' && (
                    <>
                      <label className="sr-only" htmlFor={`role-${user.user_id}`}>
                        Papel de {user.name}
                      </label>
                      <select
                        disabled={busy}
                        id={`role-${user.user_id}`}
                        value={user.platform_role}
                        onChange={(event) =>
                          void act(
                            () =>
                              setAdminUser(
                                user.user_id,
                                event.target.value as 'MEMBER' | 'MODERATOR',
                              ),
                            'Papel atualizado.',
                          )
                        }
                      >
                        <option value="MEMBER">MEMBER</option>
                        <option value="MODERATOR">MODERATOR</option>
                      </select>
                      <Button
                        disabled={busy}
                        icon={
                          user.account_status === 'SUSPENDED' ? (
                            <RotateCcw size={15} />
                          ) : (
                            <ShieldAlert size={15} />
                          )
                        }
                        onClick={() =>
                          user.account_status === 'SUSPENDED'
                            ? void act(
                                () => setAdminUser(user.user_id, undefined, 'ACTIVE'),
                                'Usuário reativado.',
                              )
                            : (setReasonAction({ id: user.user_id, action: 'SUSPENDED' }),
                              setReason(''))
                        }
                        size="small"
                        variant={user.account_status === 'SUSPENDED' ? 'secondary' : 'danger'}
                      >
                        {user.account_status === 'SUSPENDED' ? 'Reativar' : 'Suspender'}
                      </Button>
                    </>
                  )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'projects' && !loading && (
        <section className="admin-section">
          <div className="admin-toolbar">
            <label className="admin-search">
              <Search size={16} />
              <input
                aria-label="Buscar projetos administrativos"
                placeholder="Projeto ou owner"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </label>
            <select
              aria-label="Filtrar lifecycle"
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
            >
              <option value="ALL">Todos os status</option>
              {['FORMING', 'ACTIVE', 'COMPLETED', 'CANCELLED', 'ARCHIVED'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              aria-label="Filtrar moderação"
              value={moderationFilter}
              onChange={(event) => setModerationFilter(event.target.value)}
            >
              <option value="ALL">Toda moderação</option>
              {['PENDING', 'APPROVED', 'REJECTED'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
            <select
              aria-label="Filtrar tipo"
              value={originFilter}
              onChange={(event) => setOriginFilter(event.target.value)}
            >
              <option value="ALL">Todos os tipos</option>
              <option value="community">Community</option>
              <option value="template">Template</option>
              <option value="replica">Réplica</option>
            </select>
            <input
              aria-label="Filtrar data de criação"
              type="date"
              value={dateFilter}
              onChange={(event) => setDateFilter(event.target.value)}
            />
          </div>
          <div className="admin-list">
            {filteredProjects.map((project) => (
              <article className="admin-row" key={project.id}>
                <div className="admin-row-main">
                  <strong>{project.name}</strong>
                  <small>
                    {project.owner_name} · {project.origin} · {project.members} membros ·{' '}
                    {formatDate(project.created_at)}
                  </small>
                  {project.moderation_reason && <small>Motivo: {project.moderation_reason}</small>}
                </div>
                <div className="admin-row-status">
                  <Badge>{project.status}</Badge>
                  <Badge
                    tone={
                      project.moderation_status === 'PENDING'
                        ? 'amber'
                        : project.moderation_status === 'REJECTED'
                          ? 'red'
                          : 'green'
                    }
                  >
                    {project.moderation_status}
                  </Badge>
                </div>
                <div className="admin-row-actions">
                  <Button onClick={() => onOpenProject(project.id)} size="small">
                    Abrir
                  </Button>
                  {project.origin !== 'template' && project.moderation_status === 'PENDING' && (
                    <>
                      <Button
                        disabled={busy}
                        icon={<Check size={15} />}
                        onClick={() =>
                          void act(
                            () => moderateProject(project.id, 'APPROVED'),
                            'Projeto aprovado.',
                          )
                        }
                        size="small"
                        variant="primary"
                      >
                        Aprovar
                      </Button>
                      <Button
                        disabled={busy}
                        icon={<X size={15} />}
                        onClick={() => {
                          setReasonAction({ id: project.id, action: 'REJECTED' });
                          setReason('');
                        }}
                        size="small"
                        variant="danger"
                      >
                        Rejeitar
                      </Button>
                    </>
                  )}
                  {project.origin !== 'template' &&
                    ['FORMING', 'ACTIVE'].includes(project.status) && (
                      <Button
                        disabled={busy}
                        icon={<ShieldAlert size={15} />}
                        onClick={() => {
                          setReasonAction({ id: project.id, action: 'CANCELLED' });
                          setReason('');
                        }}
                        size="small"
                        variant="danger"
                      >
                        Moderar
                      </Button>
                    )}
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'templates' && !loading && (
        <section className="admin-section">
          <div className="admin-toolbar">
            <Button onClick={() => void editTemplate()} variant="primary">
              Criar template Focus
            </Button>
          </div>
          <div className="admin-list">
            {templates.map((item) => (
              <article className="admin-row" key={item.id}>
                <div className="admin-row-main">
                  <strong>{item.name}</strong>
                  <small>{item.description}</small>
                </div>
                <Badge tone={item.archived ? 'zinc' : 'orange'}>
                  {item.archived ? 'Arquivado' : 'Oficial'}
                </Badge>
                <div className="admin-row-actions">
                  <Button
                    icon={<Pencil size={15} />}
                    onClick={() => void editTemplate(item)}
                    size="small"
                  >
                    Editar
                  </Button>
                  <Button
                    disabled={busy}
                    icon={item.archived ? <RotateCcw size={15} /> : <Archive size={15} />}
                    onClick={() =>
                      void act(
                        () => setAdminTemplateArchived(item.id, !item.archived),
                        item.archived ? 'Template restaurado.' : 'Template arquivado.',
                      )
                    }
                    size="small"
                  >
                    {item.archived ? 'Restaurar' : 'Arquivar'}
                  </Button>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === 'settings' && settings && !loading && (
        <form
          className="admin-settings structured-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (
              Math.max(
                settings.max_owned_open_projects_per_user,
                settings.max_project_creations_per_day,
                settings.max_projects_joined_simultaneously,
              ) > 20 &&
              !window.confirm('Um dos limites excede 20. Confirmar?')
            )
              return;
            void act(() => updateAdminSettings(settings), 'Limites atualizados.');
          }}
        >
          <label className="field">
            <span>Limite de projetos próprios ativos</span>
            <input
              required
              min={0}
              max={50}
              type="number"
              value={settings.max_owned_open_projects_per_user}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  max_owned_open_projects_per_user: Number(event.target.value),
                })
              }
            />
          </label>
          <label className="field">
            <span>Criações por 24h</span>
            <input
              required
              min={0}
              max={50}
              type="number"
              value={settings.max_project_creations_per_day}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  max_project_creations_per_day: Number(event.target.value),
                })
              }
            />
          </label>
          <label className="field">
            <span>Participações simultâneas</span>
            <input
              required
              min={0}
              max={50}
              type="number"
              value={settings.max_projects_joined_simultaneously}
              onChange={(event) =>
                setSettings({
                  ...settings,
                  max_projects_joined_simultaneously: Number(event.target.value),
                })
              }
            />
          </label>
          <div className="field-wide">
            <Button disabled={busy} type="submit" variant="primary">
              {busy ? 'Salvando...' : 'Salvar'}
            </Button>
          </div>
        </form>
      )}

      {tab === 'audit' && !loading && (
        <div className="admin-list">
          {audit.map((entry) => (
            <article className="admin-row" key={entry.id}>
              <div className="admin-row-main">
                <strong>
                  {entry.actor_name} · {entry.action}
                </strong>
                <small>
                  {entry.target_type}: {entry.target_id}
                </small>
              </div>
              <time>{formatDate(entry.created_at)}</time>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(reasonAction)}
        title={
          reasonAction?.action === 'SUSPENDED'
            ? 'Suspender usuário'
            : reasonAction?.action === 'REJECTED'
              ? 'Rejeitar projeto'
              : 'Cancelar projeto abusivo'
        }
        onClose={busy ? () => {} : () => setReasonAction(undefined)}
      >
        <form
          className="lifecycle-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (!reasonAction || !reason.trim()) return;
            const { id, action } = reasonAction;
            void act(async () => {
              if (action === 'SUSPENDED') await setAdminUser(id, undefined, 'SUSPENDED', reason);
              else await moderateProject(id, action, reason);
              setReasonAction(undefined);
            }, 'Decisão registrada.');
          }}
        >
          <label className="field">
            <span>Motivo</span>
            <textarea
              required
              maxLength={500}
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
            />
          </label>
          <div className="modal-actions">
            <Button disabled={busy} onClick={() => setReasonAction(undefined)}>
              Voltar
            </Button>
            <Button disabled={busy || !reason.trim()} type="submit" variant="danger">
              Confirmar
            </Button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(profileDetail)}
        title={String(profileDetail?.name ?? 'Perfil')}
        onClose={() => setProfileDetail(undefined)}
      >
        {profileDetail && (
          <div className="admin-profile">
            <img
              className="admin-avatar"
              src={String(
                profileDetail.avatar_url ||
                  `https://api.dicebear.com/9.x/initials/svg?seed=${encodeURIComponent(String(profileDetail.name || 'Focus'))}`,
              )}
              alt=""
            />
            <p>{String(profileDetail.bio || 'Sem bio.')}</p>
            <p>Função: {String(profileDetail.main_role || 'Outra')}</p>
            <p>Disponibilidade: {String(profileDetail.availability || 'Não informada')}</p>
          </div>
        )}
      </Modal>

      <Modal
        open={editingTemplate !== undefined}
        title={editingTemplate ? 'Editar template Focus' : 'Criar template Focus'}
        onClose={busy ? () => {} : () => setEditingTemplate(undefined)}
      >
        <form className="lifecycle-form admin-template-form" onSubmit={saveTemplate}>
          {(
            [
              ['name', 'Nome'],
              ['description', 'Descrição'],
              ['category', 'Categoria'],
              ['problem', 'Problema'],
              ['objective', 'Objetivo'],
              ['audience', 'Público'],
            ] as const
          ).map(([key, label]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <input
                required={key === 'name' || key === 'description'}
                value={templateDraft[key]}
                onChange={(event) =>
                  setTemplateDraft({ ...templateDraft, [key]: event.target.value })
                }
              />
            </label>
          ))}
          <label className="field">
            <span>Dificuldade</span>
            <select
              value={templateDraft.difficulty}
              onChange={(event) =>
                setTemplateDraft({ ...templateDraft, difficulty: event.target.value })
              }
            >
              {['Iniciante', 'Intermediário', 'Avançado', 'Misto'].map((value) => (
                <option key={value}>{value}</option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Máximo recomendado de membros</span>
            <input
              required
              min={2}
              max={50}
              type="number"
              value={templateDraft.recommended_max_members}
              onChange={(event) =>
                setTemplateDraft({
                  ...templateDraft,
                  recommended_max_members: Number(event.target.value),
                })
              }
            />
          </label>
          {(
            [
              ['suggested_features', 'Funcionalidades'],
              ['acceptance_criteria', 'Critérios de entrega'],
              ['areas', 'Áreas sugeridas'],
              ['technologies', 'Tecnologias'],
              ['suggested_composition', 'Composição (Função:quantidade)'],
              ['possible_stacks', 'Stacks possíveis'],
              ['outcomes', 'Entregáveis'],
            ] as const
          ).map(([key, label]) => (
            <label className="field" key={key}>
              <span>{label}</span>
              <input
                value={templateDraft[key]}
                onChange={(event) =>
                  setTemplateDraft({ ...templateDraft, [key]: event.target.value })
                }
              />
            </label>
          ))}
          <div className="modal-actions">
            <Button disabled={busy} onClick={() => setEditingTemplate(undefined)}>
              Cancelar
            </Button>
            <Button disabled={busy} type="submit" variant="primary">
              {busy ? 'Salvando...' : 'Salvar template'}
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
