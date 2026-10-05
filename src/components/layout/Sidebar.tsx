import {
  BookOpen,
  BriefcaseBusiness,
  CirclePlus,
  LayoutDashboard,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  UserRound,
  Users,
  X,
} from 'lucide-react';
import type { MemberProfile, PlatformRole } from '../../types';
import type { View } from '../../viewTypes';
import { Button } from '../ui/Button';
import { FocusLogo } from './FocusLogo';
import { Avatar } from '../ui/Avatar';

const navigation: Array<{ view: View; label: string; icon: typeof LayoutDashboard }> = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'catalog', label: 'Projetos', icon: BookOpen },
  { view: 'my-projects', label: 'Meus projetos', icon: BriefcaseBusiness },
  { view: 'create', label: 'Criar projeto', icon: CirclePlus },
  { view: 'community', label: 'Comunidade', icon: Users },
  { view: 'profile', label: 'Perfil', icon: UserRound },
];

export function Sidebar({
  activeView,
  accountRole,
  compact,
  mobileOpen,
  profile,
  sidebarWidth,
  onNavigate,
  onToggleCompact,
  onStartResize,
  onResize,
  onCloseMobile,
  onSignOut,
}: {
  activeView: View;
  accountRole: PlatformRole;
  compact: boolean;
  mobileOpen: boolean;
  profile: MemberProfile;
  sidebarWidth: number;
  onNavigate: (view: View) => void;
  onToggleCompact: () => void;
  onStartResize: () => void;
  onResize: (width: number) => void;
  onCloseMobile: () => void;
  onSignOut: () => void;
}) {
  const navigate = (view: View) => {
    onNavigate(view);
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen && (
        <button aria-label="Fechar menu" className="sidebar-overlay" onClick={onCloseMobile} />
      )}
      <aside
        className={`sidebar ${compact ? 'compact' : ''} ${mobileOpen ? 'mobile-open' : ''}`}
        aria-label="Navegação principal"
      >
        <div className="sidebar-brand">
          <button
            aria-label="Ir para Dashboard"
            className="expanded-logo logo-home"
            onClick={() => navigate('dashboard')}
            title="Ir para Dashboard"
          >
            <FocusLogo />
          </button>
          <button
            aria-label="Ir para Dashboard"
            className="compact-logo logo-home"
            onClick={() => navigate('dashboard')}
            title="Ir para Dashboard"
          >
            <FocusLogo compact />
          </button>
          <Button
            aria-label="Fechar menu"
            className="mobile-close"
            icon={<X size={18} />}
            onClick={onCloseMobile}
            size="icon"
            variant="ghost"
          />
        </div>

        <nav className="nav-list">
          <p className="nav-label">Focus Academy</p>
          {navigation.map((item) => {
            const Icon = item.icon;
            const active = activeView === item.view;
            return (
              <button
                aria-current={active ? 'page' : undefined}
                className={`nav-item ${active ? 'active' : ''}`}
                key={item.view}
                onClick={() => navigate(item.view)}
                title={compact ? item.label : undefined}
              >
                <Icon aria-hidden="true" size={18} />
                <span>{item.label}</span>
              </button>
            );
          })}
          {accountRole !== 'MEMBER' && (
            <>
              <p className="nav-label">Administração</p>
              <button
                aria-current={activeView === 'admin' ? 'page' : undefined}
                className={`nav-item ${activeView === 'admin' ? 'active' : ''}`}
                onClick={() => navigate('admin')}
                title={
                  compact
                    ? accountRole === 'MODERATOR'
                      ? 'Moderação'
                      : 'Administração'
                    : undefined
                }
              >
                <Shield aria-hidden="true" size={18} />
                <span>{accountRole === 'MODERATOR' ? 'Moderação' : 'Administração'}</span>
              </button>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <button className="profile-mini" onClick={() => navigate('profile')} title="Abrir perfil">
            <Avatar src={profile.avatarUrl} name={profile.name} />
            <span className="profile-mini-copy">
              <strong>{profile.name}</strong>
              <small>{profile.primaryRole}</small>
            </span>
          </button>
          <Button
            aria-label="Sair"
            icon={<LogOut size={16} />}
            onClick={onSignOut}
            size="icon"
            title="Sair"
            variant="ghost"
          />
        </div>

        <Button
          aria-label={compact ? 'Expandir navegação' : 'Recolher navegação'}
          className="sidebar-toggle"
          icon={compact ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          onClick={onToggleCompact}
          size="icon"
          title={compact ? 'Expandir navegação' : 'Recolher navegação'}
        />
        {!compact && (
          <div
            aria-label="Largura da navegação"
            aria-orientation="vertical"
            aria-valuemax={336}
            aria-valuemin={196}
            aria-valuenow={sidebarWidth}
            className="sidebar-resize-handle"
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                event.preventDefault();
                onResize(sidebarWidth + (event.key === 'ArrowRight' ? 12 : -12));
              }
              if (event.key === 'Home' || event.key === 'End') {
                event.preventDefault();
                onResize(event.key === 'Home' ? 196 : 336);
              }
            }}
            onPointerDown={(event) => {
              if (event.pointerType === 'mouse' && event.button !== 0) return;
              event.preventDefault();
              onStartResize();
            }}
            role="separator"
            tabIndex={0}
          />
        )}
      </aside>
    </>
  );
}
