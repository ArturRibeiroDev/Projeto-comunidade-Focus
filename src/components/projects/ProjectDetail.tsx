import {
  Archive,
  CheckCircle2,
  CopyPlus,
  Link2,
  Pencil,
  Play,
  Send,
  UsersRound,
  XCircle,
} from 'lucide-react';
import { useEffect, useId, useState, type KeyboardEvent } from 'react';
import { ownerActions } from '../../domain/projectLifecycle';
import type { ProjectDisplay } from '../../types';
import {
  getProjectDiscordReadiness,
  type ProjectDiscordReadiness as DiscordReadiness,
  type ProjectEditInput,
} from '../../services/projectService';
import { Button } from '../ui/Button';
import { ProjectEditModal } from './ProjectEditModal';
import { ProjectDiscordSection } from './ProjectDiscordSection';
import { ProjectDiscordReadiness } from './ProjectDiscordReadiness';
import type { DiscordConnection } from '../../services/useDiscordIntegration';
import { ProjectJoinRequests } from './ProjectJoinRequests';
import {
  ProjectLifecycleModal,
  type LifecycleDetails,
  type LifecycleTarget,
} from './ProjectLifecycleModal';
import { ProjectDetailSections, projectDetailTabs, type DetailTab } from './ProjectDetailSections';
import { ModerationBadge, ProjectStatusBadge, ProjectTypeBadge } from './ProjectStatusBadge';

type PrimaryAction = 'reuse' | 'join' | 'member' | 'resubmit' | 'start' | 'complete' | null;

