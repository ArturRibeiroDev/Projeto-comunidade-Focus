import { BookOpen, BriefcaseBusiness, CirclePlus, LayoutDashboard, PanelLeftClose, PanelLeftOpen, RotateCcw, UserRound, X } from 'lucide-react';
import type { MemberProfile } from '../../types';
import type { View } from '../../viewTypes';
import { Button } from '../ui/Button';
import { FocusLogo } from './FocusLogo';

const navigation: Array<{ view: View; label: string; icon: typeof LayoutDashboard }> = [
  { view: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { view: 'catalog', label: 'Projetos', icon: BookOpen },
  { view: 'my-projects', label: 'Meus projetos', icon: BriefcaseBusiness },
  { view: 'create', label: 'Criar projeto', icon: CirclePlus },
  { view: 'profile', label: 'Perfil', icon: UserRound }
];

export function Sidebar({ activeView, compact, mobileOpen, profile, onNavigate, onToggleCompact, onCloseMobile, onRestore }: {
  activeView: View;
  compact: boolean;
  mobileOpen: boolean;
  profile: MemberProfile;
  onNavigate: (view: View) => void;
  onToggleCompact: () => void;
  onCloseMobile: () => void;
  onRestore: () => void;
}) {
  const navigate = (view: View) => {
    onNavigate(view);
    onCloseMobile();
  };

  return (
    <>
      {mobileOpen && <button aria-label="Fechar menu" className="sidebar-overlay" onClick={onCloseMobile} />}
      <aside className={`sidebar ${compact ? 'compact' : ''} ${mobileOpen ? 'mobile-open' : ''}`} aria-label="Navegação principal">
        <div className="sidebar-brand">
          <div className="expanded-logo"><FocusLogo /></div>
          <div className="compact-logo"><FocusLogo compact /></div>
          <Button aria-label="Fechar menu" className="mobile-close" icon={<X size={18} />} onClick={onCloseMobile} size="icon" variant="ghost" />
        </div>

        <nav className="nav-list">
          <p className="nav-label">FocusEdu</p>
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
        </nav>

        <div className="sidebar-footer">
          <button className="profile-mini" onClick={() => navigate('profile')} title="Abrir perfil">
            <img src={profile.avatarUrl} alt="" />
            <span className="profile-mini-copy">
              <strong>{profile.name}</strong>
              <small>{profile.primaryRole}</small>
            </span>
          </button>
          <Button aria-label="Restaurar dados iniciais" icon={<RotateCcw size={16} />} onClick={onRestore} size="icon" title="Restaurar dados iniciais" variant="ghost" />
        </div>

        <Button
          aria-label={compact ? 'Expandir navegação' : 'Recolher navegação'}
          className="sidebar-toggle"
          icon={compact ? <PanelLeftOpen size={15} /> : <PanelLeftClose size={15} />}
          onClick={onToggleCompact}
          size="icon"
          title={compact ? 'Expandir navegação' : 'Recolher navegação'}
        />
      </aside>
    </>
  );
}