export function ProjectDetail({
  project,
  onMembersChanged,
  onOpenMember,
  profileId,
  discordConnected,
  canManageDiscord,
  discordRefresh,
  discord,
  onJoin,
  onConnectDiscord,
  onDecideJoinRequest,
  onReuse,
  onLeave,
  onEdit,
  onResubmit,
  onTransition,
  busy,
}: {
  project: ProjectDisplay;
  onMembersChanged?: () => Promise<void>;
  onOpenMember?: (key: string) => void;
  profileId: string;
  discordConnected: boolean;
  canManageDiscord: boolean;
  discordRefresh: number;
  discord: DiscordConnection;
  onJoin: () => void;
  onConnectDiscord: () => void;
  onDecideJoinRequest: (requestId: string, decision: 'APPROVED' | 'REJECTED') => void;
  onReuse: () => void;
  onLeave: () => void;
  onEdit: (input: ProjectEditInput) => Promise<boolean>;
  onResubmit: () => Promise<boolean>;
  onTransition: (target: LifecycleTarget, details: LifecycleDetails) => Promise<boolean>;
  busy: boolean;
}) {
  const [editOpen, setEditOpen] = useState(false);
  const [action, setAction] = useState<LifecycleTarget>();
  const [selectedTab, setSelectedTab] = useState<DetailTab>('overview');
  const [readiness, setReadiness] = useState<DiscordReadiness>();
  const [readinessError, setReadinessError] = useState('');
  const tabsId = useId();
  const panelId = `${tabsId}-panel`;
  const tabs = projectDetailTabs(project);
  const activeTab = tabs.some((tab) => tab.id === selectedTab) ? selectedTab : 'overview';

  const isOwner = project.kind === 'project' && project.ownerId === profileId;
  const canAdminCancel =
    project.kind === 'project' &&
    canManageDiscord &&
    !isOwner &&
    (project.status === 'FORMING' || project.status === 'ACTIVE');
  const actions = project.status ? ownerActions(project.status, isOwner) : [];
  const alreadyJoined = project.members.some((member) => member.memberId === profileId);
  const pendingRequest = project.joinRequests?.find(
    (request) => request.userId === profileId && request.status === 'PENDING',
  );
  const rejectedRequest = project.joinRequests?.find(
    (request) => request.userId === profileId && request.status === 'REJECTED',
  );
  const isFull = project.members.length >= project.memberLimit;
  const forming = project.kind === 'project' && project.status === 'FORMING';
  const canJoin = forming && project.moderationStatus === 'APPROVED' && !alreadyJoined;
  const canStart = actions.includes('start') && project.moderationStatus === 'APPROVED';
  const startReady = Boolean(
    !forming || !isOwner || (readiness && readiness.memberCount === readiness.readyCount),
  );
  const missingDiscordCount = readiness ? readiness.memberCount - readiness.readyCount : 0;
  const canReuse = project.kind === 'template' || project.status !== 'ARCHIVED';

  useEffect(() => {
    if (!forming || (!isOwner && !canManageDiscord)) {
      setReadiness(undefined);
      setReadinessError('');
      return;
    }
    let active = true;
    setReadinessError('');
    getProjectDiscordReadiness(project.id)
      .then((next) => {
        if (active) setReadiness(next);
      })
      .catch(() => {
        if (active) setReadinessError('Não foi possível verificar o Discord da squad.');
      });
    return () => {
      active = false;
    };
  }, [
    forming,
    isOwner,
    canManageDiscord,
    project.id,
    project.members.length,
    discordRefresh,
    discordConnected,
  ]);

  const ownReadiness: DiscordReadiness | undefined =
    forming && alreadyJoined && !isOwner && !canManageDiscord
      ? {
          memberCount: 1,
          readyCount: discordConnected ? 1 : 0,
          members: [
            {
              userId: profileId,
              name: project.members.find((member) => member.memberId === profileId)?.name ?? 'Você',
              avatarUrl: '',
              role: '',
              discordConnected,
            },
          ],
        }
      : undefined;

  let primaryAction: PrimaryAction = null;
  if (project.kind === 'template') primaryAction = 'reuse';
  else if (forming && alreadyJoined && !isOwner) primaryAction = 'member';
  else if (canJoin) primaryAction = 'join';
  else if (isOwner && project.moderationStatus === 'REJECTED') primaryAction = 'resubmit';
  else if (canStart) primaryAction = 'start';
  else if (actions.includes('complete')) primaryAction = 'complete';
  else if (canReuse) primaryAction = 'reuse';

  const hasSecondaryActions =
    (forming && alreadyJoined && !isOwner) ||
    actions.includes('edit') ||
    actions.includes('cancel') ||
    canAdminCancel ||
    actions.includes('archive') ||
    (canReuse && primaryAction !== 'reuse');

  const handleTabKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = tabs.findIndex((tab) => tab.id === activeTab);
    let nextIndex = currentIndex;
    if (event.key === 'ArrowRight') nextIndex = (currentIndex + 1) % tabs.length;
    else if (event.key === 'ArrowLeft') nextIndex = (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === 'Home') nextIndex = 0;
    else if (event.key === 'End') nextIndex = tabs.length - 1;
    else return;

    event.preventDefault();
    setSelectedTab(tabs[nextIndex].id);
    event.currentTarget.querySelectorAll<HTMLButtonElement>('[role="tab"]')[nextIndex]?.focus();
  };

  return (
    <aside className="project-detail" aria-label="Detalhes do projeto selecionado">
      <header className="detail-header">
        <div className="badge-row">
          <ProjectTypeBadge type={project.type} />
          {project.status && <ProjectStatusBadge status={project.status} />}
          {isOwner && <ModerationBadge status={project.moderationStatus} />}
        </div>
        <span className="detail-category">{project.category}</span>
        <h2>{project.name}</h2>
        <p>{project.shortDescription}</p>
        {isOwner && project.moderationStatus === 'REJECTED' && (
          <p className="detail-moderation-note">
            <strong>Motivo da revisão</strong>
            {project.moderationReason || 'Não informado.'}
          </p>
        )}
      </header>

      <div
        aria-label="Informações do item"
        className="detail-tabs"
        onKeyDown={handleTabKeyDown}
        role="tablist"
      >
        {tabs.map((tab) => (
          <button
            aria-controls={panelId}
            aria-selected={activeTab === tab.id}
            className={activeTab === tab.id ? 'active' : ''}
            id={`${tabsId}-${tab.id}`}
            key={tab.id}
            onClick={() => setSelectedTab(tab.id)}
            role="tab"
            tabIndex={activeTab === tab.id ? 0 : -1}
            type="button"
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div
        aria-labelledby={`${tabsId}-${activeTab}`}
        className="detail-panel"
        id={panelId}
        role="tabpanel"
        tabIndex={0}
      >
        <ProjectDetailSections
          onOpenMember={onOpenMember}
          project={project}
          profileId={profileId}
          onMembersChanged={onMembersChanged}
          tab={activeTab}
          alreadyJoined={alreadyJoined}
        />
        {activeTab === 'overview' && project.kind === 'project' && project.status && (
          <ProjectDiscordSection
            projectName={project.name}
            canManage={canManageDiscord || isOwner}
            refreshKey={discordRefresh}
            projectId={project.id}
            status={project.status}
            started={Boolean(project.startedAt)}
          />
        )}
        {activeTab === 'overview' && forming && (readiness || ownReadiness) && (
          <ProjectDiscordReadiness
            readiness={(readiness || ownReadiness)!}
            profileId={profileId}
            connection={discord}
            showCount={!ownReadiness}
          />
        )}
        {activeTab === 'overview' && readinessError && (
          <p className="field-error" role="alert">
            {readinessError}
          </p>
        )}
        {activeTab === 'overview' && discord.error && (
          <p className="field-error" role="alert">
            {discord.error}
          </p>
        )}
        {activeTab === 'overview' && forming && isOwner && (
          <ProjectJoinRequests
            onOpenMember={onOpenMember}
            busy={busy}
            onApprove={(requestId) => onDecideJoinRequest(requestId, 'APPROVED')}
            onReject={(requestId) => onDecideJoinRequest(requestId, 'REJECTED')}
            requests={project.joinRequests ?? []}
          />
        )}

        {activeTab === 'overview' && hasSecondaryActions && (
          <div className="detail-secondary-actions">
            <h3>Ações do projeto</h3>
            {forming && alreadyJoined && !isOwner && (
              <Button disabled={busy} onClick={onLeave}>
                Sair da squad
              </Button>
            )}
            {actions.includes('edit') && (
              <Button disabled={busy} icon={<Pencil size={16} />} onClick={() => setEditOpen(true)}>
                Editar projeto
              </Button>
            )}
            {actions.includes('cancel') && (
              <Button
                disabled={busy}
                icon={<XCircle size={16} />}
                onClick={() => setAction('CANCELLED')}
                variant="danger"
              >
                Cancelar projeto
              </Button>
            )}
            {canAdminCancel && (
              <div className="admin-action-block">
                <Button
                  disabled={busy}
                  icon={<XCircle size={16} />}
                  onClick={() => setAction('CANCELLED')}
                  variant="danger"
                >
                  Cancelar projeto
                </Button>
                <small>Ação administrativa</small>
              </div>
            )}
            {actions.includes('archive') && (
              <Button
                disabled={busy}
                icon={<Archive size={16} />}
                onClick={() => setAction('ARCHIVED')}
              >
                Arquivar projeto
              </Button>
            )}
            {canReuse && primaryAction !== 'reuse' && (
              <Button disabled={busy} icon={<CopyPlus size={16} />} onClick={onReuse}>
                Replicar projeto
              </Button>
            )}
          </div>
        )}
      </div>

      {primaryAction && (
        <div className="detail-primary-actions">
          {primaryAction === 'reuse' && (
            <Button
              disabled={busy}
              icon={<CopyPlus size={17} />}
              onClick={onReuse}
              variant="primary"
            >
              {project.kind === 'template' ? 'Usar esta ideia' : 'Replicar projeto'}
            </Button>
          )}
          {primaryAction === 'join' && (
            <>
              {!discordConnected ? (
                <Button
                  disabled={busy || discord.pending || discord.loading}
                  icon={<Link2 size={17} />}
                  onClick={
                    discord.status === 'error' ? () => void discord.retry() : onConnectDiscord
                  }
                  variant="primary"
                >
                  {discord.pending
                    ? 'Conectando...'
                    : discord.loading
                      ? 'Verificando Discord...'
                      : discord.status === 'error'
                        ? 'Verificar conexão'
                        : discord.error
                          ? 'Tentar novamente'
                          : 'Conectar meu Discord'}
                </Button>
              ) : pendingRequest ? (
                <Button disabled icon={<UsersRound size={17} />} variant="primary">
                  Solicitação pendente
                </Button>
              ) : (
                <Button
                  disabled={busy || isFull}
                  icon={<Send size={17} />}
                  onClick={onJoin}
                  variant="primary"
                >
                  {isFull ? 'Squad completa' : 'Solicitar entrada'}
                </Button>
              )}
              {rejectedRequest && !pendingRequest && (
                <p className="detail-note">Sua solicitação anterior foi rejeitada.</p>
              )}
            </>
          )}
          {primaryAction === 'member' && (
            <Button disabled icon={<UsersRound size={17} />} variant="primary">
              Você faz parte da squad
            </Button>
          )}
          {primaryAction === 'resubmit' && (
            <Button disabled={busy} onClick={() => void onResubmit()} variant="primary">
              Enviar novamente para revisão
            </Button>
          )}
          {primaryAction === 'start' && (
            <>
              <Button
                disabled={busy || !startReady}
                icon={<Play size={17} />}
                onClick={() => setAction('ACTIVE')}
                variant="primary"
              >
                Iniciar projeto
              </Button>
              {!startReady && missingDiscordCount > 0 && (
                <p className="detail-action-note">
                  Todos os membros precisam conectar o Discord antes de iniciar.
                </p>
              )}
            </>
          )}
          {primaryAction === 'complete' && (
            <Button
              disabled={busy}
              icon={<CheckCircle2 size={17} />}
              onClick={() => setAction('COMPLETED')}
              variant="primary"
            >
              Concluir projeto
            </Button>
          )}
        </div>
      )}

      {project.kind === 'project' && (
        <ProjectEditModal
          busy={busy}
          onClose={() => setEditOpen(false)}
          onSave={onEdit}
          open={editOpen}
          project={project}
        />
      )}
      {project.kind === 'project' && (
        <ProjectLifecycleModal
          busy={busy}
          onClose={() => setAction(undefined)}
          onConfirm={onTransition}
          projectName={project.name}
          target={action}
          administrative={canAdminCancel && action === 'CANCELLED'}
        />
      )}
    </aside>
  );
}
